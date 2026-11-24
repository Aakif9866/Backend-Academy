---
title: Performance Engineering
summary: Latency percentiles and throughput, a method for finding bottlenecks, CPU and memory profiling with flame graphs, event loops and thread pools, N+1 queries and memory leaks, load/stress/spike/soak testing with k6, benchmarking honestly, and backpressure.
difficulty: advanced
minutes: 65
prerequisites: [concurrency-async, indexing-lab, caching-deep-dive]
objectives:
  - Measure latency with percentiles and explain why averages mislead
  - Apply a systematic method (USE, RED) to find the actual bottleneck
  - Profile CPU and memory with flame graphs and heap snapshots
  - Diagnose event-loop blocking, thread-pool exhaustion, connection-pool exhaustion, N+1 queries and memory leaks
  - Design and run load, stress, spike and soak tests, and report results honestly
  - Apply backpressure and understand Little's law
videos:
  - id: lJ8ydIuPFeU
    title: "\"How NOT to Measure Latency\" by Gil Tene"
    channel: Strange Loop Conference
    why: The classic talk on percentiles, coordinated omission and why most latency measurements are wrong.
  - id: D53T1Ejig1Q
    title: "USENIX ATC '17: Visualizing Performance with Flame Graphs"
    channel: USENIX
    why: Brendan Gregg, who invented flame graphs, explains how to read them and use them for CPU and off-CPU analysis.
resources:
  - url: https://www.brendangregg.com/usemethod.html
    title: "Brendan Gregg: The USE Method"
    why: Utilisation, saturation and errors for every resource; a checklist for finding bottlenecks.
  - url: https://grafana.com/docs/k6/latest/
    title: Grafana k6 documentation
    why: Scripting load tests, scenarios, thresholds and executors (including open-model arrival rates).
  - url: https://nodejs.org/en/learn/diagnostics/memory/using-heap-snapshot
    title: "Node.js: Using heap snapshots"
    why: The official guide to finding memory leaks in Node.
  - url: https://go.dev/doc/diagnostics
    title: "Go: Diagnostics"
    why: pprof profiling, tracing and debugging from the Go team.
  - url: https://github.com/benfred/py-spy
    title: py-spy
    why: A sampling profiler for Python that attaches to running processes in production with low overhead.
quiz:
  - type: mcq
    q: "An endpoint's average latency is 40 ms but p99 is 2.5 s. What does that mean?"
    options: ["The endpoint is fast for everyone", "1 in 100 requests takes 2.5 s or more; users making many requests per page will hit that tail often", "The average is wrong", "p99 doesn't matter"]
    answer: 1
    explain: "Averages hide the tail. A page that makes 20 backend calls hits at least one p99-slow call with probability 1 − 0.99^20 ≈ 18%. Measure and set targets on percentiles."
  - type: scenario
    q: Under load, latency climbs steeply while CPU sits at 30%, and logs show "timeout acquiring connection from pool". What is the bottleneck?
    options: ["CPU", "The database connection pool is saturated: requests queue waiting for a connection (check slow queries holding connections, pool size vs DB capacity)", "Network bandwidth", "Disk space"]
    answer: 1
    explain: "Low CPU plus rising latency means waiting, not computing. Pool saturation is common: slow queries or transactions held open hog connections. Fix the slow queries first, then size the pool against what the database can handle."
  - type: mcq
    q: "Little's law: a service handles 500 req/s with average latency 200 ms. How many requests are in flight on average?"
    options: ["2.5", "100", "2,500", "500"]
    answer: 1
    explain: "L = λ × W = 500/s × 0.2 s = 100 concurrent requests. It's how you size connection pools, worker counts and concurrency limits."
  - type: code
    q: What performance problem does this code have?
    code: |
      const orders = await db.query('SELECT * FROM orders WHERE user_id = $1', [userId]);
      for (const o of orders) {
        o.items = await db.query('SELECT * FROM order_items WHERE order_id = $1', [o.id]);
      }
    options: ["None", "N+1 queries: one query per order, so 100 orders mean 101 round trips", "SQL injection", "A memory leak"]
    answer: 1
    explain: "Fetch all items in one query (WHERE order_id = ANY($1)) or with a join, then group in memory. ORMs cause this silently with lazy loading."
  - type: tf
    q: A load test that sends the next request only after the previous one returns (closed model) can hide latency problems under overload.
    answer: 0
    explain: "True. When the system slows, a closed-loop client slows its sending rate too, so the test never applies the intended load and misses queueing delays (coordinated omission). Use arrival-rate (open model) tests to model real traffic."
---

## Why it matters

Performance is a feature: slow responses lose users and cost money (more servers, more timeouts, more retries). But performance work done by intuition is mostly wasted: engineers routinely optimise code that accounts for 1% of the time while a missing index or an exhausted pool causes 90% of it. Performance engineering is a **measurement discipline**: define the target, find the bottleneck with evidence, fix it, and prove the fix.

## Measuring the right things

### Latency percentiles

Latency distributions are skewed: most requests are fast and a long tail is slow. Report percentiles:

- **p50** (median): the typical experience.
- **p95, p99, p99.9**: the tail. This is where timeouts, GC pauses, lock contention and cold caches live.

Why the tail matters more than it looks: a page that makes 20 backend calls in parallel is as slow as its slowest call. The chance that at least one of 20 calls hits the p99 is 1 − 0.99²⁰ ≈ 18%. At scale, your users experience your tail constantly.

Rules:

- Never average percentiles across servers or time windows; aggregate histograms instead (Prometheus histograms, HDR histograms).
- Measure at the client or edge too, not just inside the service: queueing before your code runs is real latency.
- Watch out for **coordinated omission**: if your load generator waits for slow responses before sending more, it under-reports latency during slowdowns.

### Throughput, saturation and Little's law

- **Throughput:** requests or jobs completed per second.
- **Utilisation:** how busy a resource is (CPU 70%).
- **Saturation:** work queued waiting for a resource (run-queue length, pool wait time). Saturation is what makes latency explode.

**Little's law:** `L = λ × W`. In-flight requests = arrival rate × average time in system. At 500 req/s and 200 ms, there are 100 requests in flight on average, so a pool of 20 database connections will queue unless queries are much shorter than the request. Use it to size pools, workers and concurrency limits.

As utilisation approaches 100%, queueing delay grows non-linearly, so a system at 90% CPU has far worse tail latency than one at 60%. That's why you plan headroom.

## A method for finding bottlenecks

Don't guess. Work top-down:

1. **Define the symptom precisely:** which endpoint, which percentile, at what load, since when.
2. **RED for services:** **R**ate, **E**rrors, **D**uration per endpoint. Which endpoints are slow?
3. **Traces:** for slow requests, where does the time go: your code, the database, a downstream call, waiting for a pool? Distributed tracing answers this immediately ([observability](/learn/observability-in-practice/)).
4. **USE for resources:** for each resource (CPU, memory, disk, network, connection pools, thread pools, locks): **U**tilisation, **S**aturation, **E**rrors.
5. **Profile** the component that owns the time.
6. **Change one thing, re-measure** under the same conditions.

| Symptom | Likely cause | Look at |
| --- | --- | --- |
| High CPU, latency rises with load | CPU-bound code: serialisation, regex, crypto, inefficient algorithms | CPU flame graph |
| Low CPU, latency rises with load | Waiting: DB, locks, pools, downstream calls | Traces, pool metrics, DB wait events |
| Latency spikes periodically | GC pauses, cron jobs, cache expiry waves, autovacuum | GC logs, correlate with schedules |
| Memory grows until restart | Leak or unbounded cache or queue | Heap snapshots over time |
| Fine at low load, collapses suddenly | Saturation and queueing, retry storms | Queue lengths, pool waits, retry rates |
| One instance slow, others fine | Noisy neighbour, bad node, uneven load balancing | Per-instance metrics |

## Profiling CPU

A **sampling profiler** records stack traces many times per second. A **flame graph** visualises them: the x-axis is the share of samples (wider = more time), the y-axis is stack depth, and the top edge is what was actually on-CPU. Look for wide plateaus.

```bash
# Node.js
node --cpu-prof server.js            # writes a .cpuprofile; open in Chrome DevTools or speedscope
npx 0x server.js                     # generates an interactive flame graph
# Python (attach to a running process, low overhead)
py-spy record -o profile.svg --pid 4242
py-spy top --pid 4242
# Go
import _ "net/http/pprof"            # exposes /debug/pprof
go tool pprof -http=:8081 http://localhost:6060/debug/pprof/profile?seconds=30
# JVM
# async-profiler or Java Flight Recorder: java -XX:+FlightRecorder ...
# Linux, any language
perf record -F 99 -g -p 4242 -- sleep 30 && perf script | stackcollapse-perf.pl | flamegraph.pl > cpu.svg
```

Common CPU hogs in backends: JSON serialisation of huge payloads, regex on large inputs (including catastrophic backtracking), password hashing on the request path, logging at debug level in hot loops, O(n²) algorithms on growing data, and inefficient ORMs hydrating thousands of objects.

**Off-CPU time** (time spent waiting: blocked on I/O or locks) doesn't appear in CPU profiles. Use tracing, or off-CPU flame graphs.

## Event loops, thread pools and connection pools

- **Event-loop lag** (Node.js, asyncio): measure it (`perf_hooks.monitorEventLoopDelay()` in Node; asyncio debug mode in Python). Lag of tens of milliseconds means something synchronous is blocking every request. Move CPU work to worker threads or processes.
- **Node's libuv thread pool** (default 4 threads) runs some file system operations, DNS lookups (`dns.lookup`), and crypto such as `pbkdf2` and `scrypt`. Heavy use saturates it silently; `UV_THREADPOOL_SIZE` raises it.
- **Thread pools** (Java, .NET, Python sync servers): when all threads are blocked on slow I/O, new requests queue. Virtual threads or async I/O help; bounded pools plus timeouts protect you.
- **Connection pools:** the most common hidden bottleneck. Monitor pool size, active connections, and **wait time**. A pool that's too small queues requests; too large overwhelms the database (Postgres performance typically degrades with too many active connections, so many teams put PgBouncer in front and keep active connections near a small multiple of CPU cores, then tune by measurement).

## Database performance

Usually the biggest lever. In order:

1. **Find the queries that matter:** `pg_stat_statements` sorted by *total* time.
2. **N+1 queries:** replace loops with joins or `WHERE id = ANY($1)`; enable eager loading in ORMs; detect them in tests by counting queries per request.
3. **Indexes and plans** ([indexing lab](/learn/indexing-lab/)).
4. **Fetch less:** select needed columns, paginate, avoid loading huge JSON blobs.
5. **Batch writes:** multi-row inserts, `COPY`, fewer transactions.
6. **Shorter transactions:** less lock contention.
7. **Cache** results that are read often and change rarely ([caching](/learn/caching-deep-dive/)).
8. **Read replicas** for read-heavy load (mind replication lag).

```ts
// N+1 → 2 queries
const orders = await db.query("select * from orders where user_id = $1", [userId]);
const items = await db.query("select * from order_items where order_id = any($1)", [orders.map((o) => o.id)]);
const byOrder = Map.groupBy(items, (i) => i.order_id);       // Node 21+
for (const o of orders) o.items = byOrder.get(o.id) ?? [];
```

## Memory leaks

Symptoms: memory grows steadily under constant load, GC runs more often and takes longer, latency rises, and eventually the process is OOM-killed.

Common causes in garbage-collected languages: unbounded caches or maps keyed by request data; event listeners added per request and never removed; global arrays used as queues; closures capturing large objects; timers not cleared; per-request objects stored on long-lived singletons.

Finding them:

1. Confirm the trend with a soak test and a memory metric (RSS and heap used).
2. Take **heap snapshots** a few minutes apart under load (Chrome DevTools for Node with `--inspect`, `tracemalloc` in Python, `pprof` heap in Go, heap dumps with Eclipse MAT for the JVM).
3. Compare them: which object types keep growing, and **what retains them** (the retainer path).

## Load testing

### Kinds of test

| Test | Shape | Answers |
| --- | --- | --- |
| **Load** | Expected peak, sustained | Do we meet the SLO at expected traffic? |
| **Stress** | Ramp beyond peak until failure | Where is the breaking point, and how does it fail? (gracefully, or catastrophically) |
| **Spike** | Sudden jump (10× in seconds) | Do autoscaling, caches and pools cope with sudden bursts? |
| **Soak (endurance)** | Normal load for hours | Leaks, connection churn, disk filling, slow degradation |
| **Breakpoint / capacity** | Step up in increments | Max throughput per instance, for capacity planning |

### A k6 test with an open (arrival-rate) model

```js
// load-test.js — run: k6 run load-test.js
import http from "k6/http";
import { check } from "k6";

export const options = {
  scenarios: {
    steady: {
      executor: "ramping-arrival-rate",     // open model: requests arrive regardless of response time
      startRate: 50, timeUnit: "1s",
      preAllocatedVUs: 200, maxVUs: 1000,
      stages: [
        { target: 200, duration: "2m" },    // ramp to 200 req/s
        { target: 200, duration: "5m" },    // hold
        { target: 0, duration: "1m" },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],                    // < 1% errors
    http_req_duration: ["p(95)<300", "p(99)<800"],     // SLO-style latency targets
  },
};

export default function () {
  const res = http.get(`${__ENV.BASE_URL}/api/products?category=shoes&limit=20`);
  check(res, { "status 200": (r) => r.status === 200 });
}
```

### Doing it honestly

- Test a **production-like environment**: similar instance sizes, a realistic data volume (not 100 rows), realistic request mix and payloads, caches in a realistic state (both warm and cold).
- Run the load generator **outside** the system under test, with enough capacity of its own (watch the generator's CPU).
- Watch server-side metrics during the test (CPU, memory, pools, DB), not only client numbers.
- Repeat runs; report median results and variance. Change one variable at a time.
- Report **your measured numbers with context**: hardware, data size, concurrency, versions, and the date. Don't extrapolate linearly from one instance to many.

## Benchmarking code

Micro-benchmarks lie easily: JIT warm-up, dead-code elimination, CPU frequency scaling, and caches. Use proper harnesses (JMH for Java, `testing.B` for Go, `pytest-benchmark`, `mitata` or `tinybench` for JavaScript), warm up, run many iterations, and check that the result matters at the system level. A 10× faster function that accounts for 1% of request time saves 0.9%.

## Backpressure and overload

When producers outpace consumers, something must give. Without explicit backpressure, queues grow, memory fills and latency becomes unbounded.

- **Bound everything:** queues, pools, buffers, concurrent requests.
- **Signal upstream:** `429`/`503` with `Retry-After`; TCP flow control; stream APIs that pause producers (Node streams' `pipe`/`pipeline`, reactive streams).
- **Shed load** early and cheaply, prioritising critical traffic ([resilience patterns](/learn/resilience-patterns/)).
- **Autoscale** on the right signal (queue depth, concurrency or latency, not just CPU), knowing scaling takes minutes while spikes take seconds.

```js
// Node streams handle backpressure for you; don't read a big file into memory
import { pipeline } from "node:stream/promises";
await pipeline(fs.createReadStream(bigFile), zlib.createGzip(), res);   // pauses reading when the client is slow
```

## Graceful degradation under load

Plan what to turn off when overloaded: recommendations, expensive search facets, non-critical background jobs, high-resolution images. Feature flags let you do this in seconds during an incident.

## Common mistakes

- Optimising without measuring, or measuring averages.
- Load tests with unrealistic data, closed-loop clients, or the generator as the bottleneck.
- Raising pool sizes to "fix" pool exhaustion caused by slow queries.
- Ignoring the database and tuning application code.
- Claiming improvements from a single noisy run.

## Security considerations

- Expensive endpoints are denial-of-service targets: rate-limit them and cap input sizes, pagination limits and query complexity.
- Profiling endpoints (`/debug/pprof`, inspector ports) must never be publicly exposed.

## Performance considerations

This whole lesson. The summary: measure percentiles, find the bottleneck with evidence, fix the biggest one first, and re-measure.

## Hands-on exercise

Use the [Task API project](/projects/task-api/) (or any API with a database):

1. Seed realistic data (1M+ rows). Write a k6 arrival-rate test for your three most important endpoints with SLO thresholds. Record a baseline: p50, p95, p99, error rate, CPU, DB connections in use, and pool wait time.
2. Introduce an N+1 query into one endpoint and an unindexed filter into another. Re-run, find both problems using traces or `pg_stat_statements` and a flame graph, fix them, and re-measure.
3. Add Redis caching to the hottest read endpoint and compare before and after at the same arrival rate.
4. Run a stress test to find the breaking point of one instance and describe *how* it fails. Add a concurrency limit with `503` load shedding and run it again.
5. Run a 1-hour soak test while graphing memory. If memory grows, take two heap snapshots and find the retainer.
6. Write a one-page performance report with your actual numbers, environment details, and what you'd do next.

## Completion criteria

- You report latency as percentiles and size systems with Little's law.
- You find bottlenecks with traces, profiles and resource metrics, not guesses.
- You can design and run load, stress, spike and soak tests, and you never publish numbers you didn't measure.
