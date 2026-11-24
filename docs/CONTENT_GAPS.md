# Content gaps

## Gaps in the original notes, and how they were filled

The original notes were strongest on the decision layer (which database, framework, broker, real-time technique) and on case studies. They were thin on fundamentals, distributed-systems theory, internals and hands-on practice.

| Gap | Filled by (new lesson) |
| --- | --- |
| Processes, threads, memory, syscalls, signals | How Computers Run Your Code |
| Linux, shell, environment variables, networking commands | Linux and the Shell for Backend Engineers |
| Git and team workflow | Git and Team Workflows |
| Concurrency, async, races, deadlocks | Concurrency and Asynchronous Programming |
| IP, DNS, TCP/UDP, TLS 1.3, QUIC, round trips | How the Internet Works (+ request-lifecycle simulation) |
| HTTP semantics, caching headers, cookies, CORS, HTTP/2/3, building an HTTP server | HTTP in Depth |
| Reverse proxies, L4/L7 load balancing, Nginx config, CDN caching | Proxies, Load Balancers, Nginx and CDNs (+ load-balancer simulation) |
| Layered architecture, validation, errors, config, DI, SOLID, clean architecture | Structuring a Backend Application |
| REST design: pagination, idempotency keys, ETags, versioning, OpenAPI | Designing REST APIs People Enjoy Using |
| SQL fluency: constraints, joins, window functions, migrations | SQL and Relational Modelling |
| MVCC internals, locks, deadlocks, SKIP LOCKED, retries | Transactions, Isolation and MVCC |
| Measured indexing and query-plan reading | Indexing Lab |
| Argon2id, refresh rotation, OAuth/OIDC + PKCE, TOTP, passkeys, API keys, RBAC/ABAC | Authentication Deep Dive |
| OWASP Top 10 / API Top 10 in code, SSRF, uploads, headers, STRIDE | Web and API Vulnerabilities |
| Cache patterns in depth, eviction, stampede/penetration/avalanche, Redis operations | Caching in Depth (+ eviction simulation) |
| Monolith vs modular monolith vs microservices, DDD, multi-tenancy, ADRs | Architecture Styles |
| CQRS, event sourcing, outbox, sagas, 2PC | CQRS, Event Sourcing, Outbox and Sagas |
| Timeouts, retries, breakers, bulkheads, load shedding, fencing tokens | Resilience Patterns (+ circuit-breaker simulation) |
| A repeatable design method with worked estimates | The System Design Method |
| CAP/PACELC, consistency models, replication, quorums, partitioning, gossip, split brain | Distributed Systems Fundamentals (+ quorum and consistent-hashing simulations) |
| Clocks, logical time, consensus, Raft | Time, Ordering and Consensus |
| Feed, notifications, autocomplete, video platform | Product Design Cases |
| Distributed rate limiter, job scheduler, file sync, event streaming | Infrastructure Design Cases |
| Postgres vs Mongo, Redis vs Memcached, K8s vs serverless, polyglot | Technology Decision Guides |
| Profiling, percentiles, load testing, N+1, leaks, backpressure | Performance Engineering |
| SLOs and error budgets, burn-rate alerts, incidents, chaos, DR | Reliability Engineering |
| Dockerfiles, Compose | Docker and Docker Compose |
| Kubernetes objects, probes, HPA, rollouts | Kubernetes Essentials |
| GitHub Actions, Terraform, cloud mapping, secrets, canary/blue-green, flags | CI/CD, IaC and Deployment Strategies |
| Structured logs, Prometheus, OpenTelemetry, dashboards, audit trails | Observability in Practice |
| WAL, B-trees, LSM, compaction, amplification | Storage Engines |
| Kafka internals, exactly-once, stream processing (windows, watermarks, Flink) | Kafka Internals and Stream Processing |
| Building LLM features: streaming, validation, async jobs, vectors, RAG, LLM security | Building AI-Enabled Backends |
| Hands-on practice | 17 project briefs (beginner → expert) and 218 quiz questions |

## Remaining gaps (honest list)

The original brief's Level 11 list and a few Level 1–9 topics are touched on but don't have dedicated lessons yet. Good next additions, in rough priority order:

1. **Search engines:** inverted indexes, BM25, Elasticsearch/OpenSearch internals (sharding, refresh, relevance tuning).
2. **GraphQL in depth:** schema design, DataLoader, persisted queries, cost limiting, federation.
3. **gRPC hands-on:** protobuf evolution rules, streaming, deadlines, gRPC-Web.
4. **Multi-region architecture** as its own lesson (it's spread across the distributed systems, reliability and decision lessons).
5. **Serverless deep dive and edge computing:** cold starts, connection management, Durable Objects/edge storage.
6. **CDN internals, object storage internals** (erasure coding, consistency models of S3).
7. **FinOps and platform engineering** as standalone lessons (covered briefly in CI/CD and decision guides).
8. **Linux server administration beyond basics:** systemd hardening, firewalling, kernel tuning.
9. **Testing strategy** as a dedicated lesson (it's distributed across project briefs and the AI lesson).
10. **In-browser coding challenges** with automatic grading. The platform has quizzes (including code-reading questions) and project briefs, but no code execution sandbox.

Each fits the existing content pipeline: add a Markdown file, place it in `content/curriculum.ts`, and run the validator.
