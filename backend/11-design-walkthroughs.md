# Part 11: Design walkthroughs

Each walkthrough uses the same steps you'd use in an interview or a real design review:

1. **Requirements:** what must it do (functional), and how well (non-functional: scale, speed, availability)?
2. **Estimates:** rough numbers.
3. **API:** the main endpoints.
4. **Data model:** tables or documents.
5. **High-level design:** the boxes and arrows.
6. **Deep dives:** the hard parts.
7. **Trade-offs:** what you gave up and why.

---

## 1. URL shortener (like bit.ly)

### Requirements

- Turn a long URL into a short one: `sho.rt/aZ3k9Q`.
- Visiting the short URL redirects to the long one.
- Optional: custom names, expiry, click counts.
- Non-functional: redirects must be very fast (under 50 ms) and always up. Reads massively outnumber writes (say 100:1).

### Estimates

- 100 million new links a month ≈ 40 writes per second.
- 100:1 → 4,000 redirects per second; peak about 20,000.
- 5 years × 100 million × 12 = 6 billion links × about 500 bytes ≈ 3 TB.

### API

```
POST /links        { url, customAlias?, expiresAt? }  →  { short: "aZ3k9Q" }
GET  /:code        →  301/302 redirect
GET  /links/:code/stats
```

### Data model

```
links: code (primary key), long_url, user_id, created_at, expires_at
clicks: code, clicked_at, country, referrer        ← huge, append-only
```

### Design

```
User ──▶ CDN/edge ──▶ App servers ──▶ Redis cache (code → URL) ──miss──▶ Database
                          │
                          └── click event ──▶ Queue ──▶ Analytics store (ClickHouse)
```

### Deep dives

- **Making codes:** 7 characters of `a–z A–Z 0–9` = 62⁷ ≈ 3.5 trillion combinations. Options:
  - A counter turned into base62: no collisions, but codes are guessable (`aaaab`, `aaaac`...).
  - A random code + retry on collision: simple, unguessable.
  - Pre-generated code pool: a background job makes unused codes, and the API grabs one.
- **301 vs 302:** a 301 (permanent) is cached by browsers, which means fewer hits but lost click stats. A 302 (temporary) means every click comes back to you.
- **Caching:** a small share of links gets most of the clicks. Cache them in Redis or at the edge. A cache hit rate of 90%+ is normal.
- **Click counting:** don't write to the main database on every click. Send an event to a queue and count in bulk.

### Trade-offs

- Key-value or SQL? Either works. Lookups are by key only, so DynamoDB or Cassandra scale easily. Postgres is fine for years at this size, with caching.
- Analytics is eventually consistent (counts lag a few seconds). That's fine.

---

## 2. Chat app (like WhatsApp or Slack)

### Requirements

- One-to-one and group messages, delivered in real time.
- Message history, sent/delivered/read ticks, online status.
- Non-functional: low latency (under 200 ms), messages must never be lost, order must be kept within a chat.

### Estimates

- 50 million daily users × 40 messages ≈ 2 billion messages a day ≈ 23,000 per second; peak about 100,000.
- Millions of open connections at once.

### Design

```
Phone ◀══ WebSocket ══▶ Gateway servers (hold connections) ◀──▶ Presence (Redis: who's online, on which gateway)
                              │
                              ▼
                        Chat service ──▶ Message store (Cassandra/ScyllaDB, partitioned by chat_id)
                              │
                              ├──▶ Pub/sub (route to the recipient's gateway)
                              └──▶ Push notifications (if the recipient is offline)
```

### Data model (wide-column)

```
messages: partition key = chat_id, sort key = message_id (time-ordered, e.g. Snowflake/ULID)
          sender_id, body, created_at
```

"The last 50 messages of chat X" is a single fast partition read.

### Deep dives

- **Delivery:** the sender's phone gives each message a client id (idempotency). The server saves it, then acks → one tick. The recipient's device acks → two ticks.
- **Offline users:** store the message; send a push notification; deliver on reconnect ("give me everything after message id N").
- **Ordering:** time-sortable ids per chat. Don't trust phone clocks.
- **Groups:** a small group means sending one copy to each member. A huge channel (100k members) means storing once and letting members fetch it.
- **Encryption:** end-to-end (Signal protocol) means the server can't read messages. Server-side search becomes impossible; that's a trade-off.

### The small-scale version

Supabase: a `messages` table with RLS ("you can read messages in chats you're a member of") + Supabase Realtime to push new rows to subscribed clients + a Next.js app on Vercel. No socket server of your own. This is a good fit for thousands of users.

---

## 3. Food delivery (like Swiggy or Zomato)

### Requirements

- Browse restaurants near you, search, order, pay, track the driver live.
- Non-functional: orders and payments must be correct; search and browsing must be fast; it must survive the dinner rush (traffic spikes 5–10x at 8 pm).

### Design

```
App ──▶ API gateway ──▶ ┬─ Restaurant/menu service ──▶ Postgres + Redis cache + Elasticsearch (search)
                        ├─ Order service ──────────▶ Postgres (orders: strongly consistent)
                        ├─ Payment service ────────▶ payment provider (Razorpay/Stripe) + webhooks
                        ├─ Dispatch service ───────▶ matches orders to nearby drivers
                        └─ Location service ◀────── driver GPS pings every 5 s ──▶ Redis GEO / time-series store
                                       │
                        Events (Kafka): order.placed, order.paid, driver.assigned, order.delivered
                                       │
                        Notifications, analytics, ETA model, loyalty points
```

### Deep dives

- **Orders as a state machine:** `placed → paid → accepted → preparing → picked_up → delivered` (or `cancelled`). Only allowed transitions. Store each change as an event.
- **Payments:** idempotency keys; treat the provider's webhook as the truth; reconcile every night.
- **"Restaurants near me":** geospatial indexes (PostGIS, Redis GEO, geohash).
- **Driver locations:** very write-heavy (100k drivers × every 5 s = 20,000 writes per second). Keep the latest position in Redis; send history to a time-series store. Don't put it in the orders database.
- **Dinner rush:** autoscale stateless services; queue non-urgent work; cache menus heavily; put rate limits on the gateway.

### Trade-offs

- Microservices make sense here: big teams, very different loads (location vs payments).
- Menu data can be a few minutes stale (cache it). Order and payment data must be exact.

---

## 4. PLOS at 1 million users

Imagine opening PLOS to the public. What changes, and what doesn't?

### What already scales

- **Stateless app on Vercel:** it scales out by itself.
- **RLS by `user_id`:** each user's data is already isolated. Multi-user is mostly removing the single-owner guard.
- **Upserts with client ids:** retries are already safe.
- **Same-region app and database.**

### What would need work

| Problem at scale | Change |
| --- | --- |
| Single-owner design (`private.app_owner`, `guard_owner`) | Remove the guard; open sign-up with email verification and CAPTCHA |
| Indexes | Make sure every table has `(user_id, date)` indexes for the common queries |
| `audit_logs` grows fastest (one row per change) | Partition by month; keep 1 year online, archive the rest to object storage |
| Dashboards recompute totals on every load | Cache per user; or keep daily summary tables updated by triggers or jobs |
| Big exports and imports run inside a request | Move to a background job; email a download link when ready |
| Login rate limits in Postgres | Move counters to Redis/Upstash, and add edge rate limits |
| One database | Add read replicas for dashboards; later, a larger instance. Sharding by `user_id` only if truly needed (unlikely for this workload) |
| Reminders ("log your sleep") | Scheduled jobs + push notifications via a queue |
| Monitoring | Sentry, uptime checks, p95/p99 latency, database slow-query logs |
| Abuse | CAPTCHA on sign-up, per-user quotas, rate limits on writes |

### Rough numbers

- 1 million users, 20% daily → 200,000 daily users × 10 writes ≈ 2 million writes a day ≈ 25 per second average, maybe 150 per second at peak.
- A single well-indexed Postgres handles this. The bottleneck would be reads for dashboards, which caching and replicas solve.

**The point:** good early decisions (stateless app, RLS, idempotent writes, managed database) mean scaling is mostly *adding* pieces, not *rewriting*.
