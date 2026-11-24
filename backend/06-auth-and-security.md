# Part 6: Auth and security

## Two different questions

- **Authentication (authn):** *who are you?* Logging in.
- **Authorisation (authz):** *what are you allowed to do?* "Can this user edit this workout?"

Most security bugs are authorisation bugs: the login works, but the server forgets to check *whose* data it's returning.

## Storing passwords

Never store a password as written. Store a **hash**: a one-way scramble.

- Use a **slow** hash made for passwords: **Argon2id**, **bcrypt** or **scrypt**. Never MD5 or SHA-256 on their own; they're too fast, so attackers can try billions of guesses a second.
- A **salt** (random extra data per user) means two people with the password `hello123` get different hashes.

```js
const hash = await bcrypt.hash(password, 12);      // on sign-up
const ok = await bcrypt.compare(attempt, hash);    // on login
```

In PLOS, Supabase Auth does this for us (it uses bcrypt).

## Sessions vs JWT

After login, the server must remember you on later requests. Two main ways:

### Server sessions

1. Login succeeds. The server creates a random id `abc123` and saves `abc123 → user 42` in a database or Redis.
2. It sends a cookie: `session=abc123`.
3. Each request: look up `abc123`, find user 42.

- **Good:** log someone out instantly by deleting the row. Small cookie.
- **Bad:** one lookup per request; the session store must be shared by all servers.

### JWT (JSON Web Token)

1. Login succeeds. The server builds a token: `{ sub: 42, exp: 10:15 }` + a signature only it can make.
2. It sends the token (in a cookie or in the `Authorization: Bearer ...` header).
3. Each request: check the signature. No database lookup.

```
eyJhbGciOi...   .   eyJzdWIiOiI0MiIsImV4cCI6...   .   SflKxwRJSMeKKF2QT4f...
   header              payload (readable by anyone!)         signature
```

- **Good:** no lookup; any server (or Supabase's database) can verify it.
- **Bad:** hard to cancel before it expires. Fix: short-lived access tokens (minutes) + a refresh token that *can* be cancelled.
- **The payload is not secret.** Anyone can decode it. Never put passwords or private data in it.

**PLOS uses JWTs from Supabase**, stored in an `httpOnly` cookie, refreshed by `src/proxy.ts`. Postgres reads the JWT directly in RLS rules (`auth.uid()`, `auth.jwt() ->> 'aal'`).

### Where to keep the token in the browser

| Place | Risk |
| --- | --- |
| `localStorage` | Any script on the page (including an injected one, see XSS) can read it |
| `httpOnly` cookie | Scripts can't read it. Needs CSRF protection (see below). **Preferred.** |

## OAuth and "Sign in with Google"

**OAuth 2.0** lets a user give your app limited access to another account without sharing their password. **OpenID Connect (OIDC)** sits on top and adds "and here's who they are".

Flow, simplified:

1. User clicks "Sign in with Google". You send them to Google.
2. They log in at Google and approve.
3. Google sends them back with a one-time **code**.
4. Your server swaps the code (plus your secret) for tokens.
5. You now know their email and Google id.

Use **PKCE** for browser and mobile apps. Libraries do all of this: Supabase Auth, Auth.js, Clerk, Better Auth, Firebase Auth.

## Two-step login (MFA)

Something you **know** (password) + something you **have** (phone app code, security key).

- **TOTP:** the 6-digit codes from an authenticator app. PLOS uses this.
- **Passkeys / WebAuthn:** a fingerprint or Face ID on the device. Strongest and easiest for users.
- **SMS codes:** better than nothing, but SIM-swap attacks exist.

PLOS's `private.is_owner()` requires `aal2` (two-step done) whenever a two-step factor is set up, so a stolen password alone can't read anything.

## Authorisation models

| Model | Idea | Example |
| --- | --- | --- |
| **Ownership** | You can touch rows you own | `where user_id = me` (PLOS) |
| **RBAC** (role-based) | Users have roles; roles have permissions | `admin` can delete, `editor` can edit, `viewer` can read |
| **ABAC** (attribute-based) | Rules over attributes | "Doctors can read records of patients in their own hospital during their shift" |
| **ReBAC** (relationship-based) | Access follows relationships | Google Drive: you can edit because the folder was shared with your team |

### Where to enforce it

- **In application code:** every query adds `where user_id = $1`. Easy to forget once, and then you have a data leak.
- **In the database (RLS):** Postgres adds the rule to every query automatically. PLOS does this, so even a buggy query can't leak.
- Best: both, so one mistake doesn't expose data.

## The common attacks (OWASP Top 10, simplified)

| Attack | What happens | Defence |
| --- | --- | --- |
| **Broken access control** | `GET /workouts/w2` returns someone else's workout because nobody checked the owner | Check ownership on every request; RLS |
| **SQL injection** | Input `'; DROP TABLE users; --` gets glued into SQL | Parameterised queries (`$1`), ORMs; never build SQL with string joining |
| **XSS** (cross-site scripting) | An attacker's `<script>` gets shown on your page and runs in other people's browsers | Escape output (React does by default), avoid `dangerouslySetInnerHTML`, a Content Security Policy |
| **CSRF** (cross-site request forgery) | Another site makes your logged-in browser submit a form to your app | `SameSite` cookies (PLOS uses `lax`), CSRF tokens; Server Actions check the origin |
| **Broken auth** | Weak passwords, no rate limit, tokens that never expire | Rate limits (PLOS: 8 login tries per window), MFA, short-lived tokens |
| **Sensitive data exposure** | Secrets in the frontend bundle, personal data in logs | Keep keys server-side; log ids, not data (PLOS's `defineAction` logs only the error name) |
| **SSRF** | Your server is tricked into fetching internal URLs | Allow-list outbound URLs |
| **Vulnerable dependencies** | An npm package has a known hole | `pnpm audit`, Dependabot, keep things updated |
| **Security misconfiguration** | Debug mode on in production, open storage buckets | Checklists, secure defaults |
| **Mass assignment** | The client sends `{ "isAdmin": true }` and the server saves the whole body | Validate with a schema and only accept known fields (Zod in PLOS) |

## Secrets

- Keep secrets in environment variables, never in git. Commit a `.env.example` with empty values (PLOS does).
- Two kinds of key:
  - **Public:** fine in the browser because the server still checks rules (Supabase publishable key, Stripe publishable key).
  - **Secret:** full power (Supabase secret key, Stripe secret key, database password). Server only.
- In Next.js, anything named `NEXT_PUBLIC_*` ends up in the browser bundle. PLOS has none for Supabase.
- If a secret leaks: **rotate it first**, investigate second.

## Other must-knows

- **HTTPS everywhere.** Vercel and most hosts do it automatically.
- **CORS:** tells browsers which other websites may call your API. It protects users, not your server: curl ignores it. Don't set `*` on an API that uses cookies.
- **Rate limiting:** protects login, signup, password reset and expensive endpoints ([Part 8](08-system-design-async.md)).
- **Validate on the server**, always. Client checks are for user experience only; anyone can bypass them.
- **Least privilege:** each part gets only the access it needs. PLOS's app never sees the secret key.
- **Audit logs:** record who did what, and when. PLOS writes one for every change, and the log itself can't be changed.
