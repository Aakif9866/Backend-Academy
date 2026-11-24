# Part 17: Technology decision matrix

This part maps **requirements** to **technologies**. Treat every row as a *good starting point with known trade-offs*, not a rule. The right answer always depends on scale, team and constraints.

## Contents

1. [How to use the matrix](#1-how-to-use-the-matrix)
2. [Application types](#2-application-types)
3. [Data and storage requirements](#3-data-and-storage-requirements)
4. [Communication and real-time requirements](#4-communication-and-real-time-requirements)
5. [Processing and workload requirements](#5-processing-and-workload-requirements)
6. [Non-functional requirements](#6-non-functional-requirements)
7. [Infrastructure and operations](#7-infrastructure-and-operations)
8. [Five complete architecture examples](#8-five-complete-architecture-examples)
9. [Anti-patterns: common wrong choices](#9-anti-patterns-common-wrong-choices)

---

## 1. How to use the matrix

1. List your **functional** requirements (what it does) and **non-functional** ones (scale, latency, availability, security, compliance, budget, team).
2. For each requirement, find the row and read the **trade-off** column.
3. Prefer choices that satisfy several requirements with **fewer** technologies.
4. Write down *why* you chose each piece (an "Architecture Decision Record", ADR). You'll thank yourself in a year.

```markdown
# ADR-007: Use PostgreSQL + pgvector instead of Pinecone
Status: Accepted (2026-11-10)
Context: 300k document chunks, must filter by tenant, small team.
Decision: pgvector in our existing Postgres.
Consequences: + one database, RLS for tenants, transactions. − Revisit if chunks pass ~20M or p95 search > 150 ms.
```

---

## 2. Application types

| Requirement | Good default | Why | Trade-off / watch out | Alternatives |
| --- | --- | --- | --- | --- |
| Traditional CRUD app with admin | **Django**, **Rails**, **Laravel**, or **Next.js + Supabase** | Batteries included: ORM, auth, admin, migrations | Less control; frameworks' conventions to learn | Express/NestJS + Prisma, Spring Boot |
| Full-stack web product (TypeScript team) | **Next.js** + Postgres (Supabase/Neon) | One codebase, one deploy, server-side rendering | A separate API needed later for mobile/partners | Remix/React Router, SvelteKit, Nuxt |
| Public REST API for partners | **FastAPI**, **NestJS**, **Spring Boot**, **ASP.NET Core** + OpenAPI | Typed contracts, generated docs and SDKs | Versioning discipline needed | Go (Gin/chi), Express + Zod-to-OpenAPI |
| High-concurrency API (many simultaneous I/O requests) | **Go**, **Fastify**, **ASP.NET Core**, **Spring with virtual threads**, or **FastAPI** with fully async I/O | Cheap concurrency | Async Python/Node must avoid blocking calls; the DB is usually the real bottleneck | Rust (Axum), Elixir (Phoenix) |
| CPU-heavy service (image/video/PDF/crypto) | **Go**, **Rust**, **Java**, **C#**; or Python with native libraries in **worker processes** | Use all cores | Don't do it in the Node event loop or a request thread | Managed services (MediaConvert, Cloudinary) |
| ML model serving / AI backend | **FastAPI** (Python) | ML ecosystem | Python's raw speed; use batching, GPUs, dedicated servers (vLLM, Triton) | BentoML, Ray Serve, managed inference APIs |
| Microservice in a polyglot company | Whatever the platform team supports best (often **Go**, **Java**, **Node**) | Shared tooling and on-call knowledge | — | — |
| Mobile app backend | **Supabase/Firebase** (fast start) or a REST/GraphQL API (NestJS, FastAPI, Go) | Auth, push, offline sync | BaaS lock-in vs custom work | AWS Amplify, Appwrite |
| Internal tool / admin dashboard | **Django admin**, Retool/Appsmith, or Next.js + Supabase | Speed of delivery | Low-code tools have limits and per-seat costs | Rails + ActiveAdmin |
| E-commerce store (standard) | **Shopify** / hosted platform; custom: Postgres + Next.js + Stripe/Razorpay | Don't rebuild checkout unless it's your differentiator | Platform fees and limits | Medusa (open source), Saleor |
| Content site / blog | **Static site generator + CDN**, or a headless CMS | Fast, cheap, secure | Dynamic features need extra services | WordPress (huge ecosystem) |

## 3. Data and storage requirements

| Requirement | Good default | Why | Trade-off / watch out | Alternatives |
| --- | --- | --- | --- | --- |
| Financial transactions, ledgers | **PostgreSQL** (Serializable or careful locking), double-entry ledger | ACID, constraints, auditability | Vertical scaling limits; shard by account at extreme scale | SQL Server, Oracle, CockroachDB/Spanner (global) |
| General relational data | **PostgreSQL** | Features, extensions, community | — | MySQL, SQL Server |
| Flexible document storage | **MongoDB**, or Postgres `jsonb` | Varying shapes, read whole documents | Weak joins; schema drift without validation | Firestore, Couchbase |
| Low-latency caching | **Redis / Valkey** | Sub-millisecond, rich data types | Memory cost; invalidation; not the source of truth | Memcached, CDN, in-process cache |
| Sessions | **Redis**, or signed cookies/JWT | Fast shared lookups | Redis = one more dependency; JWT revocation is hard | Database sessions (fine at small scale) |
| Massive write throughput, always-on | **Cassandra / ScyllaDB**, **DynamoDB** | Horizontal writes, multi-region | Query-first modelling; no joins; operational complexity | Bigtable, sharded Postgres (Citus) |
| Predictable key lookups at any scale, serverless | **DynamoDB** | Pay per request, no servers | Must design access patterns up front | Cassandra, Upstash Redis |
| AI semantic search | **pgvector** → **Qdrant / Pinecone / Weaviate** at scale | Nearest-neighbour search | Dedicated vector DB = sync + access-control work | Elasticsearch/OpenSearch vector search, Milvus |
| Full-text search | **Elasticsearch / OpenSearch**; smaller: **Meilisearch / Typesense / Postgres FTS** | Relevance, facets, typos | A separate cluster to sync and run | Algolia (managed) |
| Hybrid search (keywords + meaning) | **Weaviate**, **OpenSearch**, **Elasticsearch**, or Postgres FTS + pgvector with rank fusion | Catches exact codes *and* meaning | Tuning the two scores together | Qdrant with sparse vectors |
| Time-series metrics / sensor data | **TimescaleDB** (SQL) or **InfluxDB**; large analytics: **ClickHouse** | Compression, retention, time queries | Another system unless you use the Timescale extension | Prometheus (monitoring), QuestDB |
| Relationship-heavy queries | **Neo4j** | Multi-hop traversals | Specialist skills; not for general CRUD | Postgres recursive CTEs, Neptune |
| Analytics / BI over large data | **ClickHouse**, **BigQuery**, **Snowflake**, **Redshift** | Column stores scan billions of rows fast | Not for transactional writes; data pipelines needed | DuckDB (single machine, surprisingly far) |
| Files, images, video | **Object storage (S3, R2, GCS)** + **CDN** | Cheap, durable, scalable | Never store big files in the database | Supabase Storage, Cloudinary (with processing) |
| Geospatial ("near me") | **PostGIS**, **Redis GEO** for hot positions | Spatial indexes | — | MongoDB geo, Elasticsearch geo |
| Audit trail / immutable history | Append-only tables + triggers (as in PLOS), or event sourcing | Compliance, debugging | Storage growth → partitioning and retention | Write-once object storage (S3 Object Lock) |
| Multi-tenant SaaS data isolation | **Shared tables + `tenant_id` + Postgres RLS** | Simple, efficient | One mistake leaks across tenants → RLS + tests | Schema per tenant; database per tenant (strongest, costly) |
| Data residency (keep data in a country) | Region-specific deployments/databases | Legal compliance | Duplicated infrastructure | Partition by region |

## 4. Communication and real-time requirements

| Requirement | Good default | Why | Trade-off / watch out | Alternatives |
| --- | --- | --- | --- | --- |
| Real-time chat | **WebSockets / Socket.IO + Redis Pub/Sub + PostgreSQL** | Two-way delivery, fan-out across servers, durable history | Stateful connections; scaling gateways | Managed (Ably, Pusher, Supabase Realtime); Cassandra for huge history |
| Live notifications | **SSE** + push (FCM/APNs/Web Push) | Simple one-way, auto-reconnect | — | WebSockets, managed services |
| Collaborative editing | **WebSockets + CRDT (Yjs/Automerge)** | Conflict-free concurrent edits | CRDT document size; persistence design | Liveblocks, OT (ShareDB) |
| Live dashboards | **SSE**, or polling every 10–30 s | One-way, simple | Polling cost at scale | WebSockets |
| Multiplayer games | Authoritative server + **WebSockets** (casual) or **UDP / WebRTC data channels** (fast action) | Latency, cheat prevention | Netcode complexity | Game backends (Nakama, Photon, Colyseus) |
| Video/voice calls | **WebRTC** + SFU (**LiveKit**, mediasoup) + TURN | Peer media, group calls | TURN bandwidth costs | Twilio, Agora, Daily (managed) |
| IoT device communication | **MQTT** broker (EMQX, Mosquitto, HiveMQ, AWS IoT Core) | Lightweight, weak networks, QoS levels | A broker to run; bridge to backend storage | CoAP, HTTP for infrequent devices |
| Internal service-to-service | **REST** (simple) or **gRPC** (fast, typed) | — | gRPC needs tooling; not browser-friendly | Messaging for async |
| Many clients needing different data shapes | **GraphQL** | Client chooses fields | Caching, N+1, query-cost limits | REST + BFF per client |
| TypeScript full-stack, same repo | **tRPC** or **Server Actions** | End-to-end types, no schema file | Only your app can use it | REST |
| Receiving third-party events | **Webhooks** (verify signatures, idempotent, respond fast) | Standard | Retries, duplicates, ordering | Polling the provider |
| AI text streaming | **HTTP streaming / SSE** | Token-by-token display | Handle client disconnects to save cost | WebSockets |

## 5. Processing and workload requirements

| Requirement | Good default | Why | Trade-off / watch out | Alternatives |
| --- | --- | --- | --- | --- |
| Background jobs (Node) | **BullMQ** | Retries, delays, cron, rate limits | Needs Redis + a worker process | SQS, pg-boss, Inngest |
| Background jobs (Python) | **Celery** | Mature | Config complexity | RQ, Dramatiq, arq |
| Background jobs on serverless | **Inngest / Trigger.dev / QStash**, SQS + Lambda | No worker servers | Vendor pricing and limits | — |
| Large-scale event processing | **Kafka** (managed) | Ordered partitions, replay, many consumers | Heavy to run; overkill when small | Kinesis, Pulsar, Redpanda, Redis Streams |
| Simple reliable queue on AWS | **SQS** (+ **SNS** fan-out) | Zero ops | No replay; FIFO throughput limits | — |
| Complex message routing | **RabbitMQ** | Exchanges, routing keys | Operations | — |
| Long-running workflows (days, retries, human steps) | **Temporal** | Durable execution | New concepts | AWS Step Functions, Inngest |
| Scheduled tasks | Platform cron (Vercel Cron, Render cron), **Celery Beat**, BullMQ repeatable, **pg_cron** | — | Avoid duplicate runs across servers | Kubernetes CronJob |
| Stream processing (windows, joins over events) | **Flink**, Kafka Streams, ksqlDB | Real-time aggregations | Expertise needed | Spark Structured Streaming, ClickHouse materialised views |
| Batch data pipelines (ETL) | **Airflow / Dagster / Prefect** + dbt | Scheduling, lineage | Infrastructure | Cloud-native (Glue, Dataflow) |
| Media transcoding | Queue + FFmpeg workers, or **MediaConvert / Mux / Cloudinary** | Heavy CPU/GPU | Cost of running GPUs | — |
| Serverless workloads (spiky, event-driven) | **AWS Lambda**, Vercel Functions, Cloudflare Workers, Cloud Run | Scale to zero, pay per use | Cold starts, time limits, no sockets, connection limits | Containers on autoscaling |
| Steady high-traffic services | Containers (**ECS, Cloud Run, Kubernetes**) or VMs | Cheaper per request at constant load | You manage more | — |

## 6. Non-functional requirements

| Requirement | Approach | Trade-off |
| --- | --- | --- |
| p95 latency < 100 ms globally | CDN + edge caching, regional read replicas, keep payloads small | Consistency (replica lag); complexity |
| 99.9% availability | Redundant app instances across availability zones; managed DB with failover; health checks | Cost |
| 99.99%+ | Multi-AZ everything, automated failover, zero-downtime deploys, possibly multi-region | Much higher cost and complexity |
| Strong consistency for money/stock | Single primary database, transactions, idempotency | Lower write scalability, cross-region latency |
| Handle 10x traffic spikes (sales, launches) | Autoscaling stateless tiers, queues to absorb writes, caches, load shedding, pre-scaling | Cost of spare capacity |
| Low cost at small scale | Serverless + managed free/low tiers (Vercel + Supabase/Neon) | Cold starts, vendor limits |
| Compliance (PCI-DSS, HIPAA, GDPR, India's DPDP Act) | Minimise stored sensitive data, use compliant providers (card data with Stripe/Razorpay, never on your servers), encryption, audit logs, data residency | Process and audit overhead |
| Strong security / zero trust | Least privilege, MFA, RLS, secrets manager, network isolation, dependency scanning | Developer friction |
| Small team, fast delivery | Monolith, managed services, a batteries-included framework | Less flexibility later (usually fine) |
| Large org, many teams | Service boundaries by domain, API contracts, platform team | Distributed-system overhead |

## 7. Infrastructure and operations

| Need | Good default | Notes |
| --- | --- | --- |
| Hosting a Next.js app | Vercel | Or self-host with Docker/OpenNext |
| Always-on API/workers | Render, Railway, Fly.io, ECS, Cloud Run | Paid tiers to avoid sleeping |
| Containers at scale | Kubernetes (EKS/GKE/AKS) | Only with platform expertise |
| Infrastructure as code | Terraform / OpenTofu, Pulumi | Reproducible environments |
| CI/CD | GitHub Actions | Lint, type-check, test, deploy |
| Secrets | Platform env vars → a secrets manager (AWS Secrets Manager, Doppler, Vault) as you grow | Rotate regularly |
| Error tracking | Sentry | |
| Logs/metrics/traces | OpenTelemetry → Grafana stack, Datadog, Honeycomb, Axiom | |
| API gateway | Cloud provider gateway, Kong, Cloudflare | Auth, rate limits, routing |
| Feature flags | LaunchDarkly, Unleash, PostHog, GrowthBook | Separate deploy from release |

---

## 8. Five complete architecture examples

Each starts small and shows what to add as it grows. Full case studies with every concern are in [Part 19](19-architecture-case-studies.md).

### Example 1: Multi-tenant B2B SaaS (project management tool)

**Requirements:** companies (tenants) sign up; users in each tenant manage projects and tasks; comments with live updates; file attachments; admin roles; SSO for big customers; strict tenant isolation.

```
Browser ──▶ CDN ──▶ Next.js app (Vercel or containers)
                      │  Server Actions / REST API (tenant resolved from session)
                      ├──▶ PostgreSQL: tenants, users, memberships(role), projects, tasks, comments
                      │      every table has tenant_id + RLS policy "tenant_id = current tenant"
                      ├──▶ Redis: cache, rate limits, BullMQ queues
                      ├──▶ S3: attachments (pre-signed URLs, keys prefixed by tenant)
                      ├──▶ Realtime: Supabase Realtime / Ably / Socket.IO for task and comment updates
                      └──▶ Workers: emails, digests, exports, webhooks to customers
Auth: Supabase Auth / Auth.js / Clerk / WorkOS (SAML SSO, SCIM for enterprises)
```

| Decision | Why | Trade-off |
| --- | --- | --- |
| Shared database + `tenant_id` + RLS | Efficient; one schema to migrate | Must test isolation rigorously; noisy neighbours → later move big tenants to their own database |
| RBAC per membership (owner/admin/member/guest) | Clear permissions | Fine-grained sharing may need ReBAC later |
| Monolith | Small team | Split out notifications or search only if needed |

### Example 2: Video-on-demand platform (course videos)

**Requirements:** instructors upload videos; students stream on any device; progress tracking; paid access; global audience.

```
Upload: Client ──pre-signed URL──▶ S3 (raw) ──event──▶ SQS ──▶ transcoding (MediaConvert / FFmpeg workers)
                                                                      │
                                                                      ▼
                                                    S3 (HLS renditions + thumbnails) ──▶ CDN (signed URLs/cookies)
API (NestJS or Django): courses, enrolments, payments (webhooks), progress
PostgreSQL: users, courses, lessons, enrolments, purchases, progress (upsert per user+lesson)
Redis: sessions, "continue watching" cache
Search: Meilisearch/OpenSearch for courses
```

| Decision | Why | Trade-off |
| --- | --- | --- |
| Direct-to-S3 uploads | Big files never pass through the API | Need upload-complete handling |
| Managed transcoding (or Mux) | Avoid running GPU fleets | Per-minute costs |
| CDN with signed URLs | Global speed + only paying students can watch | Signed URLs can be shared until they expire (DRM if needed) |
| Progress updates every ~15 s, batched | Write-heavy but small | Slight data loss if the tab closes (acceptable) |

### Example 3: Ride-hailing / delivery dispatch

**Requirements:** riders request trips; nearby drivers are matched; live location for both; fares; payments; surge pricing; very spiky demand.

```
Driver app ──location every 3–5 s──▶ Location service (Go) ──▶ Redis GEO (current positions, by city)
                                                    └──▶ Kafka "locations" ──▶ ClickHouse (history, ETA models)
Rider app ──POST /trips──▶ Trip service ──▶ PostgreSQL (trips state machine, fares)
                              │
                              └──▶ Matching service: GEO radius query → rank by ETA → offer to driver (timeout → next driver)
Realtime: WebSocket gateways (rider ↔ driver updates) + Redis Pub/Sub
Payments: provider + webhooks + outbox → receipts, driver earnings ledger (double-entry)
```

| Decision | Why | Trade-off |
| --- | --- | --- |
| Separate location service in Go | Very high write rate, simple logic | One more language and service |
| Redis GEO for live positions | Fast radius queries; data is short-lived | Lost on Redis failure → rebuilt from the next pings in seconds |
| Trip as a state machine in Postgres | Money and disputes need correctness | Write path limited by the primary → partition by city at large scale |
| Kafka for location history | Many consumers (ETA, analytics, fraud) | Operating Kafka (use a managed one) |

### Example 4: Ticket booking with flash sales (concerts, trains)

**Requirements:** show seats; hold a seat during checkout; never double-sell; survive 100x traffic at sale start.

```
Users ──▶ CDN (static event pages) ──▶ Waiting room / virtual queue (admits N users per second)
                                            │
                                            ▼
                                    Booking API ──▶ Redis: seat holds with TTL (SET seat:E1:A12 user NX EX 600)
                                            │
                                            └──▶ PostgreSQL (source of truth):
                                                   unique constraint (event_id, seat_id) on bookings
                                                   payment confirmed → insert booking in a transaction
Workers: expire unpaid holds; send tickets (PDF + email); refunds
```

| Decision | Why | Trade-off |
| --- | --- | --- |
| Virtual waiting room | Protects the system and is fairer than a crash | Users wait; extra infrastructure (Cloudflare Waiting Room, Queue-it, custom) |
| Redis `SET NX EX` holds | Fast, atomic, auto-expire | Redis isn't the truth; the final booking relies on the DB unique constraint |
| Database unique constraint | The last line of defence against double-selling | Contention on hot seats (fine: losers get "seat taken") |
| Precomputed seat maps on the CDN, live availability via small API calls | Offload reads | Availability shown may be seconds stale |

### Example 5: IoT fleet monitoring (smart energy meters)

**Requirements:** 500,000 meters send readings every minute; live dashboards for operators; alerts on anomalies; customers see monthly usage; devices on flaky mobile networks.

```
Meters ──MQTT (TLS, QoS 1, per-device certificates)──▶ EMQX / AWS IoT Core
                                                          │ rule engine / bridge
                                                          ▼
                                                        Kafka "readings" (key = meter_id)
                              ┌───────────────────────────┼─────────────────────────────┐
                              ▼                           ▼                             ▼
                 TimescaleDB (hypertable,        Stream processor (Flink /       Redis (latest reading
                 compression, 2-year retention,  Kafka Streams): anomaly rules   per meter for dashboards)
                 continuous aggregates hourly/daily)      │
                              │                           └──▶ Alerts queue ──▶ SMS/email/on-call
                              ▼
                 API (Go/FastAPI) ──▶ Operator dashboard (SSE live) / Customer portal (monthly usage)
PostgreSQL: customers, meters, tariffs, billing
```

| Decision | Why | Trade-off |
| --- | --- | --- |
| MQTT | Low bandwidth, QoS, last-will for offline detection | Broker to run (or managed IoT Core cost) |
| Kafka between broker and storage | Absorbs bursts (all meters reconnect after an outage), multiple consumers | Operational weight |
| TimescaleDB | SQL + joins with customer data; compression; continuous aggregates | Very large scale may move to ClickHouse |
| ≈ 8,300 readings/s average | Fine for a well-tuned Timescale cluster with batch inserts | Batch writes (1,000 rows per insert) are essential |

---

## 9. Anti-patterns: common wrong choices

| Anti-pattern | Why it hurts | Better |
| --- | --- | --- |
| Microservices on day one for a 3-person team | Network calls, distributed debugging and deploy overhead for no benefit | Modular monolith; split when a real need appears |
| Kafka for a few hundred jobs a day | Huge operational cost | A job queue (BullMQ, Celery, SQS, pg-boss) |
| MongoDB for highly relational, transactional data (orders, payments) | Manual joins, consistency bugs | PostgreSQL |
| Redis as the only copy of important data | Memory loss or eviction = data loss | Database as the source of truth, Redis as a cache |
| Elasticsearch as the primary database | Eventual consistency, no transactions | Postgres + a search index fed from it |
| A dedicated vector database for 50k chunks | Extra sync and access-control work | pgvector |
| Storing files/images in database rows | Bloated database, slow backups | Object storage + store the key |
| Kubernetes for one small app | Large learning and maintenance cost | A PaaS (Render, Railway, Cloud Run, Vercel) |
| Picking a language for benchmarks the app will never reach | Slower delivery, hiring issues | The team's strongest language |
| Doing heavy work inside the request | Timeouts, poor experience, blocked event loops | Queue + worker, `202 Accepted` |
| No idempotency on payments/webhooks | Double charges and duplicate orders | Idempotency keys, dedupe tables |
| Caching per-user data under shared keys | Data leaks between users | User/tenant id in every cache key |
