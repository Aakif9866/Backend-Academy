---
title: Distributed Systems Fundamentals
summary: Why distribution is hard (partial failure, unreliable networks), CAP and PACELC done right, consistency models from linearizable to eventual, replication strategies, quorums, partitioning and consistent hashing, gossip, failure detection and split brain.
difficulty: advanced
minutes: 70
prerequisites: [system-design-method, transactions-and-concurrency]
objectives:
  - Explain partial failure and why you can't distinguish a slow node from a dead one
  - State CAP and PACELC precisely and apply them to real databases
  - Compare consistency models (linearizable, sequential, causal, read-your-writes, eventual)
  - Compare single-leader, multi-leader and leaderless replication
  - Reason about quorums (N, R, W) and their limits
  - Partition data with hash and range partitioning and consistent hashing
  - Explain gossip, failure detection and how split brain happens and is prevented
videos:
  - id: UEAMfLPZZhE
    title: "Distributed Systems 1.1: Introduction"
    channel: Martin Kleppmann
    why: The first lecture of Kleppmann's Cambridge course. The whole series is the best free university-level treatment of this lesson's topics.
  - id: cQP8WApzIQQ
    title: "Lecture 1: Introduction"
    channel: "MIT 6.824: Distributed Systems"
    why: MIT's distributed systems course, introducing fault tolerance, consistency and the labs (MapReduce, Raft, sharded KV).
  - id: BHqjEjzAicA
    title: CAP Theorem Simplified
    channel: ByteByteGo
    why: A short refresher on CAP before the more careful treatment here.
  - id: zaRkONvyGr8
    title: What is CONSISTENT HASHING and Where is it used?
    channel: Gaurav Sen
    why: A whiteboard explanation of the ring and virtual nodes. Then play with the simulation in this lesson.
resources:
  - url: https://www.cl.cam.ac.uk/teaching/2122/ConcDisSys/dist-sys-notes.pdf
    title: "Kleppmann: Distributed Systems lecture notes (Cambridge)"
    why: Free, rigorous notes covering failure models, clocks, replication, quorums, consensus and consistency.
  - url: https://jepsen.io/consistency
    title: "Jepsen: Consistency models"
    why: A clickable map of consistency models and their precise guarantees.
  - url: https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf
    title: "Dynamo: Amazon's Highly Available Key-value Store (SOSP 2007)"
    why: The paper that popularised leaderless replication, sloppy quorums, consistent hashing and vector clocks.
  - url: https://www.cs.umd.edu/~abadi/papers/abadi-pacelc.pdf
    title: "Abadi: Consistency Tradeoffs in Modern Distributed Database System Design (PACELC)"
    why: The paper introducing PACELC, the more useful refinement of CAP.
  - url: https://martin.kleppmann.com/2015/05/11/please-stop-calling-databases-cp-or-ap.html
    title: "Kleppmann: Please stop calling databases CP or AP"
    why: Why CAP labels mislead, and what to reason about instead.
quiz:
  - type: mcq
    q: What does CAP actually say?
    options: ["You can pick any two of consistency, availability and partition tolerance at design time", "When a network partition occurs, a system must choose between linearizable consistency and availability for requests on both sides", "Distributed databases can't be consistent", "Availability means 99.99% uptime"]
    answer: 1
    explain: "Partitions aren't optional in real networks, so 'CA' isn't a real choice for a distributed system. CAP is narrowly about behaviour during a partition, with specific definitions (linearizability; every non-failed node answers)."
  - type: scenario
    q: "N=3, W=1, R=1. A client writes x=5 (acked by one replica), then immediately reads x from a different replica. What can it see?"
    options: ["Always 5", "Possibly the old value, because R + W = 2 is not greater than N = 3, so the read set may not overlap the write set", "An error", "5, because of TCP"]
    answer: 1
    explain: "Quorum overlap requires R + W > N. Try it in the quorum simulation in this lesson."
  - type: mcq
    q: "After posting a comment, a user refreshes and their comment is missing (it appears 2 s later). Which guarantee was violated?"
    options: ["Linearizability", "Read-your-writes (session) consistency", "Durability", "Atomicity"]
    answer: 1
    explain: "The read probably hit a lagging replica. Fixes: read from the leader for a short time after a user writes, or track the write's log position and only read from replicas that have caught up."
  - type: tf
    q: In an asynchronous network, a node cannot reliably distinguish a crashed peer from a slow one or a lost message.
    answer: 0
    explain: "True. All it observes is the absence of a response. Timeouts are a guess, so failure detectors trade detection speed against false positives."
  - type: mcq
    q: "What is split brain?"
    options: ["A CPU fault", "Two nodes both believing they are the leader (often after a partition), each accepting writes, so data diverges", "A replica falling behind", "A sharding scheme"]
    answer: 1
    explain: "Prevented by requiring a majority quorum to elect and keep a leader (the minority side can't), plus fencing tokens so a deposed leader's writes are rejected."
---

## Why it matters

As soon as your system has more than one machine (a replica, a cache, a queue, a second service), you're building a distributed system, with problems a single process never has. Networks drop and delay messages, clocks disagree, and nodes pause or crash at the worst moment. Databases make promises about these situations in very precise language ("linearizable", "eventually consistent", "quorum"), and choosing the right system means knowing what those words actually mean.

## What makes distributed systems hard

**Partial failure.** In one process, things either work or crash. In a distributed system, some parts fail while others continue, and you often can't tell which.

**Unreliable networks.** When you send a request and get no response, any of these could have happened: the request was lost; the remote node crashed before processing it; it processed it and crashed before replying; the reply was lost; or everything is just slow. **You cannot tell which.** Timeouts are your only tool, and choosing them is a trade-off between detecting failures quickly and declaring healthy-but-slow nodes dead.

**Unreliable clocks.** Each machine's clock drifts, and NTP corrections can make it jump. You can't use timestamps from different machines to order events reliably (see [consensus and time](/learn/consensus-and-time/)).

**Process pauses.** Garbage collection, VM migration or swapping can freeze a process for seconds. It resumes unaware time has passed, still believing it holds a lock or leadership.

The **fallacies of distributed computing** (attributed to Peter Deutsch and others at Sun) summarise the traps: the network is reliable; latency is zero; bandwidth is infinite; the network is secure; topology doesn't change; there is one administrator; transport cost is zero; the network is homogeneous. Every one is false.

## CAP, stated carefully

The **CAP theorem** (Brewer's conjecture, proven by Gilbert and Lynch): when a **network partition** splits nodes into groups that can't communicate, a system must choose between:

- **Consistency** (in CAP, this specifically means **linearizability**: every read sees the most recent write, as if there were one copy), or
- **Availability** (every request to a non-failed node gets a non-error response).

You can't have both *during a partition*. Since partitions happen in any real network, "CA" isn't a meaningful option for a distributed system. The real choice is what to do when one occurs:

- **CP behaviour:** the minority side refuses requests (errors or timeouts) to avoid serving stale or conflicting data. Examples: systems built on consensus (etcd, ZooKeeper), and a relational primary with failover that only promotes a replica with a majority.
- **AP behaviour:** every side keeps answering, possibly with stale data or accepting conflicting writes to reconcile later. Examples: Dynamo-style stores (Cassandra and Riak with low consistency levels), DNS, many caches.

CAP is often over-applied. Many databases don't fit neatly into either label, many are configurable per query (Cassandra's consistency levels), and CAP says nothing about latency or about the 99.9% of the time when there's no partition.

### PACELC: the more useful version

**PACELC** (Daniel Abadi): if there's a **P**artition, choose **A**vailability or **C**onsistency; **E**lse (normal operation), choose **L**atency or **C**onsistency.

The "else" half matters every day: keeping replicas strongly consistent requires coordination (waiting for acknowledgements across machines or regions), which adds latency.

| System (typical configuration) | During partition | Normal operation |
| --- | --- | --- |
| Cassandra / DynamoDB (default reads) | Availability | Latency |
| Google Spanner, CockroachDB | Consistency | Consistency (pays latency) |
| Single-leader Postgres + async replicas (reads from replicas) | Depends on failover config | Latency (replica reads may be stale) |
| MongoDB (majority write concern, primary reads) | Consistency | Consistency |

## Consistency models

From strongest to weakest:

| Model | Guarantee | Cost |
| --- | --- | --- |
| **Linearizable** (strong) | Operations appear to take effect atomically at a single point between their start and end; all clients see one up-to-date copy | Coordination on every operation; unavailable under partition |
| **Sequential** | All clients see operations in the same order, consistent with each client's own order (not necessarily real-time order) | Still requires coordination |
| **Causal** | Operations that are causally related (a reply after the comment it answers) are seen in that order by everyone; concurrent ones may be seen in different orders | Can stay available during partitions |
| **Read-your-writes** | A client always sees its own writes | Session stickiness or log-position tracking |
| **Monotonic reads** | A client never sees data go "back in time" | Stick a client to one replica |
| **Eventual** | If writes stop, all replicas eventually converge | Cheapest; readers may see stale or out-of-order data |

Note that **ACID consistency** (constraints hold) and **CAP consistency** (linearizability) are different things that share a name. In practice, you combine models per use case: linearizable for "username taken?" and account balances; read-your-writes for a user's own profile edits; eventual for like counts and feeds.

## Replication

Replication keeps copies of data on multiple machines, for **fault tolerance**, **read scalability** and **latency** (copies near users).

### Single-leader (primary/replica)

All writes go to one leader, which streams changes (its write-ahead log or a logical change stream) to followers. Reads can go to the leader (fresh) or to followers (possibly stale).

- **Synchronous replication:** the leader waits for a follower to confirm before acknowledging. Durable even if the leader dies, but a slow or dead follower stalls writes. Common practice: one synchronous standby plus the rest asynchronous ("semi-synchronous").
- **Asynchronous replication:** fast, but a leader failure can lose recently acknowledged writes that hadn't reached followers yet.
- **Replication lag** causes the read anomalies above: read-your-writes, monotonic reads, and causally inconsistent reads.
- **Failover** is the dangerous moment: detecting the leader is dead (a timeout guess), choosing a new one (the most up-to-date follower), redirecting clients, and making sure the old leader, if it comes back, doesn't keep accepting writes (split brain).

Used by PostgreSQL, MySQL, MongoDB replica sets, Redis with replicas, and Kafka partitions.

### Multi-leader

Several nodes accept writes (often one per region) and replicate to each other. Writes are local and fast in every region, and each region tolerates the others being unreachable. But **concurrent writes to the same data conflict** and must be resolved: last-writer-wins (data loss), merge functions, or CRDTs. Used for multi-region active-active setups, offline-first apps (each device is a "leader") and collaborative editing.

### Leaderless (Dynamo-style)

Clients (or a coordinator node) send writes to several replicas and read from several replicas, using **quorums**. There's no failover because there's no leader. Stale replicas are fixed by **read repair** (update stale replicas seen during reads) and **anti-entropy** (background comparison using Merkle trees). Used by Cassandra, ScyllaDB and Riak, and in Amazon's original Dynamo design.

## Quorums

With **N** replicas, a write waits for **W** acknowledgements and a read queries **R** replicas and takes the newest version. If **R + W > N**, every read set overlaps every write set in at least one replica, so reads see the latest acknowledged write in normal operation.

<div data-viz="quorum"></div>

| Configuration (N=3) | Behaviour |
| --- | --- |
| W=2, R=2 | Balanced; tolerates 1 node down for both reads and writes |
| W=3, R=1 | Fast reads; any single node down blocks writes |
| W=1, R=3 | Fast writes; any node down blocks reads |
| W=1, R=1 | Fast and available, but no overlap: stale reads |

Caveats: even with R + W > N, concurrent writes, **sloppy quorums** (writing to stand-in nodes during failures, with "hinted handoff" later), and failed writes that partially succeeded can produce stale or surprising reads. Quorums alone don't give linearizability.

## Partitioning (sharding)

When data or write load exceeds one machine, split it across nodes. Each record belongs to one **partition**, and partitions are spread over nodes (each partition usually replicated too).

| Strategy | How | Strength | Weakness |
| --- | --- | --- | --- |
| **Range** | Key ranges: A–F, G–M… or by time | Efficient range scans | Hot spots (all of today's writes in one partition) |
| **Hash** | hash(key) → partition | Even spread | Range queries hit every partition |
| **Directory / lookup** | A table maps keys to partitions | Flexible moves | The directory must be highly available |
| **Compound** | Hash of tenant, range within it | Locality plus spread | More design work |

Choosing the **partition key** is the crucial decision: it should spread load evenly *and* match your main access pattern, so most queries hit one partition. A celebrity user or a single huge tenant still creates **hot partitions**; split them further (add a suffix to the key) or isolate them.

Secondary indexes on partitioned data are either **local** (each partition indexes its own data, so queries scatter to all partitions and gather the results) or **global** (the index is partitioned by the indexed term; reads are efficient, but writes update remote index partitions, often asynchronously).

### Consistent hashing

With `hash(key) % N`, changing N remaps almost every key, which for a cache means a flood of misses and for a datastore means moving nearly all data. **Consistent hashing** places nodes and keys on a ring; each key belongs to the next node clockwise. Adding or removing a node moves only the keys in its arc, about 1/N of them. **Virtual nodes** (many points per physical node) even out the load and let bigger machines take more.

<div data-viz="consistent-hashing"></div>

Many systems use a related, simpler idea: a **fixed number of partitions** much larger than the number of nodes (Kafka partitions, Redis Cluster's 16,384 hash slots, Elasticsearch shards), with whole partitions reassigned between nodes as the cluster changes.

### Rebalancing

Moving partitions is expensive (network, disk, cache warm-up) and risky. Prefer gradual, operator-controlled rebalancing over fully automatic schemes that can trigger cascading moves during an incident.

## Membership, gossip and failure detection

How do nodes know who's in the cluster and who's alive?

- **Heartbeats with timeouts:** a node is suspected dead after missing heartbeats for some time. Too short and you get false positives (flapping); too long and failover is slow.
- **Phi accrual failure detector** (Cassandra, Akka): instead of a binary timeout, compute a suspicion level from the observed distribution of heartbeat intervals, adapting to network conditions.
- **Gossip protocols:** every node periodically exchanges state with a few random peers. Information spreads epidemically, reaching all N nodes in O(log N) rounds, with no central coordinator and good fault tolerance. Used for membership and failure detection by Cassandra, Consul (via the SWIM-based Serf library) and others.

## Split brain

A partition separates a leader from the rest of the cluster. The majority side elects a new leader. The old leader, still running, still thinks it's the leader and keeps accepting writes from clients that can reach it. Now two leaders accept conflicting writes: **split brain**.

Prevention:

- **Majority quorums for leadership:** a leader must be elected by, and keep contact with, a majority. Only one side of a partition can have a majority, so the minority leader steps down. This is why clusters have an odd number of nodes (3 or 5).
- **Leases:** leadership is valid only for a bounded time; the leader must renew it with a majority before it expires.
- **Fencing:** every leadership term has a monotonically increasing number (an epoch or term), and storage rejects writes from older terms. This is the same idea as fencing tokens in [resilience patterns](/learn/resilience-patterns/).
- **STONITH** ("shoot the other node in the head") in some HA setups: forcibly power off the old leader.

Consensus algorithms like Raft package all of this; that's the next lesson.

## Real-world use cases

- **Postgres with one synchronous standby** across availability zones: single-leader, CP-ish failover, read replicas for scale-out reads with read-your-writes handled in the app.
- **Cassandra** for write-heavy, multi-datacenter data: leaderless, tunable quorums (`LOCAL_QUORUM`), partition keys designed per query.
- **Redis Cluster** for caches: hash slots, asynchronous replication (acknowledged writes can be lost on failover).
- **etcd** for Kubernetes cluster state: Raft consensus, linearizable, unavailable without a majority.

## Common mistakes

- Treating CAP labels as the whole story and ignoring latency and normal-operation trade-offs.
- Reading from async replicas immediately after writes (broken read-your-writes).
- Assuming failover is instant and lossless with async replication.
- A partition key that concentrates load (dates, a global counter, a mega-tenant).
- Even-numbered clusters (an even split leaves no majority on either side).

## Security considerations

- Replication and gossip traffic should be authenticated and encrypted; a rogue node joining a cluster can read or corrupt data.
- Data residency rules may forbid replicating some data to certain regions; partition by region where needed.

## Performance considerations

- Strong consistency costs round trips. Cross-region linearizable writes pay inter-region latency on every write.
- Scatter-gather queries across many partitions are only as fast as the slowest partition (tail latency amplification).
- Rebalancing and anti-entropy compete with live traffic for I/O.

## Hands-on exercise

1. Run a 3-node Cassandra or ScyllaDB cluster in Docker Compose. Create a keyspace with replication factor 3. Write and read at consistency `ONE`, `QUORUM` and `ALL` while stopping nodes, and record which operations succeed.
2. Run Postgres with one asynchronous replica. Write to the primary and immediately read from the replica in a loop; measure how often you see stale data and how far it lags (`pg_stat_replication`).
3. Implement consistent hashing with virtual nodes in your language. Measure key movement when adding a node, for 1, 10 and 100 virtual nodes per server, and compare with `hash % N`.
4. Write half a page classifying three databases you use with PACELC, citing their documentation.

## Completion criteria

- You can explain CAP and PACELC precisely and apply them to real systems.
- You can choose a consistency model per use case and a replication strategy per workload.
- You understand quorums, partitioning, consistent hashing and how split brain is prevented.
