# SMUhub

The private home of SMU students: a shared resource library, peer Q&A, an anonymous-capable Campus Voice, events, student rentals, and a leaderboard that rewards people who help others.

## Status

| Part | State |
| --- | --- |
| `client/` | Done. React 19 + TypeScript + Vite + Tailwind 4. Runs on a mock API. |
| `server/` | Not started. Will replace `client/src/api/mock.ts` with real REST calls. |
| Auth | Planned: sign in through the university Moodle (see `docs/BACKEND.md`). |

## Run the client

```bash
cd client
pnpm install
pnpm dev        # http://localhost:5173
```

Any username and a password of 4+ characters signs you in while the mock API is active. Data lives in `localStorage`; use Settings, then "Reset demo data" to start over.

## Layout

```
client/src/api/      types, rules, seed data, mock.ts (the API contract)
client/src/pages/    one file per screen
client/src/components/  shell, cards, UI primitives
docs/BACKEND.md      what the server must implement and enforce
```

## Working together

- Nobody pushes to `main`. Work on a branch (`feature/login`, `fix/search-bug`) and open a pull request.
- Write specific commit messages.
