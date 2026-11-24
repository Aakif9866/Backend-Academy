---
title: Ways to Build an API
summary: REST, GraphQL, gRPC, tRPC, WebSockets, webhooks and Server Actions compared, with the status codes and habits every HTTP API needs.
difficulty: beginner
minutes: 30
source: backend/05-apis.md
prerequisites: [http-deep-dive]
objectives:
  - Explain what REST, GraphQL, gRPC and tRPC each optimise for
  - Pick correct HTTP status codes for success, client errors and server errors
  - Choose an API style for a public API, an internal service mesh and a full-stack TypeScript app
  - Explain when webhooks beat polling
videos:
  - id: lsMQRaeKNDk
    title: What is a REST API?
    channel: IBM Technology
    why: A clear 9-minute grounding in resources, verbs and statelessness before you read the comparison.
  - id: eIQh02xuVw4
    title: GraphQL Explained in 100 Seconds
    channel: Fireship
    why: The fastest way to see what a GraphQL schema and query look like side by side.
resources:
  - url: https://www.rfc-editor.org/rfc/rfc9110.html
    title: "RFC 9110: HTTP Semantics"
    why: The authoritative definition of methods, status codes and headers. Look up any status code here, not on blogs.
  - url: https://graphql.org/learn/
    title: Learn GraphQL (official)
    why: The official tutorial covering schemas, resolvers, and the N+1 problem DataLoader solves.
  - url: https://grpc.io/docs/what-is-grpc/core-concepts/
    title: gRPC core concepts
    why: Unary vs streaming RPCs, deadlines and cancellation from the gRPC project itself.
quiz:
  - type: mcq
    q: A client sends a POST with a JSON body that fails validation (email missing). Which status code is most appropriate?
    options: ["200 OK with an error field", "400 Bad Request (or 422 Unprocessable Content)", "404 Not Found", "500 Internal Server Error"]
    answer: 1
    explain: The client sent a request the server won't process because of the client's input, so it's a 4xx. 400 is the general case and 422 is the more specific "well-formed but semantically invalid". 200 with an error hides failures from caches, proxies and monitoring. 5xx means the server is at fault.
  - type: scenario
    q: Two internal Go and Java services exchange thousands of small calls per second and you control both ends. Which style fits best?
    options: ["GraphQL", "gRPC with Protocol Buffers", "Webhooks", "REST with XML"]
    answer: 1
    explain: gRPC gives a typed contract shared by both languages, compact binary encoding, HTTP/2 multiplexing and deadlines. GraphQL shines for flexible client-shaped reads, webhooks are for event notification to third parties, and XML REST is verbose.
  - type: tf
    q: PUT and DELETE are defined as idempotent in HTTP, while POST is not.
    answer: 0
    explain: True. Repeating a PUT or DELETE leaves the server in the same state as doing it once (the response may differ). POST makes no such promise, which is why payment APIs add idempotency keys to POST.
  - type: mcq
    q: Why does GraphQL often need a tool like DataLoader on the server?
    options: ["To compress responses", "Nested fields resolve one by one and can trigger an N+1 query storm", "To cache HTTP responses in a CDN", "Because GraphQL has no schema"]
    answer: 1
    explain: Resolving `posts { author }` naively runs one author query per post. DataLoader batches those into one query per tick. GraphQL is strongly schema-typed, and CDN caching is harder with GraphQL, not something DataLoader fixes.
  - type: scenario
    q: Stripe needs to tell your server when a payment succeeds, which can happen minutes after checkout. What mechanism do they use and why?
    options: ["You poll their API every second", "Webhooks: they POST an event to your URL", "A permanent WebSocket from Stripe to every customer", "Email"]
    answer: 1
    explain: Webhooks push the event to you when it happens, with no wasted polling. Your handler must verify the signature and be idempotent, because webhooks are delivered at least once.
---

## Hands-on exercise

Design the same tiny "todo" capability three ways and compare:

1. **REST:** write the routes table (`GET /todos`, `POST /todos`, `PATCH /todos/{id}`, `DELETE /todos/{id}`) with request bodies, success codes and two error codes each.
2. **GraphQL:** write the schema (`type Todo`, `Query.todos`, `Mutation.addTodo`) and one query that fetches todos with their owner's name.
3. **gRPC:** write the `.proto` file with a `TodoService` and messages.

Then answer in two sentences each: which is easiest for a third-party developer with `curl`? Which gives the strongest type guarantees across languages? Which makes HTTP caching easiest?

## Completion criteria

- You can justify a status code for any common situation without looking it up.
- You can explain to a teammate why your public API is REST and your internal hot path is gRPC (or why not).
- You know webhooks must be verified and idempotent.
