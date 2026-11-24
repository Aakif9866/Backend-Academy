# Part 9: Hosting and deployment

## Three ways to run backend code

### 1. A long-running server ("always on")

Your app starts once and keeps running, listening on a port. Express, Django, Spring.

```
08:00 start ───────────────────────────────────────────── running ────────▶
          req   req      req  req req              req
```

- **Good:** WebSockets, background workers, in-memory caches, no cold starts, predictable cost.
- **Bad:** you pay while it's idle; you handle scaling (or the platform does); someone must keep it up.
- **Hosts:** Render, Railway, Fly.io, DigitalOcean, AWS EC2, a VPS (Hetzner, Hostinger).

### 2. Serverless functions

Code runs only when a request comes in, then stops. The platform runs as many copies as needed.

```
          req→[run]   req→[run]   [run][run][run]← spike      (nothing running, nothing billed)
```

- **Good:** scales to zero (cheap when idle) and to thousands automatically; no servers to manage.
- **Bad:** **cold starts** (first request after idle is slower), time limits, no persistent connections (WebSockets), no local disk, database connection limits.
- **Hosts:** Vercel, Netlify, AWS Lambda, Google Cloud Run (container-based, can scale to zero), Cloudflare Workers.

### 3. Containers

Package your app and everything it needs into an image (**Docker**). It runs the same on your laptop and in production.

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
CMD ["node", "server.js"]
```

- Run one on Render, Railway, Fly or Cloud Run.
- Run many with **Kubernetes** (k8s): automatic restarts, scaling, rolling deploys. Powerful, and heavy. Usually only worth it for a larger team with a platform engineer.

### Edge functions

Serverless functions that run in many cities, close to the user (Cloudflare Workers, Vercel Edge). Start in about 0–5 ms. Limited APIs (not full Node.js). Great for redirects, auth checks, A/B tests and personalisation. Less great if your database is in one region anyway; the function is near the user but far from the data.

## Comparing the hosts

| Host | Model | Free tier | Sleeps? | Good for |
| --- | --- | --- | --- | --- |
| **Vercel** | Serverless + edge | Yes (hobby, personal use) | Cold starts about 0.1–1 s | Next.js, frontends, serverless APIs |
| **Netlify** | Serverless | Yes | Cold starts | Static sites, Jamstack |
| **Render** | Always-on servers, workers, cron, Postgres | Yes | **Free web services sleep after about 15 minutes idle; waking takes about a minute.** Paid (about $7/month) stays on | Express/Django APIs, workers |
| **Railway** | Servers/containers, usage-based | Trial credit | No (paid) | Quick deploys of anything, databases included |
| **Fly.io** | Containers near users, many regions | Small allowance | Can auto-stop and start | Global apps, WebSockets |
| **Cloudflare Workers** | Edge functions | Generous | Almost no cold start | Edge APIs, Hono |
| **AWS (Lambda, ECS, EC2)** | Everything | 12-month and always-free parts | Depends | Full control, big companies |
| **Google Cloud Run** | Containers, scale to zero | Yes | Cold starts | Containers without the Kubernetes hassle |
| **A VPS (Hetzner, DigitalOcean)** | A Linux machine you manage | No | Never | Cheapest always-on; you handle everything |

**Your Render pain, explained:** the free tier *sleeps* the server to save Render money. The fix is a paid plan, not a different design. (Pinging it every 10 minutes to keep it awake works but goes against the spirit of the free tier.)

## Where MERN fits

| Part | Easy host |
| --- | --- |
| React (built static files) | Vercel, Netlify, Cloudflare Pages |
| Express API | Render, Railway, Fly (always on), or Vercel as a function with connection caching |
| MongoDB | MongoDB Atlas |

On Vercel, cache the Mongo connection across warm calls:

```js
let cached = global._mongo;
export async function db() {
  if (!cached) cached = global._mongo = await MongoClient.connect(process.env.MONGODB_URI);
  return cached.db();
}
```

## Deployment basics

### Environments

- **Local:** your laptop (PLOS: `pnpm dev` + `pnpm db:start`).
- **Preview / staging:** a copy for testing. Vercel makes one per pull request automatically.
- **Production:** the real thing.

Each has its own database and secrets. Never test on production data.

### CI/CD

- **CI (continuous integration):** on every push, run lint, type-check and tests automatically (GitHub Actions).
- **CD (continuous delivery/deployment):** if CI passes, deploy automatically. Vercel deploys `main` to production and every branch to a preview.

### Deploy strategies

| Strategy | How | Why |
| --- | --- | --- |
| **Recreate** | Stop old, start new | Simple; has downtime |
| **Rolling** | Replace servers one at a time | No downtime; old and new run together for a while |
| **Blue-green** | Run the new version beside the old, then switch all traffic | Instant rollback by switching back |
| **Canary** | Send 5% of traffic to the new version, watch, then increase | Catch bugs before everyone sees them |
| **Feature flags** | Ship the code turned off; switch it on for some users | Separate "deployed" from "released" |

Vercel does a form of blue-green: the new build goes live atomically, and "Instant Rollback" points back to the previous build.

### Database migrations without downtime

Code and schema change at different moments. Use **expand → migrate → contract**:

1. **Expand:** add the new column (nullable). Old code still works.
2. **Deploy code** that writes both old and new columns and reads the new one.
3. **Backfill** old rows.
4. **Contract:** once nothing uses the old column, remove it in a later migration.

Never rename or drop a column in the same deploy that stops using it.

## Cost thinking

- Serverless is cheapest at low or spiky traffic, and can become expensive at constant high traffic.
- Always-on servers are cheapest at steady, high traffic.
- Watch **egress** (data sent out). Many clouds charge for it, and it adds up with video or big files.
- Managed services cost more than doing it yourself and save a lot of your time. For a small team, your time is the expensive part.
- Set **spend alerts** on every cloud account.

## PLOS's hosting, in these terms

- **App:** serverless on Vercel (Mumbai region), with preview deploys per branch.
- **Database + auth:** managed by Supabase (Mumbai), the same region as the app, so queries stay quick.
- **No always-on server**, so nothing to babysit. That works because every task is a short request and reply.
- **When that would change:** long imports, scheduled reminders, or sockets you run yourself → add a serverless job service or a small Render/Railway worker.
