# Part 19: Architecture case studies

Five systems designed end to end. Each covers requirements, stack, data, API, auth, caching, async work, real-time, security, scaling, monitoring and deployment. Each also shows **how the design changes from 100 to 10,000 to 1 million users**. Notice how little is needed at the start.

## Contents

1. [E-commerce backend](#1-e-commerce-backend)
2. [Real-time messaging platform](#2-real-time-messaging-platform)
3. [Banking / financial transaction system](#3-banking--financial-transaction-system)
4. [AI document processing and RAG platform](#4-ai-document-processing-and-rag-platform)
5. [Real-time analytics and monitoring platform](#5-real-time-analytics-and-monitoring-platform)
6. [Patterns that repeat across all five](#6-patterns-that-repeat-across-all-five)

---

## 1. E-commerce backend

### Requirements

**Functional:** product catalogue with categories and variants; search and filters; cart; checkout with payments (UPI, cards); order tracking; inventory; reviews; admin for sellers; emails/SMS.

**Non-functional:** product pages fast (p95 < 300 ms); checkout must never oversell or double-charge; survive sale-day spikes (10–50x); 99.9% availability; PCI-DSS scope kept minimal.

### Stack

| Layer | Choice | Reasoning |
| --- | --- | --- |
| Framework | **NestJS** (TypeScript) or **Django** | Structured domain modules (catalogue, cart, orders, payments); big ecosystems |
| Main database | **PostgreSQL** | Orders, payments, inventory need transactions; variants fit `jsonb` |
| Search | **Meilisearch/Typesense** early; **OpenSearch** at scale | Facets, typos, relevance |
| Cache | **Redis** | Carts, sessions, product cache, rate limits |
| Jobs | **BullMQ** / **Celery** | Emails, invoices, search indexing, abandoned-cart reminders |
| Files | **S3 + CDN** (with image resizing) | Product images |
| Payments | **Razorpay / Stripe** | Card data never touches your servers (PCI scope stays small) |

### API design (REST)

```
GET    /products?category=shoes&brand=nike&sort=price&cursor=...
GET    /products/:slug
GET    /cart                       POST /cart/items     PATCH /cart/items/:id     DELETE /cart/items/:id
POST   /checkout                   (Idempotency-Key header) → { orderId, paymentIntent }
POST   /webhooks/payments          (signature verified)
GET    /orders                     GET /orders/:id
POST   /products/:id/reviews
Admin: /admin/products, /admin/orders/:id/refund (role: seller/admin)
```

### Data model (core)

```
products(id, slug, title, brand, category_id, attributes jsonb, status)
variants(id, product_id, sku unique, price_paise, stock, version)
carts(id, user_id), cart_items(cart_id, variant_id, qty)
orders(id, user_id, status, total_paise, idempotency_key unique, created_at)
order_items(order_id, variant_id, qty, price_at_purchase_paise)     ← copied price = historical truth
payments(id, order_id, provider_ref unique, status, amount_paise)
outbox(id, topic, payload, sent_at)
```

Money is stored as **integer paise**, never floating point (`0.1 + 0.2 !== 0.3`).

### Checkout without overselling

```sql
begin;
  -- atomic decrement with the check built in; 0 rows = out of stock
  update variants set stock = stock - $qty where id = $variant and stock >= $qty;
  insert into orders (...) values (...);                 -- idempotency_key unique → retries can't duplicate
  insert into order_items (...) values (...);
  insert into outbox (topic, payload) values ('order.created', ...);
commit;
```

Payment confirmed by webhook → `orders.status = 'paid'` + outbox `order.paid`. Unpaid after 15 minutes → a job restores stock and cancels the order.

### Auth

Customers: email/phone OTP or OAuth; sessions in `httpOnly` cookies. Sellers/admins: RBAC (`customer`, `seller`, `support`, `admin`) with MFA for admin. **Object-level checks everywhere:** a seller edits only *their* products; a customer sees only *their* orders (OWASP API1: Broken Object Level Authorization).

### Caching

- CDN: images, static assets, product pages (short TTL + purge on change).
- Redis: product details (cache-aside, 5 min + jitter), category listings, carts.
- **Never cached:** stock at checkout, prices at payment time (read in the transaction).

### Async work

`order.paid` → email receipt, invoice PDF, notify warehouse, loyalty points, analytics. Product changed → re-index search. Daily → abandoned-cart reminders, payment reconciliation.

### Real-time

Order status updates via SSE or push notifications. Sale countdowns are static (client-side clock + server time sync). Not much else needs real-time.

### Security

Signature-verified webhooks; idempotency keys; rate limits on login, OTP, checkout and coupon endpoints (stops coupon brute-forcing — OWASP API6: unrestricted access to sensitive business flows); bot protection on sale days; input validation; no card data stored; secrets in a manager; audit log for admin actions and refunds.

### Monitoring

Checkout success rate, payment failure rate by method, p95 of product and checkout endpoints, queue depth, search latency, stock-out errors, webhook failures. Alert on checkout success rate dropping, not on CPU.

### Growth

| Stage | Architecture |
| --- | --- |
| **100 users** | One Django/Next.js app + managed Postgres (+ Stripe/Razorpay). Search with Postgres full-text. Emails sent from a simple job queue (or even inline at first). One region. |
| **10,000 users** | Add Redis (cache, sessions, BullMQ). Move search to Meilisearch/Typesense. CDN for images. 2+ app instances behind a load balancer. Database backups + point-in-time recovery. Sentry + uptime checks. |
| **1 million users** | Read replicas for catalogue reads; OpenSearch cluster; outbox → Kafka/SNS for order events; separate services only where load differs (search indexing, notifications, maybe payments); waiting room for flash sales; autoscaling; multi-AZ database; analytics to ClickHouse/BigQuery instead of the main database; partition the orders table by month. |

---

## 2. Real-time messaging platform

### Requirements

**Functional:** 1:1 and group chats; text, images and files; delivery/read receipts; typing indicators; online presence; push notifications; message history and search; edit/delete.

**Non-functional:** delivery latency < 200 ms p95; no lost messages; per-chat ordering; up to millions of concurrent connections at the top tier.

### Stack

| Layer | Choice | Reasoning |
| --- | --- | --- |
| Connection gateways | **Node (Socket.IO/ws)** early; **Go** or **Elixir** at very large scale | Cheap concurrent connections |
| Chat API/service | Node/NestJS or Go | Stateless business logic |
| Messages | **PostgreSQL** (partitioned by time) → **Cassandra/ScyllaDB** at large scale | Start simple; move when write volume demands it |
| Fan-out | **Redis Pub/Sub** → NATS/Kafka at scale | Cross-gateway delivery |
| Presence | **Redis** keys with TTL | Short-lived |
| Search | **OpenSearch** | Message search |
| Media | **S3 + CDN** with pre-signed uploads | Files |
| Push | **FCM / APNs** | Offline users |

### Architecture

```
Clients ══WSS══▶ LB ══▶ Gateways (auth ticket, hold sockets) ◀──▶ Redis (presence, pub/sub by chat)
                             │
                             ▼
                      Chat service: check membership → assign seq per chat → persist → publish
                             │                           │
                             ▼                           ▼
                      Messages DB                Push service (offline members)
                             │
                             └──▶ CDC/queue ──▶ Search indexer (OpenSearch)
```

### API / protocol

```
REST:  POST /ws-ticket      GET /chats      GET /chats/:id/messages?before=<seq>&limit=50
       POST /uploads (pre-signed)           POST /chats (create group)
WS client → server:  {type:"send", clientMsgId, chatId, body}   {type:"typing", chatId}   {type:"read", chatId, seq}
WS server → client:  {type:"ack", clientMsgId, seq}             {type:"message", chatId, seq, ...}   {type:"receipt", ...}
On reconnect: {type:"resume", cursors:{chatId: lastSeq}} → server sends anything newer
```

### Data model

```
chats(id, type, created_at)          chat_members(chat_id, user_id, role, last_read_seq)
messages(chat_id, seq, id, sender_id, client_msg_id, body, attachments, created_at, edited_at, deleted)
  primary key (chat_id, seq); unique (chat_id, sender_id, client_msg_id)  ← idempotent sends
```

### Key decisions

- **Persist before deliver;** client message ids for idempotency; per-chat sequence numbers for ordering (see [Part 15](15-real-time-systems.md#7-message-delivery-guarantees)).
- Typing indicators and presence are **at-most-once** (never stored).
- Large groups/channels: store once and let clients fetch, rather than pushing to every member.

### Auth and security

Short-lived WS tickets; check `Origin`; membership checked on every send and subscribe; per-connection message rate limits; size limits; file scanning for malware; signed, expiring media URLs; optional end-to-end encryption (Signal protocol) — but then server-side search and moderation become impossible. That's a product trade-off.

### Caching

Recent messages per active chat in Redis (optional); chat lists per user; membership lookups cached briefly (invalidate on membership change).

### Monitoring

Connected sockets per gateway, message send→deliver latency, ack failures, reconnect rate (spikes = network or deploy problems), push delivery failures, Redis pub/sub lag, DB write latency.

### Deployment

Gateways deploy with graceful draining (close code 1012, jittered reconnects). Stateless services roll normally. Multi-AZ.

### Growth

| Stage | Architecture |
| --- | --- |
| **100 users** | **Supabase** (messages table + RLS by membership + Realtime) and a Next.js app. Or one Socket.IO server + Postgres. No Redis needed. |
| **10,000 users** | 2–4 Socket.IO servers + Redis adapter; Postgres with indexes on `(chat_id, seq)`; S3 for media; FCM push; Sentry. |
| **1 million users** (~100k+ concurrent) | Dedicated gateway fleet (Go/Elixir or tuned Node); chat service separate from gateways; Cassandra/ScyllaDB for messages; NATS/Kafka for fan-out and downstream consumers; OpenSearch; multi-region gateways for latency (messages still homed by chat). |

---

## 3. Banking / financial transaction system

### Requirements

**Functional:** accounts; deposits/withdrawals; transfers (internal and via UPI/IMPS/NEFT rails); statements; limits; KYC; fraud checks; notifications.

**Non-functional:** **correctness above everything** (no lost or duplicated money); full audit trail; regulatory compliance (RBI guidelines, PCI-DSS for cards, data retention); high availability, but a consistent "no" beats a wrong "yes"; strong security.

### Stack

| Layer | Choice | Reasoning |
| --- | --- | --- |
| Framework | **Spring Boot (Java/Kotlin)** or **ASP.NET Core** | Mature, strongly typed, auditable, widely used in finance |
| Core database | **PostgreSQL** / Oracle / SQL Server, Serializable isolation for ledger operations | ACID, constraints |
| Ledger | **Double-entry, append-only** | Every transfer = debit + credit entries that sum to zero; balances derived/verified |
| Messaging | **Kafka** (with outbox) | Durable events for fraud, notifications, statements, reconciliation |
| Workflows | **Temporal** (or Step Functions) | Multi-step transfers with external rails and timeouts |
| Cache | Very limited (reference data, rate limits) | Stale balances are dangerous |
| Fraud | Streaming rules + ML scoring; **Neo4j** for link analysis | Detect mule networks |

### Ledger model

```
accounts(id, customer_id, currency, status)
journal_entries(id, created_at, type, idempotency_key unique, external_ref)
postings(id, journal_entry_id, account_id, amount_paise)          -- debit negative, credit positive
  constraint: postings for one journal entry sum to 0 (checked in the transaction)
account_balances(account_id, balance_paise, version)               -- derived; updated in the same transaction
```

### Transfer flow

```
POST /transfers  (Idempotency-Key)
 1. Authenticate (session + device binding); check MFA/step-up for high value
 2. Validate limits, account status, sanctions/fraud pre-check (sync, fast rules)
 3. BEGIN (serializable)
      lock both balance rows in a consistent order (avoid deadlocks: lower id first)
      check funds; insert journal entry + 2 postings; update balances
      insert outbox event "transfer.completed"
    COMMIT   (serialization failure → retry with the same idempotency key)
 4. Outbox → Kafka → notifications, statements, async fraud scoring, analytics
External rails (UPI/IMPS): state machine pending → submitted → settled/failed, driven by callbacks
and polling; reconciliation jobs compare bank-side and rail-side records daily.
```

### Auth and security

MFA, device binding, step-up auth for risky actions; RBAC + maker-checker (two people approve sensitive admin actions); HSM/KMS for keys; encryption at rest and in transit; network segmentation; immutable audit logs (WORM storage); penetration testing; rate limits; anomaly detection on logins; strict data minimisation and masking in logs.

### API design

REST with idempotency keys on all money-moving endpoints; precise error codes (`INSUFFICIENT_FUNDS`, `LIMIT_EXCEEDED`); no partial success; amounts as integer minor units with an explicit currency.

### Monitoring

Ledger integrity checks (sum of all postings = 0; derived balances = stored balances), reconciliation mismatches, transfer success/failure rates by rail, latency, fraud alert rates. Alerts page humans immediately for integrity failures.

### Deployment

Multi-AZ primary with synchronous replica (no data loss on failover, RPO ≈ 0); blue-green/canary releases with feature flags; strict change management; DR region with tested failover.

### Growth

| Stage | Architecture |
| --- | --- |
| **100 users** (pilot/fintech MVP) | Spring Boot monolith + Postgres with the double-entry ledger from day one (retrofitting it is painful); partner bank/BaaS APIs for rails; audit tables; MFA. |
| **10,000 users** | Outbox + a queue for notifications/statements; reconciliation jobs; read replica for statements and reporting; formal on-call and runbooks. |
| **1 million users** | Kafka event backbone; Temporal for transfer workflows; dedicated fraud service; ledger partitioned/sharded by account range if needed; separate reporting warehouse; multi-region DR; 24×7 SRE. |

---

## 4. AI document processing and RAG platform

### Requirements

**Functional:** organisations upload documents (PDF, DOCX, HTML); text is extracted, chunked and embedded; users ask questions and get answers with citations; access follows document permissions; admins manage sources and see usage.

**Non-functional:** answers grounded only in documents the asking user may see (no cross-tenant or cross-user leaks); first token < 2 s; ingestion of thousands of pages per hour; cost control; resistance to prompt injection.

### Stack

| Layer | Choice | Reasoning |
| --- | --- | --- |
| API | **FastAPI** (Python) | AI/ML ecosystem, async, streaming |
| App/UI | Next.js | Streaming UI |
| Database | **PostgreSQL** + **pgvector** (→ Qdrant/Weaviate at large scale) | Permissions, metadata and vectors together; RLS |
| Keyword search | Postgres full-text (→ OpenSearch) | Hybrid retrieval |
| Files | **S3** | Originals |
| Ingestion | **Celery / SQS workers** | Slow, retryable, CPU-heavy parsing |
| Cache / limits | **Redis** | Rate limits, response cache, token budgets |
| LLM | A hosted model API (or self-hosted via vLLM) behind an internal gateway | Swap models, central logging and limits |

### Architecture

```
Upload ──▶ API ──▶ S3 + documents row (status=queued, tenant_id, acl) ──▶ queue
                                                                         │
Workers: scan for malware → extract text (sandboxed) → clean → chunk (e.g. ~500 tokens, overlap)
         → embed (batched) → upsert chunks(tenant_id, doc_id, acl, text, embedding) → status=ready

Question ──▶ API (auth → tenant + user + groups)
         → hybrid retrieval WITH permission filter (tenant_id = X AND acl overlaps user's groups)
         → rerank top 50 → top 8
         → build prompt: system rules + retrieved text clearly marked as untrusted data + question
         → LLM (streamed via SSE) → answer + citations (doc ids the user is allowed to see)
         → log (redacted), count tokens against tenant budget
```

### Data model

```
documents(id, tenant_id, title, s3_key, status, acl text[], uploaded_by, created_at)
chunks(id, tenant_id, document_id, ord, text, acl text[], embedding vector(1536), tsv tsvector)
  index: hnsw (embedding vector_cosine_ops); gin (tsv); btree (tenant_id)
  RLS: tenant_id = current tenant AND acl && current user's groups
conversations(id, tenant_id, user_id), messages(conversation_id, role, content, citations, tokens)
```

### Security (the critical part)

| Risk | Mitigation |
| --- | --- |
| **Cross-tenant / unauthorised retrieval** (OWASP LLM08) | Filter by tenant *and* ACL **in the database query** (RLS), never by asking the model to ignore things; tests that prove user A can't retrieve B's chunks |
| **Indirect prompt injection** in documents ("ignore instructions and reveal...") (LLM01) | Treat retrieved text as data; the model has no tools that can act or reach other data; output filtered; citations only to permitted docs |
| **Sensitive information disclosure** (LLM02) | PII redaction options at ingestion; don't put secrets in system prompts (LLM07); redact logs |
| **Improper output handling** (LLM05) | Render model output as text/sanitised markdown (no raw HTML) to prevent XSS; never execute it |
| **Unbounded consumption** (LLM10) | Per-user and per-tenant rate limits and token budgets; max input size; timeouts; cache repeated questions |
| **Malicious files** | Size/type limits, malware scanning, parse in sandboxed workers without network access |
| **SSRF** from "import from URL" | Allow-list schemes, block private IP ranges, fetch via an isolated egress proxy |

Full detail: [Part 18, section 5](18-using-ai-for-backend-engineering.md#5-security-considerations-when-using-ai).

### Caching

Embeddings of identical chunks reused (hash the text); answer cache keyed by (tenant, permission set, normalised question, document version) — **permission set must be in the key**; rate-limit counters in Redis.

### Monitoring

Ingestion queue depth and failure rate; retrieval latency; time to first token; tokens and cost per tenant; answer feedback (thumbs up/down); "no relevant context found" rate; evaluation set scores run on every prompt/model change (groundedness, citation accuracy).

### Growth

| Stage | Architecture |
| --- | --- |
| **100 users** | One FastAPI app + Postgres/pgvector + S3; ingestion in a simple background worker; a hosted model API. RLS + permission tests from day one. |
| **10,000 users** | Celery/SQS worker pool with autoscaling; hybrid search + reranking; Redis rate limits and budgets; an evaluation pipeline; an LLM gateway with logging and fallbacks. |
| **1 million users** | Dedicated vector DB (Qdrant/Weaviate) with tenant-aware filtering/sharding; OpenSearch for keywords; separate ingestion and query services; caching layers; per-tenant quotas and isolation for large customers; self-hosted models for cost/latency where justified; multi-region for data residency. |

---

## 5. Real-time analytics and monitoring platform

### Requirements

**Functional:** customers install an SDK/agent that sends events and metrics; live dashboards (last 15 minutes updating every few seconds); historical queries (last 90 days); alert rules ("error rate > 2% for 5 minutes"); multi-tenant.

**Non-functional:** ingest bursts of 100k+ events/s; query p95 < 2 s over billions of rows; alerts within 1 minute; no data loss on ingest; cost-efficient storage.

### Stack

| Layer | Choice | Reasoning |
| --- | --- | --- |
| Ingest API | **Go** (or Rust) | High throughput, low memory |
| Buffer | **Kafka** (key = tenant/source) | Absorbs bursts, decouples, replay |
| Stream processing | **Flink / Kafka Streams** (or ClickHouse materialised views) | Rolling aggregates, alert evaluation |
| Analytics store | **ClickHouse** | Column store, fast aggregations, compression |
| Metadata | **PostgreSQL** | Tenants, dashboards, alert rules, users |
| Live push | **SSE** gateways + Redis Pub/Sub | One-way dashboard updates |
| Cold storage | **S3 + Parquet** | Cheap long-term retention |

### Architecture

```
SDKs/agents ──HTTPS batch (gzip) ──▶ Ingest API (auth by API key, validate, rate-limit per tenant)
                                          │  responds 202 after writing to Kafka
                                          ▼
                                        Kafka "events" (partitions by tenant)
               ┌──────────────────────────┼──────────────────────────────┐
               ▼                          ▼                              ▼
     ClickHouse writer (batched     Stream processor:              Archiver → S3 Parquet
     inserts, ~1s / 100k rows)      1-min aggregates, alert rules
               │                          │
               ▼                          ├──▶ Redis (latest aggregates) ──▶ SSE gateways ──▶ live dashboards
     Query API (Go/Node):                 └──▶ Alerts → queue → email/Slack/PagerDuty/webhooks
     tenant-scoped SQL, time-bounded,
     cached for repeated dashboard queries
```

### API design

```
POST /v1/ingest            (API key; batch of events; 202 Accepted)
GET  /v1/query?metric=errors&from=...&to=...&groupBy=service&interval=1m
GET  /v1/live/:dashboardId (SSE)
CRUD /v1/dashboards, /v1/alerts
```

### Key decisions and trade-offs

| Decision | Why | Trade-off |
| --- | --- | --- |
| Accept-then-process (202 + Kafka) | Ingest never blocks on storage | Data visible after a few seconds |
| Batched inserts into ClickHouse | ClickHouse prefers large, infrequent inserts | Small extra delay |
| Pre-aggregation (1-min rollups) | Dashboards query small tables | Raw detail kept only for N days |
| Tiered retention: raw 7–30 days, rollups 1 year, archive in S3 | Cost | Old raw queries are slower (go to S3) |
| Tenant id in every partition key and query | Isolation and noisy-neighbour control | Large tenants may need dedicated resources |

### Security

API keys scoped per project, hashed at rest, rotatable; ingest rate limits and payload size caps per tenant (OWASP API4: unrestricted resource consumption); query guardrails (mandatory time range, row and time limits, tenant filter enforced server-side — users never send raw SQL); PII scrubbing options in SDKs; signed webhooks for alert delivery.

### Monitoring the monitor

Kafka consumer lag (the key health signal), ingest error rate, ClickHouse insert latency and merges, query p95, alert evaluation delay, SSE connection counts. A separate, simpler monitoring setup watches this system (don't monitor yourself only with yourself).

### Growth

| Stage | Architecture |
| --- | --- |
| **100 users** | One API writing directly to **TimescaleDB or ClickHouse** (single node) in small batches; dashboards poll every 10 s; alert rules evaluated by a cron job every minute. |
| **10,000 users** | Add Kafka (or Redpanda) as the buffer; separate ingest and query services; Redis for live aggregates + SSE; ClickHouse with replicas; tiered retention. |
| **1 million users** | Sharded ClickHouse cluster; Flink for streaming aggregates and alerts; per-tenant quotas and isolation; S3 archive with Parquet; multi-region ingest endpoints; dedicated SRE team. |

---

## 6. Patterns that repeat across all five

| Pattern | Where it appeared |
| --- | --- |
| **Postgres as the source of truth** | All five (metadata at minimum) |
| **Idempotency keys / client ids** | Checkout, messages, transfers, ingestion retries |
| **Outbox → events** | Orders, transfers, chat search indexing |
| **Queue + workers for slow work** | Invoices, push, statements, document ingestion, alerts |
| **Cache with explicit rules for what's *never* cached** | Stock, balances, permissions |
| **Access control enforced in the data layer** | Seller products, chat membership, ledger, RAG chunks, tenant queries |
| **Start as a monolith on managed services** | Every 100-user stage |
| **Scale the bottleneck you measured** | Each 10k → 1M step adds pieces for a specific load, not "just in case" |
