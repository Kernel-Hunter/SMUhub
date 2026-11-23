import { Schema, model, type HydratedDocumentFromSchema, type InferSchemaType } from 'mongoose'
import { isCourseCode } from '../lib/courses.js'

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    // select: false keeps the hash out of every query unless asked for with .select('+passwordHash').
    passwordHash: { type: String, required: true, select: false },
    firstName: { type: String, required: true, trim: true, maxlength: 50 },
    lastName: { type: String, required: true, trim: true, maxlength: 50 },
    major: { type: String, trim: true, maxlength: 60, default: '' },
    year: { type: Number, min: 1, max: 6, default: 1 },
    bio: { type: String, trim: true, maxlength: 240, default: '' },
    courses: {
      type: [{ type: String, trim: true, uppercase: true }],
      default: [],
      validate: { validator: (v: string[]) => v.length <= 12 && v.every(isCourseCode), message: 'Unknown course code or more than 12 courses' },
    },
    role: { type: String, enum: ['student', 'admin'], default: 'student' },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
)

export type UserFields = InferSchemaType<typeof userSchema>
export type UserDoc = HydratedDocumentFromSchema<typeof userSchema>

/** The only shape the API ever returns for a user. Never includes passwordHash. */
export type PublicUserDto = {
  id: string
  email: string
  firstName: string
  lastName: string
  major: string
  year: number
  createdAt: string
}

export function toPublicUser(u: UserDoc): PublicUserDto {
  return {
    id: u._id.toString(),
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    major: u.major ?? '',
    year: u.year ?? 1,
    createdAt: (u.createdAt ?? new Date()).toISOString(),
  }
}

/** The public shape other students see (client/src/api/types.ts PublicUser). Never includes the email. */
export type ClientUser = { id: string; name: string; handle: string; major: string; year: number }

export function toClientUser(u: { _id: { toString(): string }; firstName: string; lastName: string; email: string; major?: string | null; year?: number | null }): ClientUser {
  return { id: u._id.toString(), name: `${u.firstName} ${u.lastName}`, handle: u.email.split('@')[0], major: u.major ?? '', year: u.year ?? 1 }
}

// Safety net in case a document is ever passed to res.json() directly.
userSchema.set('toJSON', {
  transform: (_doc, ret: Record<string, unknown>) => {
    delete ret.passwordHash
    return ret
  },
})

export const User = model('User', userSchema)
