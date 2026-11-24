---
title: Architecture Case Studies
summary: E-commerce, real-time messaging, banking ledger, AI document processing and real-time analytics, each designed end to end from 100 to 1 million users.
difficulty: advanced
minutes: 70
source: backend/19-architecture-case-studies.md
prerequisites: [design-walkthroughs, messaging-and-background-jobs]
objectives:
  - Design checkout that never oversells
  - Model money with a double-entry ledger
  - Secure a multi-tenant RAG system
  - Identify the patterns that repeat across very different systems
videos:
  - id: CZ3wIuvmHeM
    title: Mastering Chaos - A Netflix Guide to Microservices
    channel: InfoQ
    why: "Real lessons from running a huge service architecture: dependencies, caching, autoscaling and organisational coupling."
  - id: hnpzNAPiC0E
    title: Scaling Instagram Infrastructure
    channel: InfoQ
    why: How a real product scaled across data centers, with concrete storage and caching decisions.
resources:
  - url: https://stripe.com/blog/online-migrations
    title: "Stripe: Online migrations at scale"
    why: How a payments company changes data models without downtime (dual writes, backfills, and the cutover).
  - url: https://www.uber.com/blog/
    title: Uber Engineering blog
    why: Many deep dives on dispatch, geospatial indexing and payments relevant to these case studies.
  - url: https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html
    title: "Martin Kleppmann: How to do distributed locking"
    why: Why naive locks fail in financial and booking systems, and what fencing tokens fix.
quiz:
  - type: mcq
    q: Why do banking systems use a double-entry ledger instead of a single mutable balance column?
    options: ["It's faster", "Every movement is an immutable pair of entries that sum to zero, giving an audit trail and a way to recompute and verify balances", "Regulators forbid integers", "It uses less storage"]
    answer: 1
    explain: Immutable entries make history auditable and errors detectable (sum of entries must be zero). Balances become derived values you can rebuild and reconcile.
  - type: scenario
    q: In a multi-tenant RAG system, what is the most critical security control?
    options: ["A bigger LLM", "Filtering retrieved documents by the requesting user's permissions before they reach the prompt", "Caching embeddings", "Using HTTPS"]
    answer: 1
    explain: If retrieval ignores permissions, the model will happily summarise another tenant's documents. Filter in the vector query itself (metadata filters or RLS) so unauthorised chunks never enter the context.
  - type: tf
    q: To avoid overselling in a flash sale, decrementing stock with `UPDATE … SET stock = stock - 1 WHERE id = $1 AND stock > 0` and checking affected rows is a valid approach.
    answer: 0
    explain: True. The condition and decrement happen atomically in one statement, so two buyers can't both take the last unit. At extreme scale you'd add reservations, queues or Redis counters in front.
---

## Hands-on exercise

Pick one case study and write an **Architecture Decision Record** for its most contentious choice (for example "Kafka vs a Postgres outbox for order events" or "pgvector vs a dedicated vector database").

Use this format: Title, Status, Context (forces and constraints), Decision, Consequences (good and bad), Alternatives considered. Keep it to one page. Then write the "growth" trigger: the specific metric that would make you revisit it.

## Completion criteria

- You can explain the key decisions in each case study and what would change them.
- You've written an ADR with real alternatives and consequences.
