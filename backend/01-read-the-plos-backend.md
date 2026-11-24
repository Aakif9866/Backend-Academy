# Part 1: Reading the PLOS backend

The whole backend is under 1,000 lines of TypeScript plus the SQL migrations. You can read the important parts in an afternoon. Go in this order: each step builds on the one before.

## Step 1: How a request gets in (about 20 minutes)

| Order | File | Lines | What to look for |
| --- | --- | --- | --- |
| 1 | [src/proxy.ts](../../src/proxy.ts) | 48 | Runs before every page. Find the three redirects: no login → `/login`, owes two-step → `/mfa`, already logged in on `/login` → `/`. This is "middleware" in Express terms. |
| 2 | [src/lib/supabase/server.ts](../../src/lib/supabase/server.ts) | 46 | `createClient()`. See how it reads cookies, uses only the publishable key, and adds `x-request-id` and `x-plos-source` headers. |
| 3 | [src/lib/auth.ts](../../src/lib/auth.ts) | 32 | `getOwner()` returns `{ db, userId }` or `null`. `requireOwner()` is the page version that redirects. Note `cache(...)`: one check per request, shared by the whole page. |

**Try this:** in `getOwner`, find the two reasons it returns `null`. (Answer: not marked `plos_owner`, or still owes the two-step code.)

## Step 2: How data gets saved (about 30 minutes)

| Order | File | Lines | What to look for |
| --- | --- | --- | --- |
| 4 | [src/lib/actions/define.ts](../../src/lib/actions/define.ts) | 57 | The most important file. `defineAction` = owner check → Zod check → run handler → refresh pages → friendly errors. Also `must()`, which turns database error codes like `23505` into human messages. |
| 5 | [src/lib/schemas.ts](../../src/lib/schemas.ts) | 261 | Zod rules. Look at `workoutSchema`: every field has limits. Compare them with the `check (...)` rules in the SQL: the same rules exist in both places on purpose. |
| 6 | [src/lib/actions/records.ts](../../src/lib/actions/records.ts) | 135 | Every save. Notice most are one line: `defineAction(schema, handler)`. Look at `saveBudget` for a case with real logic, and `deleteRecord` for how a delete is limited to a fixed list of tables. |
| 7 | [src/lib/actions/auth.ts](../../src/lib/actions/auth.ts) | 141 | Sign in, sign out, two-step setup. Look at how failed logins are rate-limited and logged. |

**Try this:** follow `saveWorkout` from `records.ts` to the SQL function `save_workout` in `supabase/migrations/`. Why is it one SQL function instead of three separate inserts? (Answer: so it's all-or-nothing. See "transactions" in [Part 2](02-sql-vs-nosql.md).)

## Step 3: How data gets read (about 20 minutes)

| Order | File | Lines | What to look for |
| --- | --- | --- | --- |
| 8 | [src/lib/queries.ts](../../src/lib/queries.ts) | 119 | Reads for pages. `fetchAll` pages through results 1,000 rows at a time (Supabase caps one response). `getTimeline` merges many tables into one list. |
| 9 | Any page in `src/app/(app)/` | | Pages are Server Components: they `await` data directly. No `useEffect`, no `fetch('/api/...')`. |

## Step 4: The API routes (about 15 minutes)

| Order | File | Lines | What to look for |
| --- | --- | --- | --- |
| 10 | [src/app/api/health/route.ts](../../src/app/api/health/route.ts) | 15 | The simplest route. Good template. |
| 11 | [src/app/api/export/route.ts](../../src/app/api/export/route.ts) | 61 | A `GET` that streams a file. Same pattern as Express: check auth → validate query → do work → respond. |
| 12 | [src/app/api/import/route.ts](../../src/app/api/import/route.ts) | 70 | A `POST` that accepts an upload, checks it, then calls the `import_rows` SQL function. |
| 13 | [src/lib/backup/](../../src/lib/backup/) | | `tables.ts` (the list of tables), `format.ts` (pure logic, tested), `server.ts` (builds Excel/ZIP). |

## Step 5: The database (about 1 hour; take it slowly)

Read the migrations in `supabase/migrations/` in order. They're numbered by date.

| File | What's in it |
| --- | --- |
| `..._001_schema.sql` | Every table. Read `workout_sessions` and `workout_sets` closely: primary keys, foreign keys, `check` rules, `on delete cascade` vs `restrict`. |
| `..._002_security_audit.sql` | `private.is_owner()`, the RLS loop that adds a policy to every table, the audit trigger, the "audit log can't be changed" trigger. |
| `..._003_rpcs_views.sql` | SQL functions (`save_meal`, `save_workout`...) and views (`daily_nutrition`...). |
| `..._004` to `..._011` | Later changes: expenses, fixes, event times, planner, trackers, hardening. Each shows how to change a live database safely: a new file, never editing an old one. |

**Try this:** find the rule that makes `sleep_logs.duration_minutes` calculate itself. (Hint: `generated always as`.)

## Step 6: The tests (about 30 minutes)

| File | What it proves |
| --- | --- |
| [tests/db/security.test.ts](../../tests/db/security.test.ts) | The security rules really work: logged-out users and other users can't read or write anything. Needs local Supabase (`pnpm test:db`). |
| `src/lib/*.test.ts` | Pure logic: analytics, dates, Quran ranges, backups. Fast, no database. |
| `tests/e2e/*.spec.ts` | Playwright clicks through the real app in a browser. |

## Step 7: The hand-run scripts

| File | Why it's separate |
| --- | --- |
| `scripts/create-owner.mjs` | Creates the one owner account. Uses the secret key, which is exactly why it's a script you run by hand and not part of the app. |
| `scripts/owner-recovery.mjs` | For when you're locked out (for example, a lost two-step device). |
| `scripts/backup.mts` | Takes a backup from the command line. |

## A good exercise once you've read it all

Add a tiny new feature end to end, for example a "water glasses per day" log:

1. A new migration with a `water_logs` table: `id`, `user_id`, `logged_on`, `glasses`, plus RLS and the audit trigger (copy the pattern from migration 002).
2. `pnpm db:reset` then `pnpm db:types`.
3. A Zod schema in `schemas.ts`.
4. `saveWater = defineAction(waterSchema, ...)` in `records.ts`.
5. Add it to `src/lib/backup/tables.ts`.
6. A form and a page.

If you can do that, you understand the whole backend.
