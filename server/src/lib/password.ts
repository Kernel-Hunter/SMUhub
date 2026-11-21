import bcrypt from 'bcryptjs'

const ROUNDS = 12

export const hashPassword = (plain: string) => bcrypt.hash(plain, ROUNDS)

export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash)

// Compared against when the email is unknown, so a wrong email takes as long as a wrong password
// and response time does not reveal which accounts exist.
const DUMMY_HASH = bcrypt.hashSync('smuhub-timing-equaliser', ROUNDS)
export const burnPasswordCheck = (plain: string) => bcrypt.compare(plain, DUMMY_HASH)
