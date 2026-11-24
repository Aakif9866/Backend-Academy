---
title: SQL vs NoSQL
summary: What relational databases promise, the seven main kinds of NoSQL store, and how real apps mix them.
difficulty: beginner
minutes: 30
source: backend/02-sql-vs-nosql.md
objectives:
  - Describe the relational model and what ACID guarantees
  - Name the main NoSQL families (document, key-value, wide-column, graph, search, time-series, vector) and a use for each
  - Explain why "NoSQL scales, SQL doesn't" is an oversimplification
  - Explain polyglot persistence and its costs
videos:
  - id: zsjvFFKOm3c
    title: SQL Explained in 100 Seconds
    channel: Fireship
    why: A quick refresher of what SQL and relational tables look like before the comparison.
  - id: n2Fluyr3lbc
    title: PostgreSQL in 100 Seconds
    channel: Fireship
    why: Why Postgres, with JSONB and extensions, covers many "NoSQL" use cases too.
resources:
  - url: https://www.postgresql.org/docs/current/tutorial.html
    title: PostgreSQL tutorial (official)
    why: The official walkthrough of tables, joins, transactions and views.
  - url: https://www.mongodb.com/docs/manual/data-modeling/
    title: MongoDB data modeling
    why: "How document stores want you to model by access pattern: embed vs reference."
  - url: https://martinfowler.com/bliki/PolyglotPersistence.html
    title: "Martin Fowler: Polyglot Persistence"
    why: The short essay that named the idea of using different stores for different needs.
quiz:
  - type: mcq
    q: Which property of ACID ensures that a transfer either debits AND credits, or does neither?
    options: ["Atomicity", "Consistency", "Isolation", "Durability"]
    answer: 0
    explain: Atomicity means all-or-nothing. Isolation controls what concurrent transactions see, durability means committed data survives a crash, and consistency means constraints hold before and after.
  - type: scenario
    q: You need "people you may know" based on friends-of-friends-of-friends. Which kind of store is purpose-built for this?
    options: ["Time-series", "Graph database", "Key-value", "Search engine"]
    answer: 1
    explain: Multi-hop relationship traversal is what graph databases (Neo4j and others) optimise. Relational databases can do it with recursive CTEs, but deep traversals get expensive.
  - type: tf
    q: GraphQL is a kind of NoSQL database.
    answer: 1
    explain: False. GraphQL is an API query language. It sits in front of any data source, SQL or NoSQL.
  - type: mcq
    q: What is the main cost of polyglot persistence?
    options: ["It is always slower", "Each extra store adds operations work, consistency problems between stores, and more to secure and back up", "It's not allowed in the cloud", "You must use microservices"]
    answer: 1
    explain: Every datastore needs backups, monitoring, upgrades and security, and data copied between stores can drift. Add one only when the gain is clear.
---

## Hands-on exercise

Model the same "blog with posts, authors, tags and comments" twice:

1. **Relational:** write `CREATE TABLE` statements with primary keys, foreign keys and a `post_tags` join table.
2. **Document:** write one example MongoDB document for a post. Decide what to embed (comments? tags?) and what to reference (author?), and justify each choice by the page that reads it.

Then list three queries that are easy in one model and awkward in the other.

## Completion criteria

- You can explain ACID with an example for each letter.
- You can name a realistic use for each NoSQL family and say when Postgres alone would do.
