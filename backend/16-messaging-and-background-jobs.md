# Part 16: Messaging systems and background jobs

[Part 8](08-system-design-async.md) introduced queues, pub/sub, idempotency and retries. This part compares the real tools, shows code, and works through common jobs end to end.

## Contents

1. [Message queues vs event streaming](#1-message-queues-vs-event-streaming)
2. [The tools compared](#2-the-tools-compared)
3. [Each tool in detail](#3-each-tool-in-detail)
4. [Delivery semantics and ordering](#4-delivery-semantics-and-ordering)
5. [Handling failed jobs](#5-handling-failed-jobs)
6. [Worked examples](#6-worked-examples)
7. [Choosing](#7-choosing)

---

## 1. Message queues vs event streaming

| | Message queue | Event stream (log) |
| --- | --- | --- |
| Mental model | A to-do list: each job is done **once** by **one** worker, then removed | A newspaper archive: events are **kept**; many readers each read at their own pace |
| After processing | Message deleted | Message stays (for the retention period, possibly forever) |
| Replay old messages | No | Yes: rewind a consumer to any offset |
| Many independent consumers | Needs fan-out (exchanges, SNS) | Built in (consumer groups) |
| Ordering | Usually best-effort (FIFO options exist) | Guaranteed **within a partition** |
| Typical tools | RabbitMQ, SQS, BullMQ, Celery | Kafka, Redis Streams, Kinesis, Pulsar |
| Use for | Tasks: send email, resize image, generate PDF | Facts: "order placed", "user clicked", feeding analytics, search, caches |

```
Queue:   [job3][job2][job1] ──▶ worker A takes job1, worker B takes job2   (each job once)

Stream:  [e1][e2][e3][e4][e5][e6] ...  (kept)
           ▲            ▲         ▲
     analytics      search    email service      (each group reads every event, at its own position)
```

**Command vs event:** a queue message is usually a *command* ("send the welcome email to user 42"). A stream message is usually an *event* ("user 42 signed up"), and each consumer decides what to do about it.

---

## 2. The tools compared

| | RabbitMQ | Apache Kafka | Redis Streams | AWS SQS | AWS SNS | BullMQ | Celery |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Kind | Message broker | Distributed event log | Log inside Redis | Managed queue | Managed pub/sub fan-out | Node job-queue library (on Redis) | Python task-queue library (on RabbitMQ/Redis/SQS) |
| Retention | Until consumed (Streams feature can retain) | Time/size-based, can be forever | Until trimmed (memory-bound) | Up to 14 days | None (push and forget) | Until done (keeps completed/failed for inspection) | Until done |
| Replay | Limited | Yes | Yes | No | No | No | No |
| Ordering | Per queue (with one consumer) | Per partition | Per stream | FIFO queues: per message group | FIFO topics available | Per queue (priorities change it) | Not guaranteed |
| Throughput | High (tens of thousands of msg/s per node) | Very high (millions/s across a cluster) | High | Nearly unlimited (standard) | Very high | High (Redis-bound) | Broker-bound |
| Ops effort | Medium | High (managed: Confluent, MSK, Redpanda) | Low if you already run Redis | None | None | Low (needs Redis) | Low–medium |
| Best for | Task routing, RPC, complex routing rules | Event backbone, analytics, CDC, high volume | Lightweight streams, chat fan-out | Simple, reliable AWS queues | Fan-out to many SQS queues/Lambdas/emails | Background jobs in Node | Background jobs in Python |

---

## 3. Each tool in detail

### RabbitMQ

- Producers send to an **exchange**; exchanges route to **queues** by rules:
  - **direct:** exact routing key (`email.send`).
  - **topic:** patterns (`order.*.paid`).
  - **fanout:** to every bound queue.
- Consumers **ack** after processing; un-acked messages are redelivered if the consumer dies.
- **Prefetch** (`basic.qos`) limits how many un-acked messages a worker holds, for fair load sharing.
- **Dead-letter exchange (DLX)** catches rejected or expired messages.
- Use **quorum queues** for durability (replicated).

**Use when:** you need flexible routing, priorities, per-message TTL, or classic work queues in any language.

### Apache Kafka

- A **topic** is split into **partitions**. Each partition is an ordered, append-only log.
- Messages with the **same key** go to the same partition → ordered per key (for example, all events for `order:o1` stay in order).
- **Consumer groups:** each partition is read by one consumer in a group, so you scale consumers up to the number of partitions.
- Consumers track their position (**offset**); they can rewind to replay.
- Replicated across brokers (replication factor 3 is common). Modern Kafka runs without ZooKeeper (KRaft mode).

```ts
// kafkajs producer: key = orderId keeps each order's events in order
await producer.send({
  topic: "orders",
  messages: [{ key: order.id, value: JSON.stringify({ type: "order.paid", orderId: order.id, at: Date.now() }) }],
});
```

**Use when:** high-volume event streams, several teams consuming the same events, replay, feeding analytics/search/caches, change data capture (Debezium).
**Avoid when:** you just need a job queue for a small app. Kafka is heavy to run and its per-job features (delays, per-job retries, priorities) aren't built in.

### Redis Streams

```
XADD orders * type order.paid orderId o1                       # append
XGROUP CREATE orders emailers $ MKSTREAM                       # consumer group
XREADGROUP GROUP emailers worker-1 COUNT 10 BLOCK 5000 STREAMS orders >
XACK orders emailers 1731234567890-0                           # done
XPENDING orders emailers                                       # delivered but not acked (find stuck ones)
XAUTOCLAIM ...                                                 # take over messages from a dead consumer
```

**Use when:** you already run Redis and need lightweight streams with consumer groups. **Watch:** memory-bound (trim with `MAXLEN`); durability depends on Redis persistence settings.

### AWS SQS and SNS

- **SQS Standard:** at-least-once, best-effort ordering, nearly unlimited throughput.
- **SQS FIFO:** ordered within a **message group id**, deduplication within a 5-minute window, lower throughput.
- **Visibility timeout:** when a worker receives a message, it's hidden for N seconds. If the worker doesn't delete it in time (crash, or slow), it reappears for another worker. Set it longer than your longest processing time.
- **Redrive policy:** after `maxReceiveCount` failed receives → dead-letter queue.
- **SNS → SQS fan-out:** publish once to an SNS topic; each subscribed SQS queue (email service, analytics, search) gets its own copy.
- **Lambda** can be triggered directly by SQS (serverless workers).

```
OrderService ──publish──▶ SNS "order-events" ──▶ SQS email-queue     ──▶ email worker
                                             ├──▶ SQS analytics-queue ──▶ analytics worker
                                             └──▶ SQS search-queue    ──▶ indexer
```

**Use when:** you're on AWS and want zero operations.

### BullMQ (Node.js)

```ts
import { Queue, Worker } from "bullmq";
const connection = { host: "localhost", port: 6379 };

// Producer (in your API)
const emails = new Queue("emails", { connection });
await emails.add("welcome", { userId: 42 }, {
  jobId: `welcome:42`,                         // dedupe: same id won't be queued twice
  attempts: 5,
  backoff: { type: "exponential", delay: 2000 },
  removeOnComplete: 1000,                      // keep the last 1000 for inspection
});

// Worker (a separate long-running process)
new Worker("emails", async (job) => {
  const user = await db.user.findUnique({ where: { id: job.data.userId } });
  await sendEmail(user.email, "Welcome!");
}, { connection, concurrency: 10, limiter: { max: 50, duration: 1000 } });   // max 50 jobs/s (provider rate limit)
```

Features: delayed jobs, repeatable (cron) jobs, priorities, rate limiting, parent/child "flows", progress reporting, a dashboard (Bull Board).

**Use when:** Node backend + Redis. **Needs** a long-running worker process (Render/Railway/Fly/ECS), not a serverless function.

### Celery (Python)

```python
from celery import Celery
app = Celery("tasks", broker="redis://localhost:6379/0")

@app.task(bind=True, autoretry_for=(TimeoutError,), retry_backoff=True, retry_kwargs={"max_retries": 5}, acks_late=True)
def generate_invoice_pdf(self, order_id: str):
    order = load_order(order_id)
    pdf = render_pdf(order)                 # CPU work, off the web server
    upload_to_s3(f"invoices/{order_id}.pdf", pdf)

# In the API:
generate_invoice_pdf.delay(order.id)
```

- `acks_late=True` acks after the task finishes, so a worker crash means a retry (at-least-once). Tasks must be idempotent.
- **Celery Beat** schedules periodic tasks.
- Alternatives: RQ (simpler), Dramatiq, arq (asyncio), or Temporal for long workflows.

### Also worth knowing

| Tool | What | When |
| --- | --- | --- |
| **Temporal** | Durable workflow engine: code that survives crashes, waits days, retries steps | Multi-step business processes (onboarding, payments, sagas) |
| **Inngest / Trigger.dev / QStash** | Serverless background jobs over HTTP | Jobs on Vercel with no worker servers |
| **pg-boss / Graphile Worker / pgmq** | Queues inside Postgres | Small/medium apps that want no extra infrastructure; jobs can be queued in the same transaction as the data |
| **NATS JetStream** | Fast messaging with persistence | Microservices messaging, edge |
| **Google Pub/Sub, Azure Service Bus** | Managed messaging | GCP/Azure equivalents of SNS/SQS |

---

## 4. Delivery semantics and ordering

### Delivery

| Semantics | How it happens | Consequence | Use for |
| --- | --- | --- | --- |
| **At most once** | Ack *before* processing | Crash = message lost | Metrics samples, typing indicators |
| **At least once** | Ack *after* processing | Crash after the work, before the ack = **processed twice** | Almost everything: the default |
| **Exactly once** | Not truly possible end to end over a network; achieved as "at least once + idempotent consumer" (Kafka offers exactly-once *within* Kafka via idempotent producers and transactions) | | Payments, counters |

### Making consumers idempotent

```sql
-- Processed-message table: the unique key makes duplicates harmless
create table processed_events (event_id text primary key, processed_at timestamptz default now());
```

```ts
await db.tx(async (t) => {
  const inserted = await t.result(
    "insert into processed_events (event_id) values ($1) on conflict do nothing", [event.id]);
  if (inserted.rowCount === 0) return;              // already handled: skip
  await t.none("update loyalty set points = points + $1 where user_id = $2", [10, event.userId]);
});
```

Other ways: natural idempotency (`set status = 'shipped'`), unique constraints, and provider idempotency keys (Stripe).

### Ordering

- Most queues **don't** guarantee order once there are several workers or retries.
- Kafka orders **per partition** → choose the key carefully (`orderId`, `userId`).
- SQS FIFO orders **per message group id**.
- **Retries break order:** message 2 succeeds while message 1 is waiting to retry. If order matters, either process one message at a time per key, or make handlers **order-tolerant**: include a version/sequence number and ignore older updates.

```ts
// Order-tolerant update: ignore stale events
await db.none(
  "update orders set status = $1, version = $2 where id = $3 and version < $2",
  [event.status, event.version, event.orderId]);
```

### The dual-write problem and the outbox pattern

```ts
// ❌ Two separate systems, no shared transaction
await db.insert(order);           // succeeds
await kafka.send(orderPlaced);    // crashes here → the order exists but nobody hears about it
```

```sql
-- ✅ Outbox: write the event in the SAME database transaction
begin;
  insert into orders (...) values (...);
  insert into outbox (id, topic, payload) values (gen_random_uuid(), 'order.placed', '{...}');
commit;
-- A relay process (or Debezium CDC) reads the outbox and publishes, marking rows as sent.
```

---

## 5. Handling failed jobs

1. **Classify errors:**
   - *Temporary* (timeout, 429, 503, deadlock) → retry with exponential backoff + jitter.
   - *Permanent* (invalid data, 400, "user deleted") → don't retry; fail fast to the DLQ.
2. **Cap attempts** (for example, 5) → then the **dead-letter queue**.
3. **Timeouts** on every external call inside a job.
4. **Monitor:** queue depth, age of the oldest message, failure rate, DLQ size. Alert when the DLQ grows or the queue backs up.
5. **Replay tooling:** a way to inspect DLQ messages, fix the cause, and re-queue them.
6. **Poison messages:** one malformed message that crashes the worker every time must not block the queue. The attempt cap + DLQ handles this.
7. **Visibility/lock timeouts** longer than the job's runtime, or extend them for long jobs (BullMQ lock renewal, SQS `ChangeMessageVisibility`).
8. **Graceful shutdown:** on deploy, stop taking new jobs and finish (or release) the current ones.

---

## 6. Worked examples

### Sending emails

```
API: user signs up ──▶ save user ──▶ queue "send-welcome" {userId, jobId: welcome:userId} ──▶ respond 201
Worker: load user ──▶ render template ──▶ email provider (Resend/SES/SendGrid) with idempotency key
        temporary error → retry with backoff   │   hard bounce → mark email invalid, no retry
```

- Store **ids** in the job, not the full email address and content (data may change; keeps personal data out of the queue).
- Rate-limit to the provider's sending limit.

### Processing payments

```
1. Client: POST /checkout  (Idempotency-Key)  → create order (status = pending_payment) → create a payment intent with the provider
2. Client completes payment on the provider's page/SDK
3. Provider ──webhook──▶ POST /webhooks/payments
       verify signature → insert event_id into processed_events (dedupe)
       → in one transaction: order.status = paid, insert outbox "order.paid"
       → respond 200 quickly
4. Outbox relay publishes order.paid → consumers: email receipt, warehouse, loyalty points, analytics
5. Nightly reconciliation job: compare provider records with orders; flag mismatches
```

- **Never** mark an order paid based only on the client's redirect. The webhook (or a server-side status check) is the truth.
- Webhooks can arrive late, twice, or out of order. Handle all three.

### Generating reports

```
User clicks "Export last year" ──▶ POST /reports → insert report row (status = queued) → queue job → respond 202 {reportId}
Worker: stream rows from a read replica in batches → write CSV/XLSX to S3 → status = ready, store the file key
Client: polls GET /reports/:id or gets an SSE/email notification → downloads via a short-lived signed S3 URL
```

- Use `202 Accepted` + a status resource for anything that takes more than a few seconds.
- Read from a replica so reports don't slow down live traffic.

### Uploading and processing videos

```
1. Client asks POST /uploads → server returns a pre-signed S3 URL (direct upload; the file never passes through your API)
2. Client uploads to S3 (multipart for big files)
3. S3 event ──▶ queue ──▶ transcoding workers (FFmpeg on GPU/CPU machines, or AWS MediaConvert)
       produce 240p/480p/720p/1080p HLS segments + thumbnails
4. Each rendition done → update video row; all done → status = ready → notify uploader
5. Viewers stream HLS from the CDN
```

- CPU/GPU-heavy, long-running → dedicated workers, never the web server.
- Split into steps (one job per rendition) so a failure retries only that step.

### Large-scale notifications (for example, "Sale starts now" to 5 million users)

```
Campaign service ──▶ "fan-out" job: page through user ids in batches of 1,000
     └──▶ for each batch: queue "send-batch" job ──▶ many workers ──▶ FCM/APNs/email providers (batch APIs)
          respect user preferences, quiet hours, provider rate limits; record per-user send status (idempotency)
```

- Fan out in **batches**, not one giant job and not 5 million individual API calls from one process.
- Throttle so you don't overload your own app when 5 million people tap at once (stagger sends).

---

## 7. Choosing

| Situation | Pick | Why not the others |
| --- | --- | --- |
| Node app needs background jobs | **BullMQ** (+ Redis) | Kafka is overkill; SQS is fine if you're on AWS |
| Python app needs background jobs | **Celery** (or RQ/Dramatiq) | Same |
| Serverless app (Vercel) needs jobs | **Inngest / Trigger.dev / QStash**, or SQS + Lambda | No long-running worker available |
| Small app, already on Postgres, low volume | **pg-boss / Graphile Worker / pgmq** | One less system; jobs commit with your data |
| On AWS, want zero ops | **SQS** (+ **SNS** for fan-out) | — |
| Complex routing, multiple languages | **RabbitMQ** | — |
| Event backbone: many consumers, replay, high volume | **Kafka** (managed: Confluent, MSK, Redpanda) | Queues don't keep history |
| Already on Redis, light streaming | **Redis Streams** | — |
| Long, multi-step business workflows (days, human steps) | **Temporal** | Hand-rolled state machines over queues get fragile |

**Start simple:** many apps go a long way with "Postgres + one job queue". Add Kafka when several independent consumers need the same high-volume events, or you need replay.
