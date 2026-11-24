---
title: Designing REST APIs People Enjoy Using
summary: Resource modelling, URLs, versioning, pagination (offset vs cursor), filtering and sorting, idempotency keys, concurrency control, errors, and documenting it all with OpenAPI.
difficulty: intermediate
minutes: 50
prerequisites: [http-deep-dive, backend-architecture-layers]
objectives:
  - Model resources and URLs consistently
  - Implement cursor pagination and explain why offset pagination breaks at scale
  - Make unsafe operations retry-safe with idempotency keys
  - Prevent lost updates with ETags and If-Match
  - Version an API and evolve it without breaking clients
  - Write an OpenAPI description and keep it in sync with the code
videos:
  - id: lsMQRaeKNDk
    title: What is a REST API?
    channel: IBM Technology
    why: A concise refresher on resources and representations before the design details.
resources:
  - url: https://google.aip.dev/
    title: Google API Improvement Proposals (AIP)
    why: Google's detailed, opinionated API design rules, covering pagination, filtering, long-running operations and field masks.
  - url: https://github.com/microsoft/api-guidelines/blob/vNext/azure/Guidelines.md
    title: Microsoft Azure REST API Guidelines
    why: Another large-scale, battle-tested set of conventions, especially strong on versioning and errors.
  - url: https://spec.openapis.org/oas/latest.html
    title: OpenAPI Specification
    why: The standard for describing HTTP APIs, used for docs, client generation and contract testing.
  - url: https://docs.stripe.com/api/idempotent_requests
    title: "Stripe API: Idempotent requests"
    why: How a major payments API implements idempotency keys, including expiry and parameter mismatch behaviour.
quiz:
  - type: mcq
    q: Why does OFFSET pagination get slower and less correct on large, changing tables?
    options: ["OFFSET is not SQL", "The database still reads and discards all skipped rows, and inserts or deletes shift rows between pages (duplicates or gaps)", "It uses too little memory", "Indexes can't be used at all"]
    answer: 1
    explain: "OFFSET 100000 makes the database walk past 100,000 rows. And if a row is inserted at the top while a client pages, everything shifts by one. Cursor (keyset) pagination seeks directly via an index and is stable."
  - type: scenario
    q: A mobile client sends POST /payments, the connection drops before the response, and the client retries. How do you avoid charging twice?
    options: ["Tell clients never to retry", "Require an Idempotency-Key header; store the key with the result and return the stored result for repeats", "Use GET instead", "Add a sleep before processing"]
    answer: 1
    explain: "The server records (key, request hash, response). A retry with the same key returns the original response without re-executing. Reusing a key with a different body should be rejected."
  - type: mcq
    q: Two admins edit the same product. Admin B's save overwrites admin A's changes without either noticing. Which HTTP mechanism prevents this?
    options: ["CORS", "ETag + If-Match, returning 412 Precondition Failed on mismatch", "Cache-Control", "HTTP/2"]
    answer: 1
    explain: "The client sends back the ETag it read. If the resource changed since then, the server refuses with 412 and the client can show a conflict instead of silently losing data."
  - type: tf
    q: Adding a new optional field to a JSON response is generally a backward-compatible change.
    answer: 0
    explain: "True, provided clients ignore unknown fields, which you should document as a rule. Removing or renaming fields, changing types, or making optional inputs required are breaking changes."
  - type: mcq
    q: Which URL design is most conventional for "the comments of post 42"?
    options: ["GET /getCommentsForPost?id=42", "GET /posts/42/comments", "POST /comments/list", "GET /post-comments-42"]
    answer: 1
    explain: "Plural nouns, hierarchy for ownership, and the method carries the verb. Keep nesting shallow (one level is usually enough); /comments/{id} can stand alone for direct access."
---

## Why it matters

An API is a contract you can rarely take back. Once mobile apps, partners or other teams depend on it, every inconsistency becomes permanent and every breaking change becomes a migration project. Good API design makes clients simple to write, safe to retry, and possible to evolve without coordination.

## Resources and URLs

Model your API around **resources** (nouns) and use HTTP methods as the verbs.

| Action | Method and path | Success |
| --- | --- | --- |
| List projects | `GET /projects` | `200` |
| Create a project | `POST /projects` | `201` + `Location` |
| Get one | `GET /projects/{id}` | `200` |
| Partially update | `PATCH /projects/{id}` | `200` |
| Replace | `PUT /projects/{id}` | `200` |
| Delete | `DELETE /projects/{id}` | `204` |
| List a project's tasks | `GET /projects/{id}/tasks` | `200` |
| Create a task in a project | `POST /projects/{id}/tasks` | `201` |
| Get a task directly | `GET /tasks/{id}` | `200` |

Conventions:

- Plural nouns, lowercase, hyphens: `/order-items`.
- Nest only to express ownership, and only one level deep. `/projects/{id}/tasks` is fine; `/orgs/1/projects/2/tasks/3/comments/4` isn't. Give child resources their own top-level URL too.
- Actions that don't map to CRUD become sub-resources or explicit action endpoints: `POST /orders/{id}/cancel`, `POST /invoices/{id}/send`. That's pragmatic, and clearer than contorting a `PATCH`.
- Use stable, opaque IDs (UUIDs or prefixed IDs like `ord_9f8c…`). Auto-increment IDs leak business volume and invite enumeration.

### Representations

- JSON with a consistent naming style (pick `snake_case` or `camelCase` and never mix).
- Timestamps in ISO 8601 UTC: `"2026-11-10T09:00:00Z"`.
- Money as integer minor units plus currency: `{"amount": 1999, "currency": "INR"}`. Never floats.
- Enums as strings: `"status": "in_progress"`.
- Return the created or updated resource in the response so clients don't need a second request.

## Pagination

Never return unbounded lists. Two approaches:

### Offset pagination

```
GET /tasks?limit=20&offset=40
SELECT … ORDER BY created_at DESC LIMIT 20 OFFSET 40;
```

Simple, and allows "jump to page 7". But the database must read and discard every skipped row, so deep pages get slow, and concurrent inserts shift rows between pages, causing duplicates and gaps.

### Cursor (keyset) pagination

```
GET /tasks?limit=20
→ { "data": [...], "next_cursor": "eyJjIjoiMjAyNi0xMS0xMFQwOTowMDowMFoiLCJpIjoiOGYzYyJ9" }
GET /tasks?limit=20&cursor=eyJjIjoi...
```

The cursor encodes the sort key of the last row returned. The next query seeks straight to it:

```sql
-- index: (project_id, created_at DESC, id DESC)
SELECT * FROM tasks
WHERE project_id = $1
  AND (created_at, id) < ($2, $3)      -- row-value comparison: strictly after the cursor
ORDER BY created_at DESC, id DESC
LIMIT 21;                               -- one extra row tells you if there's a next page
```

Include a unique tiebreaker (`id`) in the sort, or rows with equal timestamps get skipped or duplicated. Make cursors opaque (base64-encoded JSON), so you can change their contents later. Cursor pagination is stable under writes and equally fast for page 1 and page 10,000; the trade-off is no random page jumps.

| | Offset | Cursor |
| --- | --- | --- |
| Jump to page N | ✅ | ❌ |
| Performance on deep pages | Degrades linearly | Constant (index seek) |
| Stable under concurrent writes | ❌ | ✅ |
| Best for | Small admin tables | Feeds, timelines, large lists, infinite scroll |

## Filtering, sorting and field selection

```
GET /tasks?status=todo,in_progress&assignee_id=u_12&due_before=2026-12-01&sort=-priority,created_at&fields=id,title,status
```

- Filter with plain query params for common fields. Reserve a richer filter language (`filter=status eq 'todo'`) for APIs that truly need it.
- `sort=-priority,created_at`: a leading `-` means descending. **Allowlist** sortable and filterable fields, both for security (no injecting arbitrary columns into SQL) and so every combination you support has an index.
- Sparse fieldsets (`fields=`) reduce payload size for mobile clients.

## Idempotency

`POST` isn't idempotent, yet networks fail after the server has done the work but before the client sees the response. The client can't know whether to retry. **Idempotency keys** solve this:

```http
POST /payments
Idempotency-Key: 5c0a6c1e-2d8b-4c3e-9f0a-7b9b3c1d2e4f
Content-Type: application/json

{"order_id":"ord_42","amount":1999,"currency":"INR"}
```

```sql
create table idempotency_keys (
  key            text primary key,
  user_id        uuid not null,
  request_hash   text not null,
  status         text not null,        -- 'in_progress' | 'done'
  response_code  int,
  response_body  jsonb,
  created_at     timestamptz not null default now()
);
```

Server logic:

1. `INSERT … ON CONFLICT DO NOTHING` the key with status `in_progress`. If the insert succeeded, process the request, store the response, and mark it `done`, ideally in the same transaction as the business write.
2. If the key already exists and is `done` with the same request hash, return the stored response.
3. If it's `in_progress`, return `409` (a concurrent duplicate). If the request hash differs, return `422`: the key was reused for a different request.
4. Expire keys after a period (Stripe keeps them for 24 hours).

## Concurrency control with ETags

Prevent lost updates when two clients edit the same resource:

```
GET /products/42           → 200, ETag: "7"
PATCH /products/42
If-Match: "7"              → 200, ETag: "8"     (version matched)
PATCH /products/42
If-Match: "7"              → 412 Precondition Failed (someone else updated it)
```

```sql
UPDATE products SET name = $1, version = version + 1
WHERE id = $2 AND version = $3
RETURNING version;          -- 0 rows → 412
```

## Errors

Use RFC 9457 problem details everywhere, with machine-readable `type`s and field-level validation errors:

```json
{
  "type": "https://api.example.com/problems/insufficient-funds",
  "title": "Insufficient funds",
  "status": 409,
  "detail": "Balance 500 is less than the requested 1999",
  "balance": 500,
  "request_id": "req_6c1f9a"
}
```

Clients branch on `type` and `status`, never on parsing `title` text.

## Versioning and evolution

The best versioning strategy is needing it rarely. Make **additive** changes, which are backward-compatible:

| Safe (non-breaking) | Breaking |
| --- | --- |
| Adding an endpoint | Removing or renaming an endpoint or field |
| Adding an optional request field | Making an optional field required |
| Adding a response field | Changing a field's type or meaning |
| Adding an enum value (if clients are told to tolerate unknowns) | Changing error codes or status codes |
| | Changing default behaviour or pagination |

When you must break things:

- **URL versioning** (`/v1/`, `/v2/`): explicit, easy to route and cache. The most common choice.
- **Header versioning** (`Accept: application/vnd.example.v2+json`, or Stripe-style dated versions `Stripe-Version: 2024-06-20`): keeps URLs stable and allows fine-grained evolution, at the cost of being less visible.

Announce deprecations with the `Deprecation` and `Sunset` headers, measure who still calls old versions, and give real migration windows.

## Long-running operations

If work takes more than a few seconds (video transcoding, report generation), don't hold the request open:

```
POST /reports            → 202 Accepted, Location: /operations/op_91
GET  /operations/op_91   → 200 {"status":"running","progress":0.4}
GET  /operations/op_91   → 200 {"status":"succeeded","result_url":"/reports/r_17"}
```

Or notify the client with a webhook or a real-time channel when it's done.

## Rate limits

Tell clients their limits and when to retry:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 30
RateLimit-Limit: 100
RateLimit-Remaining: 0
RateLimit-Reset: 30
```

(The `RateLimit-*` fields come from an IETF draft that's widely implemented in variations; many APIs use `X-RateLimit-*`.)

## Documenting with OpenAPI

An OpenAPI document describes endpoints, parameters, schemas, responses and security. It powers interactive docs, client SDK generation, mock servers and contract tests.

```yaml
openapi: 3.1.0
info: { title: Tasks API, version: 1.0.0 }
paths:
  /projects/{projectId}/tasks:
    post:
      summary: Create a task
      parameters:
        - { name: projectId, in: path, required: true, schema: { type: string, format: uuid } }
        - { name: Idempotency-Key, in: header, required: false, schema: { type: string } }
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: "#/components/schemas/CreateTask" }
      responses:
        "201": { description: Created, content: { application/json: { schema: { $ref: "#/components/schemas/Task" } } } }
        "404": { $ref: "#/components/responses/Problem" }
        "422": { $ref: "#/components/responses/Problem" }
components:
  schemas:
    CreateTask:
      type: object
      additionalProperties: false
      required: [title]
      properties:
        title: { type: string, minLength: 1, maxLength: 200 }
        priority: { type: integer, minimum: 1, maximum: 4, default: 2 }
```

Keep it in sync by **generating it from code** (FastAPI does this automatically; Fastify, NestJS and Spring have plugins) or by writing the spec first and generating server stubs and validators from it. Either way, test that responses match the spec in CI.

## REST vs the alternatives

REST is a strong default for public and partner APIs because it's universal, cacheable and debuggable with `curl`. GraphQL suits client-driven data needs across many screens, and gRPC suits internal service-to-service calls. See [ways to build an API](/learn/apis/) for the comparison.

## Common mistakes

- Verbs in URLs (`/createUser`) and inconsistent naming.
- Unbounded list endpoints.
- OFFSET pagination on feeds.
- Retrying `POST` without idempotency.
- Leaking database structure (column names, auto-increment ids) as the public contract.
- Breaking changes without versioning or notice.
- Documentation that drifts from the implementation.

## Security considerations

- Every endpoint enforces object-level authorisation (`WHERE owner_id = $user`). Broken object-level authorisation is the top OWASP API risk.
- Allowlist filter and sort fields; cap `limit` (for example at 100).
- Opaque, non-sequential IDs make enumeration harder (but are not a substitute for authorisation).
- Return `404` rather than `403` for resources the caller shouldn't know exist.

## Performance considerations

- Cursor pagination with a matching composite index keeps list endpoints fast at any depth.
- Field selection and compression reduce payloads.
- ETags plus `304` responses save bandwidth on unchanged resources.

## Hands-on exercise

Extend the [Task API project](/projects/task-api/):

1. Convert list endpoints to cursor pagination. Write a test that inserts rows *while* paging and proves no duplicates or gaps.
2. Add `Idempotency-Key` support to `POST /projects/{id}/tasks`. Test: same key twice returns the same task id; same key with a different body returns `422`.
3. Add ETags to `GET /tasks/{id}` and require `If-Match` on `PATCH`; return `412` on mismatch and `428 Precondition Required` if the header is missing.
4. Seed 1,000,000 tasks and compare `EXPLAIN ANALYZE` for `OFFSET 900000` vs the cursor query. Record your measured timings.
5. Publish an OpenAPI 3.1 document and add a CI check that fails if a response doesn't match its schema.

## Completion criteria

- Your list endpoints use stable cursor pagination with matching indexes.
- Unsafe operations are retry-safe and concurrent edits can't silently overwrite each other.
- You can evolve your API additively and know exactly which changes are breaking.
