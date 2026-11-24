# Part 10: Running it for real

Building it is half the job. Keeping it working, knowing when it breaks, and fixing it fast is the other half.

## Observability: logs, metrics, traces

### Logs: what happened

```json
{ "time": "2026-11-10T09:14:02Z", "level": "error", "requestId": "a1b2", "msg": "action failed", "error": "TimeoutError" }
```

- Use **structured logs** (JSON), not loose sentences, so you can search and filter them.
- Include a **request id** so you can follow one request through every log line. (PLOS sends `x-request-id` all the way into `audit_logs`.)
- Levels: `debug` < `info` < `warn` < `error`.
- **Never log passwords, tokens or personal data.** PLOS logs only the error *name*, never the input.

### Metrics: how much, how fast

Numbers over time. The **four golden signals** (from Google's SRE book):

| Signal | Question | Example |
| --- | --- | --- |
| **Latency** | How long do requests take? | p50 = 80 ms, p99 = 900 ms |
| **Traffic** | How many requests? | 120 per second |
| **Errors** | How many fail? | 0.3% return 5xx |
| **Saturation** | How full is the system? | CPU 85%, DB connections 90/100 |

**Use percentiles, not averages.** An average of 100 ms can hide 1% of users waiting 5 seconds. p99 = "99% of requests were faster than this".

### Traces: where the time went

One request, broken into steps:

```
POST /workouts                         ███████████████████████  240 ms
├── auth check                         ██                        18 ms
├── validate                           █                          2 ms
├── db: insert session                 ████                      40 ms
├── db: insert sets (x12, one by one)  ██████████████           170 ms   ← the problem
└── revalidate                         █                         10 ms
```

**OpenTelemetry** is the standard for collecting traces.

### Tools

| Need | Tools |
| --- | --- |
| Error tracking | Sentry (on the PLOS v2 roadmap), Rollbar, Bugsnag |
| Logs | Vercel logs, Better Stack, Axiom, Datadog, Grafana Loki |
| Metrics and dashboards | Grafana + Prometheus, Datadog, New Relic |
| Uptime checks | Better Stack, UptimeRobot, Checkly (hitting `/api/health` every minute) |
| Traces | Honeycomb, Grafana Tempo, Datadog APM, Jaeger |

## Alerts and SLOs

- **SLI** (indicator): what you measure. "% of requests under 500 ms."
- **SLO** (objective): your target. "99.5% of requests under 500 ms over 30 days."
- **SLA** (agreement): a promise to customers, with penalties. Set it looser than your SLO.
- **Error budget:** 99.5% means 0.5% may fail. Budget left → ship features. Budget gone → fix reliability.

Alert on **symptoms users feel** (error rate up, site down), not on every CPU spike. Too many alerts and people start ignoring them.

## Backups and recovery

> A backup you've never restored is not a backup. It's a hope.

- **RPO** (recovery point objective): how much data can you lose? "Last 24 hours" → daily backups. "5 minutes" → continuous backups (Point-in-Time Recovery).
- **RTO** (recovery time objective): how long can you be down? "1 hour" → you need a practised restore process.
- **3-2-1 rule:** 3 copies, on 2 kinds of storage, 1 somewhere else.
- **Test restores** regularly.

**PLOS:** Supabase takes database backups, *and* the app exports a full JSON/Excel/ZIP backup with checksums, which can be re-imported. See [RESTORE.md](../RESTORE.md).

## Migrations and schema changes

- Every change is a new, numbered file, applied in order. Never edit one that already ran in production (PLOS rule).
- Run them in CI against a fresh database to catch mistakes.
- Big tables: adding an index can lock writes. Use `create index concurrently` in Postgres.
- Use expand → migrate → contract for zero downtime ([Part 9](09-hosting-and-deployment.md)).
- Keep generated types in sync (PLOS: `pnpm db:types`).

## Testing

The **testing pyramid**:

```
        ╱ E2E ╲            few, slow, test real user journeys      (Playwright: tests/e2e)
      ╱ Integration ╲      some: code + real DB together            (tests/db/security.test.ts)
    ╱      Unit       ╲    many, fast, pure functions               (src/lib/*.test.ts with Vitest)
```

- **Unit:** pure logic. `analytics.test.ts` checks totals without a database.
- **Integration:** real database, real rules. PLOS's security test proves another user can't read your rows. This kind of test catches the scariest bugs.
- **E2E:** a robot clicks through the app in a browser. Slow, but catches what users would hit.
- **Load testing:** k6, Artillery, Locust. Find out where it breaks *before* users do.
- **Contract tests:** check that an API still matches what its clients expect.

## Incidents

When something breaks:

1. **Detect:** an alert or a user report.
2. **Mitigate first:** roll back, switch off the feature flag, scale up. Stop the bleeding before finding the root cause.
3. **Communicate:** a status page, a note to users.
4. **Fix the root cause.**
5. **Postmortem, blameless:** what happened, why, and what will stop it from happening again. Focus on systems, not people.

## Common failure stories (and the fix)

| What happened | Why | Fix |
| --- | --- | --- |
| Site slow every morning at 9 | Everyone logs in; one query does a full table scan | Add an index; cache the dashboard |
| "Too many connections" on deploy | Each serverless function opened its own DB connection | Connection pooler or HTTP driver |
| Users charged twice | Client retried a payment request | Idempotency keys |
| Data from user A shown to user B | A cache key didn't include the user id | Put the user in every per-user cache key; RLS as a safety net |
| Whole app down when the email provider died | Signup waited for the email to send | Send emails from a queue, with timeouts |
| Disk full, database stopped | Logs and audit rows grew forever | Retention policies, partitions, disk alerts |
| A migration locked a big table for 10 minutes | Added a column with a default on an old Postgres, or built an index without `concurrently` | Test migrations on a copy of production; online-safe migration patterns |
| Secret key leaked on GitHub | Committed `.env` | `.gitignore`, secret scanning, rotate immediately |
| The whole region went down | Everything was in one zone | Multi-zone first; multi-region only if the business needs it |
