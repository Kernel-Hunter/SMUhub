import { Schema, model } from 'mongoose'
import { FILE_RULES } from '../lib/files.js'

export const RESOURCE_KINDS = ['notes', 'exam', 'summary', 'slides', 'tutorial'] as const

/**
 * A course file shared in the library. The bytes live in GridFS (bucket `resources`, see lib/files.ts) under `fileId`.
 * `sha256` is unique: the same file can only be shared once, by anyone.
 */
const resourceSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 600, default: '' },
    courseCode: { type: String, required: true, index: true },
    kind: { type: String, enum: RESOURCE_KINDS, required: true },
    semester: { type: String, enum: ['S1', 'S2'], required: true },
    academicYear: { type: String, required: true, maxlength: 9 },
    fileName: { type: String, required: true, maxlength: 120 }, // safe name, served in Content-Disposition
    ext: { type: String, enum: FILE_RULES.allowedExt, required: true }, // detected from the bytes
    size: { type: Number, required: true },
    sha256: { type: String, required: true, unique: true },
    fileId: { type: Schema.Types.ObjectId, required: true },
    uploader: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    downloads: { type: Number, default: 0 }, // distinct students other than the uploader
    helpful: { type: Number, default: 0 }, // distinct "helpful" ratings
    verified: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
)
resourceSchema.index({ uploader: 1, createdAt: -1 })
resourceSchema.index({ createdAt: -1 })

/** A student downloaded a resource (at least once). Rating requires one. */
const downloadSchema = new Schema(
  {
    resource: { type: Schema.Types.ObjectId, ref: 'Resource', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
)
downloadSchema.index({ resource: 1, user: 1 }, { unique: true })

/** A student rated a resource helpful. Final: one per student and resource, never changed. */
const ratingSchema = new Schema(
  {
    resource: { type: Schema.Types.ObjectId, ref: 'Resource', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
)
ratingSchema.index({ resource: 1, user: 1 }, { unique: true })

export const Resource = model('Resource', resourceSchema)
export const Download = model('Download', downloadSchema)
export const Rating = model('Rating', ratingSchema)
