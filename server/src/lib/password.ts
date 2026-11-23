import bcrypt from 'bcryptjs'

const ROUNDS = 12

export const PASSWORD_MIN = 10
export const PASSWORD_MAX = 128

/** Sign-up and reset policy. Returns a message for the student, or null when the password is acceptable. */
export function checkPasswordPolicy(plain: string): string | null {
  if (plain.length < PASSWORD_MIN) return `Le mot de passe doit contenir au moins ${PASSWORD_MIN} caractères.`
  if (plain.length > PASSWORD_MAX) return `Le mot de passe ne doit pas dépasser ${PASSWORD_MAX} caractères.`
  if (/^\d+$/.test(plain)) return 'Le mot de passe ne peut pas contenir que des chiffres.'
  return null
}

export const hashPassword = (plain: string) => bcrypt.hash(plain, ROUNDS)

export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash)

// Compared against when the email is unknown, so a wrong email takes as long as a wrong password
// and response time does not reveal which accounts exist.
const DUMMY_HASH = bcrypt.hashSync('smuhub-timing-equaliser', ROUNDS)
export const burnPasswordCheck = (plain: string) => bcrypt.compare(plain, DUMMY_HASH)
