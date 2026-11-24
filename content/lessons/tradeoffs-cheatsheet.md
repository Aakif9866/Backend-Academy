---
title: Trade-offs Cheat Sheet
summary: The classic trade-offs, quick "if X, pick Y" answers, a system design interview checklist, vocabulary, and books worth reading.
difficulty: intermediate
minutes: 20
source: backend/12-tradeoffs-cheatsheet.md
objectives:
  - Recall the core trade-offs (consistency vs availability, latency vs throughput, and others)
  - Use a checklist to structure a design discussion
  - Know the vocabulary well enough to use it precisely
videos:
  - id: BHqjEjzAicA
    title: CAP Theorem Simplified
    channel: ByteByteGo
    why: A short refresher on the most-quoted (and most misused) trade-off on the sheet.
resources:
  - url: https://dataintensive.net/
    title: Designing Data-Intensive Applications
    why: The single most recommended book for understanding the trade-offs behind data systems.
  - url: https://sre.google/books/
    title: Google SRE books (free online)
    why: Free books on reliability trade-offs, SLOs and operations.
quiz:
  - type: mcq
    q: "Your API's p99 latency is high but p50 is fine. What is the first thing to suspect?"
    options: ["The average user is unhappy", "A subset of requests hits slow paths: GC pauses, lock contention, cold caches, or a slow dependency", "The network is down", "The CPU is too fast"]
    answer: 1
    explain: Tail latency comes from occasional slow paths. Averages and medians hide them; look at traces for the slowest requests.
  - type: tf
    q: Batching more work per request usually increases throughput but can increase latency for individual items.
    answer: 0
    explain: True. Batching amortises overhead (more throughput) but items wait for the batch to fill or finish (more latency). It's one of the classic trade-offs.
---

## Hands-on exercise

Turn this cheat sheet into your own: for each "if X, pick Y" line, add one situation where the advice would be **wrong**. If you can't think of one, you don't fully understand the trade-off yet, so revisit the related lesson.

## Completion criteria

- You can use the interview checklist to run a 45-minute design discussion.
