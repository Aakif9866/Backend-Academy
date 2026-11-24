// Decision guides: real engineering questions mapped to where the curriculum answers them.
export interface Guide { question: string; gist: string; lesson: string; anchor?: string }

export const guides: Guide[] = [
  { question: "SQL or NoSQL?", gist: "Start from access patterns and consistency needs, not hype. Relational is the default for a reason.", lesson: "sql-vs-nosql" },
  { question: "PostgreSQL or MongoDB?", gist: "Joins, constraints and transactions vs flexible documents read as a unit. A decision tree with the cases where each wins.", lesson: "technology-decision-guides", anchor: "postgresql-vs-mongodb" },
  { question: "Single database or polyglot persistence?", gist: "Every extra datastore is another thing to back up, secure and keep in sync. When the second one pays for itself.", lesson: "technology-decision-guides", anchor: "single-database-vs-polyglot-persistence" },
  { question: "Redis or Memcached?", gist: "Plain cache vs data-structure server: persistence, replication, data types and threading model compared.", lesson: "technology-decision-guides", anchor: "redis-vs-memcached" },
  { question: "RabbitMQ or Kafka?", gist: "Smart broker with per-message acks vs a replayable partitioned log. Work queues vs event streams.", lesson: "messaging-and-background-jobs", anchor: "1-message-queues-vs-event-streaming" },
  { question: "REST, GraphQL or gRPC?", gist: "Public HTTP APIs, client-shaped queries, or fast typed service-to-service calls.", lesson: "apis", anchor: "which-to-use" },
  { question: "WebSockets, SSE or polling?", gist: "Bidirectional vs server-push vs simple. Which fits notifications, chat, dashboards and collaboration.", lesson: "real-time-systems", anchor: "1-the-techniques-compared" },
  { question: "Node.js, Go, Java or Python?", gist: "Concurrency models, I/O-bound vs CPU-bound work, ecosystems and team fit.", lesson: "languages-and-frameworks" },
  { question: "Express, NestJS, FastAPI or Spring Boot?", gist: "The same endpoint in each, then structure, performance and productivity trade-offs.", lesson: "backend-frameworks", anchor: "how-to-choose" },
  { question: "Monolith, modular monolith or microservices?", gist: "Why a modular monolith is often the right answer, and the organisational signals that justify splitting.", lesson: "architecture-styles" },
  { question: "Kubernetes or serverless?", gist: "Control and steady load vs zero-ops and spiky load. Cost curves, cold starts and lock-in.", lesson: "technology-decision-guides", anchor: "kubernetes-vs-serverless" },
  { question: "Synchronous or asynchronous processing?", gist: "What the user must wait for vs what can happen after the response. Queues, retries and idempotency.", lesson: "system-design-async", anchor: "sync-vs-async" },
  { question: "Which database service?", gist: "Supabase, Neon, Atlas, PlanetScale, DynamoDB, Turso and more, side by side.", lesson: "database-services" },
  { question: "Which database combination for my app type?", gist: "E-commerce, banking, social, chat, analytics, IoT and RAG: the stores each needs and why.", lesson: "choosing-databases", anchor: "12-scenarios-which-database-combination-and-why" },
  { question: "Requirement → technology", gist: "A full matrix from requirement to technology, five complete architectures, and the anti-patterns.", lesson: "technology-decision-matrix" },
  { question: "Quick “if X, pick Y” answers", gist: "The cheat sheet: databases, backends, APIs, hosting, and performance fixes in the order to try them.", lesson: "tradeoffs-cheatsheet" },
];
