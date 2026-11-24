---
title: Choosing a Backend Language
summary: I/O-bound vs CPU-bound work, how Node, Python, Java, Go, C# and Rust handle many requests at once, and the traps that come with each model.
difficulty: intermediate
minutes: 45
source: backend/13-choosing-languages-and-frameworks.md
prerequisites: [concurrency-async]
objectives:
  - Classify a workload as I/O-bound or CPU-bound and explain why it matters
  - Describe the concurrency model of Node.js, Python (async and WSGI), the JVM, Go and Rust
  - Recognise and fix a blocked event loop and a sync call inside async Python
  - Choose a language using workload, team and ecosystem, not fashion
videos:
  - id: 8aGhZQkoFbQ
    title: "What the heck is the event loop anyway? | Philip Roberts | JSConf EU"
    channel: JSConf
    why: The clearest visual explanation of the call stack, task queue and why blocking code freezes Node.
  - id: oV9rvDllKEg
    title: Concurrency is not Parallelism by Rob Pike
    channel: gnbitcom
    why: The Go co-creator explains the distinction that underlies every concurrency model compared in this lesson.
resources:
  - url: https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop
    title: "Node.js: Don't Block the Event Loop (or the Worker Pool)"
    why: The official guide to what blocks Node and how to avoid it, including ReDoS and JSON parsing costs.
  - url: https://docs.python.org/3/library/asyncio.html
    title: Python asyncio documentation
    why: The reference for event loops, tasks and running blocking code in executors.
  - url: https://go.dev/doc/effective_go#concurrency
    title: "Effective Go: Concurrency"
    why: Goroutines and channels from the Go team, including "share memory by communicating".
  - url: https://openjdk.org/jeps/444
    title: "JEP 444: Virtual Threads"
    why: Why Java 21 added lightweight threads, which changes the Java concurrency story described here.
quiz:
  - type: mcq
    q: An API endpoint spends 5 ms of CPU and 200 ms waiting for a database and a payment provider. This workload is…
    options: ["CPU-bound", "I/O-bound", "Memory-bound", "Neither"]
    answer: 1
    explain: Almost all the time is spent waiting on I/O. Event loops, async/await, goroutines and virtual threads all exist to serve many such requests concurrently while they wait.
  - type: code
    q: What happens to other requests on this Node.js server while one request runs the handler?
    code: |
      app.get('/hash', (req, res) => {
        let h = 0;
        for (let i = 0; i < 5e9; i++) h = (h * 31 + i) | 0;
        res.json({ h });
      });
    options: ["They run in parallel on other cores automatically", "They wait: the single JS thread is busy, so the event loop is blocked", "Node pauses the loop every 10 ms to serve them", "They are rejected with 503"]
    answer: 1
    explain: JavaScript runs on one thread per process. A long synchronous loop blocks the event loop, so every other request, timer and health check waits. Fixes include worker_threads, a separate job, or chunking the work.
  - type: code
    q: Why is this FastAPI endpoint a problem under load?
    code: |
      @app.get("/report")
      async def report():
          data = requests.get("https://slow.example.com/data").json()
          return summarize(data)
    options: ["requests is not installed", "A blocking HTTP call inside async def stalls the whole event loop", "FastAPI cannot return dicts", "async functions cannot call functions"]
    answer: 1
    explain: requests is synchronous. Inside async def it blocks the event loop thread, so every concurrent request waits. Use an async client (httpx.AsyncClient) or declare the route with plain def so FastAPI runs it in a thread pool.
  - type: tf
    q: Go's goroutines are scheduled by the Go runtime onto a small number of OS threads, so a server can hold hundreds of thousands of them.
    answer: 0
    explain: True. Goroutines start with small growable stacks and the runtime multiplexes them over OS threads (the M:N model), which is why one-goroutine-per-connection is idiomatic.
  - type: scenario
    q: Your team is five TypeScript developers building a typical SaaS API. Someone proposes Rust "for performance". What is the strongest counter-argument?
    options: ["Rust is slow", "The bottleneck will almost certainly be the database and I/O, and the team cost of a new language outweighs CPU savings", "Rust has no HTTP libraries", "Rust can't connect to Postgres"]
    answer: 1
    explain: For I/O-bound CRUD, language speed rarely dominates. Hiring, productivity, ecosystem fit and shared types with the frontend usually matter more. Rust earns its place for CPU-heavy or latency-critical components.
---

## Hands-on exercise

Reproduce the two traps from this lesson and fix them:

1. **Node:** write an Express server with `/fast` (returns immediately) and `/slow` (a 3-second CPU loop). Hit `/slow` and, while it runs, `curl /fast` in another terminal. Observe the wait. Then move the loop into a `worker_threads` Worker and repeat.
2. **Python:** write a FastAPI app whose `async def` route calls `time.sleep(3)`. Fire 5 concurrent requests with `xargs -P5` or `hey` and time them. Replace with `await asyncio.sleep(3)` and compare total time.

Write down the wall-clock numbers you measured (not ones you expect).

## Completion criteria

- You can explain the concurrency model of at least three languages.
- You have reproduced and fixed a blocked event loop yourself.
