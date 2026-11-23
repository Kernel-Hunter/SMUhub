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

/** Mirrors the server password policy (server/src/lib/password.ts). Returns an error message, or null when acceptable. */
export function checkNewPassword(p: string): string | null {
  if (p.length < 10) return 'Use at least 10 characters.'
  if (p.length > 128) return 'Use 128 characters at most.'
  if (/^\d+$/.test(p)) return 'Add some letters or symbols, not only digits.'
  return null
}

export type SignupInput = { email: string; password: string; firstName: string; lastName: string; major?: string; year?: number }

export const authApi = {
  /** Creates the account (or refreshes an unverified one) and mails a 6-digit code. Never says whether the email is taken. */
  async register(input: SignupInput): Promise<void> {
    await http('/api/auth/register', { method: 'POST', body: { ...input, email: input.email.trim() } })
  },
  /** Confirms the email with the code and starts the session. */
  async verify(email: string, code: string): Promise<AuthUser> {
    const { user } = await http<{ user: AuthUser }>('/api/auth/verify', { method: 'POST', body: { email: email.trim(), code: code.trim() } })
    return user
  },
  /** Mails a new sign-up code (at most one per minute; the server stays silent otherwise). */
  async resend(email: string): Promise<void> {
    await http('/api/auth/resend', { method: 'POST', body: { email: email.trim() } })
  },
  /** Mails a password reset code if the account exists. Same answer either way. */
  async forgot(email: string): Promise<void> {
    await http('/api/auth/forgot', { method: 'POST', body: { email: email.trim() } })
  },
  /** Sets a new password with the reset code and starts the session. */
  async reset(email: string, code: string, password: string): Promise<AuthUser> {
    const { user } = await http<{ user: AuthUser }>('/api/auth/reset', { method: 'POST', body: { email: email.trim(), code: code.trim(), password } })
    return user
  },
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
