# Content inventory

An audit of every Markdown file in `backend/` (the original notes) and where each one now lives in the curriculum. The original files are **unchanged**. Each is wrapped by a lesson in `content/lessons/` that points at it with `source:` and adds metadata, objectives, videos, references, a quiz, a hands-on exercise and completion criteria.

| File | Lines | Topic and depth | Lesson (slug) · level | Overlaps with | Notes |
| --- | --- | --- | --- | --- | --- |
| `README.md` | 39 | Index of the notes | — (replaced by the site's roadmap) | — | Links to `../BACKEND.md` and `../HOSTING_AND_BACKEND.md` point outside this repo (PLOS) |
| `01-read-the-plos-backend.md` | 82 | Guided reading of the PLOS codebase | **Excluded** | — | PLOS is a separate project (per instructions). The validator skips it deliberately. |
| `02-sql-vs-nosql.md` | 199 | Relational model, ACID, 7 NoSQL families, polyglot persistence. Beginner, good breadth | `sql-vs-nosql` · L3 | 14 | Kept as the entry point to databases |
| `03-database-services.md` | 137 | Supabase, Atlas, Neon, PlanetScale, Turso, DynamoDB, Redis, ORMs | `database-services` · L3 | 14 | Prices are dated (the notes say so) |
| `04-backend-frameworks.md` | 266 | The same endpoint in 10 frameworks; comparison; choosing | `backend-frameworks` · L2 | 13 | Strong practical comparison |
| `05-apis.md` | 150 | REST, GraphQL, gRPC, tRPC, WebSockets/SSE, webhooks, Server Actions | `apis` · L1 | 15 | Complemented by new `rest-api-design` |
| `06-auth-and-security.md` | 131 | Authn vs authz, hashing, sessions vs JWT, OAuth, MFA, OWASP summary | `auth-and-security` · L4 | — | Beginner overview; deepened by two new lessons |
| `07-system-design-basics.md` | 237 | Scaling stages, LB, caching, CDN, DB scaling ladder, CAP, nines, latency, estimates | `system-design-basics` · L7 | 14 §11, new caching lesson | Two illustrative figures flagged in the lesson (see Accuracy) |
| `08-system-design-async.md` | 173 | Queues, pub/sub, delivery guarantees, idempotency, retries, DLQ, cron, rate limiting, sagas, backpressure | `system-design-async` · L5 | 16 | Rate-limiter simulation embedded |
| `09-hosting-and-deployment.md` | 135 | Servers vs serverless vs containers vs edge; hosts; CI/CD; deploy strategies | `hosting-and-deployment` · L9 | new DevOps lessons | Intro level; deepened by Docker, Kubernetes, CI/CD lessons |
| `10-reliability-and-operations.md` | 122 | Logs/metrics/traces, SLOs, backups, migrations, testing, incidents | `reliability-and-operations` · L8 | new reliability + observability | Overview; deepened by `reliability-engineering`, `observability-in-practice` |
| `11-design-walkthroughs.md` | 185 | URL shortener, chat, food delivery, PLOS at 1M users | `design-walkthroughs` · L7 | 19 | The PLOS section references the external project; kept as a scaling example |
| `12-tradeoffs-cheatsheet.md` | 127 | Trade-offs, "if X pick Y", interview checklist, vocabulary, books | `tradeoffs-cheatsheet` · L7 | 17 | Quick reference |
| `13-choosing-languages-and-frameworks.md` | 223 | I/O vs CPU-bound, concurrency models, blocking traps, per-language fit | `languages-and-frameworks` · L2 | 04 | Deep and accurate |
| `14-choosing-databases.md` | 500 | Access-pattern-first selection; isolation levels; indexing; normalisation; pooling; scaling; 7 scenarios | `choosing-databases` · L3 | 02, 07 | The deepest original file; lost-update simulation embedded |
| `15-real-time-systems.md` | 388 | Polling, SSE, WebSockets, Socket.IO, WebRTC, MQTT; auth, heartbeats, delivery, scaling; 4 examples | `real-time-systems` · L5 | 05 | Deep |
| `16-messaging-and-background-jobs.md` | 334 | Queues vs streams; RabbitMQ, Kafka, Redis Streams, SQS, BullMQ, Celery; outbox; failures | `messaging-and-background-jobs` · L5 | 08 | Kafka partitions simulation embedded |
| `17-technology-decision-matrix.md` | 278 | Requirement → technology tables; 5 architectures; ADR; anti-patterns | `technology-decision-matrix` · L7 | 12 | Complemented by new `technology-decision-guides` |
| `18-using-ai-for-backend-engineering.md` | 865 | AI-assisted workflow, prompts, failure modes, OWASP LLM/API, verification, context engineering | `ai-for-backend-engineering` · L11 | — | Longest file; complemented by new `ai-backend-services` (building AI features) |
| `19-architecture-case-studies.md` | 435 | E-commerce, messaging, banking, RAG, analytics, 100 → 1M users | `architecture-case-studies` · L7 | 11 | Deep |

**Totals:** 20 files, about 5,000 lines. 18 are migrated into lessons, 1 is excluded (PLOS), and the README is superseded by the site roadmap.

## Duplicates and overlaps

The overlaps are intentional layering (overview → deep dive), not contradictions, so each original is kept and placed at the right depth:

- **Databases:** `02` (intro) → `14` (deep). Scaling appears in both `07` and `14 §11`.
- **Async:** `08` (concepts) → `16` (tools and patterns).
- **Real-time:** `05` (one section) → `15` (full lesson).
- **Decisions:** `12` (cheat sheet) ↔ `17` (matrix), plus the new decision guides.
- **Designs:** `11` (three classic designs) → `19` (five end-to-end case studies).

## Accuracy review

- **Links into PLOS** (`../../src/...`, `../BACKEND.md`) can't resolve on this site. The renderer keeps the link text, drops the link, and shows a dotted underline with a tooltip ("Not part of this site"). Links between the notes (`14-choosing-databases.md#...`) are rewritten to the matching lesson URLs and anchors, and the QA crawler verified every one.
- **Illustrative numbers in `07`:** "CDN cuts latency from about 250 ms to about 20 ms" and "1 million rows: about 800 ms → about 2 ms" are examples, not measurements. A clearly labelled note was added in the wrapping lesson (the original file is unchanged), and the indexing lab teaches learners to measure their own.
- **Latency tables** (`07`) are standard orders of magnitude; the lessons present them that way.
- **Prices and free tiers** (`03`, `09`) are dated late 2026 by the notes themselves; no changes.
- No technically incorrect statements were found in the reviewed sections. The remaining content is consistent with official documentation (Postgres isolation behaviour, OWASP lists, Kafka semantics).
