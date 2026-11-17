# Backend contract

`client/src/api/mock.ts` is the reference implementation. Every method there maps to one REST endpoint. Swap the object for `fetch` calls with the same signatures and the UI needs no other change. The client is never trusted: every rule below must be enforced on the server.

## Authentication (Moodle)

Students sign in with their Moodle credentials. Recommended flow:

1. `POST /api/auth/login {username, password}`.
2. Server forwards the credentials to `${MOODLE_URL}/login/token.php` with `service=moodle_mobile_app`, then calls `core_webservice_get_site_info` for the user id and full name.
3. Discard the Moodle token. Never store or log the password.
4. Create a server-side session: random 256-bit token in an `HttpOnly; Secure; SameSite=Lax` cookie, store only its SHA-256 hash. Identify users by Moodle user id.
5. Rate-limit login per IP and per username.

Verify before building on it: the university must have Moodle mobile web services enabled, and accounts must have local passwords (not SSO-only). If Moodle uses Microsoft SSO, use tenant-restricted Microsoft sign-in or an email OTP to `@medtech.tn` instead. Keep auth behind one interface so this is a one-file change.

Tell students plainly that they type their Moodle password into SMUhub.

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
