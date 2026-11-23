import { createHash } from 'node:crypto'
import { finished } from 'node:stream/promises'
import mongoose, { Types } from 'mongoose'

/**
 * Checks and storage for uploaded course files (docs/BACKEND.md, Leaderboard integrity rules).
 * The type is decided from the bytes (magic numbers), never from the browser's MIME type; the name's extension must agree.
 */

export const FILE_RULES = {
  allowedExt: ['pdf', 'docx', 'pptx', 'xlsx', 'png', 'jpg'] as const,
  minBytes: 10 * 1024,
  maxBytes: 25 * 1024 * 1024,
  uploadsPerDay: 5,
  verifyThreshold: 3,
} as const

export type FileType = (typeof FILE_RULES.allowedExt)[number]

/** Served with the file. Comes from the detected type, never from what the browser sent. */
export const CONTENT_TYPES: Record<FileType, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  png: 'image/png',
  jpg: 'image/jpeg',
}

// Office files are ZIP archives; each kind keeps its content in its own folder.
const OOXML_DIR: Record<string, string> = { docx: 'word/', pptx: 'ppt/', xlsx: 'xl/' }
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const starts = (buf: Buffer, sig: Buffer | number[]) => buf.length >= sig.length && Buffer.from(sig).equals(buf.subarray(0, sig.length))

/** Extension of a file name, lower case, `jpeg` folded into `jpg`. Empty when there is none. */
export function extOf(name: string) {
  const base = name.split(/[\\/]/).pop() ?? ''
  const i = base.lastIndexOf('.')
  const ext = i > 0 ? base.slice(i + 1).toLowerCase() : ''
  return ext === 'jpeg' ? 'jpg' : ext
}

/**
 * Names of the entries in a ZIP archive, read from its central directory (no decompression).
 * null when the buffer is not a well-formed ZIP, or uses ZIP64 (never needed for a file under 25 MB).
 */
export function zipEntries(buf: Buffer): string[] | null {
  if (!starts(buf, [0x50, 0x4b, 0x03, 0x04]) || buf.length < 22) return null
  // End of central directory record: 22 bytes plus a comment of up to 65535 bytes, at the very end.
  let eocd = -1
  for (let p = buf.length - 22; p >= Math.max(0, buf.length - 22 - 0xffff); p--) {
    if (buf.readUInt32LE(p) === 0x06054b50) { eocd = p; break }
  }
  if (eocd < 0) return null
  const count = buf.readUInt16LE(eocd + 10), size = buf.readUInt32LE(eocd + 12), offset = buf.readUInt32LE(eocd + 16)
  if (count === 0xffff || offset === 0xffffffff || offset + size > eocd || count > 20000) return null
  const names: string[] = []
  let p = offset
  for (let i = 0; i < count; i++) {
    if (p + 46 > eocd || buf.readUInt32LE(p) !== 0x02014b50) return null
    const n = buf.readUInt16LE(p + 28), extra = buf.readUInt16LE(p + 30), comment = buf.readUInt16LE(p + 32)
    if (p + 46 + n > eocd) return null
    names.push(buf.subarray(p + 46, p + 46 + n).toString('utf8'))
    p += 46 + n + extra + comment
  }
  return names
}

/** The type the bytes really are, or null when it is none of the allowed ones. `ext` only decides between the Office kinds. */
export function sniff(buf: Buffer, ext: string): FileType | null {
  if (starts(buf, Buffer.from('%PDF-'))) return 'pdf'
  if (starts(buf, PNG)) return 'png'
  if (starts(buf, [0xff, 0xd8, 0xff])) return 'jpg'
  const dir = OOXML_DIR[ext]
  if (!dir) return null
  const names = zipEntries(buf)
  if (!names || !names.includes('[Content_Types].xml') || !names.some((n) => n.startsWith(dir))) return null
  // Macros are not allowed in .docx/.pptx/.xlsx (they belong in .docm, ...): refuse a file that carries some anyway.
  if (names.some((n) => /(^|\/)vbaProject\.bin$/i.test(n))) return null
  return ext as FileType
}

export type FileCheck = { ok: true; ext: FileType } | { ok: false; error: 'too_small' | 'too_large' | 'bad_type' | 'type_mismatch' }

/** Size bounds, allowed extension, and bytes that match the extension. */
export function checkFile(buf: Buffer, name: string): FileCheck {
  if (buf.length > FILE_RULES.maxBytes) return { ok: false, error: 'too_large' }
  if (buf.length < FILE_RULES.minBytes) return { ok: false, error: 'too_small' }
  const ext = extOf(name)
  if (!(FILE_RULES.allowedExt as readonly string[]).includes(ext)) return { ok: false, error: 'bad_type' }
  if (sniff(buf, ext) !== ext) return { ok: false, error: 'type_mismatch' }
  return { ok: true, ext: ext as FileType }
}

export const sha256 = (buf: Buffer) => createHash('sha256').update(buf).digest('hex')

/**
 * The name the file is stored and served under: no folders, no control or bidi characters (they can disguise
 * the extension), no characters Windows refuses, capped length, and always the detected extension.
 */
export function safeFileName(name: string, ext: FileType, fallback: string) {
  const clean = (s: string) => s.normalize('NFC')
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/g, '')
    .replace(/["*/:<>?\\|]/g, '_').replace(/\s+/g, ' ').trim().replace(/^[.\s]+|[.\s]+$/g, '')
  const base = (name.split(/[\\/]/).pop() ?? '').replace(/\.[^.]*$/, '')
  const stem = [...clean(base)].slice(0, 100).join('') || [...clean(fallback).replace(/\s+/g, '_')].slice(0, 60).join('') || 'resource'
  return `${stem}.${ext}`
}

/** GridFS bucket holding the files. Built on demand: the connection does not exist yet when the app is created. */
export function filesBucket() {
  const db = mongoose.connection.db
  if (!db) throw new Error('MongoDB is not connected')
  return new mongoose.mongo.GridFSBucket(db, { bucketName: 'resources' })
}

/** Stores the bytes in GridFS and returns the new file's id. */
export async function saveFile(buf: Buffer, fileName: string, metadata: Record<string, unknown>) {
  const stream = filesBucket().openUploadStream(fileName, { metadata })
  stream.end(buf)
  await finished(stream)
  return stream.id as Types.ObjectId
}

/** Deletes a stored file. A file that is already gone is not an error. */
export async function deleteFile(id: Types.ObjectId) {
  try {
    await filesBucket().delete(id)
  } catch (err) {
    if (!/file not found|FileNotFound/i.test(String((err as Error)?.message))) throw err
  }
}
