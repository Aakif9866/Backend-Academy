# Part 2: SQL vs NoSQL

## The one-line version

- **SQL (relational)**: data lives in tables with fixed columns, and tables link to each other. Great when your data has clear relationships and must stay correct.
- **NoSQL**: a family of "everything else". Each kind is shaped for one job: flexible documents, super-fast lookups, huge write volumes, relationships between people, and so on.

Neither is "better". They're tools for different jobs.

## SQL databases

Examples: **PostgreSQL** (PLOS uses this), MySQL, MariaDB, SQLite, SQL Server, Oracle.

### How data looks

A workout in PLOS is two tables:

```
workout_sessions                          workout_sets
┌──────┬───────────┬──────────────┐       ┌──────┬────────────┬─────────────┬──────┬───────────┐
│ id   │ title     │ performed_on │       │ id   │ session_id │ exercise_id │ reps │ weight_kg │
├──────┼───────────┼──────────────┤       ├──────┼────────────┼─────────────┼──────┼───────────┤
│ w1   │ Push day  │ 2026-11-10   │ ◀──── │ s1   │ w1         │ bench       │ 8    │ 60        │
└──────┴───────────┴──────────────┘       │ s2   │ w1         │ bench       │ 6    │ 65        │
                                          └──────┴────────────┴─────────────┴──────┴───────────┘
```

`session_id` points at the workout. That link is a **foreign key**. The database guarantees it always points at a real workout.

### What SQL gives you

| Feature | Plain meaning | PLOS example |
| --- | --- | --- |
| **Schema** | Columns and types are decided up front | `reps integer not null` |
| **Constraints** | The database refuses bad data | `check (reps between 1 and 1000)` |
| **Foreign keys** | Links between tables that can't break | A set can't point at a deleted exercise (`on delete restrict`) |
| **Joins** | Combine tables in one query | "All sets with their exercise names" |
| **Transactions** | Several changes happen all together or not at all | `save_workout` saves the session and all sets as one unit |
| **Powerful queries** | Group, sum, filter anything | The `daily_nutrition` view sums calories per day |

### ACID: the promise SQL makes

- **Atomic**: all or nothing. Money leaves account A *and* arrives in account B, or neither happens.
- **Consistent**: rules (constraints) are never broken.
- **Isolated**: two people saving at once don't see each other's half-done work.
- **Durable**: once it says "saved", a power cut won't lose it.

### Weak spots

- Changing the structure needs a **migration** (that's why PLOS has `supabase/migrations/`).
- Very large scale (billions of rows, millions of writes a second) needs extra work: replicas, partitioning, sharding. See [Part 7](07-system-design-basics.md).
- Data that's naturally a tree or a messy blob can feel awkward. Postgres softens this a lot with `jsonb` columns (PLOS's `custom_entries.values` is one).

## NoSQL databases: the main kinds

### 1. Document databases

Examples: **MongoDB**, Firestore, CouchDB, Amazon DocumentDB.

Data is stored as JSON-like documents. Related data often lives *inside* one document.

```json
{
  "_id": "w1",
  "title": "Push day",
  "performedOn": "2026-11-10",
  "sets": [
    { "exercise": "Bench press", "reps": 8, "weightKg": 60 },
    { "exercise": "Bench press", "reps": 6, "weightKg": 65 }
  ]
}
```

- **Good at:** reading one whole thing at once (load a workout in one read); data whose shape varies (product catalogues where a phone and a sofa have different fields); moving fast early on.
- **Bad at:** data that's shared across many documents. If "Bench press" is renamed, you must update it inside every workout that copied it. Joins exist (`$lookup`) but feel bolted on.
- **Use for:** content management systems, product catalogues, user profiles, event logs, prototypes.

### 2. Key-value stores

Examples: **Redis**, Valkey, Memcached, Amazon DynamoDB (also counts as wide-column), etcd.

The simplest kind: a giant dictionary. You give a key, you get a value.

```
SET session:abc123  "{userId: 42, expires: ...}"
GET session:abc123
INCR rate:login:203.0.113.5     → 1, 2, 3 ...
```

- **Good at:** speed. Redis keeps data in memory, so a read takes well under a millisecond.
- **Bad at:** searching by anything other than the key.
- **Use for:** caches, login sessions, rate limiters, leaderboards (Redis sorted sets), shopping carts, job queues.

### 3. Wide-column stores

Examples: **Apache Cassandra**, ScyllaDB, HBase, Google Bigtable.

Like tables, but each row can have different columns, and the data is spread across many machines by a "partition key".

- **Good at:** enormous write volumes spread across many servers, with no single point of failure.
- **Bad at:** flexible queries. You design tables around the exact questions you'll ask.
- **Use for:** chat message history (Discord used Cassandra, then ScyllaDB), IoT sensor data, activity feeds, anything with billions of rows written constantly.

### 4. Graph databases

Examples: **Neo4j**, Amazon Neptune, ArangoDB, Memgraph.

Data is **nodes** (things) and **edges** (relationships). Relationships are the main thing, not an afterthought.

```
(Aakif) -[:FOLLOWS]-> (Sara) -[:FOLLOWS]-> (Omar)
(Aakif) -[:LIKES]-> (Post 17) <-[:WROTE]- (Omar)
```

Query: "friends of my friends who like the same posts as me" is short and fast. In SQL it's many joins that get slow as you go deeper.

- **Good at:** many-hop relationship questions.
- **Bad at:** plain lists and totals; it's a specialist tool.
- **Use for:** social networks, recommendations ("people who bought this also bought"), fraud detection (rings of linked accounts), knowledge graphs, network maps.

### 5. Search engines

Examples: **Elasticsearch**, OpenSearch, Meilisearch, Typesense, Algolia.

Built to search text: typos, ranking by relevance, filters, "did you mean".

- **Use for:** the search box on a shop or docs site, log search.
- Usually sits *next to* your main database, which stays the source of truth.

### 6. Time-series databases

Examples: **TimescaleDB** (a Postgres extension), InfluxDB, Prometheus, ClickHouse (analytics).

Built for "value at time": CPU every 10 seconds, stock prices, heart-rate readings.

- **Use for:** monitoring, metrics, IoT, finance charts.

### 7. Vector databases

Examples: **pgvector** (a Postgres extension), Pinecone, Weaviate, Qdrant, Milvus.

Store lists of numbers ("embeddings") and find the closest ones. This powers "find similar images" and AI search.

- **Use for:** semantic search, recommendations, AI retrieval. (PLOS's rules forbid AI features, so it doesn't use one.)

## "Is GraphQL a NoSQL database?"

**No.** This is a very common mix-up.

- **GraphQL** is a way for a frontend to *ask an API* for data: "give me this user's name and their last 3 posts' titles". It's an API style, like REST. It can sit in front of *any* database: Postgres, MongoDB, anything. See [Part 5](05-apis.md).
- **Graph database** (Neo4j) is a *storage* engine for nodes and relationships.

The names are similar; the jobs are different. You can use GraphQL with a SQL database (Hasura does exactly that with Postgres) and a graph database without GraphQL.

## Side by side

| | SQL (Postgres) | Document (MongoDB) | Key-value (Redis) | Wide-column (Cassandra) | Graph (Neo4j) |
| --- | --- | --- | --- | --- | --- |
| Shape | Tables + links | JSON documents | Key → value | Rows spread by partition key | Nodes + edges |
| Schema | Strict | Flexible | None | Planned per query | Flexible |
| Joins | Excellent | Weak | None | None | Its whole point |
| Transactions | Strong | Yes (since v4), less natural | Limited | Limited | Yes |
| Scales writes by | Bigger machine, then sharding | Built-in sharding | Clustering | Adding machines | Bigger machine, mostly |
| Typical job | Most apps | Flexible content | Cache, sessions | Huge write streams | Relationships |

## When to use which

**Start with SQL (Postgres) unless you have a clear reason not to.** It handles relationships, rules and money correctly, and with `jsonb` it covers most "flexible data" needs too.

Pick something else when:

| Your situation | Pick | Why |
| --- | --- | --- |
| Data shape changes a lot, and you mostly read whole items | Document (MongoDB) | No migrations; one read per item |
| You need something to be extremely fast and it can be rebuilt if lost | Key-value (Redis) | In-memory speed |
| Billions of writes, always on, across regions | Wide-column (Cassandra/Scylla) | Built to spread across many machines |
| The questions are about connections between things | Graph (Neo4j) | Many-hop queries stay fast |
| People type into a search box | Search engine | Relevance, typos, ranking |
| You store readings over time | Time-series | Compression and time queries |

## Real apps usually mix them ("polyglot persistence")

A food-delivery app might use:

- **Postgres** for users, restaurants, orders and payments (must be correct).
- **Redis** for sessions, the cart, and caching menus.
- **Elasticsearch** for "search biryani near me".
- **A time-series store** for driver GPS pings.
- **S3** (object storage, not a database) for photos.

Each extra database is something more to run, back up and keep in sync. Add one only when the main database really can't do the job.

## Why PLOS uses Postgres

- The data is full of relationships: meals → items → foods, workouts → sets → exercises.
- Correctness matters: no half-saved workouts, no budgets starting mid-month.
- Supabase's security rules (RLS) are a Postgres feature.
- Totals and charts are easy with SQL views.
- The few flexible bits (custom tracker values) fit in a `jsonb` column.
