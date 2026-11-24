import bcrypt from 'bcryptjs'

const ROUNDS = 12

export const PASSWORD_MIN = 10
export const PASSWORD_MAX = 128

/** Sign-up and reset policy. Returns a message for the student, or null when the password is acceptable. */
export function checkPasswordPolicy(plain: string): string | null {
  if (plain.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`
  if (plain.length > PASSWORD_MAX) return `Use ${PASSWORD_MAX} characters at most.`
  if (/^\d+$/.test(plain)) return 'Add some letters or symbols, not only digits.'
  return null
}

export const hashPassword = (plain: string) => bcrypt.hash(plain, ROUNDS)

export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash)

// Compared against when the email is unknown, so a wrong email takes as long as a wrong password
// and response time does not reveal which accounts exist.
const DUMMY_HASH = bcrypt.hashSync('smuhub-timing-equaliser', ROUNDS)
export const burnPasswordCheck = (plain: string) => bcrypt.compare(plain, DUMMY_HASH)
