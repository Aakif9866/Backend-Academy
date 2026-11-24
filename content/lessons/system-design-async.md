---
title: Background Work and Async Design
summary: Sync vs async, queues, pub/sub, delivery guarantees, idempotency, retries with backoff, dead-letter queues, cron, rate limiting, sagas and backpressure.
difficulty: intermediate
minutes: 35
source: backend/08-system-design-async.md
prerequisites: [concurrency-async, rest-api-design]
objectives:
  - Decide what work belongs in the request and what belongs in a background job
  - Explain at-most-once, at-least-once and "exactly-once" delivery
  - Make a consumer idempotent
  - Configure retries with exponential backoff, jitter and a dead-letter queue
videos:
  - id: mhUQe4BKZXs
    title: Rate Limiting system design | TOKEN BUCKET, Leaky Bucket, Sliding Logs
    channel: Tech Dummies - Narendra Lakshmana Gowda
    why: Walks through the rate-limiting algorithms in this lesson with diagrams; pair it with the simulator below.
resources:
  - url: https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/
    title: "Amazon Builders' Library: Timeouts, retries and backoff with jitter"
    why: How Amazon actually tunes retries and why jitter prevents synchronized retry storms.
  - url: https://stripe.com/blog/idempotency
    title: "Stripe: Designing robust and predictable APIs with idempotency"
    why: The classic explanation of idempotency keys for payment APIs.
  - url: https://microservices.io/patterns/data/saga.html
    title: "microservices.io: Saga pattern"
    why: Choreography vs orchestration sagas with diagrams, by Chris Richardson.
quiz:
  - type: scenario
    q: Signup must create the user, send a welcome email and resize the avatar. What should happen before the HTTP response?
    options: ["All three", "Create the user; enqueue the email and resize as background jobs", "Nothing; enqueue everything", "Only the avatar resize"]
    answer: 1
    explain: The user record is what the response depends on. Email and image processing are slow, can fail and retry independently, and the user doesn't need to wait for them.
  - type: tf
    q: With at-least-once delivery, consumers must be prepared to process the same message more than once.
    answer: 0
    explain: True. A consumer can crash after doing the work but before acknowledging, so the broker redelivers. Idempotent handlers make duplicates harmless.
  - type: mcq
    q: Why add random jitter to exponential backoff?
    options: ["To make retries faster", "So thousands of clients that failed at the same moment don't all retry at the same moment", "To encrypt retries", "Jitter is required by HTTP"]
    answer: 1
    explain: Without jitter, clients retry in synchronized waves that re-overload the recovering service. Randomizing the delay spreads the load.
  - type: mcq
    q: What is a dead-letter queue for?
    options: ["Deleting messages permanently", "Parking messages that keep failing after N retries so they can be inspected and replayed", "Speeding up delivery", "Storing successful messages"]
    answer: 1
    explain: A poison message that always fails would otherwise block or loop forever. The DLQ isolates it, alerts someone, and lets you replay it after a fix.
---

<div data-viz="rate-limiter"></div>

## Hands-on exercise

Implement a tiny job runner with a Postgres `jobs` table (no broker needed):

1. Columns: `id`, `type`, `payload jsonb`, `status`, `attempts`, `run_at`, `last_error`.
2. A worker loop that claims one job with `SELECT … FOR UPDATE SKIP LOCKED`, runs it, and marks it `done`.
3. On failure, increment `attempts` and set `run_at = now() + 2^attempts seconds` (plus jitter). After 5 attempts, set `status = 'dead'`.
4. Run two workers at once and show that no job runs twice concurrently.

## Completion criteria

- You can explain delivery semantics and design an idempotent consumer.
- You've built a retrying job worker with a dead-letter state.
