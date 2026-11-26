# SMUhub

The private home of SMU students: a shared resource library, peer Q&A, an anonymous-capable Campus Voice, events, student rentals, and a leaderboard that rewards people who help others.

One repository, two apps:

| Folder | What it is | Stack |
| --- | --- | --- |
| `client/` | Web app | React 19, TypeScript, Vite, Tailwind CSS 4, TanStack Query, React Router |
| `server/` | REST API | Node, Express 5, TypeScript, MongoDB with Mongoose, Zod |

## Status

| Area | State |
| --- | --- |
Every feature runs on the real API and the shared MongoDB database. The client keeps no data of its own.

| Area | State |
| --- | --- |
| Sign-up, email code, password reset (US-01) | Done. SMU domains only, 6-digit code by mail (printed in the API console when no SMTP is set up in development). |
| Sign in / sign out (US-02) | Done. bcrypt-hashed passwords, session in an HttpOnly cookie, a password reset ends every other session. |
| SMU-only access (US-03) | Done. Email domain checked at login and on every request by `requireAuth`. |
| Course library | Done. Uploads stored in MongoDB (GridFS), type checked on the bytes, duplicates rejected, 5 uploads a day, verified after 3 helpful ratings. |
| Q&A and Campus Voice | Done. One vote per student, no self-votes, accepted answers, anonymous posts that never reveal their author. |
| Calendar and rentals | Done. The owner's contact is shown only to the renter they accept. |
| XP and leaderboard | Done. Append-only ledger, daily and per-classmate caps, all points computed on the server. |
| Hosting | Ready. One build, one server: the API serves the web app in production (see [Deploying](#deploying)). |

## Prerequisites

- **Node.js 20 or newer**
- **pnpm** for the client (the version is pinned in `client/package.json`, Corepack picks it up), **npm** for the server
- **MongoDB** running locally on `localhost:27017` (MongoDB Community Server, view it with MongoDB Compass), or a MongoDB Atlas connection string

## Quick start

Open two terminals.

```bash
# Terminal 1: API
cd server
npm install
cp .env.example .env      # Windows PowerShell: Copy-Item .env.example .env
# edit .env and set JWT_SECRET and SEED_PASSWORD (see Configuration)
npm run seed              # creates the database and 2 test students
npm run dev               # http://localhost:4000
```

```bash
# Terminal 2: web client
cd client
pnpm install
pnpm dev                  # http://localhost:5173
```

Open http://localhost:5173 and sign in with a test account. The password is the `SEED_PASSWORD` value in `server/.env`:

| Email | Password |
| --- | --- |
| `yasmine.trabelsi@medtech.tn` | `SEED_PASSWORD` |
| `ahmed.benali@msb.tn` | `SEED_PASSWORD` |

Start the API first. If it is not running, the Vite terminal shows `http proxy error: /api/auth/me ECONNREFUSED` and the login page says it cannot reach the server.

## Configuration

### `server/.env`

Copy `server/.env.example` to `server/.env`. The server validates these values at startup and stops with a clear message if one is missing or wrong. Never commit `.env`; it is git-ignored.

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `MONGODB_URI` | yes | | Connection string, e.g. `mongodb://localhost:27017/SMUhub` |
| `JWT_SECRET` | yes | | At least 32 characters. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `ALLOWED_EMAIL_DOMAINS` | yes | | Comma-separated SMU domains allowed to sign in, e.g. `smu.tn,medtech.tn,msb.tn` |
| `CLIENT_URL` | no | `http://localhost:5173` | Origin of the web app, used for CORS with credentials |
| `PORT` | no | `4000` | API port |
| `SESSION_DAYS` | no | `7` | How long a login lasts (max 30) |
| `LOGIN_RATE_LIMIT` | no | `10` | Failed login attempts allowed per IP per 15 minutes |
| `AUTH_RATE_LIMIT` | no | `50` | Sign-up, resend, forgot, verify and reset requests per IP per 15 minutes |
| `SMTP_URL` and `MAIL_FROM` | in production | | Mail server for sign-up and reset codes, e.g. `smtp://user:pass@smtp.example.com:587` and `SMUhub <no-reply@smu.tn>`. Without them, development prints codes in the API console and production refuses sign-ups. |
| `TRUST_PROXY` | behind a proxy | `0` | Number of proxies in front of the API (usually `1` on a hosting platform), so rate limits see real student IPs |
| `CLIENT_DIST` | no | `../client/dist` in production | Built web app the API serves |
| `SEED_PASSWORD` | for `npm run seed` | | Password given to the test students (8 to 128 characters). Only read by the seed script. |
| `NODE_ENV` | no | `development` | `production` turns on the `Secure` cookie flag (HTTPS only) |

### `client/.env.local` (optional)

The defaults work for local development. Copy `client/.env.example` to `client/.env.local` only to change them.

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | empty | Leave empty in development: the client calls `/api` and Vite proxies it. Set it when the API is on another origin. |
| `API_PROXY_TARGET` | `http://localhost:4000` | Where the Vite dev proxy sends `/api` requests |
| `VITE_ALLOWED_EMAIL_DOMAINS` | `smu.tn,medtech.tn,msb.tn` | Mirror of the server list, used for instant feedback on the login form. The server always decides. |

## Database

MongoDB database `SMUhub` (the name comes from `MONGODB_URI`). You do not need to create anything by hand: the database, the `users` collection and the unique index on `email` are created by Mongoose and `npm run seed`.

| Collection | What it holds |
| --- | --- |
| `users` | Students: email (unique), bcrypt `passwordHash` (never returned), names, major, year, bio, courses, role, `emailVerified`, `tokenVersion` |
| `verificationcodes` | Sign-up and reset codes, stored as HMACs, deleted automatically when they expire |
| `ledgers` | The XP ledger: append-only rows with a unique `refKey`, so one event pays once |
| `resources`, `downloads`, `ratings` | Library files (metadata and SHA-256), who downloaded what, helpful ratings |
| `resources.files`, `resources.chunks` | The uploaded files themselves (GridFS) |
| `threads`, `replies` | Questions and Campus Voice posts, answers and replies |
| `events`, `announcements`, `rentalitems`, `rentalrequests` | Calendar events, announcements, rental listings and requests |

`npm run seed` can be run again at any time. It upserts two test students (password `SEED_PASSWORD`) and demo questions, Voice posts, events, announcements, rentals and library files, matched by email, title or file hash, so nothing is duplicated and no XP is paid twice. Never run it against the shared database without agreeing with the team first.

MongoDB refuses two databases whose names differ only by case (`smuhub` and `SMUhub`). If the seed fails with "db already exists with different case", drop the old one in Compass or point `MONGODB_URI` at the existing name.

## API

Base URL `http://localhost:4000` (or `/api` through the Vite proxy). Errors always have the shape `{ "error": { "code": "...", "message": "..." } }`.

| Method | Path | Auth | Body | Response |
| --- | --- | --- | --- | --- |
| `GET` | `/api/health` | no | | `200 { ok: true }` |
| `POST` | `/api/auth/login` | no | `{ email, password }` | `200 { user }` and sets the session cookie. `400` invalid input, `403` email domain not allowed, `401` "Wrong email or password.", `429` too many failed attempts |
| `POST` | `/api/auth/logout` | no | | `204`, clears the session cookie |
| `GET` | `/api/auth/me` | yes | | `200 { user }` or `401` |
| `POST` | `/api/auth/register`, `/verify`, `/resend`, `/forgot`, `/reset` | no | see `docs/BACKEND.md` | sign-up with an email code, password reset |

`user` is `{ id, email, firstName, lastName, major, year, createdAt }`. The password hash is never sent.

Everything else needs a session. Each router lives in `server/src/routes/`:

| Prefix | What it serves |
| --- | --- |
| `/api/me` | Your profile (`GET`, `PATCH`) and XP history (`GET /xp`) |
| `/api/users/:id` | A classmate's public profile: no email, no anonymous content |
| `/api/leaderboard?period=week\|all` | Top 50 by XP |
| `/api/resources` | Library: list, upload (multipart), download (`/:id/file`), rate helpful, remove |
| `/api/questions` | Q&A: ask, answer, vote, accept |
| `/api/voice` | Campus Voice: post (optionally anonymous), reply, vote |
| `/api/events` | Calendar: list, add, join or leave |
| `/api/announcements` | Short notices: list (`?course=`), post, delete your own (admins can pin and delete any) |
| `/api/rentals` | List items, request, accept or decline, mark returned |

`client/src/api/client.ts` is the typed client for these, and `docs/BACKEND.md` lists the rules the server enforces (ownership checks, rate limits, file checks, leaderboard integrity, privacy).

### How authentication works

- Passwords are hashed with bcrypt (12 rounds). An unknown email takes as long to reject as a wrong password, and both get the same message, so the API does not reveal which accounts exist.
- On login the server sets `smuhub_session`: a signed JWT (HS256, `JWT_SECRET`) holding only the user id, in an `HttpOnly; SameSite=Lax` cookie, `Secure` in production, expiring after `SESSION_DAYS`. JavaScript in the page cannot read it.
- `requireAuth` checks the token, reloads the user from the database and re-checks the email domain on every request. Removing a domain from `ALLOWED_EMAIL_DOMAINS` locks its users out immediately.
- Also in place: `helmet` security headers, CORS limited to `CLIENT_URL`, JSON bodies capped at 10 KB, input validation with Zod.
- Known limit: logging out clears the cookie on that device only. A password reset ends every session.

### Protecting a new route

Every route that serves student data must sit behind `requireAuth`; the client-side redirect is not a security check.

```ts
// server/src/routes/resources.ts
import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'

export function resourcesRouter() {
  const router = Router()
  router.use(requireAuth)                     // every route below needs a signed-in SMU student
  router.get('/', async (req, res) => {
    // req.user is the signed-in student
  })
  return router
}

// server/src/app.ts
app.use('/api/resources', resourcesRouter())
```

## Scripts

| Where | Command | What it does |
| --- | --- | --- |
| `server/` | `npm run dev` | Start the API with reload on change |
| `server/` | `npm run seed` | Create or reset the test students |
| root | `npm run build` then `npm start` | Build both apps and run the production server (API and web app on one port) |
| `server/` | `npm test` | Run the API tests (needs a local MongoDB; each test file uses its own throwaway `smuhub_test_*` database) |
| `server/` | `npm run typecheck` | Type-check source and tests |
| `server/` | `npm run build` then `npm start` | Compile to `dist/` and run the compiled API |
| `client/` | `pnpm dev` | Start the web app on port 5173 |
| `client/` | `pnpm build` | Type-check and build to `dist/` |
| `client/` | `pnpm preview` | Serve the production build locally |
| `client/` | `pnpm typecheck` | Type-check only |

## Project layout

```
client/
  public/                 SMU logo and favicons
  src/
    api/
      http.ts             fetch wrapper for the real API (cookies included)
      auth.ts             login, logout, current user, SMU email check
      client.ts           typed client for every other endpoint (resources, Q&A, events...)
      types.ts rules.ts courses.ts
    auth/AuthContext.tsx  session state, waits for /api/auth/me before rendering
    components/           Shell (sidebar, top bar), Banner, Cards, UI primitives
    pages/                one file per screen
    index.css             design tokens (colours, radius, type, shadows)
  vite.config.ts          dev proxy /api -> server
server/
  src/
    config/env.ts         reads and validates .env
    models/               Mongoose schemas (users, ledger, resources, threads, events, rentals, codes)
    routes/               one router per area (auth, me, users, leaderboard, resources, questions, voice, events, rentals)
    middleware/requireAuth.ts
    lib/                  XP awards, file checks, mailer, codes, sessions, passwords, errors
    scripts/seed.ts       test students and demo content
    app.ts                Express app (helmet, CORS, routes, web app in production, error handler)
    index.ts              connects to MongoDB and starts the server
  test/                   API tests (node:test + supertest), one file per area
docs/BACKEND.md           rules the API must enforce
```

## Design system

All colours, radii, type sizes and shadows are tokens in `client/src/index.css`. Change them there, never in components.

- SMU colours: accent `#007fa4` for primary buttons, links, the active nav item and focus; night blue `#203549` for titles only.
- Cool neutral greys; green and red only for states (solved, accepted, error, deadline). Every text colour pair passes WCAG AA in light and dark mode.
- No gradients, glows or decorative background patterns. Cards are separated by 1px borders; the only shadow is a light neutral one for menus, popovers and toasts.
- Radius 6px (buttons, fields, chips), 8px (cards, menus), 10px (panels). Text sizes 12, 14, 16, 20 and 28px. Spacing on a 4px grid.
- Font: IBM Plex Sans, IBM Plex Mono for course codes.

## Deploying

The API serves the built web app, so one Node service is enough (Render, Railway, Fly.io, a VPS). Use MongoDB Atlas for the database.

1. Build command: `npm run build` (at the repository root). Start command: `npm start`.
2. Set the environment variables: `NODE_ENV=production`, `MONGODB_URI` (Atlas, with a user that has `readWrite` on the `SMUhub` database only), a fresh `JWT_SECRET`, `ALLOWED_EMAIL_DOMAINS`, `CLIENT_URL` (the public `https://` address), `TRUST_PROXY=1`, and `SMTP_URL` plus `MAIL_FROM` so students receive their codes.
3. Serve it over HTTPS only. Session cookies are `Secure` in production and the browser drops them on plain HTTP.
4. Check `https://your-address/api/health` answers `{ "ok": true }`, then create an account with your SMU email.

Limits to know before scaling past one instance: XP awards and upload limits are serialized per student inside one process, and rate limits are kept in memory. With several instances, move them to the database or Redis.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Vite shows `http proxy error ... ECONNREFUSED` | The API is not running. Start it with `npm run dev` in `server/`. |
| `Can't resolve '@fontsource-variable/ibm-plex-sans'` (or another package) after `git pull` | Dependencies changed. Run `pnpm install` in `client/` (or `npm install` in `server/`). |
| The API stops with `Invalid server configuration` | A variable in `server/.env` is missing or wrong; the message names it. |
| Login always says "Wrong email or password." | Run `npm run seed`, and check that the API's `MONGODB_URI` points at the database you seeded. Restart `npm run dev` after editing `.env`. |
| `Port 4000 (or 5173) is already in use` | Another copy is still running. Stop it or change `PORT` / the Vite port. |
| `db already exists with different case` | See the note in [Database](#database). |

## Working together

- Nobody pushes to `main`. Work on a branch named after the change (`feature/login`, `fix/search-bug`, `docs/readme`) and open a pull request.
- Write specific commit messages that say what changed and why, not "update" or "fix".
- Keep secrets out of git: `.env` files are ignored, share values another way.
- Before opening a pull request: `npm test` and `npm run typecheck` in `server/`, `pnpm build` in `client/`.
