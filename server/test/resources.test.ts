/**
 * Resources library tests (uploads, downloads, ratings, removal). Need a running MongoDB; use their own throwaway
 * database (smuhub_test_resources by default, override with MONGODB_URI_TEST_RESOURCES), dropped at the end.
 *   npm test
 */
import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import jwt from 'jsonwebtoken'
import mongoose, { type Types } from 'mongoose'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { loadConfig } from '../src/config/env.js'
import { SESSION_COOKIE } from '../src/lib/session.js'
import { FILE_RULES, safeFileName, zipEntries } from '../src/lib/files.js'
import { XP_RULES } from '../src/lib/xp.js'
import { Ledger } from '../src/models/Ledger.js'
import { User } from '../src/models/User.js'
import { Download, Rating, Resource } from '../src/models/Resource.js'
import { UploadLog } from '../src/models/UploadLog.js'
import { UPLOAD_SLOTS, uploadsInFlight } from '../src/routes/resources.js'
import { makeOffice, makePdf, makePng } from '../src/scripts/sampleFiles.js'
import { dropTestDb } from './db.js'

const MONGO = process.env.MONGODB_URI_TEST_RESOURCES ?? 'mongodb://127.0.0.1:27017/smuhub_test_resources'
const SECRET = 'test-secret-that-is-long-enough-for-hs256-signing'
const app = createApp(loadConfig({ NODE_ENV: 'test', MONGODB_URI: MONGO, JWT_SECRET: SECRET, ALLOWED_EMAIL_DOMAINS: 'medtech.tn,msb.tn' }))

type Id = Types.ObjectId
let lina: Id, omar: Id, sara: Id, nour: Id, admin: Id
const cookie = (id: Id) => `${SESSION_COOKIE}=${jwt.sign({}, SECRET, { subject: id.toString(), expiresIn: 60 })}`
const as = (id: Id) => ({
  get: (path: string) => request(app).get(path).set('Cookie', cookie(id)),
  post: (path: string, body?: object) => request(app).post(path).set('Cookie', cookie(id)).send(body ?? {}),
  patch: (path: string, body?: object) => request(app).patch(path).set('Cookie', cookie(id)).send(body ?? {}),
  del: (path: string) => request(app).delete(path).set('Cookie', cookie(id)),
})
const META = { title: 'Databases final 2025, solved', description: 'Full worked solution.', courseCode: 'CS224', kind: 'exam', semester: 'S1', academicYear: '2025/26' }
let n = 0
const pdf = () => makePdf([`Test document ${++n}`, 'SMUhub resources test'])
const upload = (id: Id, file: Buffer, name: string, over: Record<string, string> = {}) => {
  const req = request(app).post('/api/resources').set('Cookie', cookie(id))
  for (const [k, v] of Object.entries({ ...META, ...over })) req.field(k, v)
  return req.attach('file', file, name)
}
const created = async (id: Id, file = pdf(), name = 'final.pdf') => {
  const res = await upload(id, file, name)
  assert.equal(res.status, 201, JSON.stringify(res.body))
  return res.body.resource as { id: string; fileName: string; ext: string; fileSize: number; helpful: number; verified: boolean; downloads: number; iDownloaded: boolean; iVoted: boolean; mine: boolean }
}
// Reads the body as raw bytes whatever the content type.
const binary = (res: request.Response, cb: (err: Error | null, body: Buffer) => void) => {
  const stream = res as unknown as NodeJS.ReadableStream, parts: Buffer[] = []
  stream.on('data', (d: Buffer) => parts.push(d))
  stream.on('end', () => cb(null, Buffer.concat(parts)))
}
const fetchFile = (id: Id, resourceId: string) => as(id).get(`/api/resources/${resourceId}/file`).buffer(true).parse(binary)
const xp = async (user: Id) => (await Ledger.find({ user })).reduce((s, l) => s + l.points, 0)
const noEmail = (body: unknown) => !/@(medtech|msb)\.tn/.test(JSON.stringify(body))

before(async () => {
  await mongoose.connect(MONGO, { serverSelectionTimeoutMS: 3000 })
  await mongoose.connection.dropDatabase()
  await Promise.all([User.syncIndexes(), Ledger.syncIndexes(), Resource.syncIndexes(), Download.syncIndexes(), Rating.syncIndexes(), UploadLog.syncIndexes()])
})
after(dropTestDb)
beforeEach(async () => {
  const db = mongoose.connection.db!
  // The ledger refuses deletes through the app, so tests clear it with the raw driver.
  await Promise.all([
    User.deleteMany({}), Resource.deleteMany({}), Download.deleteMany({}), Rating.deleteMany({}), UploadLog.deleteMany({}), Ledger.collection.deleteMany({}),
    db.collection('resources.files').deleteMany({}), db.collection('resources.chunks').deleteMany({}),
  ])
  const base = { passwordHash: 'x', major: 'CS', year: 2 }
  lina = (await User.create({ ...base, email: 'lina.haddad@medtech.tn', firstName: 'Lina', lastName: 'Haddad' }))._id
  omar = (await User.create({ ...base, email: 'omar.jaziri@msb.tn', firstName: 'Omar', lastName: 'Jaziri' }))._id
  sara = (await User.create({ ...base, email: 'sara.mejri@medtech.tn', firstName: 'Sara', lastName: 'Mejri' }))._id
  nour = (await User.create({ ...base, email: 'nour.ayari@msb.tn', firstName: 'Nour', lastName: 'Ayari' }))._id
  admin = (await User.create({ ...base, email: 'admin.smu@medtech.tn', firstName: 'Admin', lastName: 'SMU', role: 'admin' }))._id
})

describe('authentication', () => {
  it('requires a session for every route', async () => {
    const id = new mongoose.Types.ObjectId().toString()
    for (const res of [
      await request(app).get('/api/resources'),
      await request(app).get(`/api/resources/${id}`),
      await request(app).get(`/api/resources/${id}/file`),
      await request(app).post(`/api/resources/${id}/rate`),
      await request(app).delete(`/api/resources/${id}`),
      await request(app).patch(`/api/resources/${id}`).send({ title: 'Some title here' }),
      await request(app).post('/api/resources').field('title', 'Some title here').attach('file', Buffer.from('%PDF-1.4'), 'a.pdf'),
    ]) assert.equal(res.status, 401)
    assert.equal(await Resource.countDocuments(), 0)
  })
})

describe('upload', () => {
  it('stores a valid PDF and returns the client shape, without hash or email', async () => {
    const res = await upload(lina, pdf(), 'Final exam.pdf')
    assert.equal(res.status, 201)
    const r = res.body.resource
    assert.equal(r.title, META.title); assert.equal(r.ext, 'pdf'); assert.equal(r.fileName, 'Final exam.pdf'); assert.equal(r.courseCode, 'CS224')
    assert.equal(r.kind, 'exam'); assert.equal(r.semester, 'S1'); assert.equal(r.academicYear, '2025/26')
    assert.equal(r.mine, true); assert.equal(r.downloads, 0); assert.equal(r.helpful, 0); assert.equal(r.verified, false)
    assert.equal(r.uploader.name, 'Lina Haddad')
    assert.ok(!('sha256' in r) && !('fileId' in r))
    assert.ok(noEmail(res.body))
    assert.equal((await as(lina).get('/api/me')).body.me.uploads, 1)
    assert.equal((await as(omar).get('/api/resources')).body.resources.length, 1)
  })

  it('accepts PNG, JPEG and Office files whose bytes match their extension', async () => {
    assert.equal((await upload(lina, makePng([30, 90, 160], 'test png'), 'diagram.png')).status, 201)
    const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(11 * 1024, 7)])
    assert.equal((await upload(lina, jpg, 'photo.JPEG')).body.resource.ext, 'jpg')
    assert.equal((await upload(lina, makeOffice('word/', 'doc'), 'notes.docx')).status, 201)
    assert.equal((await upload(omar, makeOffice('ppt/', 'deck'), 'slides.pptx')).status, 201)
    assert.equal((await upload(omar, makeOffice('xl/', 'sheet'), 'grades.xlsx')).status, 201)
  })

  it('rejects a fake PDF (wrong magic bytes)', async () => {
    const html = Buffer.from(`<html><script>alert(1)</script>${' '.repeat(12 * 1024)}</html>`)
    const res = await upload(lina, html, 'notes.pdf')
    assert.equal(res.status, 415); assert.equal(res.body.error.code, 'type_mismatch')
    assert.equal((await upload(lina, Buffer.concat([Buffer.from('%PDX-1.4'), pdf().subarray(8)]), 'notes.pdf')).status, 415)
    assert.equal(await Resource.countDocuments(), 0)
  })

  it('rejects a file that is too small', async () => {
    const res = await upload(lina, makePdf(['tiny'], 0), 'tiny.pdf')
    assert.equal(res.status, 400); assert.equal(res.body.error.code, 'too_small')
  })

  it('rejects a file over 25 MB', async () => {
    const big = Buffer.concat([pdf(), Buffer.alloc(FILE_RULES.maxBytes)])
    const res = await upload(lina, big, 'huge.pdf')
    assert.equal(res.status, 413); assert.equal(res.body.error.code, 'too_large')
    assert.equal(await Resource.countDocuments(), 0)
    assert.equal(await mongoose.connection.db!.collection('resources.files').countDocuments(), 0)
  })

  it('rejects an extension that does not match the bytes', async () => {
    for (const [file, name] of [
      [makePng([1, 2, 3], 'png'), 'notes.pdf'],
      [pdf(), 'notes.png'],
      [makeOffice('word/', 'a docx'), 'sheet.xlsx'],
      [makeOffice('word/', 'a docx'), 'notes.pdf'],
      [pdf(), 'notes.docx'],
    ] as const) {
      const res = await upload(lina, file, name)
      assert.equal(res.status, 415, name); assert.equal(res.body.error.code, 'type_mismatch')
    }
  })

  it('rejects unknown types, even with valid bytes', async () => {
    for (const name of ['page.html', 'logo.svg', 'archive.zip', 'run.exe', 'noext']) {
      const res = await upload(lina, pdf(), name)
      assert.equal(res.status, 415, name); assert.equal(res.body.error.code, 'bad_type')
    }
  })

  it('rejects an Office file that carries macros', async () => {
    const res = await upload(lina, makeOffice('word/', 'macro', [{ name: 'word/vbaProject.bin', data: 'x' }]), 'notes.docx')
    assert.equal(res.status, 415)
  })

  it('rejects a duplicate (same bytes, different name or student) with 409', async () => {
    const file = pdf()
    await created(lina, file, 'first.pdf')
    for (const res of [await upload(lina, file, 'renamed.pdf', { title: 'Another title' }), await upload(omar, file, 'mine.pdf')]) {
      assert.equal(res.status, 409); assert.equal(res.body.error.code, 'duplicate')
    }
    assert.equal(await Resource.countDocuments(), 1)
    assert.equal(await mongoose.connection.db!.collection('resources.files').countDocuments(), 1)
  })

  it('validates the metadata', async () => {
    assert.equal((await upload(lina, pdf(), 'a.pdf', { title: 'abc' })).body.error.code, 'bad_title')
    assert.equal((await upload(lina, pdf(), 'a.pdf', { courseCode: 'XX999' })).body.error.code, 'bad_course')
    assert.equal((await upload(lina, pdf(), 'a.pdf', { kind: 'lab' })).status, 400)
    assert.equal((await upload(lina, pdf(), 'a.pdf', { semester: 'S3' })).status, 400)
    assert.equal((await upload(lina, pdf(), 'a.pdf', { academicYear: 'last year' })).body.error.code, 'bad_year')
    assert.equal((await as(lina).post('/api/resources', META)).body.error.code, 'no_file') // JSON, no file
    const two = request(app).post('/api/resources').set('Cookie', cookie(lina))
    for (const [k, v] of Object.entries(META)) two.field(k, v)
    assert.equal((await two.attach('file', pdf(), 'a.pdf').attach('file', pdf(), 'b.pdf')).status, 400)
    assert.equal(await Resource.countDocuments(), 0)
  })

  it('stores a safe file name', async () => {
    assert.equal((await created(lina, pdf(), 'Résumé du cours.pdf')).fileName, 'Résumé du cours.pdf')
    const evil = await created(lina, pdf(), '..\\..\\evil‮fdp.exe"<x>.pdf')
    assert.equal(evil.fileName, 'evilfdp.exe__x_.pdf')
    assert.equal(safeFileName('../../etc/passwd\u0000.pdf', 'pdf', 'Fallback'), 'passwd.pdf')
    assert.equal(safeFileName('....pdf', 'pdf', 'My notes'), 'My_notes.pdf')
    assert.equal(safeFileName(`${'a'.repeat(300)}.pdf`, 'pdf', 'x').length, 104)
  })

  it(`allows ${FILE_RULES.uploadsPerDay} uploads per 24 hours, then answers 429`, async () => {
    for (let i = 0; i < FILE_RULES.uploadsPerDay; i++) await created(lina)
    const res = await upload(lina, pdf(), 'one-more.pdf')
    assert.equal(res.status, 429); assert.equal(res.body.error.code, 'rate_limited')
    await UploadLog.updateMany({ user: lina }, { createdAt: new Date(Date.now() - 25 * 3_600_000) }) // a day later
    await created(lina)
  })

  it('keeps the daily limit with parallel uploads (one at a time per student)', async () => {
    const res = await Promise.all(Array.from({ length: 8 }, () => upload(omar, pdf(), 'p.pdf')))
    const ok = res.filter((r) => r.status === 201).length
    assert.ok(ok >= 1 && ok <= FILE_RULES.uploadsPerDay)
    for (const r of res.filter((x) => x.status !== 201)) { assert.equal(r.status, 429); assert.ok(['rate_limited', 'upload_in_progress'].includes(r.body.error.code)) }
    assert.equal(await Resource.countDocuments({ uploader: omar }), ok)
  })

  it('does not give an upload back when a file is deleted', async () => {
    const ids: string[] = []
    for (let i = 0; i < FILE_RULES.uploadsPerDay; i++) ids.push((await created(lina)).id)
    assert.equal((await as(lina).del(`/api/resources/${ids[0]}`)).status, 204)
    const res = await upload(lina, pdf(), 'one-more.pdf')
    assert.equal(res.status, 429); assert.equal(res.body.error.code, 'rate_limited')
  })
})

describe('uploads in flight', () => {
  let server: http.Server
  before(() => { server = app.listen(0) })
  after(() => { server.closeAllConnections(); server.close() })

  // An upload whose body never ends: the server holds its slot until the socket closes.
  const stalled = (id: Id) => {
    const req = http.request({
      port: (server.address() as AddressInfo).port, method: 'POST', path: '/api/resources',
      headers: { Cookie: cookie(id), 'Content-Type': 'multipart/form-data; boundary=x', 'Content-Length': 20 * 1024 * 1024 },
    })
    req.on('error', () => {})
    req.write('--x\r\nContent-Disposition: form-data; name="title"\r\n\r\nA stalled upload\r\n')
    return req
  }
  const inFlight = async (n: number) => {
    for (let i = 0; i < 400 && uploadsInFlight() !== n; i++) await new Promise((r) => setTimeout(r, 5))
    assert.equal(uploadsInFlight(), n)
  }

  it('allows one upload at a time per student, and frees the slot when the client gives up', async () => {
    const first = stalled(lina)
    await inFlight(1)
    const res = await upload(lina, pdf(), 'second.pdf')
    assert.equal(res.status, 429); assert.equal(res.body.error.code, 'upload_in_progress')
    assert.match(res.body.error.message, /^[A-Z][^{}<>]+\.$/)
    assert.equal((await upload(omar, pdf(), 'other-student.pdf')).status, 201)
    first.destroy()
    await inFlight(0)
    assert.equal((await upload(lina, pdf(), 'after-abort.pdf')).status, 201)
    await inFlight(0)
  })

  it(`answers 503 once ${UPLOAD_SLOTS.global} uploads are in flight`, async () => {
    const base = { passwordHash: 'x', major: 'CS', year: 2 }
    const extra = await Promise.all(Array.from({ length: UPLOAD_SLOTS.global }, (_, i) => User.create({ ...base, email: `extra${i}@medtech.tn`, firstName: 'Extra', lastName: `Student${i}` })))
    const open = extra.map((u) => stalled(u._id))
    await inFlight(UPLOAD_SLOTS.global)
    const res = await upload(lina, pdf(), 'busy.pdf')
    assert.equal(res.status, 503); assert.equal(res.body.error.code, 'busy')
    assert.equal(res.body.error.message, 'The server is busy. Try again in a minute.')
    for (const r of open) r.destroy()
    await inFlight(0)
    assert.equal((await upload(lina, pdf(), 'not-busy.pdf')).status, 201)
  })
})

describe('download', () => {
  it('serves the bytes as an attachment, with the detected type and nosniff', async () => {
    const file = pdf()
    const r = await created(lina, file, 'Final exam.pdf')
    const res = await fetchFile(omar, r.id)
    assert.equal(res.status, 200)
    assert.equal(res.headers['content-type'], 'application/pdf')
    assert.match(res.headers['content-disposition'], /^attachment; filename="Final exam\.pdf"/)
    assert.equal(res.headers['x-content-type-options'], 'nosniff')
    assert.match(res.headers['content-security-policy'], /sandbox/)
    assert.ok(Buffer.compare(res.body as Buffer, file) === 0)
    const png = makePng([200, 40, 40], 'red')
    const p = await created(lina, png, 'red.png')
    const pres = await fetchFile(omar, p.id)
    assert.equal(pres.headers['content-type'], 'image/png'); assert.ok((pres.body as Buffer).equals(png))
  })

  it('counts each student once, and never the uploader', async () => {
    const r = await created(lina)
    await fetchFile(lina, r.id)
    await Promise.all([fetchFile(omar, r.id), fetchFile(omar, r.id), fetchFile(omar, r.id)])
    await fetchFile(sara, r.id)
    const seen = (await as(omar).get(`/api/resources/${r.id}`)).body.resource
    assert.equal(seen.downloads, 2); assert.equal(seen.iDownloaded, true)
    assert.equal(await Download.countDocuments({ resource: r.id }), 3)
    assert.equal((await as(nour).get(`/api/resources/${r.id}`)).body.resource.iDownloaded, false)
  })

  it('serves a link followed from another site but does not count it as a download', async () => {
    const r = await created(lina)
    for (const site of ['cross-site', 'same-site']) {
      const res = await fetchFile(omar, r.id).set('Sec-Fetch-Site', site)
      assert.equal(res.status, 200); assert.ok((res.body as Buffer).length > 0)
    }
    assert.equal((await Resource.findById(r.id))!.downloads, 0)
    assert.equal(await Download.countDocuments({ resource: r.id }), 0)
    assert.equal((await as(omar).post(`/api/resources/${r.id}/rate`)).body.error.code, 'download_first')
    await fetchFile(omar, r.id).set('Sec-Fetch-Site', 'same-origin')
    await fetchFile(sara, r.id).set('Sec-Fetch-Site', 'none')
    assert.equal((await Resource.findById(r.id))!.downloads, 2)
  })

  it('answers 404 for an unknown resource', async () => {
    assert.equal((await as(omar).get(`/api/resources/${new mongoose.Types.ObjectId()}/file`)).status, 404)
    assert.equal((await as(omar).get('/api/resources/not-an-id/file')).status, 404)
  })
})

describe('rating', () => {
  it('refuses a rating without a download', async () => {
    const r = await created(lina)
    const res = await as(omar).post(`/api/resources/${r.id}/rate`)
    assert.equal(res.status, 403); assert.equal(res.body.error.code, 'download_first')
    assert.equal(await xp(lina), 0)
  })

  it('refuses rating your own file', async () => {
    const r = await created(lina)
    await fetchFile(lina, r.id)
    const res = await as(lina).post(`/api/resources/${r.id}/rate`)
    assert.equal(res.status, 403); assert.equal(res.body.error.code, 'self_vote')
  })

  it('rates once, and pays the uploader once', async () => {
    const r = await created(lina)
    await fetchFile(omar, r.id)
    const res = await as(omar).post(`/api/resources/${r.id}/rate`)
    assert.equal(res.status, 200)
    assert.equal(res.body.resource.helpful, 1); assert.equal(res.body.resource.iVoted, true)
    assert.ok(noEmail(res.body))
    const again = await Promise.all([as(omar).post(`/api/resources/${r.id}/rate`), as(omar).post(`/api/resources/${r.id}/rate`)])
    for (const a of again) { assert.equal(a.status, 409); assert.equal(a.body.error.code, 'already_voted') }
    assert.equal((await Resource.findById(r.id))!.helpful, 1)
    assert.equal(await xp(lina), XP_RULES.points.helpful)
    assert.equal(await Ledger.countDocuments({ refKey: `helpful:${omar}:${r.id}` }), 1)
  })

  it('verifies on the third rating, once, and pays the bonus once, even in parallel', async () => {
    const r = await created(lina)
    const raters = [omar, sara, nour, admin]
    for (const u of raters) await fetchFile(u, r.id)
    const res = await Promise.all(raters.map((u) => as(u).post(`/api/resources/${r.id}/rate`)))
    assert.ok(res.every((x) => x.status === 200))
    const doc = (await Resource.findById(r.id))!
    assert.equal(doc.helpful, 4); assert.equal(doc.verified, true)
    assert.equal(await Ledger.countDocuments({ kind: 'resource_verified' }), 1)
    const bonus = (await Ledger.findOne({ kind: 'resource_verified' }))!
    assert.equal(bonus.actor, null); assert.equal(bonus.refKey, `verify:${r.id}`)
    assert.equal(await xp(lina), 4 * XP_RULES.points.helpful + XP_RULES.points.verified)
  })

  it('does not verify before the third rating', async () => {
    const r = await created(lina)
    for (const u of [omar, sara]) { await fetchFile(u, r.id); await as(u).post(`/api/resources/${r.id}/rate`) }
    assert.equal((await Resource.findById(r.id))!.verified, false)
    assert.equal(await xp(lina), 2 * XP_RULES.points.helpful)
  })

  it('counts only ratings that paid XP toward verification', async () => {
    // Omar, Sara and Nour already spent their weekly pair cap with Lina (two days ago, so the daily cap is free).
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000)
    for (const u of [omar, sara, nour]) for (let i = 0; i < XP_RULES.pairWeeklyCap; i++) {
      await Ledger.create({ user: lina, actor: u, kind: 'answer_upvoted', points: 1, refKey: `old:${u}:${i}`, label: 'Earlier upvote', createdAt: twoDaysAgo })
    }
    const before = await xp(lina)
    const r = await created(lina)
    for (const u of [omar, sara, nour]) { await fetchFile(u, r.id); assert.equal((await as(u).post(`/api/resources/${r.id}/rate`)).status, 200) }
    let doc = (await Resource.findById(r.id))!
    assert.equal(doc.helpful, 3); assert.equal(doc.verified, false)
    assert.equal(await xp(lina), before)
    assert.equal(await Rating.countDocuments({ resource: r.id, paid: true }), 0)
    // Two paying ratings are still short of the threshold, the third one verifies.
    const base = { passwordHash: 'x', major: 'CS', year: 2 }
    const [a, b] = await Promise.all(['amel.ben@medtech.tn', 'yassine.t@msb.tn'].map((email, i) => User.create({ ...base, email, firstName: 'New', lastName: `Rater${i}` })))
    for (const u of [a._id, b._id]) { await fetchFile(u, r.id); await as(u).post(`/api/resources/${r.id}/rate`) }
    assert.equal((await Resource.findById(r.id))!.verified, false)
    await fetchFile(admin, r.id); await as(admin).post(`/api/resources/${r.id}/rate`)
    doc = (await Resource.findById(r.id))!
    assert.equal(doc.helpful, 6); assert.equal(doc.verified, true)
    assert.equal(await xp(lina), before + 3 * XP_RULES.points.helpful + XP_RULES.points.verified)
  })

  it('still verifies when only the uploader\'s daily cap stopped the points', async () => {
    // Lina earned her full daily XP from other classmates today, so the ratings pay nothing.
    await Ledger.create({ user: lina, actor: admin, kind: 'answer_accepted', points: XP_RULES.dailyXpCap, refKey: 'busy-day', label: 'Busy day', createdAt: new Date(Date.now() - 3_600_000) })
    const r = await created(lina)
    for (const u of [omar, sara, nour]) { await fetchFile(u, r.id); assert.equal((await as(u).post(`/api/resources/${r.id}/rate`)).status, 200) }
    assert.equal((await Resource.findById(r.id))!.verified, true)
  })
})

describe('removal', () => {
  it('refuses removal by someone else, allows the uploader and admins', async () => {
    const r = await created(lina)
    const res = await as(omar).del(`/api/resources/${r.id}`)
    assert.equal(res.status, 403); assert.equal(res.body.error.code, 'forbidden')
    assert.equal(await Resource.countDocuments(), 1)
    assert.equal((await as(admin).del(`/api/resources/${r.id}`)).status, 204)
    const mine = await created(lina)
    assert.equal((await as(lina).del(`/api/resources/${mine.id}`)).status, 204)
    assert.equal((await as(lina).del(`/api/resources/${mine.id}`)).status, 404)
  })

  it('takes back the XP the file earned and deletes the file and its records', async () => {
    const r = await created(lina)
    const other = await created(lina) // XP from another file stays
    for (const u of [omar, sara, nour]) { await fetchFile(u, r.id); await as(u).post(`/api/resources/${r.id}/rate`) }
    await fetchFile(omar, other.id); await as(omar).post(`/api/resources/${other.id}/rate`)
    const earned = 3 * XP_RULES.points.helpful + XP_RULES.points.verified
    assert.equal(await xp(lina), earned + XP_RULES.points.helpful)
    assert.equal((await as(lina).del(`/api/resources/${r.id}`)).status, 204)
    assert.equal(await xp(lina), XP_RULES.points.helpful)
    const penalty = (await Ledger.findOne({ kind: 'removal_penalty' }))!
    assert.equal(penalty.points, -earned); assert.equal(penalty.refKey, `remove:${r.id}`)
    assert.equal(await Download.countDocuments({ resource: r.id }), 0)
    assert.equal(await Rating.countDocuments({ resource: r.id }), 0)
    assert.equal(await mongoose.connection.db!.collection('resources.files').countDocuments(), 1)
    assert.equal((await fetchFile(omar, r.id)).status, 404)
    assert.equal((await as(omar).post(`/api/resources/${r.id}/rate`)).status, 404)
  })

  it('takes back a rating whose award lands after the removal', async () => {
    const r = await created(lina)
    await fetchFile(omar, r.id)
    // Force the race by call order: the rating has counted itself, then the whole removal runs, then the rating goes on.
    const original = Resource.findOneAndUpdate
    const racing = async (...args: Parameters<typeof original>) => {
      const doc = await original.apply(Resource, args)
      Resource.findOneAndUpdate = original
      assert.equal((await as(lina).del(`/api/resources/${r.id}`)).status, 204)
      return doc
    }
    Resource.findOneAndUpdate = racing as unknown as typeof original
    try {
      assert.equal((await as(omar).post(`/api/resources/${r.id}/rate`)).status, 404)
    } finally {
      Resource.findOneAndUpdate = original
    }
    assert.equal(await xp(lina), 0)
  })
})

describe('editing', () => {
  it('lets the uploader change the details and returns the GET shape, without an email', async () => {
    const r = await created(lina)
    const res = await as(lina).patch(`/api/resources/${r.id}`, { title: '  Databases   final, corrected ', courseCode: 'math101', kind: 'summary', semester: 'S2', academicYear: '2024/25', description: 'Fixed question 3.\n\n\n\nThanks Omar.' })
    assert.equal(res.status, 200, JSON.stringify(res.body))
    const e = res.body.resource
    assert.equal(e.title, 'Databases final, corrected'); assert.equal(e.courseCode, 'MATH101'); assert.equal(e.kind, 'summary')
    assert.equal(e.semester, 'S2'); assert.equal(e.academicYear, '2024/25'); assert.equal(e.description, 'Fixed question 3.\n\nThanks Omar.')
    assert.deepEqual(Object.keys(e).sort(), Object.keys(r).sort())
    assert.deepEqual(res.body, (await as(lina).get(`/api/resources/${r.id}`)).body)
    assert.ok(noEmail(res.body))
  })

  it('changes only the fields sent', async () => {
    const r = await created(lina)
    const res = await as(lina).patch(`/api/resources/${r.id}`, { title: 'Only the title changes' })
    assert.equal(res.status, 200)
    const doc = (await Resource.findById(r.id))!
    assert.equal(doc.title, 'Only the title changes'); assert.equal(doc.description, META.description); assert.equal(doc.courseCode, META.courseCode)
    assert.equal(doc.kind, META.kind); assert.equal(doc.semester, META.semester); assert.equal(doc.academicYear, META.academicYear)
    assert.equal((await as(lina).patch(`/api/resources/${r.id}`, { description: '' })).body.resource.description, '')
  })

  it('refuses everyone but the uploader and admins', async () => {
    const r = await created(lina)
    const res = await as(omar).patch(`/api/resources/${r.id}`, { title: 'Taken over by Omar' })
    assert.equal(res.status, 403); assert.equal(res.body.error.code, 'forbidden')
    assert.equal((await Resource.findById(r.id))!.title, META.title)
    const byAdmin = await as(admin).patch(`/api/resources/${r.id}`, { title: 'Renamed by a moderator' })
    assert.equal(byAdmin.status, 200); assert.equal(byAdmin.body.resource.mine, false)
    assert.equal(byAdmin.body.resource.uploader.name, 'Lina Haddad')
    assert.ok(noEmail(byAdmin.body))
  })

  it('validates with the upload rules', async () => {
    const r = await created(lina)
    const code = async (body: object) => (await as(lina).patch(`/api/resources/${r.id}`, body)).body.error?.code
    assert.equal(await code({ title: 'abc' }), 'bad_title')
    assert.equal(await code({ title: '     x     ' }), 'bad_title')
    assert.equal(await code({ courseCode: 'XX999' }), 'bad_course')
    assert.equal(await code({ academicYear: 'last year' }), 'bad_year')
    assert.equal(await code({ description: 'x'.repeat(601) }), 'bad_description')
    assert.equal((await as(lina).patch(`/api/resources/${r.id}`, { kind: 'lab' })).status, 400)
    assert.equal((await as(lina).patch(`/api/resources/${r.id}`, { semester: 'S3' })).status, 400)
    assert.equal((await as(lina).patch(`/api/resources/${r.id}`, { title: 'A valid new title', courseCode: 'XX999' })).status, 400)
    for (const body of [{}, { sha256: 'abc', helpful: 99 }]) {
      const res = await as(lina).patch(`/api/resources/${r.id}`, body)
      assert.equal(res.status, 400); assert.equal(res.body.error.code, 'empty_patch')
    }
    const doc = (await Resource.findById(r.id))!
    assert.equal(doc.title, META.title); assert.equal(doc.courseCode, META.courseCode); assert.equal(doc.kind, META.kind)
  })

  it('answers 404 for an unknown or malformed id', async () => {
    assert.equal((await as(lina).patch(`/api/resources/${new mongoose.Types.ObjectId()}`, { title: 'Some new title' })).status, 404)
    assert.equal((await as(lina).patch('/api/resources/not-an-id', { title: 'Some new title' })).status, 404)
  })

  it('never touches the file, the counters, the ratings, verified or XP', async () => {
    const r = await created(lina)
    for (const u of [omar, sara, nour]) { await fetchFile(u, r.id); await as(u).post(`/api/resources/${r.id}/rate`) }
    const before = (await Resource.findById(r.id))!.toObject()
    const earned = await xp(lina), ledgerRows = await Ledger.countDocuments()
    const res = await as(lina).patch(`/api/resources/${r.id}`, {
      title: 'Same file, better title', sha256: 'f'.repeat(64), fileId: new mongoose.Types.ObjectId().toString(), fileName: 'evil.html', ext: 'html', size: 1,
      uploader: omar.toString(), downloads: 0, helpful: 0, verified: false, createdAt: 0,
    })
    assert.equal(res.status, 200)
    const after = (await Resource.findById(r.id))!.toObject()
    assert.equal(after.title, 'Same file, better title')
    for (const k of ['sha256', 'fileName', 'ext', 'size', 'downloads', 'helpful', 'verified'] as const) assert.deepEqual(after[k], before[k], k)
    assert.ok(after.fileId.equals(before.fileId)); assert.ok(after.uploader.equals(lina)); assert.equal(after.createdAt.getTime(), before.createdAt.getTime())
    assert.equal(after.verified, true); assert.equal(after.helpful, 3); assert.equal(after.downloads, 3)
    assert.equal(await Rating.countDocuments({ resource: r.id }), 3); assert.equal(await Download.countDocuments({ resource: r.id }), 3)
    assert.equal(await xp(lina), earned); assert.equal(await Ledger.countDocuments(), ledgerRows)
    assert.equal(res.body.resource.verified, true); assert.equal(res.body.resource.helpful, 3)
    // The same bytes are still refused as a new upload.
    const file = await fetchFile(omar, r.id)
    assert.equal((await upload(sara, file.body as Buffer, 'copy.pdf')).status, 409)
  })
})

describe('listing, profiles and leaderboard', () => {
  it('filters and sorts like the mock', async () => {
    const a = await created(lina, pdf(), 'a.pdf')
    const b = (await upload(omar, pdf(), 'b.pdf', { title: 'Calculus cheat sheet', courseCode: 'MATH101', kind: 'summary', semester: 'S2', description: 'Limits and derivatives' })).body.resource
    for (const u of [sara, nour]) { await fetchFile(u, b.id); await as(u).post(`/api/resources/${b.id}/rate`) }
    await fetchFile(sara, a.id)
    const ids = async (qs: string) => ((await as(sara).get(`/api/resources${qs}`)).body.resources as { id: string }[]).map((r) => r.id)
    assert.deepEqual(await ids(''), [b.id, a.id])
    assert.deepEqual(await ids('?course=MATH101'), [b.id])
    assert.deepEqual(await ids('?kind=exam&semester=&sort=new'), [a.id])
    assert.deepEqual(await ids('?semester=S2'), [b.id])
    assert.deepEqual(await ids('?q=derivatives'), [b.id])
    assert.deepEqual(await ids('?q=cs224'), [a.id])
    assert.deepEqual(await ids('?q=.*'), [])
    assert.deepEqual(await ids('?sort=top'), [b.id, a.id])
    assert.equal((await as(sara).get('/api/resources?sort=bad')).status, 400)
  })

  it('lists a student\'s resources on their profile and counts uploads on the board, without emails', async () => {
    const r = await created(lina)
    await fetchFile(omar, r.id); await as(omar).post(`/api/resources/${r.id}/rate`)
    const profile = await as(omar).get(`/api/users/${lina}`)
    assert.equal(profile.body.resources.length, 1); assert.equal(profile.body.resources[0].iVoted, true)
    const board = await as(omar).get('/api/leaderboard?period=all')
    assert.equal(board.body.rows[0].uploads, 1)
    for (const body of [profile.body, board.body, (await as(omar).get('/api/resources')).body, (await as(omar).get(`/api/resources/${r.id}`)).body]) assert.ok(noEmail(body))
  })
})

describe('zip central directory', () => {
  it('reads entry names and refuses malformed archives', () => {
    assert.deepEqual(zipEntries(makeOffice('xl/', 'x')), ['[Content_Types].xml', 'xl/workbook.xml'])
    const z = makeOffice('xl/', 'x')
    assert.equal(zipEntries(z.subarray(0, z.length - 10)), null)
    assert.equal(zipEntries(Buffer.from('PK\x03\x04 nothing else here at all')), null)
  })
})
