---
title: Caching in Depth
summary: Why caches work, the read and write patterns (cache-aside, read-through, write-through, write-back, write-around), TTLs and invalidation, LRU/LFU eviction, Redis in practice, and the failure modes. Stampedes, penetration, avalanches and stale data.
difficulty: intermediate
minutes: 55
prerequisites: [proxies-nginx-cdn, sql-fundamentals]
objectives:
  - Decide whether and where to cache using hit ratio, staleness tolerance and cost
  - Implement cache-aside correctly and compare it with read-through, write-through, write-back and write-around
  - Choose TTLs and invalidation strategies, including versioned keys and event-driven invalidation
  - Explain and implement LRU, and compare LRU, LFU and FIFO
  - Prevent cache stampedes, penetration and avalanches
  - Use Redis data structures, expiry and eviction policies appropriately
videos:
  - id: dGAgxozNWFE
    title: Cache Systems Every Developer Should Know
    channel: ByteByteGo
    why: A map of every caching layer from CPU to CDN, which frames where application caches fit.
  - id: G1rOthIU-uo
    title: Redis in 100 Seconds
    channel: Fireship
    why: A fast overview of Redis data structures and why it's the default shared cache.
resources:
  - url: https://redis.io/docs/latest/develop/reference/eviction/
    title: "Redis: Key eviction"
    why: maxmemory policies (allkeys-lru, allkeys-lfu, volatile-ttl…) and how Redis approximates LRU and LFU.
  - url: https://aws.amazon.com/builders-library/caching-challenges-and-strategies/
    title: "Amazon Builders' Library: Caching challenges and strategies"
    why: Hard-won lessons from Amazon on cache sizing, downstream protection and failure modes.
  - url: https://www.usenix.org/system/files/conference/nsdi13/nsdi13-final170_update.pdf
    title: "Scaling Memcache at Facebook (NSDI 2013)"
    why: The classic paper on running caches at enormous scale, including leases to prevent stampedes and stale sets.
  - url: https://www.vldb.org/pvldb/vol8/p886-vattani.pdf
    title: "Optimal Probabilistic Cache Stampede Prevention (VLDB 2015)"
    why: The paper behind probabilistic early expiration (XFetch), used in this lesson's stampede section.
quiz:
  - type: code
    q: In cache-aside, what's the race in this update path?
    code: |
      async function updateUser(id, data) {
        await cache.set(`user:${id}`, data);   // 1. update cache
        await db.updateUser(id, data);         // 2. update DB
      }
    options: ["None", "If two updates interleave, or the DB write fails, the cache can hold a value the database doesn't have; prefer updating the DB, then deleting the key", "Redis is too slow", "Keys can't contain colons"]
    answer: 1
    explain: "Writing the cache first can leave it inconsistent when the DB write fails or concurrent writers interleave. The usual pattern is: write the database, then delete (not set) the cache key, so the next read reloads fresh data. Add a TTL as a safety net."
  - type: mcq
    q: A hot key expires and thousands of requests simultaneously miss and query the database. What is this called?
    options: ["Cache penetration", "Cache stampede (dogpile / thundering herd)", "Cache avalanche", "Write-back"]
    answer: 1
    explain: "A stampede is many concurrent recomputations of the same missing key. Fixes: single-flight locking, serving stale while one request refreshes, or probabilistic early refresh."
  - type: scenario
    q: Attackers request /products/<random id> for ids that don't exist. Every request misses the cache and hits the database. What helps?
    options: ["A longer TTL on real products", "Cache negative results briefly (\"not found\" with a short TTL) and/or use a Bloom filter of existing ids; rate-limit too", "Disable the cache", "Use write-through"]
    answer: 1
    explain: "This is cache penetration. Negative caching and Bloom filters stop non-existent keys from reaching the database."
  - type: tf
    q: Write-back (write-behind) caching gives fast writes but can lose recently written data if the cache node fails before flushing.
    answer: 0
    explain: "True. Writes are acknowledged once they're in the cache and persisted later, so a crash in between loses them. Use it only where that risk is acceptable or the cache is durable and replicated."
  - type: mcq
    q: Your workload has a stable set of very popular items plus occasional one-off scans of many cold items. Which eviction policy resists the scans better?
    options: ["LRU", "LFU (with decay)", "FIFO", "Random"]
    answer: 1
    explain: "A scan touches many keys once, which makes them 'recent' and flushes the hot set under LRU. LFU keeps frequently used keys. Real implementations (Redis's LFU, TinyLFU) add decay so yesterday's favourites don't squat forever."
---

## Why it matters

Caching is the highest-leverage performance technique in backend engineering: a cache hit can be orders of magnitude faster than recomputing or re-querying, and it takes load off the systems that are hardest to scale (usually the database). It's also a leading source of subtle bugs (stale data, inconsistency, outages when the cache empties). Caching well means knowing both sides.

## Why caches work

Real workloads are **skewed**: a small fraction of keys gets most of the traffic (popular products, active users, today's posts). Caching that small, hot set gets you a high **hit ratio** with modest memory.

The effective latency of a cached read:

```
effective_latency = hit_ratio × cache_latency + (1 − hit_ratio) × (cache_latency + backend_latency)
```

The relationship is very non-linear near the top. Going from a 90% to a 99% hit ratio cuts backend traffic by 10×, from 10% of requests to 1%. That's why small hit-ratio improvements matter so much at scale, and why a cold or flushed cache can overwhelm a database that is normally fine.

## Where to cache

| Layer | Example | Scope | Good for |
| --- | --- | --- | --- |
| Browser | `Cache-Control`, ETags | One user | Static assets, user-specific GETs |
| CDN / edge | Cloudflare, CloudFront | All users, per region | Static files, public pages and API responses |
| Reverse proxy | Nginx `proxy_cache`, Varnish | All users | Public responses |
| In-process | An LRU map in your app | One instance | Very hot, small, rarely changing data (config, feature flags) |
| Distributed cache | Redis, Memcached, Valkey | All instances | Sessions, computed results, rate-limit counters, shared hot data |
| Database | Postgres buffer cache, OS page cache | Database server | Hot pages, automatically |

**In-process vs distributed:** an in-process cache is the fastest (no network hop) but each instance has its own copy, so invalidation is per instance and memory is multiplied. A distributed cache is shared and consistent across instances at the cost of a network round trip. Many systems use both: a tiny in-process tier in front of Redis.

## Should you cache this?

Cache when data is **read much more than written**, **expensive** to produce, and **tolerant of some staleness**. Ask:

1. How stale may it be? (Product description: minutes. Stock count on checkout: no staleness at all, so read the source of truth.)
2. What's the expected hit ratio? (Per-user data with low reuse may not be worth caching.)
3. What happens when the cache is empty or down? (Can the backend survive a cold start?)
4. How will it be invalidated?

## Read and write patterns

### Cache-aside (lazy loading)

The application manages the cache explicitly. It's the most common pattern.

```ts
async function getProduct(id: string): Promise<Product | null> {
  const key = `product:v3:${id}`;
  const cached = await redis.get(key);
  if (cached !== null) return cached === "∅" ? null : JSON.parse(cached);   // includes negative caching

  const product = await db.products.findById(id);
  await redis.set(key, product ? JSON.stringify(product) : "∅", "EX", product ? 300 : 30); // shorter TTL for misses
  return product;
}

async function updateProduct(id: string, patch: Partial<Product>) {
  await db.products.update(id, patch);          // 1. source of truth first
  await redis.del(`product:v3:${id}`);          // 2. invalidate (delete, don't set)
}
```

Why **delete** rather than **set** on writes? Setting from the writer can race with a concurrent reader that loaded the old value and writes it back after you. Deleting means the next read loads fresh data. Even delete-on-write has a narrow race (a reader loads old data, the writer updates the DB and deletes, then the reader sets the stale value), which is why you **always keep a TTL** as a backstop. Facebook's memcache paper solves this with **leases**.

### Read-through

The cache itself loads from the backend on a miss (a library or caching layer does it, not your code). The behaviour is the same as cache-aside but centralised.

### Write-through

Writes go to the cache and the database synchronously. The cache is always warm and fresh for written keys; writes are slower, and you cache data that may never be read.

### Write-back (write-behind)

Writes go to the cache and are flushed to the database asynchronously, often batched. Writes are very fast and absorb bursts, but you **can lose data** if the cache fails before flushing, and the database is temporarily behind. Suits counters, analytics and view counts; avoid it for money.

### Write-around

Writes go straight to the database, bypassing the cache; data is cached only when read. Avoids filling the cache with write-once data such as logs or bulk imports.

| Pattern | Read latency | Write latency | Staleness risk | Data-loss risk | Typical use |
| --- | --- | --- | --- | --- | --- |
| Cache-aside | Miss penalty | DB only | TTL window | None | General purpose |
| Read-through | Miss penalty | DB only | TTL window | None | Caching libraries and proxies |
| Write-through | Fast for written keys | Cache + DB | Low | None | Read-after-write heavy data |
| Write-back | Fast | Very fast | Low (DB lags) | **Yes** | Counters, buffered analytics |
| Write-around | Miss after write | DB only | Low | None | Write-once or rarely read data |

## TTLs and invalidation

> "There are only two hard things in computer science: cache invalidation and naming things." (Phil Karlton)

Strategies, often combined:

- **TTL expiry:** simple, bounded staleness. Add **jitter** (`300 + random(0, 60)` seconds) so keys written together don't expire together.
- **Delete on write:** immediate freshness for single keys.
- **Versioned keys:** embed a version in the key (`product:v3:42`, or a per-entity version like `product:42:v17`). Changing the version makes old entries unreachable, with no deletes needed; they age out by TTL. Great for schema changes and bulk invalidation.
- **Event-driven invalidation:** publish a "product.updated" event (or use change data capture from the database) and have consumers delete or refresh keys, including in other services and CDN purges.
- **Tag-based invalidation:** associate keys with tags (`category:shoes`) and invalidate by tag. CDNs support this natively; in Redis, keep a set of keys per tag.

## Eviction: what to drop when memory is full

When a cache is full, it must evict something. Try the policies yourself:

<div data-viz="cache-eviction"></div>

| Policy | Evicts | Strength | Weakness |
| --- | --- | --- | --- |
| **LRU** | Least recently used | Adapts quickly to shifting popularity | One big scan flushes the hot set |
| **LFU** | Least frequently used | Keeps long-term favourites | Old favourites linger without decay |
| **FIFO** | Oldest inserted | Trivial | Ignores usage entirely |
| **TTL-based** | Soonest to expire | Respects freshness | Not about usefulness |
| **TinyLFU / W-TinyLFU** | Admission filter + LRU windows | High hit ratios in practice (used by Caffeine in Java) | More complex |

### Implementing LRU

The classic O(1) LRU uses a hash map for lookup plus a doubly linked list for recency. In JavaScript, a `Map` preserves insertion order, which gives a compact version:

```ts
export class LRUCache<K, V> {
  private map = new Map<K, V>();
  constructor(private capacity: number) {}

  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key)!;
    this.map.delete(key);       // move to the "most recent" end
    this.map.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    else if (this.map.size >= this.capacity) {
      this.map.delete(this.map.keys().next().value!);   // first key = least recently used
    }
    this.map.set(key, value);
  }
}
```

Redis doesn't track exact LRU order for every key (that would cost memory). It **samples** a few keys and evicts the best candidate among them, approximating LRU or LFU cheaply (`maxmemory-samples`).

## Failure modes and their fixes

### Cache stampede

A hot key expires, and every concurrent request misses and recomputes it, piling onto the database.

```ts
// Fix 1: single-flight with a short Redis lock: one request recomputes, the others wait briefly and retry.
async function getWithLock<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const hit = await redis.get(key);
    if (hit !== null) return JSON.parse(hit);
    const gotLock = await redis.set(`lock:${key}`, "1", "PX", 5000, "NX");  // only one caller wins
    if (gotLock) {
      try {
        const value = await load();
        await redis.set(key, JSON.stringify(value), "EX", ttl + Math.floor(Math.random() * ttl * 0.1));
        return value;
      } finally {
        await redis.del(`lock:${key}`);
      }
    }
    await new Promise((r) => setTimeout(r, 50));   // someone else is loading; wait and re-check
  }
  return load();                                    // give up waiting; fall back to loading directly
}
```

Other fixes: **stale-while-revalidate** (store a soft expiry inside the value, serve stale data while one request refreshes in the background), **probabilistic early expiration** (each reader refreshes early with a probability that rises as expiry approaches, so recomputation spreads out; the XFetch algorithm), and **pre-warming** hot keys on deploy or on a schedule. Within a single process, deduplicate concurrent loads of the same key with an in-flight promise map.

### Cache penetration

Requests for keys that don't exist (often malicious) always miss and always reach the database. Fixes: **negative caching** (cache "not found" with a short TTL, as in the cache-aside example above), a **Bloom filter** of existing ids in front of the cache, input validation (reject malformed ids early), and rate limiting.

### Cache avalanche

Many keys expire at once (all set by one warm-up job with the same TTL), or the cache cluster restarts empty, and the database receives the full load. Fixes: **TTL jitter**, staggered warm-up, replicated or persistent cache nodes, circuit breakers and load shedding in front of the database, and capacity planning that assumes the cache can be cold.

### Hot keys

One key (a celebrity's profile, a flash-sale item) gets so much traffic that a single cache node saturates. Fixes: a small in-process cache tier in front of Redis for that key, replicating hot keys under several names (`item:42:r1..r8`) and reading from a random replica, or read replicas.

### Inconsistency

Accept that caches are eventually consistent with the source of truth. Bound staleness with TTLs, invalidate on writes, and **read the source of truth for decisions that matter** (stock on checkout, balance on transfer). Never make a business decision from a cached value you can't afford to be stale.

## Redis in practice

Redis is an in-memory data-structure server. It's usually the shared cache, and much more.

| Structure | Commands | Uses |
| --- | --- | --- |
| String | `GET`, `SET key val EX 60 NX`, `INCR` | Cached JSON, counters, locks, rate limits |
| Hash | `HSET`, `HGETALL`, `HINCRBY` | Objects with fields, partial updates |
| List | `LPUSH`, `RPOP`, `BLPOP` | Simple queues, recent-activity lists |
| Set | `SADD`, `SISMEMBER`, `SINTER` | Tags, unique visitors, tag → keys index |
| Sorted set | `ZADD`, `ZRANGE`, `ZREVRANGE … WITHSCORES` | Leaderboards, sliding-window rate limits, scheduled jobs |
| Stream | `XADD`, `XREADGROUP`, `XACK` | Durable-ish event logs with consumer groups |
| HyperLogLog | `PFADD`, `PFCOUNT` | Approximate unique counts in ~12 KB |
| Pub/Sub | `PUBLISH`, `SUBSCRIBE` | Fan-out to WebSocket servers (fire-and-forget) |

Operational essentials:

- **Set `maxmemory` and a `maxmemory-policy`.** For a pure cache, `allkeys-lru` or `allkeys-lfu`. The default `noeviction` makes writes fail when memory is full, which suits Redis as a primary datastore or queue, not as a cache.
- **Always set TTLs** on cache keys.
- **Avoid big keys and O(N) commands** on large structures in production (`KEYS *`, `HGETALL` on a million-field hash, `SMEMBERS` on huge sets). Redis executes commands on a single main thread, so one slow command delays everyone. Use `SCAN`.
- **Persistence:** RDB snapshots and/or AOF. A cache can often live without either; a queue or session store needs them.
- **Availability:** a replica with automatic failover (Sentinel or a managed service). **Redis Cluster** shards keys across nodes by hash slot (16,384 slots); multi-key operations need keys in the same slot (use hash tags: `{user:42}:cart`).
- **Use pipelining or `MGET`** to batch many reads into one round trip.
- Licensing changed in 2024, prompting the open-source fork **Valkey** (Linux Foundation); Redis later added an AGPL option. Managed services offer both. The commands in this lesson work on either.

**Memcached** is a simpler, multi-threaded, purely in-memory key-value cache: no persistence, no rich data structures, no replication built in. It's excellent for plain, large caches. See [technology decision guides](/learn/technology-decision-guides/#redis-vs-memcached).

## Real-world scenarios

- **Product catalogue:** CDN for public pages, Redis cache-aside for product details with event-driven invalidation on edits, negative caching for unknown ids.
- **Sessions:** Redis with TTL equal to session lifetime, replicated so a node loss doesn't log everyone out.
- **Leaderboards:** sorted sets updated on each score, top-N reads in O(log N + N).
- **Rate limiting:** atomic counters or sorted sets with expiry.

## Trade-offs

Caching trades **freshness and complexity** for **speed and backend capacity**. Every cache adds a component that can fail, a consistency question, a memory bill, and a cold-start risk. A database with the right index may make a cache unnecessary.

## Common mistakes

- Caching without TTLs, then wondering why stale data never goes away.
- Setting the cache on writes instead of deleting, causing races.
- Caching per-user data in a shared cache under a key without the user id (data leak).
- Treating the cache as the source of truth for critical decisions.
- No plan for a cold cache.
- Big keys and `KEYS *` in production Redis.

## Security considerations

- Keys must include every dimension the value depends on: user, tenant, locale, permissions. Otherwise one user can be served another's data.
- Redis should never be reachable from the internet; require authentication or ACLs and TLS.
- Don't cache sensitive data longer than necessary; encrypt it if your threat model includes the cache store.

## Performance considerations

- Measure hit ratio, latency (p99), memory, evictions and backend load before and after.
- Batch reads (`MGET`, pipelines). Keep values small; compress large ones.
- Size for the working set, and test what happens when the cache is flushed.

## Hands-on exercise

1. Build an API endpoint backed by a deliberately slow query (or `pg_sleep(0.2)`). Load-test it with k6 at a fixed rate and record p50, p95 and database CPU.
2. Add Redis cache-aside with TTL jitter and delete-on-write. Re-run the same test and record the same metrics, plus hit ratio (count hits and misses).
3. Simulate a stampede: set a 5-second TTL on a hot key, run 200 concurrent virtual users, and graph database queries per second around each expiry. Then add single-flight locking or stale-while-revalidate and show the spikes disappear.
4. Add negative caching and show that requests for random non-existent ids no longer reach the database.
5. Implement the LRU class above and write tests for capacity, recency updates on `get`, and eviction order.

## Completion criteria

- You can justify caching (or not caching) a piece of data with hit ratio, staleness and failure considerations.
- You implement cache-aside with correct invalidation and TTL jitter.
- You can explain and prevent stampedes, penetration and avalanches, and you've measured a cache's effect yourself.
