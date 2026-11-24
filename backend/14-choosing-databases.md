# Part 14: Choosing databases in depth

[Part 2](02-sql-vs-nosql.md) explained the *kinds* of database and [Part 3](03-database-services.md) the hosted services. This part teaches how to **choose** based on requirements, and covers the deeper concepts you need to use a database well: transactions, isolation, indexing, normalisation and scaling.

## Contents

1. [Start from the access pattern, not the database](#1-start-from-the-access-pattern-not-the-database)
2. [Relational: PostgreSQL, MySQL, SQL Server](#2-relational-postgresql-mysql-sql-server)
3. [NoSQL: MongoDB, DynamoDB, Cassandra, Redis](#3-nosql-mongodb-dynamodb-cassandra-redis)
4. [Specialised: vector, search, time-series, graph](#4-specialised-vector-search-time-series-graph)
5. [Transactions and isolation levels](#5-transactions-and-isolation-levels)
6. [Indexing and query optimisation](#6-indexing-and-query-optimisation)
7. [Normalisation and denormalisation](#7-normalisation-and-denormalisation)
8. [Read-heavy vs write-heavy workloads](#8-read-heavy-vs-write-heavy-workloads)
9. [Caching strategies in practice](#9-caching-strategies-in-practice)
10. [Connection pooling](#10-connection-pooling)
11. [Replication, partitioning, sharding: when each is needed](#11-replication-partitioning-sharding-when-each-is-needed)
12. [Scenarios: which database combination and why](#12-scenarios-which-database-combination-and-why)

---

## 1. Start from the access pattern, not the database

Before picking a database, write down:

1. **The main entities** and how they relate (users, orders, products...).
2. **The top 5–10 queries**, with how often each runs. ("Get a user's last 20 orders": 500/s. "Monthly revenue report": once a day.)
3. **Read/write ratio.**
4. **Consistency needs.** Which data must never be wrong (money, stock)? Which can be a little stale (likes, view counts)?
5. **Data size and growth.** GB now? TB in 3 years?
6. **Latency targets.** "Product page p95 under 200 ms."
7. **Team skills and operational capacity.** Who will run and back it up?

Then choose. **Default to PostgreSQL** and add others only when a specific requirement isn't met. Each extra database is another thing to secure, back up, monitor and keep in sync.

---

## 2. Relational: PostgreSQL, MySQL, SQL Server

| | PostgreSQL | MySQL (InnoDB) | Microsoft SQL Server |
| --- | --- | --- | --- |
| License | Open source (very permissive) | Open source (GPL) + Oracle commercial editions; MariaDB fork | Commercial (free Express/Developer editions) |
| Strengths | Feature-rich: `jsonb`, arrays, full-text search, CTEs, window functions, extensions (PostGIS, pgvector, TimescaleDB), strict standards, RLS | Simple, very fast simple reads, huge web hosting support, mature replication | Excellent tooling (SSMS), BI/reporting stack, deep Windows/Azure integration, strong optimiser |
| Default isolation | Read Committed | Repeatable Read | Read Committed |
| Typical users | Startups to large companies; Supabase, Neon | WordPress, many PHP apps, large web companies (Meta runs a heavily customised MySQL) | Enterprises, finance, government on Microsoft stacks |
| Choose when | Default for new projects; need advanced types or extensions | Team/hosting already on MySQL; simple read-heavy web workloads; Vitess/PlanetScale for sharding | Company is on Microsoft; needs its BI and reporting tools |
| Avoid when | Rarely a wrong choice for an OLTP app | You need advanced SQL features or extensions | Licence cost matters; Linux-first open-source teams |

### What relational databases guarantee (ACID), in practice

```sql
begin;
  update accounts set balance = balance - 500 where id = 'A';
  update accounts set balance = balance + 500 where id = 'B';
  insert into ledger (from_id, to_id, amount) values ('A', 'B', 500);
commit;   -- all three happen, or (on any error / crash) none do
```

That's why money, stock and bookings live in relational databases.

---

## 3. NoSQL: MongoDB, DynamoDB, Cassandra, Redis

### MongoDB (document)

- **Why use it:** data naturally shaped as nested documents that are read whole; fields vary between items; fast iteration; built-in sharding.
- **When not:** lots of relationships and joins; strict multi-entity consistency (it has multi-document transactions, but heavy use goes against its design); reporting across many collections.
- **Alternatives:** Postgres `jsonb` (documents inside SQL), Firestore, Couchbase.
- **Design tip:** "data that's read together lives together". Embed small, owned children (order → line items). Reference large or shared things (product → reviews in their own collection).

### DynamoDB (key-value / wide-column, AWS)

- **How it works:** every item has a **partition key** (decides which server) and optional **sort key** (order within the partition). Queries must use the key; other lookups need a **Global Secondary Index (GSI)**.
- **Why use it:** effectively unlimited scale with steady single-digit-millisecond latency; serverless pay-per-request; no servers to manage; pairs naturally with Lambda.
- **When not:** ad-hoc queries, reporting, joins, changing access patterns. You must know your queries up front; changing them later can mean reshaping all your data. Items are capped at 400 KB.
- **Single-table design example:**

```
PK              SK                       data
USER#42         PROFILE                  { name, email }
USER#42         ORDER#2026-11-10#o1      { total: 1499 }
USER#42         ORDER#2026-11-09#o7      { total: 299 }
```

"User 42 and their orders, newest first" = one query on `PK = USER#42`.

- **Alternatives:** Cassandra/ScyllaDB (self-run or managed), Postgres until scale truly demands this.

### Cassandra / ScyllaDB (wide-column)

- **How it works:** data spread across many nodes by partition key, with no leader (any node accepts writes). Uses an LSM-tree storage engine, which is very fast for writes. **Tunable consistency:** for each query, choose `ONE`, `QUORUM`, `ALL`...
- **Why use it:** massive write throughput; survives node and even data-centre failures; multi-region active-active.
- **When not:** small data (overkill); joins, aggregations, ad-hoc queries; strong consistency everywhere; small teams (operations are demanding). Deletes create "tombstones" that can hurt performance if misused.
- **Design rule:** one table per query. Duplicating data across tables is normal and expected.
- **Alternatives:** ScyllaDB (Cassandra-compatible, C++, often faster), DynamoDB, Bigtable.

### Redis (in-memory key-value + data structures)

- **Data structures:** strings, hashes, lists, sets, **sorted sets** (leaderboards), streams, geospatial indexes, HyperLogLog (approximate unique counts), bitmaps.
- **Why use it:** sub-millisecond operations; atomic counters; perfect for caches, sessions, rate limits, leaderboards, distributed locks, queues (BullMQ), pub/sub.
- **When not:** as the only copy of important data. It persists to disk (RDB snapshots, AOF logs), but it's memory-first and size-limited by RAM. Not for complex queries.
- **Alternatives:** **Valkey** (a Linux Foundation fork created after Redis's 2024 licence change; drop-in compatible), Memcached (plain cache only), DragonflyDB, Upstash (serverless Redis-compatible).

```js
// A leaderboard in two lines
await redis.zincrby("leaderboard:week46", 50, "user:42");
const top10 = await redis.zrevrange("leaderboard:week46", 0, 9, "WITHSCORES");
```

---

## 4. Specialised: vector, search, time-series, graph

These usually sit **beside** a main database, which stays the source of truth.

### Vector databases: Qdrant, Pinecone, Weaviate (and pgvector)

Store embeddings (lists of numbers that capture meaning) and find the nearest ones. They power semantic search, recommendations, and RAG (retrieval-augmented generation) for AI apps.

| | pgvector | Qdrant | Pinecone | Weaviate |
| --- | --- | --- | --- | --- |
| Type | Postgres extension | Open source (Rust), self-host or cloud | Fully managed service only | Open source, self-host or cloud |
| Strength | Same database as your data, joins, transactions, RLS | Fast, strong metadata filtering | Zero operations, scales easily | Built-in hybrid (keyword + vector) search, modules |
| Choose when | Up to millions of vectors; want simplicity | Need speed and filtering, want open source | Don't want to run anything | Want hybrid search built in |

**Rule of thumb:** start with **pgvector**. Move to a dedicated vector database when you have very large collections (tens of millions+), need lower latency than Postgres can give, or have heavy filtering needs.

**Important for security:** vector databases must enforce *who can see which chunks* (tenant id / user id filters). See [Part 18](18-using-ai-for-backend-engineering.md#5-security-considerations-when-using-ai).

### Full-text search: Elasticsearch / OpenSearch

- **How:** an **inverted index** (word → list of documents), with relevance ranking (BM25), typo tolerance, filters, facets ("Brand: Nike (42)"), highlighting, aggregations.
- **OpenSearch** is the AWS-led fork of Elasticsearch from 2021. They're very similar.
- **Choose when:** the search box is a core feature (shops, docs, job boards), log search (the ELK/OpenSearch stack).
- **When not:** as your primary database (it's eventually consistent, with about a 1-second refresh by default). For small apps, use Postgres full-text search, Meilisearch or Typesense (simpler).
- **Keeping it in sync:** write to Postgres, then update the index through a queue or CDC (change data capture, e.g. Debezium).

### Time-series: InfluxDB, TimescaleDB

Data = measurements over time (sensor readings, metrics, prices).

| | TimescaleDB | InfluxDB |
| --- | --- | --- |
| What | Postgres extension (hypertables) | Purpose-built time-series database (v3 rebuilt on Apache Arrow/Parquet) |
| Query language | Full SQL + joins with your other tables | SQL and InfluxQL (v3) |
| Choose when | Already on Postgres; want SQL and joins with business data | Pure metrics/IoT workloads, very high ingest |

Both offer compression (often 90%+), automatic retention (delete data older than N days), and downsampling (keep 1-minute averages after a week).

Other options: ClickHouse (very fast analytics), Prometheus (metrics monitoring).

### Graph: Neo4j

- **Query language:** Cypher.

```cypher
// "People my friends follow, whom I don't follow yet"
MATCH (me:User {id: 42})-[:FOLLOWS]->(:User)-[:FOLLOWS]->(suggestion:User)
WHERE NOT (me)-[:FOLLOWS]->(suggestion) AND suggestion <> me
RETURN suggestion, count(*) AS mutual ORDER BY mutual DESC LIMIT 10
```

- **Choose when:** questions are about multi-hop relationships: fraud rings, recommendations, network/IT topology, knowledge graphs, access-control graphs.
- **When not:** simple CRUD, reporting, high-volume writes of plain records.
- **Alternatives:** Postgres recursive CTEs (fine for shallow graphs), Amazon Neptune, Memgraph.

---

## 5. Transactions and isolation levels

ACID's "I" (isolation) has **levels**. Lower levels are faster but allow strange results when two transactions run at once.

### The anomalies, with examples

| Anomaly | What happens | Example |
| --- | --- | --- |
| **Dirty read** | You read data another transaction hasn't committed (and may roll back) | You see a ₹500 deposit that then gets cancelled |
| **Non-repeatable read** | Reading the same row twice gives different values | Price is ₹100, then ₹120, within your transaction |
| **Phantom read** | Re-running a query returns new rows | "Count bookings for 7 pm" returns 9, then 10 |
| **Lost update** | Two transactions read, both write, one overwrites the other | Two people withdraw at once; only one withdrawal is recorded |
| **Write skew** | Two transactions each check a rule, then write different rows, and together break the rule | Two doctors both go off-call because each saw the other was on call |

### The levels

| Level | Prevents | Notes |
| --- | --- | --- |
| Read Uncommitted | Nothing much | Postgres treats it as Read Committed |
| **Read Committed** | Dirty reads | Postgres and SQL Server default |
| **Repeatable Read** | + non-repeatable reads (and phantoms in Postgres) | MySQL default |
| **Serializable** | Everything: as if transactions ran one at a time | Safest; may abort transactions that must be retried |

### The lost-update bug, and three fixes

```js
// ❌ BUG: read-modify-write. Two requests at once → both read 1000, both write 500.
const { balance } = await db.one("select balance from accounts where id = $1", [id]);
if (balance < 500) throw new Error("Insufficient funds");
await db.none("update accounts set balance = $1 where id = $2", [balance - 500, id]);
```

```sql
-- ✅ Fix 1: one atomic statement with the check inside it
update accounts set balance = balance - 500
where id = $1 and balance >= 500
returning balance;            -- 0 rows returned = insufficient funds

-- ✅ Fix 2: lock the row inside a transaction (pessimistic locking)
begin;
select balance from accounts where id = $1 for update;   -- others wait here
update accounts set balance = balance - 500 where id = $1;
commit;

-- ✅ Fix 3: optimistic locking with a version column
update accounts set balance = $new, version = version + 1
where id = $1 and version = $versionIReadEarlier;          -- 0 rows = someone else changed it; retry
```

**Optimistic vs pessimistic:** optimistic is better when conflicts are rare (most apps); pessimistic is better when conflicts are frequent (a hot row such as a flash-sale item's stock).

---

## 6. Indexing and query optimisation

### How an index works

Most indexes are **B-trees**: sorted trees that find any value in a few steps. A table with 10 million rows needs about 4 hops instead of scanning 10 million rows.

### Composite index: the "leftmost prefix" rule

```sql
create index orders_user_date on orders (user_id, created_at desc);
```

| Query | Uses the index? |
| --- | --- |
| `where user_id = 42` | ✅ |
| `where user_id = 42 order by created_at desc` | ✅ (and no sort step needed) |
| `where user_id = 42 and created_at > '2026-11-01'` | ✅ |
| `where created_at > '2026-11-01'` | ❌ (skips the first column) |

Order columns as: **equality filters first, then range/sort columns.**

### Other index types (Postgres)

| Type | For |
| --- | --- |
| B-tree | Equality, ranges, sorting (default) |
| Hash | Equality only |
| GIN | `jsonb`, arrays, full-text search |
| GiST / SP-GiST | Geospatial (PostGIS), ranges |
| BRIN | Huge tables naturally ordered by time (tiny index) |
| HNSW / IVFFlat (pgvector) | Vector similarity |
| **Partial** | `create index on orders (created_at) where status = 'pending'`: small and fast for a hot subset |
| **Covering** (`include`) | Answer the query from the index alone, without reading the table |

### Reading a query plan

```sql
explain analyze select * from orders where user_id = 42 order by created_at desc limit 20;
```

Look for:
- `Seq Scan` on a big table → probably a missing index.
- `Index Scan` / `Index Only Scan` → good.
- Estimated rows far from actual rows → statistics are out of date (`analyze`).
- A large `Sort` or `Hash` spilling to disk → needs an index or more `work_mem`.

### Common slow-query causes and fixes

| Cause | Fix |
| --- | --- |
| Missing index on filter/join columns | Add it (check with `explain`) |
| **N+1 queries** (1 query for 100 orders + 100 queries for items) | One join, `where id in (...)`, or ORM eager loading |
| `select *` pulling big columns | Select only the columns you need |
| Function on an indexed column: `where lower(email) = ...` | Expression index: `create index on users (lower(email))` |
| `offset 100000` pagination | Keyset/cursor pagination: `where created_at < $last order by created_at desc limit 20` |
| Leading wildcard `like '%phone%'` | Full-text search or trigram index (`pg_trgm`) |
| Huge transactions holding locks | Keep transactions short; batch big updates |

**Cost of indexes:** every insert/update must update every index. A write-heavy table with 12 indexes is slow to write. Index for your real queries and drop unused indexes (`pg_stat_user_indexes`).

---

## 7. Normalisation and denormalisation

**Normalisation** = store each fact once.

```
❌ Not normalised: orders(id, customer_name, customer_email, customer_city, ...)
   → customer changes email: update every order; risk of mismatched copies

✅ Normalised: customers(id, name, email, city)   orders(id, customer_id → customers.id, ...)
```

The normal forms, simplified:

- **1NF:** one value per cell (no comma-separated lists).
- **2NF:** every column depends on the whole primary key.
- **3NF:** non-key columns depend only on the key, not on each other (don't store `city` *and* `pincode → city` in the same row).

**Denormalisation** = deliberately store copies to make reads faster.

| Example | Why | How to keep it correct |
| --- | --- | --- |
| `posts.comment_count` | Avoid `count(*)` on every feed load | Trigger or atomic `+1` in the same transaction |
| `order_items.price_at_purchase` | Historical truth: the price *then*, not now | Copied once at checkout. That's correct, not a hack |
| A `daily_sales` summary table | Fast dashboards | Updated by a job or a materialised view |
| Customer name inside an order document (MongoDB) | One read per order | Accept staleness, or update with a background job |

**Rule:** normalise by default (correctness), denormalise specific hot paths after measuring, and decide how each copy is kept in sync.

---

## 8. Read-heavy vs write-heavy workloads

| | Read-heavy (e.g. 100 reads : 1 write) | Write-heavy (e.g. 1 read : 10 writes) |
| --- | --- | --- |
| Examples | Product catalogue, news, blogs, social feeds (reading) | IoT sensors, logs, metrics, chat messages, clickstreams, GPS pings |
| Main tools | Caching (Redis, CDN), read replicas, denormalised views, more indexes | Append-only design, batching, queues, LSM-tree databases (Cassandra, ScyllaDB, RocksDB), time-series databases, partitioning, fewer indexes |
| Database fit | Postgres/MySQL + replicas + cache | Cassandra, ScyllaDB, ClickHouse, TimescaleDB, Kafka as a buffer |
| Watch out | Cache invalidation, replica lag | Hot partitions, compaction, storage growth (set retention) |

**B-tree vs LSM-tree:** B-trees (Postgres, MySQL) update data in place: great reads, OK writes. LSM-trees (Cassandra, RocksDB) append writes to memory and flush sorted files later: excellent writes, reads may check several files.

---

## 9. Caching strategies in practice

([Part 7](07-system-design-basics.md#caching-the-biggest-win-for-the-least-effort) covers the basics.)

### Cache-aside in code

```ts
async function getProduct(id: string) {
  const key = `product:${id}:v3`;                         // version in the key = easy mass invalidation
  const hit = await redis.get(key);
  if (hit) return JSON.parse(hit);

  const product = await db.product.findUnique({ where: { id } });
  if (product) await redis.set(key, JSON.stringify(product), "EX", 300 + Math.floor(Math.random() * 60)); // TTL + jitter
  return product;
}

async function updateProduct(id: string, data: Partial<Product>) {
  await db.product.update({ where: { id }, data });
  await redis.del(`product:${id}:v3`);                    // delete after the DB write succeeds
}
```

### What to cache and for how long

| Data | Cache? | TTL idea |
| --- | --- | --- |
| Static assets (JS, CSS, images) | CDN, long | 1 year with hashed filenames |
| Public product page | CDN + Redis | Minutes; purge on change |
| User's own dashboard | Redis per user | Seconds to minutes; delete on write |
| Stock count at checkout | ❌ Read from the DB in the transaction | — |
| Bank balance | ❌ (or very short, display only) | — |
| Session | Redis | Session lifetime |
| Expensive report | Redis or a precomputed table | Hours |

### Cache dangers

- **Per-user data in a shared key** → user A sees user B's data. Always include the user/tenant in the key.
- **Stampede** on expiry → jittered TTLs, request coalescing, early refresh.
- **Cache penetration** (repeated lookups of non-existent ids) → cache the "not found" briefly, or use a Bloom filter.
- **Treating the cache as the source of truth** → it can be wiped at any time; always be able to rebuild from the database.

---

## 10. Connection pooling

Each Postgres connection is a separate process using several MB of memory. Typical limits are 100–500 connections.

```
Without pooling (serverless):  1,000 concurrent functions × 1 connection = 1,000 connections → "too many clients"

With a pooler:                 1,000 functions ──▶ [ PgBouncer / Supavisor ] ──▶ 20 real connections ──▶ Postgres
```

| Pool mode | Meaning | Caveat |
| --- | --- | --- |
| Session | Client keeps one server connection for its whole session | Few savings |
| **Transaction** | Server connection borrowed per transaction | Most efficient; session features (some prepared statements, `SET`, advisory locks) behave differently |
| Statement | Per statement | No multi-statement transactions |

**App-level pools** (`pg.Pool`, HikariCP in Java, SQLAlchemy's pool) on long-running servers: size about `(CPU cores × 2) + disks` per database server as a starting point, not hundreds. More connections often make things *slower*.

**Serverless options:** a pooler URL (Supabase, Neon, RDS Proxy) or an HTTP-based driver. PLOS uses Supabase's HTTP data API, so it never holds database connections.

---

## 11. Replication, partitioning, sharding: when each is needed

([Part 7](07-system-design-basics.md#database-scaling) explains how each works.) Use this to decide **when**:

| Symptom | Likely fix |
| --- | --- |
| Slow queries, CPU fine | Indexes, query fixes |
| CPU high from reads | Cache, then read replicas |
| Need to survive a database server failing | A replica with automatic failover (high availability) |
| Users far away in another continent read slowly | A read replica in their region, or edge caching |
| One table is huge (billions of rows); old data rarely used | Partition by time; archive old partitions |
| Writes exceed what the largest machine can take | Shard (or move that workload to Cassandra/DynamoDB) |
| Data must stay in a country (data residency laws) | Partition/shard by region |

Sharding is a last resort. Before sharding, try: a bigger machine, moving write-heavy side data (logs, events) to a better-suited store, and partitioning.

---

## 12. Scenarios: which database combination and why

### E-commerce platform

| Need | Choice | Why |
| --- | --- | --- |
| Users, orders, payments, inventory | **PostgreSQL** | Transactions: an order, its payment and the stock decrement must agree |
| Product catalogue with varied attributes | Postgres `jsonb` (or MongoDB if the catalogue is huge and very varied) | A phone and a sofa have different fields |
| Product search, filters, facets | **Elasticsearch/OpenSearch** (or Meilisearch/Typesense when smaller) | Relevance, typos, facets |
| Cart, sessions, product page cache | **Redis** | Fast, temporary |
| "Customers also bought" | Precomputed tables, or a vector database for similarity | Recommendations |
| Analytics | **ClickHouse/BigQuery** fed by events | Don't run heavy reports on the order database |

**Trade-off:** search results may lag a few seconds behind catalogue changes. Acceptable. Stock at checkout is always read from Postgres inside the transaction.

### Banking and financial systems

| Need | Choice | Why |
| --- | --- | --- |
| Accounts, ledger, transfers | **PostgreSQL / SQL Server / Oracle** with Serializable or careful locking | Correctness above all; ACID; auditability |
| Ledger design | **Double-entry, append-only**: never update a balance in place without a ledger entry | Every rupee is traceable; balances can be rebuilt |
| Fraud detection | Streaming (Kafka) + rules; **Neo4j** for fraud rings | Relationship patterns |
| Caching | Very limited (display only) | Stale balances are dangerous |
| Audit | Immutable audit tables, write-once storage | Regulation |

**Trade-off:** you give up some speed and availability for consistency (CP in CAP terms). A bank would rather reject a transfer than double-spend.

### Social media application

| Need | Choice | Why |
| --- | --- | --- |
| Users, profiles, relationships (moderate scale) | **PostgreSQL** | Relational, consistent |
| Posts, likes, comments at huge scale | **Cassandra/ScyllaDB** or sharded MySQL | Write volume |
| News feed | **Redis** (precomputed feed lists per user) | Fast reads |
| Follower graph, "people you may know" | **Neo4j** or a graph service | Multi-hop queries |
| Search (people, hashtags) | **Elasticsearch** | Text search |
| Media | **Object storage (S3) + CDN** | Not in a database |
| Like counts | Redis counters, flushed to the database periodically | Eventual consistency is fine |

**Feed design trade-off:** *fan-out on write* (push each post into every follower's feed: fast reads, expensive for celebrities) vs *fan-out on read* (build the feed when opened: cheap writes, slower reads). Real systems mix them: push for normal users, pull for celebrities.

### Chat application

| Need | Choice | Why |
| --- | --- | --- |
| Users, chats, memberships | **PostgreSQL** | Relational |
| Messages (small/medium scale) | **PostgreSQL**, partitioned by time | Simple, consistent |
| Messages (huge scale) | **Cassandra/ScyllaDB**, partitioned by `chat_id` | Write volume, "latest N in a chat" is one partition read |
| Online presence, typing indicators | **Redis** with TTL keys | Short-lived, fast |
| Cross-server delivery | **Redis Pub/Sub** or NATS/Kafka | Route to the recipient's server ([Part 15](15-real-time-systems.md)) |
| Message search | **Elasticsearch** | Text search |
| Attachments | **S3 + CDN** | Files |

### Analytics platform

| Need | Choice | Why |
| --- | --- | --- |
| Event ingestion | **Kafka** (or Kinesis/Pub/Sub) | Buffer bursts, replay |
| Analytical queries | **ClickHouse**, BigQuery, Snowflake, Redshift | Column stores: scan billions of rows quickly |
| Raw data lake | **S3 + Parquet** (Iceberg/Delta tables) | Cheap, long-term |
| Dashboard metadata, users | **PostgreSQL** | Relational |
| Dashboard query cache | **Redis** | Repeat queries |

**OLTP vs OLAP:** OLTP (Postgres) is for many small transactions (orders). OLAP (ClickHouse) is for a few huge scans ("revenue by city by month"). Don't run OLAP queries on your OLTP database at scale.

### IoT application

| Need | Choice | Why |
| --- | --- | --- |
| Device messaging | **MQTT broker** (EMQX, Mosquitto, HiveMQ, AWS IoT Core) | Lightweight protocol for unreliable networks |
| Sensor readings | **TimescaleDB / InfluxDB** (or Cassandra at huge scale) | Time-series compression, retention |
| Ingestion buffer | **Kafka** | Absorb spikes, multiple consumers |
| Devices, owners, config | **PostgreSQL** | Relational |
| Latest value per device | **Redis** | Instant dashboard reads |
| Long-term archive | **S3 + Parquet** | Cheap |

### AI-powered application (e.g. RAG assistant over company documents)

| Need | Choice | Why |
| --- | --- | --- |
| Users, tenants, documents, permissions | **PostgreSQL** | Source of truth, access control |
| Embeddings | **pgvector** first; **Qdrant/Pinecone/Weaviate** at large scale | Similarity search |
| Keyword search (hybrid with vectors) | Postgres full-text, or Elasticsearch/OpenSearch | Exact terms (product codes, names) that embeddings miss |
| Original files | **S3** | Storage |
| Ingestion pipeline (parse, chunk, embed) | **Queue + workers** (Celery, BullMQ, SQS) | Slow, retryable |
| Response cache, rate limits | **Redis** | Cost and abuse control |
| Conversation history | **PostgreSQL** | Relational, per-user |

**Critical:** every vector query must filter by tenant/user permissions. See [Part 18, security](18-using-ai-for-backend-engineering.md#5-security-considerations-when-using-ai).
