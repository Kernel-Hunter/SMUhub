import { Router, type RequestHandler } from 'express'
import multer from 'multer'
import { pipeline } from 'node:stream/promises'
import { isValidObjectId, type Types } from 'mongoose'
import { z } from 'zod'
import { HttpError } from '../lib/errors.js'
import { isCourseCode } from '../lib/courses.js'
import { CONTENT_TYPES, FILE_RULES, checkFile, deleteFile, filesBucket, safeFileName, saveFile, sha256 } from '../lib/files.js'
import { notify } from '../lib/notify.js'
import { serialize } from '../lib/serial.js'
import { loadPeople, personOr } from '../lib/people.js'
import { DAY, XP_RULES, award, compensate } from '../lib/xp.js'
import { Download, RESOURCE_KINDS, Rating, Resource } from '../models/Resource.js'
import { UploadLog } from '../models/UploadLog.js'

/**
 * Resources library, mounted at /api/resources behind requireAuth (see app.ts).
 * Same rules as docs/BACKEND.md: allowed types checked on the bytes,
 * 10 KB to 25 MB, SHA-256 duplicates refused, 5 uploads per student per 24 h (counted in UploadLog, so deleting a file
 * gives no upload back), one upload in flight per student; rate only what you downloaded, never your own file, once.
 * Each rating pays the uploader through award(); the third rating that paid XP verifies the file (bonus from 'system').
 * Removing a file takes back the XP it earned with a compensating ledger row (compensate()).
 */

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim()
const block = (s: string) => s.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim()
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const isDuplicateKey = (err: unknown) => (err as { code?: number } | null)?.code === 11000

const meta = z.object({
  title: z.string().max(500).transform(oneLine).pipe(z.string().min(6).max(120)),
  description: z.string().max(3000).optional().transform((s) => block(s ?? '')).pipe(z.string().max(600)),
  courseCode: z.string().trim().toUpperCase().refine(isCourseCode),
  kind: z.enum(RESOURCE_KINDS),
  semester: z.enum(['S1', 'S2']),
  academicYear: z.string().trim().regex(/^\d{4}\/\d{2}$/),
})
// Same rules for an edit; absent fields stay as they are. Unknown fields (file, counters, verified) are dropped.
const metaPatch = meta.partial()
// The client sends empty strings for "any".
const blank = (v: unknown) => (v === '' ? undefined : v)
const listQuery = z.object({
  q: z.string().max(100).optional(),
  course: z.preprocess(blank, z.string().max(10).optional()),
  kind: z.preprocess(blank, z.enum(RESOURCE_KINDS).optional()),
  semester: z.preprocess(blank, z.enum(['S1', 'S2']).optional()),
  sort: z.preprocess(blank, z.enum(['new', 'top', 'downloads']).default('new')),
})

const NOT_FOUND = 'File not found.'
const META_ERRORS: Record<string, [string, string]> = {
  title: ['bad_title', 'Give your file a clear title (at least 6 characters).'],
  description: ['bad_description', 'The description can be 600 characters at most.'],
  courseCode: ['bad_course', 'Pick a valid course.'],
  academicYear: ['bad_year', 'Write the academic year like 2025/26.'],
}
const FILE_ERRORS: Record<string, [number, string, string]> = {
  too_small: [400, 'too_small', 'This file is too small to be a real resource (10 KB min).'],
  too_large: [413, 'too_large', 'The file is larger than 25 MB.'],
  bad_type: [415, 'bad_type', `Only ${FILE_RULES.allowedExt.join(', ').toUpperCase()} files are accepted.`],
  type_mismatch: [415, 'type_mismatch', 'The file content does not match its extension.'],
}
const metaError = (err: z.ZodError) => {
  const [code, message] = META_ERRORS[String(err.issues[0]?.path[0])] ?? ['invalid_input', 'Check the file details.']
  return new HttpError(400, code, message)
}
const rateLimited = () => new HttpError(429, 'rate_limited', `You reached the limit of ${FILE_RULES.uploadsPerDay} files per day. Come back tomorrow.`)
const duplicate = () => new HttpError(409, 'duplicate', 'This exact file was already shared. Duplicates earn no points.')

type Id = Types.ObjectId
export type ResourceDoc = {
  _id: Id; title: string; description?: string | null; courseCode: string; kind: string; semester: string; academicYear: string
  fileName: string; ext: string; size: number; fileId: Id; uploader: Id; downloads: number; helpful: number; verified: boolean; createdAt: Date
}

/** The client's Resource shape, as seen by `me`. Never carries the hash, the file id or an email. */
export async function resourcesJson(docs: ResourceDoc[], me: Id) {
  const ids = docs.map((r) => r._id)
  const [downloaded, rated, people] = await Promise.all([
    Download.find({ user: me, resource: { $in: ids } }).select('resource'),
    Rating.find({ user: me, resource: { $in: ids } }).select('resource'),
    loadPeople(docs.map((r) => r.uploader)),
  ])
  const dl = new Set(downloaded.map((d) => d.resource.toString())), voted = new Set(rated.map((d) => d.resource.toString()))
  return docs.map((r) => {
    const id = r._id.toString()
    return {
      id, title: r.title, description: r.description ?? '', courseCode: r.courseCode, kind: r.kind, semester: r.semester, academicYear: r.academicYear,
      fileName: r.fileName, fileSize: r.size, ext: r.ext, uploader: personOr(people, r.uploader), createdAt: r.createdAt.getTime(),
      downloads: r.downloads, helpful: r.helpful, verified: r.verified, mine: r.uploader.equals(me), iVoted: voted.has(id), iDownloaded: dl.has(id),
    }
  })
}
const oneJson = async (r: ResourceDoc, me: Id) => (await resourcesJson([r], me))[0]

async function findResource(id: string) {
  if (!isValidObjectId(id)) throw new HttpError(404, 'not_found', NOT_FOUND)
  const r = await Resource.findById(id)
  if (!r) throw new HttpError(404, 'not_found', NOT_FOUND)
  return r
}

// Saved uploads, from the append-only log: a deleted file still counts.
const uploadsToday = (me: Id) => UploadLog.countDocuments({ user: me, createdAt: { $gt: new Date(Date.now() - DAY) } })

// Uploads are read into memory (up to 25 MB each), so the number of bodies being read at once is capped before multer
// starts: one per student, UPLOAD_SLOTS.global in all. Counted in this process only, like serialize().
export const UPLOAD_SLOTS = { global: 6 }
const uploading = new Set<string>()
/** Uploads currently holding a slot (tests and diagnostics). */
export const uploadsInFlight = () => uploading.size

const uploadSlot: RequestHandler = (req, res, next) => {
  const me = req.user!._id.toString()
  if (uploading.has(me)) throw new HttpError(429, 'upload_in_progress', 'Your previous upload is still in progress. Wait for it to finish.')
  if (uploading.size >= UPLOAD_SLOTS.global) throw new HttpError(503, 'busy', 'The server is busy. Try again in a minute.')
  uploading.add(me)
  // 'close' fires once the response is sent (success or error) and when the client aborts, so the slot is always freed.
  // The request's own 'close' is not enough: it fires as soon as the body has been read, before the file is saved.
  const release = () => { uploading.delete(me) }
  res.once('close', release)
  req.once('error', release)
  next()
}

// Multipart, kept in memory (25 MB max), one file in the field `file`. File names are read as UTF-8.
const multipart = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: FILE_RULES.maxBytes, files: 1, fields: 10, fieldSize: 8 * 1024, parts: 12 },
  defParamCharset: 'utf8',
}).single('file')

const parseUpload: RequestHandler = (req, res, next) => {
  multipart(req, res, (err: unknown) => {
    if (!err) return next()
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') return next(new HttpError(413, 'too_large', FILE_ERRORS.too_large[2]))
      return next(new HttpError(400, 'bad_upload', 'Send one file, in the "file" field, with the form.'))
    }
    next(new HttpError(400, 'bad_upload', 'The upload did not work. Try again.'))
  })
}

// Refuses before the body is read when the student is already at the daily limit (checked again once it is read).
const quota: RequestHandler = async (req, _res, next) => {
  if (await uploadsToday(req.user!._id) >= FILE_RULES.uploadsPerDay) throw rateLimited()
  next()
}

export function resourcesRouter() {
  const router = Router()

  // GET /api/resources?q=&course=&kind=&semester=&sort=new|top|downloads -> { resources: Resource[] }
  router.get('/', async (req, res) => {
    const parsed = listQuery.safeParse(req.query)
    if (!parsed.success) throw new HttpError(400, 'invalid_input', 'Invalid filters.')
    const { q, course, kind, semester, sort } = parsed.data
    const filter: Record<string, unknown> = {}
    if (course) filter.courseCode = course
    if (kind) filter.kind = kind
    if (semester) filter.semester = semester
    const term = q?.trim()
    if (term) {
      const re = new RegExp(escapeRegex(term), 'i')
      filter.$or = [{ title: re }, { description: re }, { courseCode: re }]
    }
    const order: Record<string, -1> = sort === 'top' ? { helpful: -1 } : sort === 'downloads' ? { downloads: -1 } : {}
    const docs = await Resource.find(filter).sort({ ...order, createdAt: -1, _id: -1 }).limit(200)
    res.json({ resources: await resourcesJson(docs, req.user!._id) })
  })

  // GET /api/resources/:id -> { resource }
  router.get('/:id', async (req, res) => {
    res.json({ resource: await oneJson(await findResource(req.params.id), req.user!._id) })
  })

  // POST /api/resources, multipart: file + title, description, courseCode, kind, semester, academicYear -> 201 { resource }
  router.post('/', uploadSlot, quota, parseUpload, async (req, res) => {
    const me = req.user!._id
    const parsed = meta.safeParse({ ...req.body })
    if (!parsed.success) throw metaError(parsed.error)
    const file = req.file
    if (!file) throw new HttpError(400, 'no_file', 'Choose a file.')
    const check = checkFile(file.buffer, file.originalname)
    if (!check.ok) { const [status, code, message] = FILE_ERRORS[check.error]; throw new HttpError(status, code, message) }
    const hash = sha256(file.buffer)
    const fileName = safeFileName(file.originalname, check.ext, parsed.data.title)

    // One at a time per student (serialize, single process), so parallel uploads cannot all pass the daily count before any is saved.
    const doc = await serialize(`upload:${me}`, async () => {
      if (await uploadsToday(me) >= FILE_RULES.uploadsPerDay) throw rateLimited()
      if (await Resource.exists({ sha256: hash })) throw duplicate()
      const fileId = await saveFile(file.buffer, fileName, { uploader: me, sha256: hash })
      let saved
      try {
        saved = await Resource.create({ ...parsed.data, fileName, ext: check.ext, size: file.size, sha256: hash, fileId, uploader: me })
      } catch (err) {
        await deleteFile(fileId)
        if (isDuplicateKey(err)) throw duplicate() // another student uploaded the same bytes at the same moment
        throw err
      }
      await UploadLog.create({ user: me })
      return saved
    })
    res.status(201).json({ resource: await oneJson(doc, me) })
  })

  // GET /api/resources/:id/file -> the bytes, as an attachment. Records the download (once per student),
  // unless the browser says the link was followed from another site: a link posted elsewhere must not inflate the count.
  router.get('/:id/file', async (req, res) => {
    const me = req.user!._id
    const r = await findResource(req.params.id)
    const bucket = filesBucket()
    const [stored] = await bucket.find({ _id: r.fileId }).limit(1).toArray()
    if (!stored) throw new HttpError(404, 'not_found', NOT_FOUND)
    const site = req.get('sec-fetch-site')
    if (!site || site === 'same-origin' || site === 'none') {
      try {
        const rec = await Download.updateOne({ resource: r._id, user: me }, { $setOnInsert: { createdAt: new Date() } }, { upsert: true })
        if (rec.upsertedCount === 1 && !r.uploader.equals(me)) await Resource.updateOne({ _id: r._id }, { $inc: { downloads: 1 } })
      } catch (err) {
        if (!isDuplicateKey(err)) throw err // a parallel request recorded it first
      }
    }
    res.attachment(r.fileName)
    res.set({
      'Content-Type': CONTENT_TYPES[r.ext as keyof typeof CONTENT_TYPES],
      'Content-Length': String(stored.length),
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cache-Control': 'private, no-store',
    })
    try {
      await pipeline(bucket.openDownloadStream(r.fileId), res)
    } catch (err) {
      if (!res.headersSent) throw err
      res.destroy()
    }
  })

  // POST /api/resources/:id/rate -> { resource }. Helpful only, final, after a download, never on your own file.
  router.post('/:id/rate', async (req, res) => {
    const me = req.user!._id
    const r = await findResource(req.params.id)
    if (r.uploader.equals(me)) throw new HttpError(403, 'self_vote', 'You cannot rate your own file.')
    if (!(await Download.exists({ resource: r._id, user: me }))) throw new HttpError(403, 'download_first', 'Download the file before you rate it.')
    let rating
    try {
      rating = await Rating.create({ resource: r._id, user: me })
    } catch (err) {
      if (isDuplicateKey(err)) throw new HttpError(409, 'already_voted', 'Ratings are final. You already rated this file.')
      throw err
    }
    const fresh = await Resource.findOneAndUpdate({ _id: r._id }, { $inc: { helpful: 1 } }, { returnDocument: 'after' })
    if (!fresh) throw new HttpError(404, 'not_found', NOT_FOUND) // removed in the meantime: nothing to pay
    const id = r._id.toString()
    // A removal may land at any point. award() checks the file still exists inside the uploader's queue, where the
    // removal's compensate() also runs: removed before the check pays nothing, removed after it is taken back.
    const exists = async () => !!(await Resource.exists({ _id: r._id }))
    const paid = await award({ user: r.uploader, actor: me, kind: 'resource_helpful', points: XP_RULES.points.helpful, refKey: `helpful:${me}:${id}`, label: `Helpful: ${r.title}`, onlyIf: exists })
    if (!(await exists())) throw new HttpError(404, 'not_found', NOT_FOUND)
    await notify(r.uploader, { kind: 'resource_helpful', title: 'A classmate found your file helpful', body: r.title, link: `/resources/${id}`, actor: me })
    // Only ratings that paid XP count toward verification: once a rater's weekly pair cap with the uploader is spent, their
    // rating still shows in `helpful` but cannot verify, so a few friends cannot verify file after file for the bonus.
    // Each paying rating is marked before counting, so the last of parallel ones sees them all. Exactly one request
    // flips `verified` (conditional update), so the bonus is paid once (and its refKey would refuse a second payment anyway).
    if (paid > 0) {
      await Rating.updateOne({ _id: rating._id }, { paid: true })
      if (await Rating.countDocuments({ resource: r._id, paid: true }) >= FILE_RULES.verifyThreshold) {
        const verified = await Resource.updateOne({ _id: r._id, verified: false }, { verified: true })
        if (verified.modifiedCount === 1) {
          await award({ user: r.uploader, actor: 'system', kind: 'resource_verified', points: XP_RULES.points.verified, refKey: `verify:${id}`, label: `Verified: ${r.title}`, onlyIf: exists })
          await notify(r.uploader, { kind: 'resource_verified', title: 'Your file is now verified', body: r.title, link: `/resources/${id}`, actor: 'system' })
        }
      }
    }
    res.json({ resource: await oneJson((await Resource.findById(r._id)) ?? fresh, me) })
  })

  // PATCH /api/resources/:id { title?, description?, courseCode?, kind?, semester?, academicYear? } -> { resource }. The uploader or an admin.
  // Details only: the file cannot be replaced (a new file is a new upload, so the SHA-256 and XP rules hold), and counters, ratings and `verified` stay.
  router.patch('/:id', async (req, res) => {
    const u = req.user!
    const r = await findResource(req.params.id)
    if (!r.uploader.equals(u._id) && u.role !== 'admin') throw new HttpError(403, 'forbidden', 'You can only edit your own files.')
    const parsed = metaPatch.safeParse({ ...req.body })
    if (!parsed.success) throw metaError(parsed.error)
    const patch = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined))
    if (Object.keys(patch).length === 0) throw new HttpError(400, 'empty_patch', 'Change at least one detail.')
    const fresh = await Resource.findOneAndUpdate({ _id: r._id }, { $set: patch }, { returnDocument: 'after' })
    if (!fresh) throw new HttpError(404, 'not_found', NOT_FOUND)
    res.json({ resource: await oneJson(fresh, u._id) })
  })

  // DELETE /api/resources/:id -> 204. The uploader or an admin. The XP the file earned is taken back.
  router.delete('/:id', async (req, res) => {
    const u = req.user!
    const r = await findResource(req.params.id)
    if (!r.uploader.equals(u._id) && u.role !== 'admin') throw new HttpError(403, 'forbidden', 'You can only delete your own files.')
    // Deleted first: a rating arriving now finds nothing to pay.
    const gone = await Resource.deleteOne({ _id: r._id })
    if (gone.deletedCount === 0) throw new HttpError(404, 'not_found', NOT_FOUND)
    const id = r._id.toString()
    await compensate({ user: r.uploader, match: new RegExp(`^(helpful:[0-9a-f]{24}|verify):${id}$`), refKey: `remove:${id}`, label: `Removed: ${r.title}` })
    await Promise.all([Download.deleteMany({ resource: r._id }), Rating.deleteMany({ resource: r._id }), deleteFile(r.fileId)])
    res.status(204).end()
  })

  return router
}
