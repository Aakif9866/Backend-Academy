# Backend notes

Plain-English notes on backends, databases and system design, with PLOS as the running example. Read them in order the first time; after that, jump to whatever you need.

| Part | Topic | What you'll be able to answer |
| --- | --- | --- |
| [01](01-read-the-plos-backend.md) | Reading the PLOS backend | Which files to open, in what order, and what to look for |
| [02](02-sql-vs-nosql.md) | SQL vs NoSQL | What the kinds of database are, and when to pick each |
| [03](03-database-services.md) | Database services | Supabase vs MongoDB Atlas vs Neon vs Firebase, PlanetScale, Turso, DynamoDB, Redis |
| [04](04-backend-frameworks.md) | Backend frameworks | Express vs Fastify vs NestJS vs Hono vs FastAPI vs Django vs Flask vs Spring, Go, Rails, Laravel |
| [05](05-apis.md) | Ways to build an API | REST vs GraphQL vs gRPC vs tRPC vs WebSockets vs Server Actions |
| [06](06-auth-and-security.md) | Auth and security | Sessions vs JWT, OAuth, password hashing, RLS, the common attacks |
| [07](07-system-design-basics.md) | System design: the building blocks | Scaling, load balancers, caching, CDNs, indexes, replicas, sharding, CAP |
| [08](08-system-design-async.md) | System design: background work | Queues, workers, cron, events, retries, idempotency, rate limits |
| [09](09-hosting-and-deployment.md) | Hosting and deployment | Serverless vs servers vs containers; Vercel, Render, Railway, Fly, AWS |
| [10](10-reliability-and-operations.md) | Running it for real | Logging, monitoring, backups, migrations, testing, incidents |
| [11](11-design-walkthroughs.md) | Design walkthroughs | URL shortener, chat app, food delivery, and PLOS at 1 million users |
| [12](12-tradeoffs-cheatsheet.md) | Trade-offs cheat sheet | Quick "if X, pick Y" answers and an interview checklist |

### Backend engineering and technology selection (deeper)

| Part | Topic | What you'll be able to answer |
| --- | --- | --- |
| [13](13-choosing-languages-and-frameworks.md) | Languages and frameworks in depth | Concurrency models, I/O vs CPU work, when Node/Python/Java/Go/C#/Rust fit or don't |
| [14](14-choosing-databases.md) | Databases in depth | Postgres/MySQL/SQL Server, MongoDB/DynamoDB/Cassandra/Redis, vector/search/time-series/graph; isolation levels, indexing, normalisation, pooling; database combinations for 7 kinds of app |
| [15](15-real-time-systems.md) | Real-time systems | WebSockets, Socket.IO, SSE, long polling, streaming, WebRTC, MQTT; auth, heartbeats, reconnection, delivery guarantees, scaling |
| [16](16-messaging-and-background-jobs.md) | Messaging and background jobs | RabbitMQ, Kafka, Redis Streams, SQS/SNS, BullMQ, Celery; ordering, delivery semantics, outbox, failed jobs |
| [17](17-technology-decision-matrix.md) | Technology decision matrix | Requirement → technology with trade-offs; five complete architectures; anti-patterns |
| [19](19-architecture-case-studies.md) | Architecture case studies | E-commerce, messaging, banking, AI/RAG, analytics: designed end to end, from 100 to 10k to 1M users |

### AI-assisted backend development

| Part | Topic | What you'll be able to answer |
| --- | --- | --- |
| [18](18-using-ai-for-backend-engineering.md) | Using AI effectively for backend engineering | A 12-step workflow, prompt templates, failure modes, security (OWASP LLM 2025 and API 2023), verification checklist, context engineering, testing, production use |

Related: [How the PLOS backend works](../BACKEND.md) and [Backends and hosting](../HOSTING_AND_BACKEND.md).

A note on numbers: prices and free-tier limits change often. Where these notes mention them, they're rough and dated late 2026. Check the provider's site before deciding anything.
