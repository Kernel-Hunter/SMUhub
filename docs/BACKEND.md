# Backend contract

`client/src/api/mock.ts` is the reference implementation. Every method there maps to one REST endpoint. Swap the object for `fetch` calls with the same signatures and the UI needs no other change. The client is never trusted: every rule below must be enforced on the server.

## Authentication (implemented)

Students sign in with their SMU email and a password. Code: `server/src/routes/auth.ts`, `server/src/middleware/requireAuth.ts`.

- `POST /api/auth/login {email, password}`: email is trimmed and lowercased; its domain must be in `ALLOWED_EMAIL_DOMAINS` (403 otherwise). Bad email or password both answer 401 "Email ou mot de passe incorrect." Failed attempts are rate limited per IP.
- On success the server sets `smuhub_session`: a JWT (HS256, `JWT_SECRET`) holding only the user id, in an `HttpOnly; SameSite=Lax` cookie, `Secure` in production, expiring after `SESSION_DAYS`.
- `POST /api/auth/logout` clears the cookie (204). `GET /api/auth/me` returns `{ user }` or 401.
- `requireAuth` guards every protected route: valid token, user still exists, email domain still allowed. It sets `req.user`.
- Passwords are stored as bcrypt hashes (12 rounds) in `users.passwordHash`, never returned by the API.

Known limit: a JWT stays valid until it expires even after logout on another device. If instant revocation is needed, add a `tokenVersion` on the user and check it in `requireAuth`.

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

- Anonymous posts and replies: the API must omit the author for everyone except the author. Moderators keep access to the real author for abuse handling.
- Profiles never list anonymous content.
- Rental contact details are returned only to the renter after the owner accepts.

## Other rules

- Escape or render all user text as plain text. No raw HTML or Markdown from users.
- Validate all input with a schema on the server. Mirror the length limits in `mock.ts`.
- Check ownership on every edit and delete.
- Rate limits: 5 threads per hour, 8 replies per 10 minutes, 10 rental listings per student.
- No money moves through the platform. Rentals only connect students.
