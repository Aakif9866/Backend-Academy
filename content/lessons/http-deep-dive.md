---
title: HTTP in Depth
summary: The request/response format, methods and their safety and idempotency, status codes, headers, caching, cookies and sessions, CORS, and HTTP/1.1 vs 2 vs 3. Then build an HTTP server from raw sockets.
difficulty: beginner
minutes: 60
prerequisites: [how-the-internet-works]
objectives:
  - Read and write raw HTTP/1.1 requests and responses
  - Choose methods and status codes by their defined semantics
  - Use caching headers (Cache-Control, ETag) correctly
  - Configure cookies securely and explain how sessions use them
  - Explain CORS, preflight requests and what CORS does not protect against
  - Compare HTTP/1.1, HTTP/2 and HTTP/3
videos:
  - id: a-sBfyiXysI
    title: HTTP/1 to HTTP/2 to HTTP/3
    channel: ByteByteGo
    why: An animated comparison of how each version moves bytes and where head-of-line blocking appears.
  - id: 4KHiSt0oLJ0
    title: CORS in 100 Seconds
    channel: Fireship
    why: A quick, accurate picture of the same-origin policy and preflight before the details below.
resources:
  - url: https://developer.mozilla.org/en-US/docs/Web/HTTP
    title: MDN HTTP documentation
    why: The most readable reference for every header, method and status code, with browser behaviour notes.
  - url: https://www.rfc-editor.org/rfc/rfc9110.html
    title: "RFC 9110: HTTP Semantics"
    why: The authoritative definitions of methods (section 9) and status codes (section 15).
  - url: https://www.rfc-editor.org/rfc/rfc9111.html
    title: "RFC 9111: HTTP Caching"
    why: How Cache-Control, freshness and validation actually work.
  - url: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    title: "MDN: Cross-Origin Resource Sharing (CORS)"
    why: The complete explanation of simple vs preflighted requests and credentialed CORS.
quiz:
  - type: mcq
    q: Which method is safe AND idempotent?
    options: ["POST", "GET", "PATCH", "DELETE"]
    answer: 1
    explain: "GET is safe (it should not change server state) and idempotent. DELETE and PUT are idempotent but not safe. POST and PATCH are neither by definition (PATCH can be made idempotent but isn't required to be)."
  - type: scenario
    q: A client requests /orders/123, which exists but belongs to another customer. Which response best avoids leaking information?
    options: ["403 Forbidden", "404 Not Found", "500 Internal Server Error", "200 with an empty body"]
    answer: 1
    explain: "403 confirms the order exists. Returning 404 for resources the caller isn't allowed to know about prevents enumeration. Use 403 when the caller may know the resource exists but lacks permission for the action."
  - type: tf
    q: CORS protects your API from requests made by curl or a malicious server.
    answer: 1
    explain: "False. CORS is enforced only by browsers, to stop one website's JavaScript from reading responses from another origin. Non-browser clients ignore it. Your API still needs authentication and authorisation."
  - type: mcq
    q: "What does `Cache-Control: no-cache` mean?"
    options: ["Never store the response", "Caches may store it but must revalidate with the origin before each reuse", "Cache for one hour", "Only the CDN may cache it"]
    answer: 1
    explain: "A common confusion: no-cache means 'revalidate before reuse' (for example with If-None-Match). no-store means 'don't store at all', which is what you want for sensitive responses."
  - type: mcq
    q: Which cookie attributes should a session cookie for a web app normally have?
    options: ["None; defaults are fine", "HttpOnly, Secure, SameSite=Lax (or Strict), a sensible Path and expiry", "Only Domain", "Expires in 10 years"]
    answer: 1
    explain: "HttpOnly blocks JavaScript access (limits XSS token theft), Secure sends it only over HTTPS, SameSite limits cross-site sending (CSRF defence)."
  - type: scenario
    q: Your browser app on app.example.com calls api.example.com with fetch and credentials. The request fails with a CORS error only for PUT, not GET. What is the most likely reason?
    options: ["PUT is not allowed in HTTP", "PUT triggers a preflight OPTIONS request, and the API doesn't answer it with the right Access-Control-Allow-* headers", "GET is cached", "The cookie expired"]
    answer: 1
    explain: "Methods other than GET/HEAD/POST (and custom headers or JSON content types) trigger a preflight. The server must reply to OPTIONS with Access-Control-Allow-Origin (the exact origin, not * when credentials are used), Allow-Methods, Allow-Headers and Allow-Credentials."
---

## Why it matters

Every web framework is a layer over HTTP. When you understand the protocol itself, framework behaviour stops being magic: you know why a response wasn't cached, why the browser blocked a request, why a cookie wasn't sent, and which status code to return. HTTP's semantics (safe, idempotent, cacheable) are also what proxies, CDNs, browsers and retry logic rely on, so getting them right makes everything in between work for you.

## The message format

HTTP/1.1 is text. Here is a complete request, exactly as it travels over the (TLS-encrypted) connection:

```http
POST /api/tasks HTTP/1.1
Host: api.example.com
Content-Type: application/json
Content-Length: 39
Authorization: Bearer eyJhbGciOi...
Accept: application/json
User-Agent: curl/8.7.1

{"title":"Write lesson","priority":2}
```

And the response:

```http
HTTP/1.1 201 Created
Content-Type: application/json
Content-Length: 76
Location: /api/tasks/8f3c
Cache-Control: no-store
Date: Tue, 10 Nov 2026 09:00:00 GMT

{"id":"8f3c","title":"Write lesson","priority":2,"status":"todo"}
```

Structure: a **start line** (method, target, version, or version, status, reason), **headers** (one per line, `Name: value`), an empty line (`\r\n`), then an optional **body**. The body length is given by `Content-Length` or by `Transfer-Encoding: chunked`.

HTTP/2 and HTTP/3 keep exactly the same *semantics* (methods, headers, status codes) but encode them as binary frames.

## Methods and their guarantees

| Method | Purpose | Safe | Idempotent | Body |
| --- | --- | --- | --- | --- |
| `GET` | Read a resource | ✅ | ✅ | No (practically) |
| `HEAD` | Like GET, headers only | ✅ | ✅ | No |
| `POST` | Create, or trigger processing | ❌ | ❌ | Yes |
| `PUT` | Replace a resource entirely (or create at a known URL) | ❌ | ✅ | Yes |
| `PATCH` | Partially modify | ❌ | ❌ (can be designed to be) | Yes |
| `DELETE` | Remove | ❌ | ✅ | Optional |
| `OPTIONS` | Ask what's allowed (CORS preflight) | ✅ | ✅ | No |

- **Safe** means the client isn't requesting a state change. Crawlers, prefetchers and caches assume GET is safe, so a `GET /delete?id=5` link *will* eventually be followed by a bot.
- **Idempotent** means doing it N times has the same effect on the server as doing it once. Proxies and clients may retry idempotent requests automatically after a network failure. `POST` isn't, which is why payment APIs add an `Idempotency-Key` header (see [REST API design](/learn/rest-api-design/)).

## Status codes

The first digit is the class:

| Class | Meaning | Most used |
| --- | --- | --- |
| 1xx | Informational | `101 Switching Protocols` (WebSocket upgrade) |
| 2xx | Success | `200 OK`, `201 Created`, `202 Accepted` (queued for async processing), `204 No Content` |
| 3xx | Redirection | `301`/`308` permanent, `302`/`307` temporary, `304 Not Modified` (cache revalidation) |
| 4xx | Client error | `400`, `401`, `403`, `404`, `405`, `409`, `412`, `413`, `415`, `422`, `429` |
| 5xx | Server error | `500`, `502 Bad Gateway`, `503 Service Unavailable`, `504 Gateway Timeout` |

The ones people mix up:

- **401 Unauthorized** really means *unauthenticated*: no valid credentials. Send `WWW-Authenticate`.
- **403 Forbidden**: authenticated, but not allowed.
- **409 Conflict**: the request conflicts with current state (duplicate unique value, version conflict).
- **412 Precondition Failed**: an `If-Match` ETag didn't match (optimistic concurrency).
- **422 Unprocessable Content**: syntactically valid but semantically invalid (validation errors).
- **429 Too Many Requests**: rate limited; include `Retry-After`.
- **502/503/504**: usually from a proxy or load balancer. 502 means the upstream sent garbage or closed the connection, 503 means unavailable or overloaded, 504 means the upstream didn't answer in time.

Never return `200` with `{"error": ...}`. Status codes drive caching, retries, monitoring and client logic.

## Headers that matter

| Header | Direction | Purpose |
| --- | --- | --- |
| `Host` | Request | Which site (required in HTTP/1.1; virtual hosting) |
| `Content-Type` | Both | Media type of the body: `application/json`, `multipart/form-data` |
| `Accept` | Request | Media types the client wants (content negotiation) |
| `Authorization` | Request | Credentials: `Bearer <token>`, `Basic …` |
| `Cookie` / `Set-Cookie` | Req / Resp | Client state (sessions) |
| `Cache-Control`, `ETag`, `Last-Modified` | Response | Caching rules and validators |
| `If-None-Match`, `If-Match` | Request | Conditional requests (cache revalidation, optimistic locking) |
| `Location` | Response | URL of a created resource or redirect target |
| `Retry-After` | Response | When to retry (429, 503) |
| `X-Request-Id` / `traceparent` | Both | Correlate logs and traces across services |
| `Strict-Transport-Security` | Response | Force HTTPS in browsers |
| `X-Forwarded-For`, `Forwarded` | Request (from proxies) | Original client IP behind a proxy (trust only from your own proxies) |

## Caching

HTTP caching happens in browsers, CDNs and reverse proxies, and it's free performance if you set headers deliberately.

```http
Cache-Control: public, max-age=31536000, immutable      # fingerprinted static assets: app.3f9c1.js
Cache-Control: public, max-age=60, stale-while-revalidate=300   # public API data that can be a minute old
Cache-Control: private, max-age=0, must-revalidate      # per-user data; browser only, always revalidate
Cache-Control: no-store                                 # sensitive: never store anywhere
```

- `public` lets shared caches (CDNs) store it; `private` restricts it to the user's browser.
- `max-age` is freshness in seconds; `s-maxage` overrides it for shared caches.
- `stale-while-revalidate` serves a stale copy immediately while refreshing in the background.

**Validation** avoids resending unchanged bodies:

```
GET /api/products/42                         →  200 OK, ETag: "v7", body
GET /api/products/42, If-None-Match: "v7"    →  304 Not Modified, no body
```

The same ETag enables **optimistic concurrency** on writes: `PATCH` with `If-Match: "v7"` returns `412` if someone changed the resource since you read it.

A response that varies by a request header must say so: `Vary: Accept-Encoding` or `Vary: Authorization`. Otherwise a CDN may serve one user's response to another.

## Cookies and sessions

HTTP is **stateless**: each request stands alone. Cookies add state. The server sets one:

```http
Set-Cookie: sid=9f8a7c…; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=1209600
```

and the browser sends it back on matching requests:

```http
Cookie: sid=9f8a7c…
```

| Attribute | Effect |
| --- | --- |
| `HttpOnly` | JavaScript can't read it (limits damage from XSS) |
| `Secure` | Only sent over HTTPS |
| `SameSite=Lax` | Not sent on cross-site subrequests (images, fetch), but sent on top-level navigations; main CSRF defence |
| `SameSite=Strict` | Never sent cross-site, not even when following a link from another site |
| `SameSite=None; Secure` | Sent cross-site (needed for third-party embeds); requires Secure |
| `Domain` | Omit it to restrict the cookie to the exact host (safer) |
| `Max-Age` / `Expires` | Persistence; without them it's a session cookie that ends with the browser session |

A **server-side session**: the cookie holds only a random, unguessable session id; the server stores the session data (user id, roles, expiry) in Redis or the database. Logout or revocation is just deleting the row. The alternative, putting signed claims in the token itself (JWT), is compared in [auth and security](/learn/auth-and-security/).

## CORS: the browser's cross-origin rule

An **origin** is scheme + host + port: `https://app.example.com:443`. Browsers enforce the **same-origin policy**: JavaScript on one origin can *send* requests to another but can't *read* the responses unless the other origin allows it via **CORS** headers.

For "simple" requests (GET/HEAD/POST with basic headers), the browser sends the request and checks the response:

```http
Access-Control-Allow-Origin: https://app.example.com
```

For anything else (PUT, DELETE, `Content-Type: application/json`, custom headers like `Authorization`), the browser first sends a **preflight**:

```http
OPTIONS /api/tasks/8f3c HTTP/1.1
Origin: https://app.example.com
Access-Control-Request-Method: PUT
Access-Control-Request-Headers: authorization, content-type
```

and the server must answer:

```http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: authorization, content-type
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 600
Vary: Origin
```

Rules that trip people up:

- With credentials (cookies), `Access-Control-Allow-Origin` must be the exact origin, not `*`.
- Reflecting any `Origin` header back with credentials allowed is a vulnerability: any website can then read your users' data. Use an allowlist.
- CORS is not authentication. `curl` ignores it entirely.

## HTTP/1.1 vs HTTP/2 vs HTTP/3

| | HTTP/1.1 | HTTP/2 | HTTP/3 |
| --- | --- | --- | --- |
| Encoding | Text | Binary frames | Binary frames |
| Transport | TCP | TCP | QUIC over UDP |
| Requests per connection at once | One (browsers open ~6 connections per host) | Many multiplexed streams | Many multiplexed streams |
| Header compression | None | HPACK | QPACK |
| Head-of-line blocking | At HTTP level | At TCP level (one lost packet stalls all streams) | Only the affected stream stalls |
| Handshake (new connection) | TCP + TLS | TCP + TLS | Combined (1 RTT, 0-RTT resumption) |
| Connection migration (Wi-Fi → mobile) | No | No | Yes (connection IDs) |

In practice: your CDN or load balancer speaks HTTP/2 and HTTP/3 to browsers; between your proxy and your app servers, HTTP/1.1 with keep-alive is common and fine. gRPC requires HTTP/2.

**Keep-alive:** HTTP/1.1 connections are persistent by default, so many requests reuse one TCP/TLS connection. Make sure your HTTP clients (`fetch`/undici, `requests.Session`, Go's `http.Client`) reuse connections instead of creating a client per request.

## Build an HTTP server from raw sockets

The best way to demystify HTTP is to parse it yourself. This Node server uses only the `net` module (raw TCP):

```js
import net from "node:net";

const server = net.createServer((socket) => {
  let buffer = "";
  socket.on("data", (chunk) => {
    buffer += chunk.toString("latin1");
    const end = buffer.indexOf("\r\n\r\n");          // headers end at the first blank line
    if (end === -1) return;                           // wait for more bytes
    const [requestLine, ...headerLines] = buffer.slice(0, end).split("\r\n");
    const [method, target] = requestLine.split(" ");
    const headers = Object.fromEntries(
      headerLines.map((l) => [l.slice(0, l.indexOf(":")).toLowerCase(), l.slice(l.indexOf(":") + 1).trim()]),
    );

    const body = JSON.stringify({ method, target, userAgent: headers["user-agent"] ?? null });
    socket.end(
      "HTTP/1.1 200 OK\r\n" +
        "Content-Type: application/json\r\n" +
        `Content-Length: ${Buffer.byteLength(body)}\r\n` +
        "Connection: close\r\n" +
        "\r\n" +
        body,
    );
  });
});
server.listen(8080, () => console.log("raw HTTP on :8080"));
```

```bash
curl -v http://localhost:8080/hello
printf 'GET /raw HTTP/1.1\r\nHost: x\r\n\r\n' | nc localhost 8080   # speak HTTP by hand
```

This toy ignores request bodies, keep-alive, chunked encoding, header size limits and malformed input. Real parsers handle all of that and defend against attacks such as oversized headers and **request smuggling**, which exploits disagreements between proxies and servers about where a request ends. Never hand-roll HTTP parsing in production.

## Real-world scenarios

- A CDN in front of a public product API serves most reads from cache because of `Cache-Control: public, s-maxage=60`.
- A mobile app retries a failed `PUT` safely because PUT is idempotent; for `POST /payments` it sends an `Idempotency-Key`.
- An SPA on `app.` and an API on `api.` need correct credentialed CORS, while a same-origin setup behind one domain avoids CORS entirely.

## Common mistakes

- `200` for errors, or `500` for validation failures.
- State-changing `GET` endpoints.
- Missing `Vary`, causing CDNs to mix up users' responses.
- Using `no-cache` when you meant `no-store` for sensitive data.
- `Access-Control-Allow-Origin: *` combined with reflected origins and credentials.
- Creating a new HTTP client per request, losing keep-alive.

## Security considerations

- Secure cookie attributes are your first line of session defence.
- Set `Strict-Transport-Security`, `Content-Security-Policy` and `X-Content-Type-Options: nosniff` (see [web vulnerabilities](/learn/web-vulnerabilities/)).
- Only trust `X-Forwarded-For` from your own proxies; otherwise clients can spoof their IP and bypass IP-based rate limits.
- Limit header and body sizes at the proxy to avoid resource exhaustion.

## Performance considerations

- Caching headers are the cheapest performance work you'll ever do.
- Compression (`gzip`, `br`) for text responses; don't compress already-compressed images.
- Reuse connections; enable HTTP/2+ at the edge.

## Hands-on exercise

1. Extend the raw-socket server to: read a body using `Content-Length`; route `GET /tasks` and `POST /tasks` (in-memory list); return `404` and `405` correctly; support keep-alive (don't close after each response); and reject headers larger than 8 KB with `431`.
2. Open your browser's DevTools Network tab on any large site. For five requests, note the protocol (h2/h3), the status, the `Cache-Control` header, and whether it came from disk cache, memory cache or the network.
3. Build two tiny servers on ports 3000 (a page) and 4000 (an API). Make a `PUT` with `fetch` from the page to the API, watch it fail on CORS, then fix it with a correct preflight response and an origin allowlist.

## Completion criteria

- You can write a valid HTTP request and response by hand.
- You choose methods and status codes by their semantics and set caching headers on purpose.
- You can configure secure cookies and debug CORS from first principles.
