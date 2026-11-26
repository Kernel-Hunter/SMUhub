# Backend contract

`client/src/api/client.ts` is the typed client for this API (auth calls are in `auth.ts`). The client is never trusted: every rule below must be enforced on the server.

## Authentication (implemented)

Students sign in with their SMU email and a password. Code: `server/src/routes/auth.ts`, `server/src/middleware/requireAuth.ts`.

- `POST /api/auth/login {email, password}`: email is trimmed and lowercased; its domain must be in `ALLOWED_EMAIL_DOMAINS` (403 otherwise). Bad email or password both answer 401 "Wrong email or password." Failed attempts are rate limited per IP.
- On success the server sets `smuhub_session`: a JWT (HS256, `JWT_SECRET`) holding only the user id, in an `HttpOnly; SameSite=Lax` cookie, `Secure` in production, expiring after `SESSION_DAYS`.
- `POST /api/auth/logout` clears the cookie (204). `GET /api/auth/me` returns `{ user }` or 401.
- `requireAuth` guards every protected route: valid token, user still exists, email domain still allowed. It sets `req.user`.
- Passwords are stored as bcrypt hashes (12 rounds) in `users.passwordHash`, never returned by the API.

### Sign-up and password reset

Code: `server/src/routes/auth.ts`, `server/src/lib/codes.ts`, `server/src/lib/mailer.ts`, `server/src/models/VerificationCode.ts`.

- `POST /api/auth/register {email, password, firstName, lastName, major?, year?}` answers `202 {pending: true}` and mails a 6-digit code. Allowed domains only; password 10 to 128 characters, not only digits; names 1 to 50. An email that already has a verified account gets the same 202, no mail, and its account is not touched. An unverified account is updated (password, names) and gets a new code.
- `POST /api/auth/verify {email, code, password}` marks the email verified, starts the session and returns `{user}`. The password must be the one currently on the account: re-registering an unconfirmed email replaces its password, so without this check a stranger could re-register and let the owner confirm an account that carries the stranger's password. Wrong or expired code: 400 `invalid_code`. After 5 wrong codes the code is burned: 429 `too_many_attempts`, even for the right one, until a new code is sent.
- `POST /api/auth/resend {email}` always 202; mails a new sign-up code only to an unverified account.
- `POST /api/auth/forgot {email}` always 202; mails a reset code only to a verified account.
- `POST /api/auth/reset {email, code, password}` sets the password, ends every other session, starts a new one and returns `{user}`.
- Login refuses an unverified account with 403 `email_not_verified`, only after the password matched.
- Codes: `crypto.randomInt`, stored as an HMAC-SHA256 (key `JWT_SECRET`, bound to purpose and email), valid 15 minutes, one active code per email and purpose, at most one mail per minute per email and purpose, single use.
- Mail: `SMTP_URL` + `MAIL_FROM` send through nodemailer. Without them, development prints `[mail] code for x@medtech.tn: 123456` in the server console, and production answers 503 `mail_unavailable` on register, resend and forgot.
- `AUTH_RATE_LIMIT` (default 50 per 15 minutes per IP, generous because a whole campus can share one IP) caps register/resend/forgot (every request) and verify/reset (failures only), each group separately.
- `users.emailVerified` has no default: accounts created before sign-up existed have no field and count as verified. `npm run seed` sets it to true.

Sessions: the JWT carries the user's `tokenVersion` (claim `tv`, missing = 0). `requireAuth` refuses a token whose version differs from the user's, and a password reset increments it, so every older session ends at once. Logout still only clears the cookie on the current device.

## Leaderboard integrity rules

Constants live in `client/src/api/rules.ts`.

- Points are computed on the server only. The client never sends a score.
- XP lives in an append-only ledger. Block UPDATE and DELETE with a DB trigger or permissions. Corrections are compensating rows (see `resources.remove`).
- Each ledger row has a unique `refKey` (`helpful:<voter>:<resource>`), so one event pays once.
- XP comes from other students: a rating from someone who downloaded the file, upvotes, accepted answers. Posting alone earns nothing.
- Forbidden: self-votes, self-awards, rating without downloading, changing a vote.
- Caps: 120 XP per day per student, 3 XP-earning interactions per voter-to-author pair per week, 5 uploads per day.
- Files: store SHA-256 and reject duplicates globally. Allowed types only: pdf, docx, pptx, xlsx, png, jpg (never html, svg, zip). Check magic bytes, size 10 KB to 25 MB. Hash on the server, not in the browser.
- Serve downloads with `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`, from a separate domain or signed URL, behind a session check.
- A resource is "verified" after 3 distinct downloaders rate it helpful.

## Privacy

- Anonymous posts and replies: the API omits the author for everyone, the author included (they get `mine: true`). Moderators can look up the real author in the database for abuse handling.
- Anonymous Voice posts earn no XP when upvoted: an XP jump right after an upvote would point at the author.
- Profiles never list anonymous content.
- Rental contact details are returned only to the renter after the owner accepts.

## Other rules

- Escape or render all user text as plain text. No raw HTML or Markdown from users.
- Validate all input with a schema on the server. `client.ts` mirrors some length limits only to show a message sooner.
- Check ownership on every edit and delete.
- Rate limits: 5 threads per hour, 8 replies per 10 minutes, 10 rental listings per student.
- No money moves through the platform. Rentals only connect students.
- Announcements (`/api/announcements`, `server/src/routes/announcements.ts`): title 5 to 120, message 10 to 2000, optional course and end date; 3 per student per 24 hours; only an admin can pin; the author or an admin deletes; expired ones are hidden; no XP.
