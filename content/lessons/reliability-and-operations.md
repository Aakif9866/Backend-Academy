---
title: Running It for Real
summary: Logs, metrics and traces; alerts and SLOs; backups and recovery; safe migrations; testing; incidents; and common failure stories with their fixes.
difficulty: intermediate
minutes: 35
source: backend/10-reliability-and-operations.md
prerequisites: [backend-architecture-layers, performance-engineering]
objectives:
  - Explain the three pillars of observability and what each answers
  - Set an SLO and alert on symptoms rather than causes
  - Design backups you have actually tested restoring
  - Run schema changes without downtime
videos:
  - id: tEylFyxbDLE
    title: SLIs, SLOs, SLAs, oh my! (class SRE implements DevOps)
    channel: Google Cloud Tech
    why: Google's own short explanation of the terms used in the "Alerts and SLOs" section.
resources:
  - url: https://sre.google/sre-book/monitoring-distributed-systems/
    title: "Google SRE book: Monitoring Distributed Systems"
    why: The four golden signals and symptom-based alerting, from the source.
  - url: https://sre.google/sre-book/postmortem-culture/
    title: "Google SRE book: Postmortem Culture"
    why: How to write blameless postmortems that actually prevent repeats.
  - url: https://www.postgresql.org/docs/current/backup.html
    title: "PostgreSQL: Backup and Restore"
    why: Dumps, file-system backups and point-in-time recovery with WAL archiving.
quiz:
  - type: mcq
    q: Which alert is most useful to page someone at 3 a.m.?
    options: ["CPU above 80% on one host", "Checkout error rate above SLO burn threshold for 10 minutes", "Disk 60% full", "A deploy happened"]
    answer: 1
    explain: Page on user-visible symptoms tied to SLOs. High CPU might be harmless; a burning error budget on checkout is not.
  - type: tf
    q: A backup you have never restored should be treated as unverified.
    answer: 0
    explain: True. Corrupt files, missing permissions or missing WAL segments are only discovered during a restore. Schedule restore drills.
  - type: scenario
    q: You need to rename column `name` to `full_name` on a busy table without downtime. What's the safe sequence?
    options: ["ALTER TABLE RENAME and deploy at the same time", "Expand/contract: add full_name, write to both, backfill, switch reads, stop writing name, drop it later", "Take the site down for a minute", "Create a new database"]
    answer: 1
    explain: Old and new app versions run side by side during a deploy. Expand/contract keeps the schema compatible with both at every step.
---

## Hands-on exercise

Take any small API you've built and add: structured JSON logs with a request id, a `/health` endpoint, and a latency histogram metric. Then write one SLO for it ("99% of `GET /notes` under 300 ms over 28 days") and the alert you'd put on it. Finally, back up its database, delete the database, and restore it. Time the restore.

## Completion criteria

- You can define an SLO and a symptom-based alert.
- You've performed and timed a real restore.
