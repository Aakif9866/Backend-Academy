// The local roadmap. Order here = learning order everywhere on the site.
// Each lesson slug must have a file at content/lessons/<slug>.md (checked by scripts/validate.mjs).

export type Tone =
  | "slate" | "cyan" | "blue" | "emerald" | "rose" | "orange"
  | "purple" | "indigo" | "amber" | "teal" | "sky" | "pink";

export interface ModuleDef { title: string; lessons: string[] }
export interface LevelDef {
  id: string;
  n: number;
  title: string;
  short: string;
  tone: Tone;
  summary: string;
  outcome: string;
  optional?: boolean;
  modules: ModuleDef[];
}

export const curriculum: LevelDef[] = [
  {
    id: "foundations", n: 0, title: "Programming & CS Foundations", short: "Foundations", tone: "slate",
    summary: "What actually happens when code runs: processes, memory, the shell, Git and concurrency.",
    outcome: "You can reason about processes, threads and memory, live in a terminal, and write correct concurrent code.",
    modules: [
      { title: "How computers run your code", lessons: ["computers-processes-threads", "linux-shell-essentials", "git-workflow"] },
      { title: "Concurrency", lessons: ["concurrency-async"] },
    ],
  },
  {
    id: "networking", n: 1, title: "Networking & Web Fundamentals", short: "Networking & Web", tone: "cyan",
    summary: "IP, DNS, TCP, TLS and HTTP from the packet up, then proxies, CDNs and the ways to expose an API.",
    outcome: "You can trace a request from a browser to your code and back, and explain every hop.",
    modules: [
      { title: "The network", lessons: ["how-the-internet-works", "http-deep-dive"] },
      { title: "Serving traffic", lessons: ["proxies-nginx-cdn", "apis"] },
    ],
  },
  {
    id: "backend-dev", n: 2, title: "Backend Development Fundamentals", short: "Backend Basics", tone: "blue",
    summary: "Choosing a language and framework, then structuring an application and designing APIs people enjoy using.",
    outcome: "You can build a layered, validated, well-documented REST API in the framework of your choice.",
    modules: [
      { title: "Choosing your tools", lessons: ["languages-and-frameworks", "backend-frameworks"] },
      { title: "Building it well", lessons: ["backend-architecture-layers", "rest-api-design"] },
    ],
  },
  {
    id: "databases", n: 3, title: "Database Engineering", short: "Databases", tone: "emerald",
    summary: "Modelling, SQL, transactions, isolation, MVCC, indexing and query plans, and choosing the right store.",
    outcome: "You can design a schema, write correct concurrent transactions, read a query plan and pick a database for a workload.",
    modules: [
      { title: "Data modelling", lessons: ["sql-vs-nosql", "sql-fundamentals"] },
      { title: "Correctness and speed", lessons: ["transactions-and-concurrency", "indexing-lab"] },
      { title: "Choosing and running", lessons: ["choosing-databases", "database-services"] },
    ],
  },
  {
    id: "security", n: 4, title: "Authentication & Backend Security", short: "Backend Security", tone: "rose",
    summary: "Identity, sessions, tokens, OAuth/OIDC, authorisation models and the vulnerabilities that actually get exploited.",
    outcome: "You can build a secure login system and recognise and prevent the OWASP Top 10 in your own code.",
    modules: [
      { title: "Identity and access", lessons: ["auth-and-security", "authentication-deep-dive"] },
      { title: "Attacks and defences", lessons: ["web-vulnerabilities"] },
    ],
  },
  {
    id: "async", n: 5, title: "Caching, Messaging & Real-time", short: "Caching & Queues", tone: "orange",
    summary: "Caches and their failure modes, queues and logs, delivery guarantees, and real-time connections at scale.",
    outcome: "You can add a cache safely, move work to background jobs with idempotent consumers, and scale WebSockets.",
    modules: [
      { title: "Caching", lessons: ["caching-deep-dive"] },
      { title: "Asynchronous processing", lessons: ["system-design-async", "messaging-and-background-jobs"] },
      { title: "Real-time", lessons: ["real-time-systems"] },
    ],
  },
  {
    id: "architecture", n: 6, title: "Advanced Backend Architecture", short: "Advanced Backend", tone: "purple",
    summary: "Monoliths, modular monoliths and microservices; DDD, CQRS, event sourcing, sagas and resilience patterns.",
    outcome: "You can choose an architecture for a team and product, record the decision, and design for partial failure.",
    modules: [
      { title: "Architecture styles", lessons: ["architecture-styles", "cqrs-event-sourcing-sagas"] },
      { title: "Designing for failure", lessons: ["resilience-patterns"] },
    ],
  },
  {
    id: "system-design", n: 7, title: "System Design & Distributed Systems", short: "System Design", tone: "indigo",
    summary: "Building blocks, estimation, distributed-systems theory, consensus, and many end-to-end designs.",
    outcome: "You can take a vague product brief to a defensible architecture with numbers, trade-offs and failure plans.",
    modules: [
      { title: "Building blocks", lessons: ["system-design-basics", "system-design-method"] },
      { title: "Distributed systems", lessons: ["distributed-systems-fundamentals", "consensus-and-time"] },
      { title: "Case studies", lessons: ["design-walkthroughs", "design-cases-product", "design-cases-infrastructure", "architecture-case-studies"] },
      { title: "Decisions", lessons: ["technology-decision-guides", "technology-decision-matrix", "tradeoffs-cheatsheet"] },
    ],
  },
  {
    id: "performance", n: 8, title: "Performance Engineering & Reliability", short: "Performance", tone: "amber",
    summary: "Profiling, latency percentiles, load testing, backpressure, SLOs, incidents and disaster recovery.",
    outcome: "You can find a bottleneck with evidence, fix it, prove the fix, and run a service against an SLO.",
    modules: [
      { title: "Performance", lessons: ["performance-engineering"] },
      { title: "Reliability", lessons: ["reliability-and-operations", "reliability-engineering"] },
    ],
  },
  {
    id: "devops", n: 9, title: "DevOps, Cloud & Production Engineering", short: "DevOps & Cloud", tone: "teal",
    summary: "Containers, Compose, Kubernetes, CI/CD, infrastructure as code and deployment strategies.",
    outcome: "You can containerise a service, deploy it with a pipeline, and roll it out without downtime.",
    modules: [
      { title: "Shipping code", lessons: ["hosting-and-deployment", "docker-and-compose"] },
      { title: "Platforms and pipelines", lessons: ["kubernetes-essentials", "cicd-and-iac"] },
    ],
  },
  {
    id: "observability", n: 10, title: "Observability & Production Operations", short: "Observability", tone: "sky",
    summary: "Structured logs, metrics, traces with OpenTelemetry, probes, alerting and debugging production.",
    outcome: "You can instrument a service end to end and answer \"why is it slow?\" from your telemetry.",
    modules: [{ title: "Seeing inside production", lessons: ["observability-in-practice"] }],
  },
  {
    id: "advanced", n: 11, title: "Advanced & Specialised Tracks", short: "Advanced Tracks", tone: "pink", optional: true,
    summary: "Optional deep dives: storage engines, Kafka internals and stream processing, and AI-enabled backends.",
    outcome: "You understand how the systems you depend on work inside, and can build LLM features responsibly.",
    modules: [
      { title: "Internals", lessons: ["storage-engines", "kafka-and-stream-processing"] },
      { title: "AI and backends", lessons: ["ai-for-backend-engineering", "ai-backend-services"] },
    ],
  },
];
