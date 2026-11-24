---
title: Choosing Databases in Depth
summary: Access-pattern-first selection across relational, document, wide-column, key-value, vector, search, time-series and graph stores, plus isolation, indexing, pooling, scaling and seven real scenarios.
difficulty: intermediate
minutes: 75
source: backend/14-choosing-databases.md
prerequisites: [sql-fundamentals, transactions-and-concurrency]
objectives:
  - Start a database decision from access patterns, consistency and scale
  - Explain the strengths and limits of Postgres, MongoDB, DynamoDB, Cassandra and Redis
  - Fix the lost-update bug three ways
  - Apply the leftmost-prefix rule and read a basic query plan
  - Pick a database combination for e-commerce, banking, chat, analytics, IoT and RAG apps
videos:
  - id: -qNSXK7s7_w
    title: Database Indexing Explained (with PostgreSQL)
    channel: Hussein Nasser
    why: Watch indexes and EXPLAIN in a real Postgres session, which makes section 6 concrete.
  - id: 5faMjKuB9bc
    title: What is DATABASE SHARDING?
    channel: Gaurav Sen
    why: A whiteboard explanation of sharding, shard keys and hotspots that complements section 11.
resources:
  - url: https://www.postgresql.org/docs/current/transaction-iso.html
    title: "PostgreSQL: Transaction Isolation"
    why: The definitive explanation of which anomalies each isolation level allows in Postgres.
  - url: https://use-the-index-luke.com/
    title: Use The Index, Luke
    why: A free book on SQL indexing for developers. The best resource on composite indexes and plan reading.
  - url: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-general-nosql-design.html
    title: DynamoDB NoSQL design best practices
    why: AWS's own guidance on single-table, access-pattern-first design.
  - url: https://cassandra.apache.org/doc/latest/cassandra/developing/data-modeling/index.html
    title: Cassandra data modeling
    why: Query-first modelling with partition keys and clustering columns, from the Apache project.
quiz:
  - type: mcq
    q: "You have an index on (user_id, created_at). Which query can NOT use it efficiently?"
    options: ["WHERE user_id = 42", "WHERE user_id = 42 ORDER BY created_at DESC", "WHERE created_at > '2026-01-01'", "WHERE user_id = 42 AND created_at > '2026-01-01'"]
    answer: 2
    explain: Composite B-tree indexes are sorted by the first column, then the second. Filtering only on created_at skips the leading column, so the index can't narrow the search (the leftmost-prefix rule).
  - type: scenario
    q: Write-heavy telemetry from millions of devices, queried only by device and time range, must survive a whole datacenter failure. Which store fits best?
    options: ["A single MySQL primary", "Cassandra/ScyllaDB or a time-series database partitioned by device", "Neo4j", "Redis without persistence"]
    answer: 1
    explain: Wide-column stores take huge write volumes across nodes and multiple datacenters, and a partition key of device plus a clustering key of time matches the query. Time-series databases are also a good fit. A single primary is a write bottleneck.
  - type: code
    q: Two requests run this at the same time for an account with balance 100. What can go wrong?
    code: |
      const { balance } = await db.one('SELECT balance FROM accounts WHERE id=$1', [id]);
      await db.none('UPDATE accounts SET balance=$1 WHERE id=$2', [balance - 30, id]);
    options: ["Nothing; each statement is atomic", "A lost update: both read 100 and both write 70", "A deadlock every time", "A syntax error"]
    answer: 1
    explain: Each statement is atomic, but the read-modify-write across two statements isn't. Fix it with a single `UPDATE … SET balance = balance - 30 WHERE balance >= 30`, `SELECT … FOR UPDATE`, or optimistic version checks.
  - type: tf
    q: Adding more indexes always makes a table faster.
    answer: 1
    explain: False. Every index must be updated on each insert, update and delete, and uses disk and memory. Index your real query patterns and drop unused ones.
  - type: mcq
    q: Why do serverless functions often need a connection pooler such as PgBouncer in front of Postgres?
    options: ["Postgres can't speak TLS", "Each function instance opens its own connections, and Postgres connections are heavyweight processes, so you exhaust max_connections", "Poolers make queries return fewer rows", "Serverless can't use TCP"]
    answer: 1
    explain: Postgres uses a process per connection, so thousands of short-lived function instances can overwhelm it. A pooler multiplexes many clients onto a small set of real connections.
---

<div data-viz="lost-update"></div>

## Hands-on exercise

Choose two of the seven scenarios at the end of this lesson. For each, write a one-page design note:

- The 3–5 most important access patterns, written as queries ("get a user's last 50 orders", "decrement stock for SKU").
- The store you'd use for each pattern, and why.
- What happens to your design at 10× the stated load: which store hits its limit first, and what you'd do.

Then, in local Postgres, reproduce the lost-update bug with two `psql` sessions and fix it with `SELECT … FOR UPDATE`.

## Completion criteria

- You can derive a database choice from access patterns and defend it.
- You can explain isolation anomalies with examples and fix a lost update.
- You can design composite indexes using the leftmost-prefix rule.
