# Part 3: Database services

Part 2 was about *kinds* of database. This part is about *companies that host one for you*, so you don't run the server yourself.

## The big three you asked about

### Supabase

**What it is:** hosted PostgreSQL **plus** a ready-made backend around it: login (Auth), an automatic data API, file storage, realtime updates and serverless functions.

**Example:** in PLOS, `db.from("sleep_logs").upsert(row)` becomes an HTTPS call to Supabase's data API. Supabase checks your login pass and the RLS rules, then runs the SQL. We wrote no route and no login system.

| Good | Not so good |
| --- | --- |
| Real Postgres: joins, transactions, constraints, views | Free projects pause after about a week without use |
| Login, two-step, OAuth built in | You learn Supabase's way (RLS, its client) on top of SQL |
| Row Level Security: safe even if the frontend talks to it directly | Heavy logic in SQL functions can be harder to debug than JavaScript |
| Realtime: chat and live dashboards without your own socket server | Some lock-in for Auth/Storage (the database itself is plain Postgres and easy to move) |
| Open source; you can self-host | |

**Pick it when:** you want a full backend fast, with SQL. Perfect for side projects, SaaS apps and internal tools.

### MongoDB Atlas

**What it is:** hosted MongoDB, a document database. Atlas also offers search, vector search and triggers.

**Example:** a recipe app where each recipe document holds its ingredients, steps and tags in one JSON object.

```js
await db.collection("recipes").insertOne({
  title: "Chicken biryani",
  ingredients: [{ name: "Rice", qty: "2 cups" }, { name: "Chicken", qty: "500 g" }],
  tags: ["dinner", "spicy"],
});
```

| Good | Not so good |
| --- | --- |
| Flexible documents, no migrations | No built-in login or API: you write Express + auth yourself (that's MERN) |
| Easy horizontal scaling (sharding built in) | Relationships and joins are weaker |
| Great with JavaScript; documents look like JS objects | Easy to end up with messy, inconsistent data with no schema |
| Atlas Search built in | Serverless (Vercel) needs care with connection reuse |

**Pick it when:** your data is naturally document-shaped, its shape changes often, or you're learning MERN.

### Neon

**What it is:** **serverless PostgreSQL**. Just the database: no auth, no API. Two standout features:

- **Scale to zero:** when nobody uses it, it sleeps and costs nothing. It wakes up in well under a second on the next query.
- **Branching:** copy your whole database in seconds, like a git branch. Each pull request gets its own test database.

**Example:** a Next.js app with Drizzle or Prisma talking to Neon:

```ts
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
const rows = await sql`select * from workouts where user_id = ${userId}`;
```

| Good | Not so good |
| --- | --- |
| Real Postgres, works with any Postgres tool | You build auth and security yourself (or add Clerk / Auth.js / Better Auth) |
| Made for serverless: an HTTP driver avoids connection limits | First query after sleep is a little slower |
| Branching is great for testing and previews | No built-in realtime, storage or auto API |
| Pay for what you use | |

**Pick it when:** you want Postgres and prefer to write your own backend code (with an ORM such as Drizzle or Prisma), especially on Vercel.

### The three side by side

| | Supabase | MongoDB Atlas | Neon |
| --- | --- | --- | --- |
| Database type | PostgreSQL (SQL) | MongoDB (document) | PostgreSQL (SQL) |
| Login built in | Yes | No | No |
| Automatic API | Yes | No (Data API was retired) | No |
| Realtime | Yes | Change streams (you wire it up) | No |
| File storage | Yes | No | No |
| Row-level security | Yes, its main idea | Through your code | Postgres RLS, you set it up |
| Branching | Yes (paid) | No | Yes, its main idea |
| Sleeps when idle | Free tier pauses after about a week | Free cluster doesn't pause | Scales to zero in minutes, wakes fast |
| What you write | Mostly frontend + SQL rules | Express/Nest/etc. + models + auth | Backend code + ORM + auth |
| Best for | Full backend quickly | Flexible document data | Postgres for your own backend code |

**Same feature in each.** "Save a workout, only the owner can see it":

- **Supabase:** a table + an RLS policy. The client calls `insert`. About 10 lines of SQL.
- **Neon:** a table + an API route + an auth library + a `where user_id = $1` on every query. About 50–100 lines.
- **MongoDB:** a Mongoose model + Express route + auth middleware + JWT + a `{ userId }` filter on every query. About 100+ lines.

## Other services worth knowing

| Service | What it is | Good for | Watch out |
| --- | --- | --- | --- |
| **Firebase (Firestore)** | Google's document database + auth + hosting + realtime | Mobile apps, realtime, quick MVPs | NoSQL only, queries are limited, costs grow per read |
| **PlanetScale** | Hosted MySQL (built on Vitess, YouTube's sharding system); now also Postgres | Very large MySQL apps | No free tier any more |
| **Turso** | Hosted SQLite (libSQL), copies at the edge | Tiny, fast, cheap; one database per user | SQLite limits on heavy concurrent writes |
| **Cloudflare D1** | SQLite on Cloudflare's network | Apps on Cloudflare Workers | Young; size limits per database |
| **AWS RDS / Aurora** | Managed Postgres/MySQL on AWS | Companies already on AWS | More setup, more knobs, pricier |
| **Amazon DynamoDB** | Key-value/document, massively scalable, pay per request | Huge scale with predictable access patterns | You must design around exact queries; hard to change later |
| **Redis Cloud / Upstash** | Hosted Redis; Upstash is serverless (pay per request, HTTP API) | Cache, rate limits, queues on Vercel | Not your main database |
| **Convex** | A reactive backend: database + functions + realtime in TypeScript | Realtime apps written in TypeScript | Its own model, more lock-in |
| **Appwrite / PocketBase** | Open-source "backend in a box" like Supabase | Self-hosting; PocketBase is one file | Smaller communities |
| **CockroachDB** | Postgres-compatible SQL spread across regions | Global apps that must survive a region going down | Complex, pricey at scale |

## ORMs and query builders

When you don't use Supabase's client, you talk to the database through one of these:

| Tool | Language | Style |
| --- | --- | --- |
| **Prisma** | TypeScript | Schema file → generated client. Very friendly |
| **Drizzle** | TypeScript | Looks like SQL, lightweight, good on serverless |
| **Mongoose** | JavaScript | Models and validation for MongoDB (the "M" in most MERN tutorials) |
| **SQLAlchemy** | Python | The standard Python ORM; FastAPI and Flask often use it |
| **Django ORM** | Python | Built into Django |
| **TypeORM / Sequelize** | TypeScript / JS | Older Node ORMs |
| **Raw SQL** (`pg`, `postgres.js`) | Any | Full control, nothing hidden |

**ORM trade-off:** faster to write and type-safe, but it can produce slow queries without you noticing (the "N+1 problem": loading 100 workouts, then running 100 more queries for their sets). Always check what SQL it actually runs.

## How to choose

```
Do you want login, API and storage done for you?
├── Yes → Do you want SQL?
│         ├── Yes → Supabase
│         └── No  → Firebase
└── No, I'll write my own backend
          ├── Relational data (most apps) → Postgres: Neon (serverless) or RDS / Railway Postgres (servers)
          ├── Document data, shape keeps changing → MongoDB Atlas
          ├── Tiny / edge / one DB per user → Turso or D1
          └── Massive scale, fixed access patterns → DynamoDB or Cassandra
Plus Redis/Upstash when you need a cache, rate limits or a queue.
```

**For PLOS specifically**, Supabase saves the most work: single user, needs login with two-step, strict security, relational data. Moving to Neon would mean writing our own auth and API layer for no gain.
