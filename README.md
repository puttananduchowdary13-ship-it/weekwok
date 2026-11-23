# WeekWok PantryPlanner

A family meal planner that tracks your pantry and builds a shopping list from what is missing.
Three tiers: **browser UI** (`public/`) → **Express REST API** → **SQLite database**.

## Run it

```bash
npm install
npm start          # http://localhost:3000
npm test           # unit + database tests (Node's built-in test runner)
```

Create an account on the sign-in screen. Each account gets its own demo pantry and plan.
Set `PORT` or `DB_FILE` to change the port or database location.

## Structure

| Folder | Responsibility |
| --- | --- |
| `server.js`, `app.js` | Start-up and Express wiring (security headers, error handler) |
| `routes/` | HTTP endpoints: auth, pantry, plan/recipes/shopping |
| `services/planner.js` | Pure logic: needs, deficits, shortage flags, costs, unit conversion |
| `services/planService.js` | Plan operations, including the transactional "cook" action |
| `services/authService.js` | Registration, login, sessions (scrypt password hashing) |
| `db/` | Connection, schema, seed data, queries |
| `utils/validators.js` | Server-side input validation |
| `public/` | 3D-styled frontend (`index.html`, `style.css`, `script.js`): sign-in screen, then every action is a `fetch` call to the API. No business data is stored in the browser |
| `tests/` | `planner.test.js` (logic) and `database.test.js` (services + validation) |

## API

All routes except `/api/auth/register` and `/api/auth/login` need `Authorization: Bearer <token>`.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register`, `/api/auth/login` | Returns `{ token, username }` |
| POST | `/api/auth/logout` | End the session |
| GET | `/api/recipes` | Recipe catalog with ingredients |
| GET / POST | `/api/pantry` | List stock (with status, expiry, after-plan) / add or top up an item |
| PATCH / DELETE | `/api/pantry/:id` | Change stock by `{ delta }` / remove item |
| GET / POST / DELETE | `/api/plan` | Meals / add `{ day, session, recipeId }` / clear plan |
| PATCH / DELETE | `/api/plan/:id` | Move to `{ day, session }` / remove |
| POST | `/api/plan/:id/cook` | Mark cooked and deduct stock (single transaction) |
| GET | `/api/shopping` | Missing items and estimated cost |
| POST | `/api/demo/reset` | Restore demo pantry and plan |

Shopping deficit for each ingredient: `max(0, needed by uncooked meals - in pantry)`.

## Notes

- Quantities are stored in base units (g, ml, pcs). kg and L are converted on input.
- SQLite uses `better-sqlite3`; if it is not installed the app falls back to Node 22's built-in `node:sqlite`.
- Security: scrypt password hashing, per-user data isolation, server-side validation, login/register rate limiting (20 attempts per 15 minutes per IP, answers 429), Content-Security-Policy and other security headers, `Cache-Control: no-store` on the API, and expired sessions are cleaned up at login.
- Tests: `tests/planner.test.js` (pure logic), `tests/database.test.js` (services and validation), `tests/rateLimit.test.js` (limiter) and `tests/api.test.js` (the real HTTP API end to end: auth, pantry, plan, shopping, ownership, bad input).
- Next steps worth adding for production: HTTPS, a shared session/rate-limit store such as Redis, and email-based password reset.
