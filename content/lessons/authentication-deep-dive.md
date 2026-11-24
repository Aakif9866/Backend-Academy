---
title: "Authentication Deep Dive: Passwords, Sessions, Tokens, OAuth and OIDC"
summary: Build login properly. Argon2id hashing, session management, JWT pitfalls, refresh-token rotation, OAuth 2.0 authorization code with PKCE, OpenID Connect, MFA with TOTP and passkeys, API keys, and RBAC/ABAC in code.
difficulty: advanced
minutes: 70
prerequisites: [auth-and-security, http-deep-dive]
objectives:
  - Hash and verify passwords with Argon2id and upgrade old hashes transparently
  - Implement server-side sessions with secure cookies, rotation and revocation
  - Use JWTs safely (algorithm pinning, short expiry, audience and issuer checks) and know when not to use them
  - Implement refresh-token rotation with reuse detection
  - Walk through OAuth 2.0 authorization code + PKCE and explain what OIDC adds
  - Implement TOTP MFA, design API keys, and enforce RBAC and ABAC in services
videos:
  - id: 996OiexHze0
    title: OAuth 2.0 and OpenID Connect (in plain English)
    channel: OktaDev
    why: The most widely recommended explanation of OAuth flows and why OIDC exists. Watch before the OAuth section.
  - id: P2CPd9ynFLg
    title: Why is JWT popular?
    channel: ByteByteGo
    why: A short visual of JWT structure and signing, to pair with the pitfalls section.
  - id: b4b8ktEV4Bg
    title: Hashing Algorithms and Security - Computerphile
    channel: Computerphile
    why: What cryptographic hash functions are, and why general-purpose hashes are wrong for passwords.
resources:
  - url: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
    title: OWASP Authentication Cheat Sheet
    why: Login flows, error messages, account lockout, password policies and more, maintained by OWASP.
  - url: https://pages.nist.gov/800-63-4/sp800-63b.html
    title: "NIST SP 800-63B: Authentication and Authenticator Management"
    why: The US government's guidance on passwords (length over complexity, no forced rotation, breach checks) and MFA.
  - url: https://datatracker.ietf.org/doc/html/rfc9700
    title: "RFC 9700: OAuth 2.0 Security Best Current Practice"
    why: Current IETF guidance, including PKCE for all clients, no implicit flow, and refresh token protection.
  - url: https://openid.net/specs/openid-connect-core-1_0.html
    title: OpenID Connect Core 1.0
    why: The specification for ID tokens, claims and the UserInfo endpoint.
  - url: https://www.rfc-editor.org/rfc/rfc8725.html
    title: "RFC 8725: JSON Web Token Best Current Practices"
    why: The IETF list of JWT pitfalls (alg confusion, missing audience checks) and how to avoid them.
  - url: https://webauthn.guide/
    title: WebAuthn Guide
    why: A readable introduction to passkeys and public-key authentication in browsers.
quiz:
  - type: mcq
    q: Why are SHA-256 hashes (even salted) a poor choice for storing passwords?
    options: ["SHA-256 is broken", "It's designed to be fast, so attackers with GPUs can try billions of guesses per second; password hashes must be deliberately slow and memory-hard", "It produces short outputs", "It can't be salted"]
    answer: 1
    explain: "General-purpose hashes are optimised for speed. Argon2id, scrypt and bcrypt are tunably slow (and Argon2id/scrypt are memory-hard), making offline guessing far more expensive."
  - type: code
    q: What's the vulnerability in this JWT verification?
    code: |
      const header = JSON.parse(base64url.decode(token.split('.')[0]));
      const payload = jwt.verify(token, publicKeyOrSecret, { algorithms: [header.alg] });
    options: ["None", "Trusting the token's own alg header: an attacker can pick 'none' or switch RS256 to HS256 and sign with the public key as an HMAC secret", "Base64 is insecure", "JWTs can't be verified in Node"]
    answer: 1
    explain: "The verifier must pin the algorithm it expects (algorithms: ['RS256']). Letting the token choose enables algorithm confusion attacks. Also verify iss, aud and exp."
  - type: scenario
    q: A refresh token that was already rotated (used once) is presented again. What should the server do?
    options: ["Accept it; it's still valid", "Treat it as theft: revoke the whole token family (all sessions from that login) and require re-authentication", "Return a new access token but log a warning", "Ignore the request"]
    answer: 1
    explain: "With rotation, each refresh token is single-use. Reuse means two parties hold it, so either the legitimate user or an attacker has a stolen copy. Revoking the family stops the attacker."
  - type: mcq
    q: In the OAuth authorization code flow with PKCE, what prevents an attacker who intercepts the authorization code from exchanging it?
    options: ["The state parameter", "The code_verifier: only the client that generated the code_challenge knows the secret needed at the token endpoint", "HTTPS alone", "The redirect URI"]
    answer: 1
    explain: "The client sends a hash (code_challenge) up front and the original random code_verifier when redeeming. An intercepted code is useless without the verifier. state separately protects against CSRF on the callback."
  - type: tf
    q: OAuth 2.0 by itself tells your application who the user is.
    answer: 1
    explain: "False. OAuth 2.0 is for delegated authorisation (an access token to call an API). OpenID Connect adds authentication: a signed ID token with the user's identity (sub, iss, aud) that your app must validate."
  - type: mcq
    q: How should API keys be stored on the server?
    options: ["In plaintext so they can be shown again", "Store only a hash (for example SHA-256 of a high-entropy key), plus a short prefix for identification; show the full key once at creation", "Encrypted with the user's password", "In a cookie"]
    answer: 1
    explain: "Keys are random and high-entropy, so a fast hash is fine (unlike passwords). If the database leaks, the keys can't be used. A visible prefix (sk_live_ab12…) helps users identify and revoke keys."
---

## Why it matters

Authentication is the front door. Getting it wrong means account takeovers, credential stuffing, leaked password databases and stolen sessions. It's also full of subtle traps that look fine in a demo. The good news is that the correct patterns are well established. This lesson walks through each building block with code you can adapt.

**First, consider not building it.** Managed identity providers (Auth0, Clerk, Cognito, Firebase Auth, Supabase Auth, Keycloak if self-hosted) handle passwords, MFA, social login, breach detection and account recovery. Build it yourself to learn, or when you have a specific reason, and when you do, follow this lesson closely.

## Passwords

### Hashing with Argon2id

Store only a slow, salted, memory-hard hash. Argon2id is OWASP's first recommendation; scrypt and bcrypt are acceptable alternatives (bcrypt silently truncates input at 72 bytes).

```ts
import argon2 from "argon2";

// OWASP's minimum suggested Argon2id settings: 19 MiB memory, 2 iterations, 1 degree of parallelism.
// Tune so one hash takes on the order of tens to hundreds of ms on your hardware, and re-measure as hardware changes.
const OPTS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };

export const hashPassword = (pw: string) => argon2.hash(pw, OPTS);   // salt is generated and embedded

export async function verifyPassword(stored: string, pw: string) {
  const ok = await argon2.verify(stored, pw);                         // constant-time comparison
  const needsRehash = ok && argon2.needsRehash(stored, OPTS);          // parameters changed since it was stored
  return { ok, needsRehash };
}
```

The stored string encodes the algorithm, parameters and salt (`$argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash>`), so you can raise the cost later and **rehash on next successful login**. The same trick migrates legacy MD5 or SHA-1 hashes: wrap them (`argon2(sha1(pw))`) immediately, then replace with a direct Argon2 hash at each login.

### Password policy (NIST SP 800-63B)

- Minimum length (at least 8 characters, preferably longer for passwords chosen by users); allow long passphrases (64+) and any characters.
- **Check against known breached passwords** (the Have I Been Pwned range API uses k-anonymity, so you never send the full hash).
- No composition rules ("one symbol, one uppercase") and no forced periodic rotation; they push users toward predictable patterns.

### Login flow defences

```ts
async function login(email: string, password: string, ip: string) {
  await rateLimit(`login:ip:${ip}`, 20, "10m");          // slow down credential stuffing per IP
  await rateLimit(`login:email:${email}`, 5, "15m");     // and per account
  const user = await users.findByEmail(email);
  // Verify against a dummy hash when the user doesn't exist, so response timing doesn't reveal valid emails.
  const { ok, needsRehash } = await verifyPassword(user?.passwordHash ?? DUMMY_HASH, password);
  if (!user || !ok) {
    await audit("login.failed", { email, ip });
    throw new UnauthorizedError("Invalid email or password");   // same message either way
  }
  if (needsRehash) await users.setPasswordHash(user.id, await hashPassword(password));
  return user;
}
```

Prefer progressive delays, CAPTCHAs after repeated failures, and alerts over hard lockouts, which let attackers lock victims out on purpose.

## Sessions

A server-side session stores state on the server and gives the browser only an unguessable identifier.

```sql
create table sessions (
  id_hash      bytea primary key,         -- SHA-256 of the session token; the raw token only lives in the cookie
  user_id      uuid not null references users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at   timestamptz not null,
  ip           inet,
  user_agent   text,
  mfa_passed   boolean not null default false
);
```

```ts
import { randomBytes, createHash } from "node:crypto";
const sha256 = (s: string) => createHash("sha256").update(s).digest();

export async function createSession(res: Response, userId: string) {
  const token = randomBytes(32).toString("base64url");                 // 256 bits of entropy
  await db.query("insert into sessions (id_hash, user_id, expires_at) values ($1, $2, now() + interval '14 days')", [sha256(token), userId]);
  res.cookie("sid", token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 14 * 864e5 });
}

export async function loadSession(token?: string) {
  if (!token) return null;
  const { rows } = await db.query(
    "update sessions set last_seen_at = now() where id_hash = $1 and expires_at > now() returning user_id, mfa_passed",
    [sha256(token)],
  );
  return rows[0] ?? null;
}
```

Session rules:

- **Rotate the session id on login and privilege change** (prevents session fixation).
- Use **idle** and **absolute** timeouts.
- Logout deletes the server row. A "log out everywhere" button deletes all of a user's rows.
- Hash tokens at rest, so a database leak doesn't hand out live sessions.
- Store sessions in Postgres or Redis. Redis with TTLs is common at scale.

## JWTs: useful, frequently misused

A JWT is `base64url(header).base64url(payload).signature`. The payload is **signed, not encrypted**: anyone can read it.

```json
{ "alg": "RS256", "kid": "2026-11" }
{ "iss": "https://auth.example.com", "sub": "user_42", "aud": "api.example.com",
  "exp": 1794301200, "iat": 1794300300, "scope": "tasks:read tasks:write" }
```

Verification checklist:

```ts
import { jwtVerify, createRemoteJWKSet } from "jose";
const JWKS = createRemoteJWKSet(new URL("https://auth.example.com/.well-known/jwks.json"));

const { payload } = await jwtVerify(token, JWKS, {
  algorithms: ["RS256"],                  // pin the algorithm; never trust the header's alg
  issuer: "https://auth.example.com",     // who issued it
  audience: "api.example.com",            // that it was meant for *this* API
  clockTolerance: 30,                     // seconds of clock skew allowed for exp/nbf
});
```

**When JWTs fit:** short-lived access tokens checked by many services without a central lookup, and service-to-service tokens. **When they don't:** as long-lived browser sessions, because you can't revoke a stateless token before it expires. The pragmatic design is short-lived access tokens (5–15 minutes) plus revocable refresh tokens.

Pitfalls: `alg: none` acceptance; RS256/HS256 confusion; missing `aud` checks (a token for service A accepted by service B); storing sensitive data in the payload; giant tokens in every request; and putting tokens in `localStorage`, where any XSS can read them.

## Refresh tokens with rotation and reuse detection

```mermaid
sequenceDiagram
  participant C as Client
  participant A as Auth server
  C->>A: POST /token (refresh_token = R1)
  A->>A: R1 valid & unused → mark R1 used, issue R2 (same family)
  A-->>C: access_token (15 min) + refresh_token R2
  Note over C,A: Later, an attacker replays the stolen R1
  C->>A: POST /token (refresh_token = R1)
  A->>A: R1 already used → REUSE DETECTED
  A->>A: revoke entire family (R2, R3…)
  A-->>C: 401 — user must sign in again
```

```sql
create table refresh_tokens (
  id_hash     bytea primary key,
  family_id   uuid not null,            -- all tokens descended from one login
  user_id     uuid not null,
  used_at     timestamptz,
  revoked_at  timestamptz,
  expires_at  timestamptz not null
);
```

On refresh: inside a transaction, look up the token's hash with `FOR UPDATE`. If it's revoked or expired, return 401. If `used_at` is already set, revoke every token in the family and return 401. Otherwise mark it used and insert a new token in the same family. For browsers, deliver refresh tokens in an `HttpOnly; Secure; SameSite=Strict` cookie scoped to the refresh path.

## OAuth 2.0 and OpenID Connect

**OAuth 2.0** lets a user grant an application limited access to their resources on another service without sharing their password ("let this app read my Google Calendar"). **OpenID Connect (OIDC)** is a layer on top that adds *authentication*: a signed **ID token** saying who the user is ("Sign in with Google").

The roles: **resource owner** (the user), **client** (your app), **authorization server** (Google, Okta, your IdP), **resource server** (the API holding the data).

### Authorization code flow with PKCE

The recommended flow for web, mobile and single-page apps (RFC 9700 says to use PKCE for all clients; the implicit flow is deprecated):

```mermaid
sequenceDiagram
  participant U as User's browser
  participant App as Your app (client)
  participant AS as Authorization server
  App->>App: code_verifier = random(32 bytes)<br/>code_challenge = BASE64URL(SHA256(verifier))<br/>state = random, nonce = random
  App->>U: 302 to AS /authorize?response_type=code&client_id=…&redirect_uri=…&scope=openid email&state=…&nonce=…&code_challenge=…&code_challenge_method=S256
  U->>AS: Login + consent
  AS->>U: 302 to redirect_uri?code=AUTH_CODE&state=…
  U->>App: GET /callback?code=…&state=…
  App->>App: check state matches (CSRF protection)
  App->>AS: POST /token (code, code_verifier, redirect_uri, client auth)
  AS->>AS: verify SHA256(code_verifier) == code_challenge
  AS-->>App: access_token, id_token (+ refresh_token)
  App->>App: validate id_token (signature, iss, aud = client_id, exp, nonce)
  App->>App: find or create the user by (iss, sub), then start a session
```

Validation details that matter:

- **`state`** must match what you stored, which prevents login CSRF.
- **`nonce`** in the ID token must match, which prevents token replay.
- Identify users by **`iss` + `sub`**, never by email alone: emails can change or be unverified at some providers. Link accounts by email only if `email_verified` is true and you trust that provider.
- Register exact redirect URIs; never allow open redirects.
- Confidential (server-side) clients authenticate at the token endpoint with a client secret or private key JWT. Public clients (SPAs, mobile) can't keep secrets, which is exactly why PKCE matters.

Other grant types: **client credentials** (machine-to-machine, no user), **device authorization** (TVs and CLIs), **refresh token**. The resource-owner password grant is deprecated.

A common modern architecture for SPAs is the **backend-for-frontend (BFF)**: the server does the OAuth flow, keeps tokens server-side, and gives the browser only an HttpOnly session cookie.

## Multi-factor authentication

### TOTP (authenticator apps)

TOTP (RFC 6238) computes a 6-digit code from a shared secret and the current 30-second time step: `HOTP(secret, floor(unixTime / 30))`.

```ts
import { authenticator } from "otplib";

// Enrolment: generate a secret, show it as a QR code (otpauth:// URI), confirm with a first code before enabling.
const secret = authenticator.generateSecret();                       // store encrypted at rest
const uri = authenticator.keyuri(user.email, "Backend Academy", secret);

// Verification: allow one step of clock drift, and reject reuse of the same code within its window.
authenticator.options = { window: 1 };
const valid = authenticator.verify({ token: submittedCode, secret });
```

Also: issue single-use **recovery codes** (store them hashed), rate-limit code attempts, mark the session `mfa_passed` only after verification, and require re-authentication for sensitive actions.

### Passkeys (WebAuthn)

Passkeys replace passwords with a public/private key pair held on the user's device. The server stores only the public key and verifies signed challenges. They are **phishing-resistant** because the browser binds each credential to your origin, so a lookalike domain can't use it. SMS codes are the weakest factor (SIM-swap attacks); prefer passkeys or TOTP.

## API keys

For server-to-server access by your customers:

```ts
// Format: visible prefix + random secret. The full key is shown once at creation.
const secret = randomBytes(24).toString("base64url");
const key = `sk_live_${secret}`;
await db.query(
  "insert into api_keys (prefix, key_hash, owner_id, scopes, expires_at) values ($1, $2, $3, $4, $5)",
  [key.slice(0, 12), sha256(key), ownerId, ["orders:read"], expiresAt],
);
```

Keys are high-entropy, so a fast SHA-256 is appropriate (unlike passwords, which need slow hashing). Support scopes, expiry, rotation (two active keys during changeover), last-used timestamps and instant revocation. Enable secret scanning so leaked keys in public repos are caught (GitHub's partner program can notify you).

## Authorisation: RBAC, ABAC and ReBAC

Authentication answers *who*; authorisation answers *may they do this to that resource*.

| Model | Rule shape | Good for |
| --- | --- | --- |
| **RBAC** (role-based) | "Admins can delete projects" | Most business apps; roles map to permissions |
| **ABAC** (attribute-based) | "Managers can approve expenses under ₹50,000 in their own department during business hours" | Rules depending on resource, user and context attributes |
| **ReBAC** (relationship-based) | "Viewers of a folder can view its documents" | Sharing models like Google Drive (Zanzibar-style systems: OpenFGA, SpiceDB) |

Centralise checks in one module so they're consistent and testable:

```ts
type Action = "project:read" | "project:update" | "project:delete" | "task:assign";
const ROLE_PERMISSIONS: Record<Role, Action[]> = {
  viewer: ["project:read"],
  member: ["project:read", "task:assign"],
  admin: ["project:read", "project:update", "project:delete", "task:assign"],
};

export function can(user: User, action: Action, project: Project): boolean {
  if (project.orgId !== user.orgId) return false;                         // tenant isolation first, always
  const membership = project.members.find((m) => m.userId === user.id);
  if (!membership) return false;
  if (!ROLE_PERMISSIONS[membership.role].includes(action)) return false;
  if (action === "project:delete" && project.status === "archived-legal-hold") return false; // attribute rule
  return true;
}
// In a service:
if (!can(user, "project:delete", project)) throw new NotFoundError("project", project.id);
```

Enforce on the server for **every** request, scope queries by tenant and owner (`WHERE org_id = $1`), and consider Postgres **row-level security** as a second layer. Most real breaches in APIs are broken object-level authorisation: the check exists for the list endpoint but was forgotten on `GET /things/{id}`.

## Common mistakes

- Fast hashes (MD5, SHA-*) for passwords, or rolling your own crypto.
- Different error messages or timing for "no such user" vs "wrong password".
- Long-lived JWTs in `localStorage` with no revocation.
- Accepting the JWT's `alg` header; skipping `aud`/`iss` checks.
- OAuth without `state` or PKCE; identifying users by email from any provider.
- MFA that can be bypassed by calling the API directly before the MFA step completes.
- Authorisation checks only in the UI or only on some endpoints.

## Security considerations

This entire lesson is security. Add audit logs for logins, MFA changes, password resets, key creation and permission changes; notify users of new-device logins and credential changes; and make password reset tokens single-use, short-lived (around 15–60 minutes) and hashed at rest.

## Performance considerations

- Argon2 is deliberately expensive: size your login service for it, and rate-limit so attackers can't use it to exhaust your CPU.
- Session lookups on every request should hit Redis or an indexed table. Cache JWKS keys rather than fetching per request.

## Hands-on exercise

Build the [authentication service project](/projects/auth-service/), or at minimum:

1. Register and login with Argon2id, with rehash-on-login when parameters change.
2. Server-side sessions with secure cookies, rotation on login, and "log out everywhere".
3. Short-lived JWT access tokens plus rotating refresh tokens with reuse detection. Write a test that replays an old refresh token and asserts the whole family is revoked.
4. TOTP enrolment and verification with recovery codes.
5. "Sign in with GitHub or Google" using authorization code + PKCE, validating `state`, `nonce` and the ID token.
6. An RBAC `can()` function with tests for cross-tenant access.

## Completion criteria

- You can implement password storage, sessions and token refresh correctly and explain each defence.
- You can draw the OAuth code + PKCE flow from memory and say what each parameter protects against.
- Every protected operation in your code goes through one authorisation function.
