# Part 5: Ways to build an API

An API is the agreement between a client (browser, mobile app, another server) and your backend: what you can ask for and what you get back.

## REST

The most common style. **Resources** have URLs; **HTTP methods** say what to do.

| Method | URL | Meaning |
| --- | --- | --- |
| `GET` | `/workouts` | List workouts |
| `GET` | `/workouts/w1` | Get one |
| `POST` | `/workouts` | Create |
| `PUT` | `/workouts/w1` | Replace |
| `PATCH` | `/workouts/w1` | Change some fields |
| `DELETE` | `/workouts/w1` | Delete |

### Status codes you must know

| Code | Meaning | Example |
| --- | --- | --- |
| 200 | OK | Got the list |
| 201 | Created | Workout saved |
| 204 | No content | Deleted |
| 301 / 302 | Moved | Redirect to `/login` |
| 304 | Not modified | Use your cached copy |
| 400 | Bad request | Title missing |
| 401 | Unauthorised (not logged in) | No cookie |
| 403 | Forbidden (logged in, not allowed) | Someone else's workout |
| 404 | Not found | No workout `w9` |
| 409 | Conflict | Already exists |
| 422 | Valid JSON, invalid data | Reps = -5 |
| 429 | Too many requests | Rate limit hit |
| 500 | Server error | A bug |
| 502 / 503 / 504 | Upstream broken / unavailable / timed out | The database is down |

### Good REST habits

- Nouns in URLs, not verbs: `POST /workouts`, not `POST /createWorkout`.
- **Pagination** for lists: `GET /workouts?limit=20&cursor=abc`. Cursor pagination ("give me 20 after this one") is better than `?page=5` for big, changing lists.
- **Filtering and sorting** with query params: `?from=2026-11-01&sort=-performed_on`.
- **Versioning** when you break things: `/v1/workouts` → `/v2/workouts`.
- A consistent error shape: `{ "error": "Title is required", "field": "title" }`.
- `GET` must never change data (browsers and caches assume this).

**Good:** simple, cacheable, every tool understands it.
**Bad:** over-fetching (you get fields you don't need) and under-fetching (you need 3 requests for one screen).

## GraphQL

One endpoint (`POST /graphql`). The client says exactly what it wants:

```graphql
query {
  me {
    name
    workouts(last: 3) {
      title
      sets { reps weightKg }
    }
  }
}
```

Response has exactly that shape. One request, no extra fields.

| Good | Bad |
| --- | --- |
| The client asks for exactly what a screen needs | Harder to cache (everything is `POST /graphql`) |
| One request for nested data | The N+1 problem on the server (needs DataLoader) |
| A typed schema = great tooling | A nasty query can be very expensive; you need depth/cost limits |
| Great when many different clients (web, iOS, Android) need different data | More setup than REST for a small app |

**Used by:** GitHub's API, Shopify, Facebook (where it was created). Tools: Apollo, GraphQL Yoga, Hasura (instant GraphQL over Postgres), Supabase's `pg_graphql`.

**Reminder:** GraphQL is an API style, not a database. See [Part 2](02-sql-vs-nosql.md).

## gRPC

Services talk using **Protocol Buffers** (a compact binary format) over HTTP/2. You define the contract in a `.proto` file and generate client and server code in any language.

```proto
service Workouts {
  rpc CreateWorkout (CreateWorkoutRequest) returns (Workout);
}
```

- **Good:** fast, small messages, strict types, streaming both ways.
- **Bad:** browsers can't call it directly (needs gRPC-Web), and you can't just read it with curl.
- **Use for:** server-to-server calls inside a company (microservices), mobile apps where bandwidth matters.

## tRPC

TypeScript-only. The frontend calls backend functions with full type safety and no schema file. You change a backend type, and the frontend shows an error right away.

```ts
const workout = await trpc.workouts.create.mutate({ title: "Push day" });
```

- **Use when:** frontend and backend are both TypeScript, in the same repo, and only your app calls the API.
- **Next.js Server Actions** give a similar feel with no library at all. That's what PLOS uses.

## Realtime: WebSockets, SSE and polling

| Technique | How it works | Use for |
| --- | --- | --- |
| **Polling** | The client asks "anything new?" every few seconds | Simple dashboards; wasteful at scale |
| **Long polling** | The client asks; the server holds the request open until there's news | Old-school chat; a fallback |
| **Server-Sent Events (SSE)** | One-way stream from server to client over HTTP | Live scores, notifications, AI text streaming (ChatGPT-style typing) |
| **WebSockets** | A two-way connection that stays open | Chat, multiplayer games, collaborative editing |
| **WebRTC** | Direct browser-to-browser | Video calls, screen sharing |

**On serverless (Vercel):** functions can't hold a WebSocket open for long. Use a managed service that holds the connections for you: Supabase Realtime, Pusher, Ably, Liveblocks, or Cloudflare Durable Objects. Or run a long-lived server on Render, Railway or Fly. See [Part 9](09-hosting-and-deployment.md).

## Webhooks

"Don't call us, we'll call you." Another service sends an HTTP request to *your* URL when something happens.

**Example:** Stripe calls `POST /api/stripe-webhook` when a payment succeeds.

Rules:

- **Verify the signature.** Anyone can hit your URL; only Stripe knows the secret.
- **Be idempotent.** The same event can arrive twice. Store the event id and skip repeats ([Part 8](08-system-design-async.md)).
- **Reply fast** (return 200 quickly) and do slow work in a background job.

## Server Actions (Next.js)

A function marked `"use server"` that the browser calls like normal code. Next.js creates a private `POST` endpoint behind the scenes.

```ts
// Browser side
const result = await saveSleep({ id, sleep_date, bed_time, wake_time });
```

- **Good:** no routes to write, end-to-end types, works with forms even before JavaScript loads.
- **Bad:** only your own Next.js app can use it. A mobile app needs a real API.
- **Security:** it's still a public endpoint. Always check auth and validate input inside it. PLOS's `defineAction` does both on every action.

## Which to use

| Situation | Pick |
| --- | --- |
| Public API that others will use | REST (with an OpenAPI spec) |
| Many clients with very different data needs | GraphQL |
| Services inside your company talking to each other | gRPC (or REST if simpler) |
| TypeScript frontend + backend in one repo | tRPC or Server Actions |
| Live updates, one way | SSE |
| Live updates, two way | WebSockets (or a managed realtime service) |
| Another service tells you something happened | Webhooks |
