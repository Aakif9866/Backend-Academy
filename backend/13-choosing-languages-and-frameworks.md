# Part 13: Choosing a backend language and framework

This part goes deeper than [Part 4](04-backend-frameworks.md). Part 4 showed *what each framework looks like*. This part is about *judgment*: how each one behaves under load, what it's good and bad at, and how to choose based on requirements.

## Contents

1. [First, two kinds of work: I/O-bound and CPU-bound](#1-first-two-kinds-of-work-io-bound-and-cpu-bound)
2. [How each language handles many requests at once](#2-how-each-language-handles-many-requests-at-once)
3. [Node.js: Express, Fastify, NestJS](#3-nodejs-express-fastify-nestjs)
4. [Python: FastAPI, Django, Flask](#4-python-fastapi-django-flask)
5. [Java: Spring Boot](#5-java-spring-boot)
6. [Go: Gin, Fiber](#6-go-gin-fiber)
7. [C#: ASP.NET Core](#7-c-aspnet-core)
8. [Rust: Axum, Actix Web](#8-rust-axum-actix-web)
9. [Side-by-side summary](#9-side-by-side-summary)
10. [How to actually decide](#10-how-to-actually-decide)

---

## 1. First, two kinds of work: I/O-bound and CPU-bound

Every backend task is mostly one of these:

| Kind | What the server is doing | Examples |
| --- | --- | --- |
| **I/O-bound** | *Waiting*: for the database, another API, a file, the network | CRUD APIs, login, reading a feed, calling Stripe, most web backends |
| **CPU-bound** | *Calculating*: the processor is busy the whole time | Resizing images, video encoding, PDF generation, encryption at scale, data crunching, running ML models |

**Why this matters:** a typical API request spends 90%+ of its time waiting on I/O. For that, what matters is how cheaply a language can *wait on thousands of things at once*. For CPU work, what matters is raw speed and using all CPU cores.

```
I/O-bound request (most APIs):
[parse 1ms][ wait for DB ......... 40ms ][ build JSON 1ms ]   ← CPU busy only ~5%

CPU-bound request (image resize):
[ resize ███████████████████████████ 300ms ]                  ← CPU busy 100%
```

## 2. How each language handles many requests at once

| Language | Model | In plain words | Good for | Watch out |
| --- | --- | --- | --- | --- |
| **Node.js** | Single-threaded event loop + async I/O | One worker who never waits: starts a DB call, moves to the next request, comes back when the DB answers | Lots of I/O, many connections | One slow calculation blocks *everyone*. Use `worker_threads` or a separate service for CPU work |
| **Python** | GIL + `asyncio` (async) or many processes | Only one thread runs Python code at a time per process (the GIL). Async helps waiting; processes help calculating | I/O with async (FastAPI); CPU via multiple processes or C libraries (NumPy) | Mixing sync and async code wrongly blocks the loop. Free-threaded (no-GIL) builds exist from Python 3.13 but aren't the default yet |
| **Java** | OS threads; **virtual threads** since Java 21 | Classic: one thread per request (threads are costly). Virtual threads make threads cheap, so millions are possible | Both I/O and CPU; huge, long-running systems | Higher memory use; slower start (fixable with GraalVM native images) |
| **Go** | **Goroutines** on a scheduler over all cores | Very cheap "mini-threads" (a few KB each). Write normal blocking code; Go makes it concurrent | Both I/O and CPU; high concurrency with simple code | Garbage collector pauses (usually tiny); less "magic" means more code to write |
| **C#** | `async`/`await` on a thread pool | Like Node's async style but using all cores | Both I/O and CPU; enterprise | Ecosystem tied more to Microsoft tooling (though fully cross-platform now) |
| **Rust** | `async` on a runtime (usually Tokio), no garbage collector | Fastest and most predictable; the compiler blocks whole classes of memory and data-race bugs | Extreme performance, low memory, no GC pauses | Steep learning curve, slower to write |

### The Node.js "blocked event loop" trap, shown

```js
app.get("/report", (req, res) => {
  const result = computeHugeReport(); // takes 3 seconds of CPU
  res.json(result);
});
// For those 3 seconds, EVERY other user's request waits. Even /health.
```

Fixes: move the work to a `worker_thread`, a job queue ([Part 16](16-messaging-and-background-jobs.md)), or a service written in a language suited to CPU work.

### The Python "sync inside async" trap, shown

```python
@app.get("/user")
async def get_user():
    time.sleep(2)              # ❌ blocks the event loop for every request
    requests.get(SLOW_URL)     # ❌ also blocking
    await asyncio.sleep(2)     # ✅ yields while waiting
    async with httpx.AsyncClient() as c:
        await c.get(SLOW_URL)  # ✅ async HTTP client
```

In FastAPI, a plain `def` endpoint (not `async def`) is run in a thread pool, which is safe for blocking libraries. The mistake is calling blocking code inside `async def`.

---

## 3. Node.js: Express, Fastify, NestJS

**Language strengths:** one language for frontend and backend; npm has a package for everything; great for JSON APIs and real-time; fast to write.

**Language weaknesses:** CPU-heavy work; npm supply-chain risk (many tiny dependencies); JavaScript's loose typing (use TypeScript).

| | Express | Fastify | NestJS |
| --- | --- | --- | --- |
| Philosophy | Minimal, unopinionated | Minimal, fast, schema-first | Opinionated structure (modules, controllers, services, dependency injection) |
| Performance | Fine | Among the fastest Node frameworks | Depends on its adapter (Express or Fastify) |
| Validation | Bring your own (Zod, Joi) | Built-in JSON Schema | `class-validator` DTOs |
| Learning curve | Lowest | Low | Medium–high (decorators, DI) |
| Maintainability at scale | Depends entirely on the team's discipline | Good, plugin system | Very good; everyone's code looks the same |
| Industry use | Everywhere; most tutorials | Newer services that care about speed | Enterprise Node teams, large codebases |

**Good choice when:** I/O-heavy APIs, real-time apps (chat, notifications), BFFs (backend-for-frontend), teams that already write TypeScript, serverless functions.

**Poor choice when:** heavy CPU work (video, ML training, big number crunching), or teams that need very strict, compiler-enforced correctness (Go, Java, C# or Rust help more).

**Pick between them:**
- Small/medium API, team knows Express → **Express** (v5 handles async errors properly).
- New service, want speed and validation built in → **Fastify**.
- Large codebase, many developers, long life → **NestJS**.

---

## 4. Python: FastAPI, Django, Flask

**Language strengths:** very readable; best ecosystem for data, ML and AI (NumPy, pandas, PyTorch); fast to prototype.

**Language weaknesses:** slower raw execution than Go/Java/C#/Rust; the GIL limits CPU parallelism inside one process; dynamic typing (use type hints + a checker such as mypy or pyright).

| | FastAPI | Django | Flask |
| --- | --- | --- | --- |
| Philosophy | Modern API framework; type hints drive validation and docs | "Batteries included": ORM, admin, auth, migrations, forms | Micro-framework; you pick the parts |
| Async | First-class | Partial (async views; ORM async is improving) | Limited |
| Performance | High for Python (on Starlette/Uvicorn) | Moderate | Moderate |
| Dev speed | Fast for APIs | Fastest for full apps with users and admin | Fast for tiny apps; slows as you add parts |
| Industry use | ML model serving, AI backends, microservices | Instagram (famously), content sites, internal tools, SaaS | Small services, prototypes, legacy apps |

**Good choice when:** anything near data science or AI; admin-heavy business apps (Django); quick APIs with automatic docs (FastAPI); teams who know Python.

**Poor choice when:** very high requests-per-second on few machines with CPU-heavy logic; very latency-sensitive services; huge numbers of long-lived connections (possible with async, but Go, Elixir or Node are more natural).

**CPU-heavy work in Python:** use libraries written in C/Rust (NumPy, Polars), multiple worker processes (Gunicorn/Uvicorn workers), or a task queue (Celery) so it doesn't block the web server.

---

## 5. Java: Spring Boot

**Strengths:** very mature; huge ecosystem (Spring Security, Spring Data, Spring Cloud); strong typing; excellent tooling and profilers; the JVM's JIT makes long-running services very fast; **virtual threads** (Java 21+) make simple blocking code scale like async code.

**Weaknesses:** more boilerplate (Kotlin reduces it); higher memory use; slower cold starts (an issue for serverless; GraalVM native images help); a lot of "magic" through annotations.

**Typical use:** banks, insurance, telecoms, e-commerce giants, large enterprise systems, Android backends. Very common in Indian IT services and product companies.

**Good choice when:** big teams, long-lived systems (10+ years), strict correctness, complex domains, and when the company already runs on the JVM.

**Poor choice when:** a tiny team needs a quick MVP, serverless functions with cold-start sensitivity (unless using native images), or very low memory budgets.

```java
// Virtual threads in Spring Boot 3.2+: one property in application.properties
spring.threads.virtual.enabled=true
```

---

## 6. Go: Gin, Fiber

**Strengths:** simple language (you can learn it in weeks); compiles to one small binary; fast start; low memory; goroutines make concurrency easy; strong standard library (`net/http` is production-ready); great for infrastructure (Docker, Kubernetes, Terraform are written in Go).

**Weaknesses:** verbose error handling (`if err != nil`); fewer "batteries" (no Django-like admin); generics arrived late (Go 1.18) so some libraries feel older.

| | Gin | Fiber | Standard library |
| --- | --- | --- | --- |
| Built on | `net/http` | `fasthttp` (not `net/http`) | — |
| Feel | Mature, widely used | Express-like API, very fast | Enough for many APIs since Go 1.22's routing |
| Watch out | — | Not compatible with `net/http` middleware and some libraries | Write more yourself |

**Good choice when:** high-concurrency APIs, microservices, proxies and gateways, real-time systems, CLIs and infrastructure tools, when you want low cloud bills.

**Poor choice when:** heavy ML/data work (Python wins), rapid admin-heavy CRUD (Django/Rails win), or teams with no Go experience under deadline pressure.

---

## 7. C#: ASP.NET Core

**Strengths:** among the fastest mainstream web frameworks in public benchmarks (TechEmpower); excellent `async`/`await`; strong typing; great tooling (Visual Studio, Rider); Entity Framework Core; fully cross-platform and open source; Native AOT for fast starts.

**Weaknesses:** smaller open-source startup scene than Node/Python; some teams still associate it with Windows-only (no longer true).

**Typical use:** enterprises on Microsoft/Azure, finance, healthcare, government, game backends (Unity uses C#).

**Good choice when:** enterprise apps needing performance and structure, teams with C# skills, Azure-heavy companies.

**Poor choice when:** the team has no .NET experience, or you rely heavily on Python ML libraries.

---

## 8. Rust: Axum, Actix Web

**Strengths:** C/C++-level speed with memory safety; no garbage collector, so latency is very steady; tiny memory use; the compiler catches data races.

**Weaknesses:** hardest to learn (ownership and lifetimes); slower development; smaller web ecosystem; compile times.

| | Axum | Actix Web |
| --- | --- | --- |
| Built by | The Tokio team | Community |
| Feel | Modular, built on Tower middleware | Very fast, mature |

**Typical use:** performance-critical services (Discord moved a key service from Go to Rust to avoid GC latency spikes), proxies (Cloudflare's Pingora), databases and search engines (Qdrant is written in Rust), WebAssembly.

**Good choice when:** extreme performance or predictable latency is a hard requirement, or memory is very limited.

**Poor choice when:** a CRUD app or MVP, or a team without Rust experience. The development cost rarely pays back for ordinary web apps.

---

## 9. Side-by-side summary

Ratings are relative: ★★★★★ = best of these.

| | Node (Fastify) | Python (FastAPI) | Java (Spring) | Go | C# (.NET) | Rust |
| --- | --- | --- | --- | --- | --- | --- |
| I/O-bound throughput | ★★★★ | ★★★ | ★★★★ | ★★★★★ | ★★★★★ | ★★★★★ |
| CPU-bound work | ★★ | ★★ (★★★★ with C libs) | ★★★★ | ★★★★ | ★★★★ | ★★★★★ |
| Memory efficiency | ★★★ | ★★ | ★★ | ★★★★ | ★★★ | ★★★★★ |
| Development speed | ★★★★★ | ★★★★★ | ★★★ | ★★★★ | ★★★★ | ★★ |
| Ecosystem size | ★★★★★ | ★★★★★ | ★★★★★ | ★★★★ | ★★★★ | ★★★ |
| Type safety | ★★★ (TS) | ★★ (hints) | ★★★★ | ★★★★ | ★★★★ | ★★★★★ |
| Hiring pool (India) | ★★★★★ | ★★★★★ | ★★★★★ | ★★★ | ★★★★ | ★★ |
| AI/ML ecosystem | ★★★ | ★★★★★ | ★★★ | ★★ | ★★★ | ★★ |
| Serverless cold start | ★★★★ | ★★★ | ★★ (★★★★ native) | ★★★★★ | ★★★ (★★★★ AOT) | ★★★★★ |

## 10. How to actually decide

Ask these in order. The first one usually settles it.

1. **What does the team know well?** A team that's expert in Express will ship a better Express API than a mediocre Go one. Familiarity beats benchmarks for most products.
2. **What's the main workload?** Mostly I/O → anything works; pick for productivity. Heavy CPU → Go, Java, C#, Rust, or Python with native libraries/queues. ML → Python.
3. **How big will the team and codebase get?** Large and long-lived → strong structure and typing (NestJS, Spring, .NET, Go).
4. **What are the hard non-functional limits?** p99 under 10 ms, tiny memory, huge connection counts → Go, Rust, Elixir.
5. **Where will it run?** Serverless → fast cold starts (Node, Go, Rust, or JVM/.NET native builds).
6. **What does the rest of the company use?** Shared libraries, deploy pipelines and on-call knowledge are worth a lot.

**Polyglot is normal.** A common, sensible setup: TypeScript (Next.js/NestJS) for the main product API, Python (FastAPI) for ML services, Go for one high-throughput service (for example, a location tracker). Add a new language only when a requirement clearly needs it. Each one adds tooling, hiring and on-call cost.
