# Part 12: Trade-offs cheat sheet

Every design choice gives something up. Good engineers can say *what* they gave up and *why it was worth it*.

## The classic trade-offs

| You gain | You pay | Example |
| --- | --- | --- |
| Consistency | Availability or latency | A bank waits for confirmation; a likes counter doesn't |
| Speed (caching) | Freshness | Menu cached for 5 minutes may show a sold-out dish |
| Speed (denormalising) | Write complexity, risk of copies disagreeing | Storing `total_volume_kg` on a workout |
| Flexibility (NoSQL schema) | Data quality and joins | MongoDB documents drift into different shapes |
| Scale (sharding) | Simplicity, cross-shard queries | Totals across all users get hard |
| Independence (microservices) | Network calls, debugging, data consistency | Many deploys, distributed traces |
| Low cost when idle (serverless) | Cold starts, time limits, no sockets | Vercel vs an always-on server |
| No cold starts (always on) | Paying while idle | Render paid plan |
| Managed services | Money and some lock-in | Supabase vs running Postgres yourself |
| Security (more checks) | A little speed and convenience | MFA, RLS on every query |
| Strong typing / structure | Speed of the first draft | NestJS vs plain Express |
| Fewer moving parts | Some specialised performance | Postgres for queues and search before adding Redis or Elasticsearch |

## "If X, pick Y"

### Databases

- Most apps, relational data, money → **Postgres**.
- Want auth and an API done for you with Postgres → **Supabase**.
- Want plain serverless Postgres for your own backend → **Neon**.
- Document-shaped data that keeps changing → **MongoDB**.
- Cache, sessions, rate limits, leaderboards → **Redis / Upstash**.
- Search box → Postgres full-text first, then **Meilisearch/Typesense/Elasticsearch**.
- Relationship-heavy questions → **Neo4j** (or Postgres recursive queries for small cases).
- Billions of writes, always on → **Cassandra/ScyllaDB/DynamoDB**.
- Metrics over time → **TimescaleDB/ClickHouse**.
- Embeddings / similarity → **pgvector** first, then a dedicated vector DB.

### Backends

- Full-stack web app in TypeScript → **Next.js** (Server Actions + Route Handlers).
- Separate Node API → **Fastify** or **Express**; big team → **NestJS**; edge → **Hono**.
- Python API or ML → **FastAPI**; full site with admin → **Django**.
- High-traffic services → **Go**; enterprise → **Spring Boot / ASP.NET**.

### APIs

- Public API → **REST**. Many different clients → **GraphQL**. Internal services → **gRPC**. Same-repo TypeScript → **tRPC / Server Actions**.
- Live one-way → **SSE**. Live two-way → **WebSockets** or a managed realtime service.

### Hosting

- Next.js → **Vercel**. Always-on API or worker → **Render (paid) / Railway / Fly**. Containers without k8s → **Cloud Run**. Cheapest always-on → **a VPS**.

### Performance problems, in the order to try

1. Measure first (find the slow part).
2. Add the missing **index**.
3. Fix N+1 queries (batch them or use one join).
4. Put app and database in the **same region**.
5. **Cache** hot reads.
6. Move slow work to a **queue**.
7. **Scale up** the database.
8. Add **read replicas**.
9. **Partition** huge tables.
10. **Shard**, only now, and only if you must.

## System design interview checklist

1. **Ask questions.** Who uses it? Which features matter? How many users? Read-heavy or write-heavy? Which matters more: consistency or availability?
2. **Estimate.** Requests per second, storage per year, bandwidth.
3. **Define the API.** 3–5 key endpoints.
4. **Model the data.** Tables or documents; keys; which database and why.
5. **Draw the high-level design.** Client → LB → app → cache → DB; queues for async work.
6. **Find the bottleneck** and deep-dive: caching, sharding, hot keys, fan-out, consistency.
7. **Cover failures.** What if a server dies? The DB? A region? Retries, idempotency, backups.
8. **Say the trade-offs out loud.** "I chose X over Y because..., which costs us..."
9. **Mention operations.** Monitoring, alerts, deploys, security.

## Words you should be comfortable with

| Term | Meaning, in one line |
| --- | --- |
| Throughput | How many requests per second |
| Latency | How long one request takes |
| p50 / p95 / p99 | Half / 95% / 99% of requests were faster than this |
| Horizontal / vertical scaling | More machines / a bigger machine |
| Stateless | The server keeps no user data between requests |
| Load balancer | Spreads traffic across servers |
| CDN | Copies of files near users |
| Cache hit ratio | % of reads served from the cache |
| TTL | How long a cached item lives |
| Replication | Copies of the database |
| Replication lag | How far behind a copy is |
| Sharding | Splitting data across database servers |
| Partitioning | Splitting a table inside one database |
| Consistent hashing | A way to shard that moves little data when servers change |
| CAP | During a network split, pick consistency or availability |
| Eventual consistency | Copies agree after a short while |
| ACID | All-or-nothing, rule-keeping, isolated, durable transactions |
| BASE | Basically Available, Soft state, Eventually consistent (the NoSQL counterpart) |
| Idempotent | Doing it twice has the same effect as once |
| Queue / pub-sub | One job → one worker / one event → many listeners |
| Dead-letter queue | Where jobs go after failing too often |
| Backpressure | Slowing producers when consumers can't keep up |
| Circuit breaker | Stop calling a failing service for a while |
| Rate limiting | Cap requests per user, IP or key |
| SPOF | A single point of failure |
| SLO / SLA | Reliability target / promise to customers |
| RPO / RTO | Data you can lose / time you can be down |
| Blue-green / canary | Switch all traffic at once / send a little traffic first |
| Feature flag | Turn code on or off without deploying |
| N+1 queries | One query for a list, then one more per item |
| Connection pooling | Sharing a few DB connections among many clients |
| Cold start | Delay when a serverless function wakes up |
| Monolith / microservices | One deployable app / many small ones |
| Saga | Multi-service transaction with undo steps |
| Outbox pattern | Save data and the event in one DB transaction, publish later |
| CQRS | Separate models for writes and reads |
| Event sourcing | Store every change as an event; rebuild state from them |

## Books and resources

- *Designing Data-Intensive Applications*, Martin Kleppmann. The best single book on this topic.
- *System Design Interview* (vol. 1 and 2), Alex Xu.
- *Site Reliability Engineering*, Google (free online).
- The *System Design Primer* on GitHub (donnemartin/system-design-primer).
- The PostgreSQL docs, especially "Indexes", "Concurrency Control" and "Row Security Policies".
- *Use The Index, Luke* (use-the-index-luke.com), on SQL indexing.
