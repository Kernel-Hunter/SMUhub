import { HttpError, http } from './http'

/** Student as returned by the server (server/src/models/User.ts, toPublicUser). */
export type AuthUser = {
  id: string
  email: string
  firstName: string
  lastName: string
  major: string
  year: number
  createdAt: string
}

/** Mirrors ALLOWED_EMAIL_DOMAINS on the server. Client-side check is for quick feedback only; the server decides. */
export const ALLOWED_DOMAINS = (import.meta.env.VITE_ALLOWED_EMAIL_DOMAINS ?? 'smu.tn,medtech.tn,msb.tn')
  .split(',').map((d) => d.trim().toLowerCase().replace(/^@/, '')).filter(Boolean)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Returns an error message, or null when the email looks like an SMU address. */
export function checkSmuEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase()
  if (!email) return 'Entre ton adresse email.'
  if (!EMAIL_RE.test(email)) return 'Adresse email invalide.'
  const domain = email.split('@').pop()!
  if (!ALLOWED_DOMAINS.includes(domain)) return `Utilise ton adresse SMU (${ALLOWED_DOMAINS.map((d) => '@' + d).join(', ')}).`
  return null
}

export const authApi = {
  async login(email: string, password: string): Promise<AuthUser> {
    const { user } = await http<{ user: AuthUser }>('/api/auth/login', { method: 'POST', body: { email: email.trim(), password } })
    return user
  },
  async logout(): Promise<void> {
    await http<void>('/api/auth/logout', { method: 'POST' })
  },
  /** The signed-in student, or null when there is no valid session. */
  async me(): Promise<AuthUser | null> {
    try {
      const { user } = await http<{ user: AuthUser }>('/api/auth/me')
      return user
    } catch (e) {
      if (e instanceof HttpError && e.status === 401) return null
      throw e
    }
  },
}
