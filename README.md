# SMUhub

The private home of SMU students: a shared resource library, peer Q&A, an anonymous-capable Campus Voice, events, student rentals, and a leaderboard that rewards people who help others.

## Status

| Part | State |
| --- | --- |
| `client/` | React 19 + TypeScript + Vite + Tailwind 4. Auth uses the real API; resources, Q&A and events still run on `client/src/api/mock.ts`. |
| `server/` | Express 5 + TypeScript + MongoDB (Mongoose). Auth done: login, logout, `/api/auth/me`, `requireAuth` middleware. |
| Auth | SMU email + password, JWT in an HttpOnly cookie. Only `ALLOWED_EMAIL_DOMAINS` can sign in. Sign-up (US-01) not built yet. |

## Run locally

Needs Node 20+, pnpm, and MongoDB running on `localhost:27017` (database `SMUhub`, created automatically).

```bash
# 1. API (terminal 1)
cd server
npm install
cp .env.example .env      # then set JWT_SECRET to a long random string
npm run seed              # adds 2 test students
npm run dev               # http://localhost:4000

# 2. Web client (terminal 2)
cd client
pnpm install
pnpm dev                  # http://localhost:5173, /api is proxied to :4000
```

Test accounts after `npm run seed`: `yasmine.trabelsi@medtech.tn` and `ahmed.benali@msb.tn`, password `SmuTest2026!`.

`npm test` in `server/` runs the API tests against a throwaway `smuhub_test` database.

## Protecting a new API route

```ts
import { requireAuth } from '../middleware/requireAuth.js'
router.get('/resources', requireAuth, (req, res) => { /* req.user is the signed-in student */ })
// or for a whole router, in app.ts:
app.use('/api/resources', requireAuth, resourcesRouter(config))
```

## Layout

```
client/src/api/      types, rules, seed data, mock.ts (the API contract)
client/src/pages/    one file per screen
client/src/components/  shell, cards, UI primitives
docs/BACKEND.md      what the server must implement and enforce
server/src/          config, models, routes, middleware (requireAuth), scripts/seed.ts
server/test/         API tests (node:test + supertest)
```

## Working together

- Nobody pushes to `main`. Work on a branch (`feature/login`, `fix/search-bug`) and open a pull request.
- Write specific commit messages.
