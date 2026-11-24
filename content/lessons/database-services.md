---
title: Managed Database Services
summary: Supabase, MongoDB Atlas, Neon, Firebase, PlanetScale, Turso, DynamoDB and Redis services, ORMs and query builders, and how to pick a provider.
difficulty: beginner
minutes: 25
source: backend/03-database-services.md
prerequisites: [sql-vs-nosql]
objectives:
  - Compare major managed database providers on model, pricing shape and lock-in
  - Explain what an ORM gives you and what it hides
  - Choose a managed service for a given project and budget
videos:
  - id: n2Fluyr3lbc
    title: PostgreSQL in 100 Seconds
    channel: Fireship
    why: Most services in this lesson are hosted Postgres; this is the engine they all share.
resources:
  - url: https://supabase.com/docs
    title: Supabase documentation
    why: Postgres with auth, storage and row-level security. Useful for seeing how RLS replaces app-level checks.
  - url: https://neon.tech/docs/introduction
    title: Neon documentation
    why: Serverless Postgres with branching, and how it separates storage from compute.
  - url: https://www.prisma.io/docs/orm/overview/introduction/what-is-prisma
    title: What is Prisma ORM?
    why: A typical modern ORM explained, useful context for the ORM vs query builder discussion.
quiz:
  - type: mcq
    q: What is the biggest long-term risk of building deeply on a proprietary database API (for example Firestore's query model)?
    options: ["It is always slower", "Lock-in: migrating away later means rewriting data access and possibly the data model", "It can't store JSON", "It can't be used from mobile apps"]
    answer: 1
    explain: Proprietary query models and SDKs spread through your code. Standard Postgres can move between Supabase, Neon, RDS or your own server with a dump and restore.
  - type: tf
    q: An ORM removes the need to understand SQL and indexes.
    answer: 1
    explain: False. ORMs generate SQL, sometimes poorly (N+1 queries are the classic case). You still need to read the generated queries and plans and add indexes.
  - type: scenario
    q: A student project needs Postgres, auth and file uploads for free, with a few hundred users. What is a sensible first pick?
    options: ["A self-managed three-node Postgres cluster", "A managed Postgres platform with a free tier (for example Supabase)", "Cassandra", "DynamoDB global tables"]
    answer: 1
    explain: A managed platform with a free tier covers database, auth and storage with no operations work. Clusters and global tables solve problems this project doesn't have.
---

## Hands-on exercise

Create a free-tier Postgres database on one provider (Supabase or Neon). Then:

1. Connect with `psql` using the connection string, create a table and insert rows.
2. Find the provider's connection pooler endpoint. Note how its port and connection string differ from the direct one.
3. Take a `pg_dump` of your database and restore it into a local Postgres in Docker. This proves you aren't locked in.

## Completion criteria

- You've provisioned a managed database, connected to it and exported your data.
- You can explain when you'd pick a managed platform over running Postgres yourself.
