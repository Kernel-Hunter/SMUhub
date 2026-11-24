import nodemailer from 'nodemailer'
import type { Config } from '../config/env.js'
import type { CodePurpose } from '../models/VerificationCode.js'
import { CODE_TTL_MS } from './codes.js'

export type Mail = { to: string; subject: string; text: string }

/** Mails "sent" by an app built with NODE_ENV=test, oldest first. Tests read the codes from here; nothing leaves the process. */
export const outbox: Mail[] = []

export type Mailer = {
  /** False in production without SMTP_URL: sign-up and password reset must answer 503 instead of losing codes. */
  available: boolean
  sendCode: (to: string, purpose: CodePurpose, code: string) => Promise<void>
}

const minutes = Math.round(CODE_TTL_MS / 60_000)

function compose(to: string, purpose: CodePurpose, code: string): Mail {
  if (purpose === 'signup') {
    return {
      to,
      subject: 'Your SMUhub confirmation code',
      text: `Hello,\n\nYour SMUhub confirmation code: ${code}\n\nIt is valid for ${minutes} minutes. If you did not create an SMUhub account, you can ignore this email.\n\nSMUhub`,
    }
  }
  return {
    to,
    subject: 'Reset your SMUhub password',
    text: `Hello,\n\nYour code to choose a new SMUhub password: ${code}\n\nIt is valid for ${minutes} minutes. If you did not ask for this, you can ignore this email: your current password still works.\n\nSMUhub`,
  }
}

/**
 * Picks how codes reach the student:
 *   test        -> kept in `outbox` (never sent)
 *   SMTP_URL    -> sent with nodemailer, plain text, from MAIL_FROM
 *   development -> printed in the server console
 *   production without SMTP_URL -> unavailable
 */
export function createMailer(config: Config): Mailer {
  if (config.env === 'test') {
    return {
      available: true,
      sendCode: async (to, purpose, code) => { outbox.push(compose(to, purpose, code)) },
    }
  }
  if (config.smtpUrl) {
    const transport = nodemailer.createTransport(config.smtpUrl)
    return {
      available: true,
      sendCode: async (to, purpose, code) => { await transport.sendMail({ from: config.mailFrom, ...compose(to, purpose, code) }) },
    }
  }
  if (config.env === 'development') {
    return {
      available: true,
      sendCode: async (to, purpose, code) => { console.log(`[mail] code for ${to}: ${code} (${purpose})`) },
    }
  }
  console.warn('[mail] SMTP_URL is not set: sign-up and password reset will answer 503 until it is.')
  return {
    available: false,
    sendCode: async () => { throw new Error('No mail transport configured (SMTP_URL)') },
  }
}
