# Curriculum roadmap

The roadmap the site follows is defined in one file: [`content/curriculum.ts`](../content/curriculum.ts). Its order is the learning order everywhere (sidebar, roadmap page, previous/next links, dashboard "continue"). ★ marks lessons built from your original notes; the rest are new.

| Level | Theme | Modules → lessons |
| --- | --- | --- |
| **0** Foundations | How code runs | *How computers run your code:* How Computers Run Your Code · Linux and the Shell · Git and Team Workflows — *Concurrency:* Concurrency and Asynchronous Programming |
| **1** Networking & Web | From packets to APIs | *The network:* How the Internet Works · HTTP in Depth — *Serving traffic:* Proxies, Load Balancers, Nginx and CDNs · Ways to Build an API ★ |
| **2** Backend Basics | Building services well | *Choosing your tools:* Choosing a Backend Language ★ · Backend Frameworks Compared ★ — *Building it well:* Structuring a Backend Application · Designing REST APIs |
| **3** Databases | The deepest level | *Data modelling:* SQL vs NoSQL ★ · SQL and Relational Modelling — *Correctness and speed:* Transactions, Isolation and MVCC · Indexing Lab — *Choosing and running:* Choosing Databases in Depth ★ · Managed Database Services ★ |
| **4** Security | Identity and attacks | *Identity and access:* Auth and Security Essentials ★ · Authentication Deep Dive — *Attacks and defences:* Web and API Vulnerabilities |
| **5** Caching & Queues | Async and real-time | *Caching:* Caching in Depth — *Asynchronous processing:* Background Work and Async Design ★ · Messaging Systems and Background Jobs ★ — *Real-time:* Real-time Systems ★ |
| **6** Advanced Backend | Architecture | *Architecture styles:* Monolith, Modular Monolith, Microservices · CQRS, Event Sourcing, Outbox and Sagas — *Designing for failure:* Resilience Patterns |
| **7** System Design | Design and distributed systems | *Building blocks:* System Design Building Blocks ★ · The System Design Method — *Distributed systems:* Distributed Systems Fundamentals · Time, Ordering and Consensus — *Case studies:* Design Walkthroughs ★ · Product Design Cases · Infrastructure Design Cases · Architecture Case Studies ★ — *Decisions:* Technology Decision Guides · Technology Decision Matrix ★ · Trade-offs Cheat Sheet ★ |
| **8** Performance | Speed and reliability | *Performance:* Performance Engineering — *Reliability:* Running It for Real ★ · Reliability Engineering |
| **9** DevOps & Cloud | Shipping | *Shipping code:* Hosting and Deployment ★ · Docker and Docker Compose — *Platforms and pipelines:* Kubernetes Essentials · CI/CD, IaC and Deployment Strategies |
| **10** Observability | Production operations | Observability in Practice |
| **11** Advanced Tracks *(optional)* | Internals and AI | *Internals:* Storage Engines, WAL, B-trees and LSM Trees · Kafka Internals and Stream Processing — *AI and backends:* Using AI for Backend Engineering ★ · Building AI-Enabled Backends |

**51 lessons:** 18 from the original notes and 33 new. Levels 0–10 are the core path (47 lessons); Level 11 is optional.

## Difficulty progression

Beginner (L0–L1 and introductory lessons) → intermediate (L2–L5) → advanced (L4 deep dives, L6–L9) → expert (consensus, infrastructure design cases, storage engines, Kafka internals). Each lesson shows its difficulty badge and lists its prerequisites; the validator checks that no prerequisite comes later in the roadmap.

## Projects alongside the roadmap

| After level | Projects |
| --- | --- |
| 1–2 | HTTP Server and Reverse Proxy from Scratch · Task Management REST API |
| 4 | Secure Authentication Service |
| 5 | URL Shortener · Caching Layer · Real-time Chat · File Upload Service · Notification Service |
| 6–7 | Event-driven Orders with Sagas · Distributed Rate Limiter · Job Scheduler · Multi-tenant SaaS · Payment Ledger |
| 10 | Fully Observable Backend |
| 11 | Build Your Own Redis · Partitioned Message Broker · Replicated KV Store with Raft |

Each level page lists the projects that practise its lessons.

## Adding a lesson

1. Create `content/lessons/<slug>.md` with frontmatter (`title`, `summary`, `difficulty`, `minutes`, `objectives`, `prerequisites`, `videos`, `resources`, `quiz`) and a body. To wrap an existing note instead, set `source: backend/<file>.md` and put only the extras in the body.
2. Add the slug to a module in `content/curriculum.ts`.
3. Run `pnpm validate` (and `pnpm check-links` before publishing).
