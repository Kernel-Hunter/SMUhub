// Basic shape check. The real proof that an address belongs to the student comes with US-01 (email verification).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const normalizeEmail = (email: string) => email.trim().toLowerCase()

export const isEmail = (email: string) => EMAIL_RE.test(email)

export const domainOf = (email: string) => normalizeEmail(email).split('@').pop() ?? ''

/** Exact match only: "medtech.tn" does not allow "evil-medtech.tn" or "x.medtech.tn". */
export function isAllowedDomain(email: string, allowed: readonly string[]) {
  const d = domainOf(email)
  return d.length > 0 && allowed.includes(d)
}
