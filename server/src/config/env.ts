import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z
    .string()
    .min(1, 'MONGODB_URI is required')
    .regex(/^mongodb(\+srv)?:\/\//, 'MONGODB_URI must start with mongodb:// or mongodb+srv://')
    .refine((v) => !/<db_(username|password)>/.test(v), 'MONGODB_URI still contains <db_username> or <db_password>: replace them with your Atlas credentials'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  SESSION_DAYS: z.coerce.number().positive().max(30).default(7),
  ALLOWED_EMAIL_DOMAINS: z.string().min(1, 'ALLOWED_EMAIL_DOMAINS is required'),
  CLIENT_URL: z.url().default('http://localhost:5173'),
  LOGIN_RATE_LIMIT: z.coerce.number().int().positive().default(10),
  AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(20),
  // Empty values in .env count as unset.
  SMTP_URL: z.string().trim().optional().transform((v) => v || undefined),
  MAIL_FROM: z.string().trim().optional().transform((v) => v || undefined),
})

export type Config = {
  env: 'development' | 'production' | 'test'
  port: number
  mongoUri: string
  jwtSecret: string
  sessionMs: number
  allowedDomains: string[]
  clientUrl: string
  /** Max login attempts per IP per 15 minutes. */
  loginRateLimit: number
  /** Max sign-up, resend, forgot, verify and reset requests per IP per 15 minutes, per group. */
  authRateLimit: number
  /** SMTP connection string for nodemailer (smtp://user:pass@host:587). Unset: codes are logged in development. */
  smtpUrl?: string
  /** Sender of the verification mails, e.g. "SMUhub <no-reply@smu.tn>". Required with SMTP_URL. */
  mailFrom?: string
}

/** Reads and validates the environment. Throws with a readable message when something is missing. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env)
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    throw new Error(`Invalid server configuration (check server/.env):\n${lines.join('\n')}`)
  }
  const e = parsed.data
  const allowedDomains = e.ALLOWED_EMAIL_DOMAINS.split(',').map((d) => d.trim().toLowerCase().replace(/^@/, '')).filter(Boolean)
  if (allowedDomains.length === 0) throw new Error('ALLOWED_EMAIL_DOMAINS must list at least one domain')
  if (e.SMTP_URL && !e.MAIL_FROM) throw new Error('MAIL_FROM is required when SMTP_URL is set')
  return {
    env: e.NODE_ENV,
    port: e.PORT,
    mongoUri: e.MONGODB_URI,
    jwtSecret: e.JWT_SECRET,
    sessionMs: e.SESSION_DAYS * 24 * 60 * 60 * 1000,
    allowedDomains,
    clientUrl: e.CLIENT_URL.replace(/\/$/, ''),
    loginRateLimit: e.LOGIN_RATE_LIMIT,
    authRateLimit: e.AUTH_RATE_LIMIT,
    smtpUrl: e.SMTP_URL,
    mailFrom: e.MAIL_FROM,
  }
}
