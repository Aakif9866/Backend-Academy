---
title: "System Design: The Building Blocks"
summary: Grow one app from a single server to millions of users. Scaling up vs out, load balancers, caching layers, CDNs, the database scaling ladder, CAP, availability numbers and estimation.
difficulty: intermediate
minutes: 45
source: backend/07-system-design-basics.md
prerequisites: [proxies-nginx-cdn, sql-fundamentals]
objectives:
  - Explain when to scale vertically vs horizontally and why horizontal scaling needs stateless servers
  - Place caches at the right layer and pick an invalidation strategy
  - Climb the database scaling ladder in the right order
  - Translate "nines" into allowed downtime and do rough capacity estimates
videos:
  - id: -W9F__D3oY4
    title: CS75 (Summer 2012) Lecture 9 Scalability Harvard Web Development David Malan
    channel: archn
    why: A legendary university lecture that builds up exactly these blocks (load balancers, caching, replication, partitioning) from first principles.
  - id: i7twT3x5yv8
    title: "System Design Interview: A Step-By-Step Guide"
    channel: ByteByteGo
    why: How to use these building blocks in a structured design conversation.
resources:
  - url: https://github.com/donnemartin/system-design-primer
    title: The System Design Primer
    why: The most popular open-source system design guide, with deeper sections on every block here.
  - url: https://sre.google/sre-book/availability-table/
    title: "Google SRE book: Availability table"
    why: The canonical table converting availability percentages into allowed downtime.
  - url: https://gist.github.com/jboner/2841832
    title: Latency numbers every programmer should know
    why: The widely cited table of approximate operation latencies (originally from Jeff Dean). Remember they are orders of magnitude, not exact.
quiz:
  - type: mcq
    q: Why must servers be stateless before you can put several behind a round-robin load balancer?
    options: ["Load balancers can't route to stateful servers", "The next request may land on a different server, so per-user state kept in one server's memory would be missing", "Stateless servers use less CPU", "HTTPS requires it"]
    answer: 1
    explain: Sessions, uploads in progress and caches kept in local memory break when requests spread across servers. Move that state to Redis, the database, or signed cookies.
  - type: mcq
    q: What is the usual first step when a database gets slow under read load?
    options: ["Shard it", "Add the right indexes and fix slow queries", "Switch to NoSQL", "Add a second region"]
    answer: 1
    explain: Indexes and query fixes are cheap and often give large wins. Then pooling, caching and read replicas. Sharding is a last resort because it complicates everything.
  - type: mcq
    q: Roughly how much downtime per year does 99.9% availability allow?
    options: ["About 5 minutes", "About 53 minutes", "About 8.8 hours", "About 3.7 days"]
    answer: 2
    explain: 0.1% of 8,760 hours is about 8.76 hours. 99.99% is about 53 minutes and 99.999% about 5 minutes.
  - type: scenario
    q: A popular product page's cache key expires and 10,000 requests miss at once, flattening the database. What is this called and what's a fix?
    options: ["Cache penetration; use a bloom filter", "Cache stampede; let one request recompute while others wait or serve stale (request coalescing)", "Split brain; use fencing", "Thundering herd on the CDN; disable the CDN"]
    answer: 1
    explain: A stampede is many simultaneous misses on one hot key. Single-flight recomputation, early probabilistic refresh, or serving stale-while-revalidate prevent it.
---

<div data-viz="load-balancer"></div>

## Hands-on exercise

Do a back-of-the-envelope design for a photo-sharing app with 10 million monthly active users:

1. Assume 20% are daily active, each views 50 photos and uploads 0.5 per day. Average photo 2 MB. Compute reads/sec, writes/sec (average and a 3× peak), daily new storage, and 5-year storage.
2. Decide which building blocks you need and in what order you'd add them as the app grows from 1k to 10M users.
3. State your assumptions explicitly. The numbers are yours, so show your arithmetic.

## Completion criteria

- You can grow a design stage by stage, adding each block only when a real problem appears.
- You can do capacity estimates and convert nines to downtime.

## A note on the numbers in this lesson

Two figures above are illustrative rather than measured: the CDN latency improvement ("about 250 ms to about 20 ms") and the index speed-up ("about 800 ms → about 2 ms"). Real values depend on distance, hardware, data distribution and cache state. Measure your own in the [indexing lab](/learn/indexing-lab/), and treat the latency table as orders of magnitude.
