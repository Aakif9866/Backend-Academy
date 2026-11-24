# Part 8: System design, background work

Not everything should happen while the user waits. This part covers work that happens later, in the background, or on a schedule.

## Sync vs async

**Synchronous:** the user waits until the work is done.

```
User clicks "Sign up" ──▶ save user ──▶ send welcome email (2 s) ──▶ resize avatar (3 s) ──▶ "Done!"   (5+ s)
```

**Asynchronous:** do the must-have part now and queue the rest.

```
User clicks "Sign up" ──▶ save user ──▶ put 2 jobs in a queue ──▶ "Done!"   (100 ms)
                                              │
                                    Worker picks them up: email, avatar
```

**Rule of thumb:** if it's slow, can fail and be retried, or the user doesn't need the result right now, make it async.

Examples: emails, push notifications, image/video processing, PDF reports, imports, exports, calling slow third-party APIs, AI processing, search indexing.

## Message queues

A **queue** is a to-do list between services. **Producers** add jobs; **workers** (consumers) take them off and do them.

```
[ API ] ──▶ [ Queue: job, job, job ] ──▶ [ Worker 1 ]
                                    └──▶ [ Worker 2 ]
```

Why it helps:

- **Speed:** the API returns at once.
- **Smoothing spikes:** 10,000 signups in a minute? The queue holds them; workers get through them at their own pace.
- **Reliability:** if a worker crashes, the job stays in the queue and is retried.
- **Decoupling:** the API doesn't care how emails get sent.

| Tool | Type | Notes |
| --- | --- | --- |
| **BullMQ** | Node library on Redis | Most popular Node job queue |
| **Celery** | Python library on Redis/RabbitMQ | The Python standard |
| **RabbitMQ** | Message broker | Flexible routing, mature |
| **AWS SQS** | Managed queue | Simple, scales without limit |
| **Kafka** | Event log (see below) | Huge throughput, keeps history |
| **Inngest, Trigger.dev, QStash** | Serverless jobs over HTTP | Work on Vercel with no worker server |
| **pg-boss, Graphile Worker** | Queue inside Postgres | No extra infrastructure |
| **Supabase Queues (pgmq)** | Queue inside Postgres | Built into Supabase |

**Serverless note:** Vercel functions stop after the response, so you can't run a forever-running BullMQ worker there. Use a serverless job service (Inngest, Trigger.dev, QStash), or run workers on Render, Railway or Fly.

## Pub/sub and event-driven design

A queue is "one job, one worker". **Pub/sub** is "one event, many listeners".

```
Order placed ──▶ [ topic: order.placed ] ──▶ Email service   (send receipt)
                                        ├──▶ Kitchen service (start cooking)
                                        ├──▶ Analytics       (count it)
                                        └──▶ Loyalty service (add points)
```

The order service doesn't know or care who listens. Adding a new listener needs no change to the order service.

- **Kafka:** an append-only log that keeps events for days or forever. Consumers can replay history. Used for activity streams, analytics pipelines and syncing data between systems.
- **Others:** Google Pub/Sub, AWS SNS + SQS, Redis Streams, NATS.

**Event sourcing:** store every change as an event ("set added", "set edited") and rebuild the current state from them. A full history for free. More complex, though. PLOS's `audit_logs` is a lighter version: current state in tables, plus a history of every change.

**CQRS:** separate models for writing and reading. Writes go to normalised tables; reads come from pre-built views. PLOS's `daily_nutrition` view is a tiny example.

## Delivery guarantees

| Guarantee | Meaning | Risk |
| --- | --- | --- |
| At most once | Sent once, maybe lost | Lost emails |
| **At least once** | Retried until confirmed | **Duplicates**: the most common setting |
| Exactly once | Hard; usually "at least once + idempotency" | |

## Idempotency: doing it twice = doing it once

Networks fail. Clients retry. Queues redeliver. Your code **will** see the same request twice. Design for it.

**Bad:** `POST /payments { amount: 500 }` retried → the customer is charged twice.

**Good:** the client sends an **idempotency key**:

```
POST /payments
Idempotency-Key: 7f3c-...
{ amount: 500 }
```

The server stores the key with the result. A repeat with the same key returns the saved result and doesn't charge again. Stripe works exactly this way.

**PLOS does this already:** the browser makes each record's `id` before saving, and every save is an upsert. A double-tap updates the same row instead of creating a duplicate.

Other idempotent patterns:

- `PUT /workouts/w1` (set to this value) is naturally idempotent; `POST` (add one) isn't.
- `update stock set count = 5` is idempotent; `count = count - 1` isn't.
- Webhooks: store the event id; skip it if seen.

## Retries, backoff and dead-letter queues

- **Retry** temporary failures (timeouts, 503s). Don't retry permanent ones (400, invalid data).
- **Exponential backoff:** wait 1 s, 2 s, 4 s, 8 s... so you don't hammer a struggling service.
- **Jitter:** add randomness so 10,000 clients don't all retry at the same moment.
- **Dead-letter queue (DLQ):** after N failures, move the job aside for a human to look at, instead of retrying forever.
- **Timeouts on every outbound call.** A call with no timeout can hang a worker forever.
- **Circuit breaker:** after many failures, stop calling that service for a while and fail fast. Then try again carefully.

## Scheduled jobs (cron)

"Every day at 2 am, back up the database." "Every Monday, send the weekly summary."

```
0 2 * * *      →  every day at 02:00
*/15 * * * *   →  every 15 minutes
0 9 * * 1      →  Mondays at 09:00
```

Options: Vercel Cron (calls one of your routes on a schedule), GitHub Actions on a schedule, Supabase `pg_cron` (runs inside Postgres), Render cron jobs, Kubernetes CronJobs.

**Watch out:**

- If you run 3 servers, a naive cron runs 3 times. Use one scheduler or a lock.
- Make jobs idempotent: a rerun after a crash shouldn't double anything.
- Time zones: say whose 2 am you mean. (PLOS stores the owner's timezone in `preferences`.)

## Rate limiting

Limit how often someone can do something, to stop abuse and protect the system.

| Algorithm | How it works | Feel |
| --- | --- | --- |
| **Fixed window** | Count per minute; reset at :00 | Simple; allows a burst at window edges |
| **Sliding window** | Count over the last 60 s, rolling | Smoother, a bit more work |
| **Token bucket** | A bucket refills N tokens a second; each request takes one | Allows short bursts, steady average. Very common |
| **Leaky bucket** | Requests drain at a fixed rate | Very smooth output |

Limit by user id, IP address, or API key. Answer with `429 Too Many Requests` and a `Retry-After` header.

**PLOS example:** `rate_limit_hit` (a SQL function) allows 8 login attempts per window per client. Password changes allow 5.

Where to store counters: Redis or Upstash (fast, shared), Postgres (fine at low volume, as in PLOS), or at the edge (Cloudflare rules).

## Transactions across services: the saga pattern

Inside one Postgres database, a transaction makes several changes all-or-nothing. Across services (order service, payment service, stock service) you can't use one transaction.

A **saga** is a chain of steps, each with an "undo":

```
1. Create order (pending)       undo: cancel order
2. Charge card                  undo: refund
3. Reserve stock                undo: release stock
4. Confirm order
If step 3 fails → refund (undo 2) → cancel order (undo 1)
```

**Outbox pattern:** to save data *and* publish an event reliably, write both to your database in one transaction (the event goes in an `outbox` table). A separate process reads the outbox and publishes. That way you never save without publishing, or publish without saving.

## Backpressure

When work arrives faster than you can handle it, don't just fall over:

- Queue it (with a maximum size).
- Reject early with `429` or `503` so clients slow down.
- Shed low-priority work first (skip analytics, keep checkout).
- Scale workers on queue length.
