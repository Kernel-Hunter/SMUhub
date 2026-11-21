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
| Sign in / sign out (US-02) | Done. Real API, bcrypt-hashed passwords, session in an HttpOnly cookie. |
| SMU-only access (US-03) | Done for auth: email domain checked at login and on every request, `requireAuth` middleware, client redirects to `/login`. Every new API route must use `requireAuth`. |
| Sign-up (US-01) | Not built yet. Accounts come from `npm run seed`. |
| Resources, Q&A, Campus Voice, events, rentals, leaderboard | UI done, still running on the in-browser mock (`client/src/api/mock.ts`). Each needs its API routes. |

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
# edit .env and set JWT_SECRET (see Configuration)
npm run seed              # creates the database and 2 test students
npm run dev               # http://localhost:4000
```

```bash
# Terminal 2: web client
cd client
pnpm install
pnpm dev                  # http://localhost:5173
```

Open http://localhost:5173 and sign in with a test account:

| Email | Password |
| --- | --- |
| `yasmine.trabelsi@medtech.tn` | `SmuTest2026!` |
| `ahmed.benali@msb.tn` | `SmuTest2026!` |

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

| Collection | Fields | Indexes |
| --- | --- | --- |
| `users` | `email` (lowercase, trimmed), `passwordHash` (bcrypt, never returned by the API), `firstName`, `lastName`, `major`, `year`, `createdAt` | `_id`, `email_1` (unique) |

`npm run seed` can be run again at any time: it updates the two test students and resets their password.

MongoDB refuses two databases whose names differ only by case (`smuhub` and `SMUhub`). If the seed fails with "db already exists with different case", drop the old one in Compass or point `MONGODB_URI` at the existing name.

## API

Base URL `http://localhost:4000` (or `/api` through the Vite proxy). Errors always have the shape `{ "error": { "code": "...", "message": "..." } }`.

| Method | Path | Auth | Body | Response |
| --- | --- | --- | --- | --- |
| `GET` | `/api/health` | no | | `200 { ok: true }` |
| `POST` | `/api/auth/login` | no | `{ email, password }` | `200 { user }` and sets the session cookie. `400` invalid input, `403` email domain not allowed, `401` "Email ou mot de passe incorrect.", `429` too many failed attempts |
| `POST` | `/api/auth/logout` | no | | `204`, clears the session cookie |
| `GET` | `/api/auth/me` | yes | | `200 { user }` or `401` |

`user` is `{ id, email, firstName, lastName, major, year, createdAt }`. The password hash is never sent.

`client/src/api/mock.ts` is the reference for every endpoint that still has to be built, and `docs/BACKEND.md` lists the rules the server must enforce (ownership checks, rate limits, file checks, leaderboard integrity).

### How authentication works

- Passwords are hashed with bcrypt (12 rounds). An unknown email takes as long to reject as a wrong password, and both get the same message, so the API does not reveal which accounts exist.
- On login the server sets `smuhub_session`: a signed JWT (HS256, `JWT_SECRET`) holding only the user id, in an `HttpOnly; SameSite=Lax` cookie, `Secure` in production, expiring after `SESSION_DAYS`. JavaScript in the page cannot read it.
- `requireAuth` checks the token, reloads the user from the database and re-checks the email domain on every request. Removing a domain from `ALLOWED_EMAIL_DOMAINS` locks its users out immediately.
- Also in place: `helmet` security headers, CORS limited to `CLIENT_URL`, JSON bodies capped at 10 KB, input validation with Zod.
- Known limit: a JWT stays valid until it expires even after logout on another device.

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
| `server/` | `npm test` | Run the API tests (needs MongoDB; uses a throwaway `smuhub_test` database) |
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
      mock.ts             in-browser mock for the features not on the API yet
      types.ts rules.ts seed.ts
    auth/AuthContext.tsx  session state, waits for /api/auth/me before rendering
    components/           Shell (sidebar, top bar), Banner, Cards, UI primitives
    pages/                one file per screen
    index.css             design tokens (colours, radius, type, shadows)
  vite.config.ts          dev proxy /api -> server
server/
  src/
    config/env.ts         reads and validates .env
    models/User.ts        user schema, public user shape
    routes/auth.ts        login, logout, me
    middleware/requireAuth.ts
    lib/                  password hashing, session cookie, email checks, errors
    scripts/seed.ts       test students
    app.ts                Express app (helmet, CORS, routes, error handler)
    index.ts              connects to MongoDB and starts the server
  test/auth.test.ts       API tests (node:test + supertest)
docs/BACKEND.md           rules the API must enforce
```

## Design system

All colours, radii, type sizes and shadows are tokens in `client/src/index.css`. Change them there, never in components.

- SMU colours: accent `#007fa4` for primary buttons, links, the active nav item and focus; night blue `#203549` for titles only.
- Cool neutral greys; green and red only for states (solved, accepted, error, deadline). Every text colour pair passes WCAG AA in light and dark mode.
- No gradients, glows or decorative background patterns. Cards are separated by 1px borders; the only shadow is a light neutral one for menus, popovers and toasts.
- Radius 6px (buttons, fields, chips), 8px (cards, menus), 10px (panels). Text sizes 12, 14, 16, 20 and 28px. Spacing on a 4px grid.
- Font: IBM Plex Sans, IBM Plex Mono for course codes.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Vite shows `http proxy error ... ECONNREFUSED` | The API is not running. Start it with `npm run dev` in `server/`. |
| `Can't resolve '@fontsource-variable/ibm-plex-sans'` (or another package) after `git pull` | Dependencies changed. Run `pnpm install` in `client/` (or `npm install` in `server/`). |
| The API stops with `Invalid server configuration` | A variable in `server/.env` is missing or wrong; the message names it. |
| Login always says "Email ou mot de passe incorrect." | Run `npm run seed`, and check that the API's `MONGODB_URI` points at the database you seeded. Restart `npm run dev` after editing `.env`. |
| `Port 4000 (or 5173) is already in use` | Another copy is still running. Stop it or change `PORT` / the Vite port. |
| `db already exists with different case` | See the note in [Database](#database). |

## Working together

- Nobody pushes to `main`. Work on a branch named after the change (`feature/login`, `fix/search-bug`, `docs/readme`) and open a pull request.
- Write specific commit messages that say what changed and why, not "update" or "fix".
- Keep secrets out of git: `.env` files are ignored, share values another way.
- Before opening a pull request: `npm test` and `npm run typecheck` in `server/`, `pnpm build` in `client/`.
