# Part 7: System design, the building blocks

System design is deciding how the pieces fit so the app stays **fast**, **available** and **correct** as usage grows, without spending more than you need.

We'll grow one imaginary app, "FitLog" (a public PLOS for everyone), from 10 users to 10 million, adding a block only when a real problem shows up.

## Stage 0: one server

```
Users ──▶ [ One server: app + database ]
```

Fine for 10 to a few thousand users. Cheap and simple. **Most apps never need more.** Don't skip this stage.

## Stage 1: separate the database

```
Users ──▶ [ App server ] ──▶ [ Database ]
```

Now each can be sized, backed up and restarted on its own. This is roughly PLOS today (Vercel + Supabase).

## Scaling up vs scaling out

- **Vertical scaling (scale up):** a bigger machine. More CPU, more RAM. Easy, no code changes. Has a ceiling and a big price jump at the top.
- **Horizontal scaling (scale out):** more machines. No hard ceiling, but your app must be **stateless**: no user data kept in one server's memory, because the next request may hit a different server.

**Stateless example:** don't keep sessions in a JavaScript object on the server. Put them in a cookie (JWT) or in Redis so every server can read them.

## Load balancer

```
             ┌──▶ [ App 1 ]
Users ──▶ [ LB ] ──▶ [ App 2 ] ──▶ [ Database ]
             └──▶ [ App 3 ]
```

Spreads requests across servers. Also does **health checks** (stops sending to a dead server) and often handles HTTPS.

- Methods: round robin, least connections, by IP hash (same user → same server).
- Examples: Nginx, HAProxy, AWS ALB, Cloudflare. On Vercel and Render it's built in and invisible.

## Caching: the biggest win for the least effort

A cache keeps a copy of something expensive close by, so you don't redo the work.

```
Request ──▶ Cache has it? ── yes ──▶ return it (1 ms)
                 │
                 no
                 ▼
            Database (50 ms) ──▶ save in cache ──▶ return it
```

### Layers of cache

| Layer | Example | What it holds |
| --- | --- | --- |
| Browser | `Cache-Control: max-age=3600` | Images, CSS, JS |
| CDN | Cloudflare, Vercel Edge | Static files and public pages, near the user |
| App memory | A `Map` in the process; React `cache()` in PLOS | Per-request or per-server results |
| Shared cache | Redis, Memcached | Results shared by all servers |
| Database | Postgres's own buffer cache | Hot rows in RAM |

### Patterns

- **Cache-aside (lazy):** check the cache; on a miss read the database and fill the cache. Most common.
- **Write-through:** write to the cache and the database together. The cache is always fresh; writes are slower.
- **Write-behind:** write to the cache, save to the database later. Fast, but risky if the cache dies.

### The hard part: invalidation

> "There are only two hard things in computer science: cache invalidation and naming things." (Phil Karlton)

When data changes, the cached copy is now wrong. Options:

- **TTL:** expire after N seconds. Simple; data may be stale for up to N seconds.
- **Delete on write:** when a workout changes, delete `workouts:user42` from the cache.
- **Tag-based:** PLOS calls `revalidatePath("/", "layout")` after every save, so Next.js throws away its cached pages.

**What to cache:** things read often and changed rarely. A restaurant menu: yes. A bank balance: careful.

**Cache stampede:** a popular key expires, and 10,000 requests hit the database at once. Fixes: let one request refill while the others wait ("request coalescing"), or refresh a little before expiry.

## CDN (Content Delivery Network)

Copies of your static files on servers around the world. A user in Chennai gets images from a Chennai server, not from Virginia.

- Cuts latency from about 250 ms to about 20 ms for far-away users.
- Takes load off your servers.
- Examples: Cloudflare, Fastly, AWS CloudFront, Vercel's edge network (built in).

## Database scaling

### 1. Indexes (do this first)

An index is like a book's index: jump straight to the page instead of reading every page.

```sql
-- Without an index, this scans every row:
select * from workout_sessions where user_id = '42' order by performed_on desc limit 20;

-- With this, it jumps straight there:
create index on workout_sessions (user_id, performed_on desc);
```

- 1 million rows: about 800 ms → about 2 ms.
- Cost: each index slows writes slightly and uses disk. Index what you filter and sort by, not everything.
- Use `explain analyze` to see whether a query uses an index.

### 2. Connection pooling

Every database connection uses memory. Postgres handles hundreds, not tens of thousands. Serverless functions each open their own, so they can run out fast.

- A **pooler** (PgBouncer, Supavisor in Supabase, Neon's pooler) shares a few real connections among many clients.
- Or use an HTTP-based driver (Supabase's data API, Neon's serverless driver), as PLOS does.

### 3. Read replicas

```
          writes ──▶ [ Primary ]
                         │ copies changes
                ┌────────┼────────┐
reads ──▶  [ Replica 1 ] [ Replica 2 ] [ Replica 3 ]
```

Most apps read far more than they write (often 10:1 or more). Send reads to replicas.

- **Catch: replication lag.** A replica may be a few milliseconds to seconds behind. A user saves a workout, the page reloads from a replica, and the workout isn't there yet. Fix: "read your own writes" by sending that user's reads to the primary for a few seconds after they write.

### 4. Partitioning

Split one huge table into pieces inside one database, for example `audit_logs_2026_10`, `audit_logs_2026_11`. Queries for November only touch November. Old months can be dropped quickly.

### 5. Sharding

Split data across **different database servers**.

```
user_id ends in 0–3 ──▶ [ Shard A ]
user_id ends in 4–6 ──▶ [ Shard B ]
user_id ends in 7–9 ──▶ [ Shard C ]
```

- **Shard key** choice is everything. `user_id` is good for FitLog: one user's data stays together.
- **Hot shards:** if one celebrity has most of the traffic, their shard melts.
- **Cross-shard queries** ("total workouts across all users") get hard.
- **Consistent hashing** makes adding a shard move only a small part of the data, not all of it.
- **Do this last.** It's a big jump in complexity. Many large companies run on one big Postgres plus replicas for a long time.

### 6. Denormalisation

Store a copy of data to avoid a join or a sum. For example, keep `total_volume_kg` on `workout_sessions` instead of summing sets each time. Faster reads; you must keep the copy correct on every write (triggers help).

## CAP theorem

When a network split happens between servers (a **P**artition), a distributed system must choose:

- **C**onsistency: every read gets the latest write, or an error.
- **A**vailability: every request gets an answer, possibly a stale one.

You can't have both during a split. (Without a split, you can have both.)

| Choose | Example | Why |
| --- | --- | --- |
| **CP** (consistent) | Bank balance, stock count, booking the last seat | Wrong data costs money |
| **AP** (available) | Likes count, view count, social feed, DNS | Slightly stale is fine; being down isn't |

**PACELC** adds: even with *no* split, you trade **L**atency for **C**onsistency. Waiting for every copy to confirm is slower.

## Consistency levels

- **Strong:** you always see the latest. (Single Postgres.)
- **Eventual:** all copies agree *eventually*, usually within seconds. (Replicas, DynamoDB by default, DNS.)
- **Read-your-writes:** at least *you* always see your own changes.

**Example:** you like a post. Your screen shows 101 likes immediately; a friend in another country sees 100 for two seconds. That's eventual consistency, and it's fine for likes. It's not fine for your bank balance.

## Availability numbers ("nines")

| Uptime | Downtime per year | Downtime per month |
| --- | --- | --- |
| 99% | 3.65 days | about 7.3 hours |
| 99.9% | 8.8 hours | about 44 minutes |
| 99.99% | 53 minutes | about 4.4 minutes |
| 99.999% | 5 minutes | about 26 seconds |

Each extra nine costs a lot more: redundancy, automatic failover, multiple regions, on-call staff.

**Single point of failure (SPOF):** any piece whose death takes everything down. Remove SPOFs with redundancy: two app servers, a standby database, two availability zones.

## Latency numbers every engineer should know (roughly)

| Operation | Time |
| --- | --- |
| Read from RAM | about 100 nanoseconds |
| Redis GET (same data centre) | about 0.5 ms |
| Simple indexed Postgres query | about 1–5 ms |
| Read 1 MB from SSD | about 1 ms |
| Round trip within one data centre | about 0.5 ms |
| Mumbai ↔ Singapore | about 60 ms |
| Mumbai ↔ US East | about 200–250 ms |
| Serverless cold start | about 100 ms to 1 s |

**Lesson:** put your app server and database in the **same region**. PLOS puts both in Mumbai. An app in the US talking to a database in India adds about 250 ms to *every* query.

## Back-of-the-envelope estimates

Interviewers love these. Example: FitLog with 10 million users.

- Daily active users: 10% → 1 million.
- Each logs about 3 things a day → 3 million writes a day ≈ **35 writes per second** on average; peaks maybe 5x → about 175 per second. One Postgres handles that easily.
- Reads: say 20 per user per day → 20 million a day ≈ **230 per second**; peak about 1,200 per second. One primary + a couple of replicas + caching.
- Storage: about 500 bytes per row × 3 million a day × 365 ≈ **550 GB a year**. Fine for one database for years; partition the biggest tables.

The answer is usually "smaller than you'd think". That's why the advice is to keep it simple until the numbers say otherwise.

## Monolith vs microservices

| | Monolith | Microservices |
| --- | --- | --- |
| What | One app, one deploy | Many small services, each with its own deploy and often its own database |
| Good | Simple to build, test, debug, deploy; fast calls in memory | Teams work independently; scale and deploy parts separately; one part failing doesn't kill all |
| Bad | One big codebase; one bug can take everything down; the whole thing scales together | Network calls everywhere, distributed debugging, data consistency across services, lots of DevOps |
| When | Almost every new product; teams under about 20–50 engineers | Large orgs with many teams; parts with very different scaling needs |

**Modular monolith:** one deploy, but cleanly separated modules inside (like PLOS's `src/lib/` per area). You get most of the benefits with none of the network pain, and you can split later if you need to.

> Amazon Prime Video moved one monitoring service *from* microservices back to a monolith in 2023 and cut its cost by about 90%. Microservices are a tool, not a goal.

## API gateway

A single front door for many services: routing, auth, rate limits, logging in one place. Examples: Kong, AWS API Gateway, Cloudflare. Useful once you have several services.

## Service discovery and the rest

When you do have many services: service discovery (how A finds B), circuit breakers (stop calling a failing service for a while), retries with backoff, timeouts on every call, and distributed tracing. More in [Part 8](08-system-design-async.md) and [Part 10](10-reliability-and-operations.md).
