---
title: "Web and API Vulnerabilities: Attack and Defend"
summary: Threat modelling with STRIDE, then the OWASP Top 10 and API Security Top 10 in code. Injection, XSS, CSRF, SSRF, broken access control, file uploads, secure headers, rate limiting and secrets.
difficulty: advanced
minutes: 70
prerequisites: [authentication-deep-dive]
objectives:
  - Threat-model a feature with STRIDE before building it
  - Recognise and fix SQL injection, command injection, path traversal and SSRF in code
  - Prevent XSS and CSRF and explain how cookies, CSP and SameSite interact
  - Prevent broken object-level authorisation and mass assignment
  - Secure file uploads, set protective headers, and rate-limit abuse-prone endpoints
  - Manage secrets and dependencies safely
videos:
  - id: _jKylhJtPmI
    title: Hacking Websites with SQL Injection - Computerphile
    channel: Computerphile
    why: Watch an injection actually happen, which makes parameterised queries feel non-negotiable.
  - id: L5l9lSnNMxg
    title: Cracking Websites with Cross Site Scripting - Computerphile
    channel: Computerphile
    why: A clear demonstration of stored and reflected XSS and why output encoding matters.
  - id: vRBihr41JTo
    title: Cross Site Request Forgery - Computerphile
    channel: Computerphile
    why: Explains why browsers sending cookies automatically creates CSRF, and how tokens and SameSite fix it.
resources:
  - url: https://owasp.org/Top10/
    title: OWASP Top 10
    why: The reference list of critical web application risks, with descriptions, examples and prevention.
  - url: https://owasp.org/API-Security/editions/2023/en/0x11-t10/
    title: OWASP API Security Top 10 (2023)
    why: API-specific risks; broken object-level authorisation is number one.
  - url: https://cheatsheetseries.owasp.org/
    title: OWASP Cheat Sheet Series
    why: Concise, practical prevention guides for every topic in this lesson.
  - url: https://portswigger.net/web-security
    title: PortSwigger Web Security Academy
    why: Free, hands-on labs for every vulnerability class here, legal to attack because they're built for it.
  - url: https://owasp.org/www-project-juice-shop/
    title: OWASP Juice Shop
    why: An intentionally vulnerable application to practise attacks locally and safely.
quiz:
  - type: code
    q: Which line is vulnerable to SQL injection?
    code: |
      // A
      db.query(`SELECT * FROM users WHERE email = '${req.query.email}'`);
      // B
      db.query("SELECT * FROM users WHERE email = $1", [req.query.email]);
    options: ["A", "B", "Both", "Neither"]
    answer: 0
    explain: "A splices user input into SQL text, so an input like ' OR '1'='1 changes the query's structure. B sends the value separately as a parameter; the database never parses it as SQL."
  - type: scenario
    q: Your API has a "fetch image from URL" feature. A user submits http://169.254.169.254/latest/meta-data/iam/security-credentials/. What attack is this?
    options: ["XSS", "SSRF: making your server request internal resources, here the cloud metadata service that can expose credentials", "CSRF", "SQL injection"]
    answer: 1
    explain: "Server-side request forgery abuses your server's network position. Defences: allowlist destinations, resolve and block private/link-local IP ranges (checking after DNS resolution and on redirects), use IMDSv2, and run fetchers in an isolated network."
  - type: code
    q: What does this endpoint allow?
    code: |
      app.patch('/api/users/me', auth, async (req, res) => {
        await db.user.update({ where: { id: req.user.id }, data: req.body });
        res.sendStatus(204);
      });
    options: ["Nothing harmful", "Mass assignment: a user can send {\"role\":\"admin\"} or {\"emailVerified\":true} and the ORM saves it", "SQL injection", "SSRF"]
    answer: 1
    explain: "Passing the raw body to the ORM lets clients set any column. Validate against an explicit allowlist schema of updatable fields."
  - type: tf
    q: A strict Content-Security-Policy is a useful second layer against XSS, but output encoding is still required.
    answer: 0
    explain: "True. CSP limits what injected script can do or load (and can block inline script), but it's defence in depth. Contextual output encoding and safe templating prevent the injection in the first place."
  - type: mcq
    q: Which combination best protects a cookie-authenticated API from CSRF?
    options: ["CORS alone", "SameSite=Lax or Strict cookies plus a CSRF token (or checking Origin) for state-changing requests", "Using GET for all changes", "HTTPS alone"]
    answer: 1
    explain: "SameSite stops most cross-site cookie sending; a synchronizer or double-submit token (or strict Origin/Fetch-Metadata checks) covers remaining cases. CORS controls reading responses, not whether requests are sent."
  - type: code
    q: What's wrong here?
    code: |
      app.get('/download', (req, res) => {
        res.sendFile(path.join('/srv/uploads', req.query.name));
      });
    options: ["Nothing", "Path traversal: name=../../etc/passwd escapes the uploads directory", "It's too slow", "It leaks memory"]
    answer: 1
    explain: "Resolve the final path and verify it's still inside the base directory, or better, look files up by an opaque id in the database and never use user input as a path."
---

## Why it matters

Attackers don't need to be clever when applications make the classic mistakes, and automated scanners find those mistakes within hours of deployment. Almost every serious breach maps to a short list of vulnerability classes that have been understood for decades. Learning to see them in code, your own included, is a core backend skill, not a specialist one.

> Practise attacks only against systems you own or that are built for it (Juice Shop, PortSwigger's labs, DVWA running locally). Testing other people's systems without written permission is illegal in most countries.

## Threat modelling first

Before building a feature, spend 15 minutes asking how it could be abused. **STRIDE** is a handy checklist:

| Threat | Question | Typical control |
| --- | --- | --- |
| **S**poofing | Can someone pretend to be another user or service? | Strong authentication, mTLS, signed webhooks |
| **T**ampering | Can data be modified in transit or at rest? | TLS, integrity checks, authorisation on writes |
| **R**epudiation | Can someone deny doing something? | Audit logs, immutable records |
| **I**nformation disclosure | Can data leak? | Authorisation, encryption, minimal responses, no verbose errors |
| **D**enial of service | Can it be overwhelmed? | Rate limits, timeouts, size limits, quotas |
| **E**levation of privilege | Can someone gain rights they shouldn't have? | Least privilege, server-side checks, input validation |

Example: "users can upload a profile picture from a URL". STRIDE quickly surfaces SSRF (tampering and disclosure via internal requests), huge files (DoS), malicious file content (elevation via stored XSS or parser exploits), and other users' images being overwritten (tampering).

## Broken access control (OWASP A01, API1 and API5)

The most common serious flaw in APIs: an endpoint checks *that* you're logged in but not *whether this object is yours*.

```ts
// ✗ Broken object-level authorisation (BOLA / IDOR)
app.get("/api/invoices/:id", requireLogin, async (req, res) => {
  res.json(await db.invoice.findUnique({ where: { id: req.params.id } }));
});

// ✓ Scope every query by the caller's tenant or ownership
app.get("/api/invoices/:id", requireLogin, async (req, res) => {
  const invoice = await db.invoice.findFirst({ where: { id: req.params.id, orgId: req.user.orgId } });
  if (!invoice) return res.status(404).end();
  res.json(invoice);
});
```

Variants: **function-level** (a regular user can call `DELETE /admin/users/7`); **property-level** (the response includes fields the caller shouldn't see, like `password_hash` or another user's email); and **mass assignment**:

```ts
// ✓ Only these fields are updatable, whatever the client sends
const UpdateMe = z.object({ displayName: z.string().max(80), avatarUrl: z.string().url() }).partial().strict();
await db.user.update({ where: { id: req.user.id }, data: UpdateMe.parse(req.body) });
```

Defences: deny by default, centralised authorisation helpers, tenant-scoped queries (or row-level security), explicit response serializers, and automated tests that try every endpoint as the wrong user.

## Injection (A03)

Injection happens whenever untrusted input is concatenated into something that's later *interpreted*: SQL, shell commands, LDAP, templates, NoSQL queries, log formats.

### SQL injection

```python
# ✗ Input becomes code
cur.execute(f"SELECT * FROM users WHERE email = '{email}'")
# email = "x' OR '1'='1' --"   → returns every user

# ✓ Parameterised: the value is sent separately and never parsed as SQL
cur.execute("SELECT * FROM users WHERE email = %s", (email,))
```

Parameters can't be used for identifiers (column names in `ORDER BY`), so **allowlist** those:

```ts
const SORTABLE = { created: "created_at", priority: "priority", due: "due_date" } as const;
const column = SORTABLE[req.query.sort as keyof typeof SORTABLE] ?? "created_at";
const sql = `SELECT * FROM tasks WHERE project_id = $1 ORDER BY ${column} DESC LIMIT $2`;
```

ORMs protect you until you use their raw-query escape hatches with string interpolation.

### NoSQL injection

```js
// ✗ If the body is {"email": {"$ne": null}, "password": {"$ne": null}}, this matches the first user
db.users.findOne({ email: req.body.email, password: req.body.password });
// ✓ Validate types: email and password must be strings
```

### Command injection

```js
// ✗ filename = "x.png; rm -rf /"
exec(`convert ${req.body.filename} -resize 200x200 out.png`);

// ✓ No shell; arguments passed as an array, plus validation
execFile("convert", [safePath, "-resize", "200x200", outPath]);
```

Better still, use a library API instead of shelling out at all.

### Path traversal

```ts
const base = path.resolve("/srv/uploads");
const target = path.resolve(base, req.query.name as string);
if (!target.startsWith(base + path.sep)) return res.status(400).end();   // escaped the directory
// Better: store files under random ids and look up metadata in the database.
```

## Cross-site scripting (XSS)

XSS happens when an attacker's input is rendered as executable script in another user's browser. The script runs with your site's privileges: it can read the DOM, act as the user, and steal tokens that JavaScript can read.

- **Stored:** a comment containing `<script>…</script>` saved and shown to everyone.
- **Reflected:** a search page echoing `?q=<script>…</script>`.
- **DOM-based:** client code writing `location.hash` into `innerHTML`.

Defences:

1. **Contextual output encoding.** Modern frameworks (React, Vue, Angular, Jinja2 with autoescape, Go's `html/template`) escape by default. The danger zones are escape hatches: `dangerouslySetInnerHTML`, `v-html`, `|safe`, `innerHTML`.
2. **Sanitise** rich HTML you must accept (DOMPurify, bleach) with an allowlist of tags and attributes.
3. **Content-Security-Policy** as a second layer:
   ```http
   Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-r4nd0m'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'
   ```
4. **HttpOnly cookies** for session tokens, so injected script can't read them (it can still make requests as the user, so XSS remains critical).
5. For APIs: return `Content-Type: application/json` and `X-Content-Type-Options: nosniff`, so a JSON response can't be interpreted as HTML.

## Cross-site request forgery (CSRF)

Browsers attach cookies to requests automatically, including requests triggered by *other* sites. A malicious page can submit a form to `https://bank.example/transfer`, and the victim's session cookie goes along.

Defences, layered:

- **`SameSite=Lax`** (now the default in major browsers for cookies without the attribute) or `Strict` on session cookies blocks most cross-site sending.
- **CSRF tokens** for state-changing requests: a random token tied to the session, included in a form field or header, verified by the server (synchronizer token), or the double-submit cookie pattern.
- **Origin/Referer checks**, or the `Sec-Fetch-Site` header, to reject cross-site state-changing requests.
- Never change state with `GET`.

APIs authenticated purely with an `Authorization: Bearer` header (not cookies) aren't CSRF-able, because browsers don't attach that header automatically. That's not a reason to put tokens in `localStorage`, which XSS can read; it's one input to the trade-off.

## Server-side request forgery (SSRF)

Any feature where your server fetches a user-supplied URL (webhooks, link previews, image import, PDF rendering) can be aimed inward: at `localhost` admin ports, internal services, or the cloud metadata endpoint (`169.254.169.254`), which can hand out credentials.

```ts
import dns from "node:dns/promises";
import ipaddr from "ipaddr.js";

async function assertPublicUrl(raw: string) {
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("scheme not allowed");
  const addrs = await dns.lookup(url.hostname, { all: true });
  for (const { address } of addrs) {
    const range = ipaddr.parse(address).range();          // 'private', 'loopback', 'linkLocal', 'uniqueLocal', …
    if (range !== "unicast") throw new Error(`blocked address range: ${range}`);
  }
  return { url, addrs };
}
// Then connect to the *checked* IP (to avoid DNS rebinding between check and use),
// disable automatic redirects or re-check every hop, set timeouts and a maximum response size.
```

Infrastructure defences matter as much: enforce **IMDSv2** on AWS (session tokens defeat simple SSRF), run fetchers in a network segment with no route to internal services, and use an egress proxy with an allowlist.

## File uploads

- Enforce size limits at the proxy and the app.
- Check the actual content type by magic bytes, not the extension or the client's `Content-Type`.
- Store under a generated name, outside the web root, preferably in object storage, and never execute uploaded files.
- Serve user files from a separate domain (`usercontent.example.net`) with `Content-Disposition: attachment` where appropriate, so an uploaded HTML or SVG file can't run script on your main origin.
- Re-encode images to strip metadata and malicious payloads; scan with antivirus where your risk profile needs it.
- Beware decompression bombs (a small zip that expands to gigabytes) and XML external entities in office documents and SVGs.
- Use pre-signed upload URLs to object storage so large files bypass your app servers.

## Security headers

```http
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Cross-Origin-Opener-Policy: same-origin
```

Libraries like `helmet` (Express), `django.middleware.security` or a proxy configuration set these consistently. Check yours with securityheaders.com.

## Rate limiting and abuse protection

Unthrottled endpoints invite credential stuffing, scraping, enumeration and cost attacks (an endpoint that sends SMS or calls an LLM can run up a large bill). Rate-limit by IP, by account and by API key, with stricter limits on login, signup, password reset, OTP verification and expensive operations. See the algorithms and try them here:

<div data-viz="rate-limiter"></div>

A distributed limiter needs shared state, usually Redis with an atomic Lua script or `INCR` + `EXPIRE`. The [distributed rate limiter project](/projects/distributed-rate-limiter/) builds one.

## Security misconfiguration and secrets

- Disable debug modes, stack traces and directory listings in production.
- Change default credentials; close admin ports to the internet.
- Keep secrets out of code and images: inject them at runtime from a secrets manager (AWS Secrets Manager, GCP Secret Manager, Vault, Doppler), scope them per environment, rotate them, and scan repositories (gitleaks, GitHub push protection).
- Least-privilege database roles and cloud IAM policies.

## Vulnerable dependencies and the supply chain

- Lockfiles committed; automated updates (Dependabot, Renovate) with CI tests.
- Vulnerability scanning: `npm audit`, `pip-audit`, `govulncheck`, Trivy for container images.
- Pin GitHub Actions to commit SHAs; review new dependencies (maintainers, install scripts, popularity). Typosquatted packages are common.
- Minimal base images (distroless, Alpine, slim) reduce what can be exploited.

## Logging and monitoring failures

Log authentication events, authorisation failures, input validation failures at a security level, admin actions and configuration changes, with user id, IP and request id, and alert on anomalies (spikes in 401s or 403s, many password resets). Never log secrets, tokens or full card numbers.

## Common mistakes

- Trusting client-side validation or hidden form fields.
- Authorisation on list endpoints but not on detail, update or delete.
- Building SQL, shell commands or file paths with string concatenation.
- Rendering user HTML through escape hatches without sanitising.
- URL-fetching features with no SSRF controls.
- Secrets in Git, Docker images or logs.

## Hands-on exercise

1. Run OWASP Juice Shop locally (`docker run -p 3000:3000 bkimminich/juice-shop`). Complete at least one challenge in each of: injection, XSS, broken access control and sensitive data exposure. For each, write the root cause and the code-level fix.
2. Take an API you've built and attack it: try accessing another user's resources by changing ids, send unexpected fields (mass assignment), send oversized and malformed bodies, and fire 100 parallel requests at an endpoint with a business limit (race conditions).
3. Add `helmet` (or equivalent), a strict CSP, rate limits on login and signup, and an SSRF-safe URL fetcher with tests for `localhost`, `10.0.0.1`, `169.254.169.254` and a redirect to an internal address.
4. Write a one-page STRIDE threat model for the file-upload feature of the [file upload service project](/projects/file-upload-service/).

## Completion criteria

- You can spot injection, BOLA, mass assignment, SSRF, XSS and CSRF in a code review.
- You threat-model features before building them.
- Your services set security headers, rate-limit abuse-prone endpoints and keep secrets out of code.
