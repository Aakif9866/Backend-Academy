---
title: "Reliability Engineering: SLOs, Incidents, Chaos and Disaster Recovery"
summary: SLIs, SLOs, SLAs and error budgets; burn-rate alerting; incident response and blameless postmortems; fault injection and chaos engineering; RPO/RTO, backup strategies, restore drills and multi-AZ/multi-region disaster recovery.
difficulty: advanced
minutes: 55
prerequisites: [reliability-and-operations, resilience-patterns]
objectives:
  - Define SLIs and SLOs from user journeys and manage an error budget
  - Alert on SLO burn rate instead of noisy resource thresholds
  - Run an incident with clear roles and write a blameless postmortem
  - Design and run safe fault-injection and chaos experiments
  - Set RPO and RTO targets and design backups and disaster recovery to meet them
videos:
  - id: tEylFyxbDLE
    title: SLIs, SLOs, SLAs, oh my! (class SRE implements DevOps)
    channel: Google Cloud Tech
    why: Google SREs define the terms precisely, with the error budget idea that the rest of the lesson builds on.
  - id: CZ3wIuvmHeM
    title: Mastering Chaos - A Netflix Guide to Microservices
    channel: InfoQ
    why: Where chaos engineering came from and how Netflix uses failure injection to build confidence.
resources:
  - url: https://sre.google/workbook/alerting-on-slos/
    title: "Google SRE Workbook: Alerting on SLOs"
    why: Multi-window, multi-burn-rate alerting explained with concrete thresholds.
  - url: https://sre.google/sre-book/managing-incidents/
    title: "Google SRE book: Managing Incidents"
    why: Incident command roles and practices.
  - url: https://principlesofchaos.org/
    title: Principles of Chaos Engineering
    why: The short manifesto defining steady state, hypotheses, minimising blast radius and running in production.
  - url: https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html
    title: "AWS: Disaster recovery options in the cloud"
    why: Backup and restore, pilot light, warm standby and multi-site active/active compared by RPO, RTO and cost.
  - url: https://www.postgresql.org/docs/current/continuous-archiving.html
    title: "PostgreSQL: Continuous Archiving and Point-in-Time Recovery"
    why: How WAL archiving enables restoring to any moment, the basis of a low-RPO database backup strategy.
quiz:
  - type: mcq
    q: "An SLO of 99.9% successful requests over 30 days allows how much failure?"
    options: ["None", "0.1% of requests (the error budget), e.g. 1,000 failures per 1 million requests", "1% of requests", "43 minutes per day"]
    answer: 1
    explain: "The error budget is 1 − SLO. Spending it on deploys and experiments is fine; exhausting it signals a shift toward reliability work."
  - type: scenario
    q: Your error budget for the month is exhausted after a week. What does an error budget policy typically prescribe?
    options: ["Nothing", "Pause risky feature launches and prioritise reliability fixes until the budget recovers", "Lower the SLO immediately", "Fire the on-call engineer"]
    answer: 1
    explain: "The budget turns 'reliability vs velocity' into a shared, data-driven rule agreed in advance by product and engineering."
  - type: mcq
    q: What do RPO and RTO mean?
    options: ["Request per operation and response time objective", "RPO: maximum acceptable data loss measured in time; RTO: maximum acceptable time to restore service", "Replica count and timeout", "Two names for the same thing"]
    answer: 1
    explain: "Nightly backups alone mean an RPO of up to 24 hours. Continuous WAL archiving or replication brings RPO to seconds or minutes. RTO depends on how quickly you can restore and fail over, which you only know by practising."
  - type: tf
    q: A blameless postmortem means nobody is accountable for fixing anything.
    answer: 1
    explain: "False. Blameless means focusing on systemic causes (missing safeguards, confusing tooling) rather than punishing individuals, so people report honestly. Action items still have owners and deadlines."
---

## Why it matters

"Make it reliable" is not an engineering requirement; "99.9% of checkout requests succeed within 1 s, measured over 28 days" is. Reliability engineering turns vague expectations into measurable targets, uses them to decide when to ship and when to fix, prepares teams to handle incidents calmly, and proves (by practising) that recovery actually works. Without it, teams oscillate between shipping recklessly and freezing out of fear.

## SLIs, SLOs and SLAs

- **SLI (indicator):** a measurement of user-visible behaviour, usually a ratio of good events to total events.
- **SLO (objective):** a target for an SLI over a window. "99.9% of requests to `POST /checkout` return a non-5xx response in under 1 s, over a rolling 28 days."
- **SLA (agreement):** a contract with customers, with consequences (credits) if missed. SLAs should be looser than internal SLOs, so you have warning before breaching them.

### Choosing SLIs from user journeys

Start from what users do, not from what servers report:

| Journey | SLI type | SLI definition |
| --- | --- | --- |
| Browse products | Availability | Share of `GET /products*` returning non-5xx |
| Browse products | Latency | Share of those served in < 300 ms |
| Checkout | Availability + latency | Share of checkout requests succeeding in < 1 s |
| Order emails | Freshness | Share of confirmation emails sent within 2 min of the order |
| Data pipeline | Correctness / freshness | Share of hourly reports produced on time and passing validation |

Measure as close to the user as practical (load balancer or edge logs rather than inside the app, where queueing is invisible). Exclude traffic you don't own (malformed requests, `4xx` caused by clients) deliberately and document it.

### How many nines?

Each extra nine costs roughly an order of magnitude more effort. Don't aim higher than users need, and **never higher than your dependencies allow**: a service depending on a 99.9% database can't credibly promise 99.99% without redundancy. 100% is the wrong target; it leaves no room to change anything.

## Error budgets

**Error budget = 1 − SLO.** At 99.9% over 28 days with 10M requests, you may fail 10,000 requests. That budget is spent by incidents, risky deploys and experiments.

An **error budget policy**, agreed in advance by product and engineering:

- Budget healthy → ship features, run experiments, deploy freely.
- Budget burning fast → slow down: smaller deploys, more testing.
- Budget exhausted → freeze non-critical launches; reliability work takes priority until it recovers.

This turns the reliability-vs-velocity argument into data.

## Alerting on burn rate

Resource-threshold alerts ("CPU > 80%") are noisy and miss real problems. Alert on **how fast you're consuming the error budget**:

```
burn rate = observed error rate / (1 − SLO)
```

A burn rate of 1 uses exactly the whole budget over the window; a burn rate of 14.4 would consume a 30-day budget in about 2 days.

The Google SRE Workbook recommends **multi-window, multi-burn-rate** alerts, for example (for a 30-day, 99.9% SLO):

| Severity | Burn rate | Long window | Short window | Budget consumed if it continues |
| --- | --- | --- | --- | --- |
| Page | 14.4 | 1 hour | 5 minutes | 2% in 1 hour |
| Page | 6 | 6 hours | 30 minutes | 5% in 6 hours |
| Ticket | 1 | 3 days | 6 hours | 10% in 3 days |

The short window makes the alert reset quickly after recovery. A PromQL sketch:

```promql
# 5xx ratio over 1h and 5m, compared with 14.4 × the 0.1% budget
(
  sum(rate(http_requests_total{job="checkout",code=~"5.."}[1h])) / sum(rate(http_requests_total{job="checkout"}[1h]))
) > (14.4 * 0.001)
and
(
  sum(rate(http_requests_total{job="checkout",code=~"5.."}[5m])) / sum(rate(http_requests_total{job="checkout"}[5m]))
) > (14.4 * 0.001)
```

Every page should be **actionable, urgent and user-impacting**. Everything else becomes a ticket or a dashboard.

## Incident management

### Roles

- **Incident commander:** coordinates, decides, delegates. Doesn't debug.
- **Operations / subject-matter leads:** investigate and mitigate.
- **Communications lead:** status page, stakeholders, support.
- **Scribe:** timeline of actions and findings.

For small teams one person may hold several roles, but name them explicitly once an incident is declared.

### The lifecycle

1. **Detect:** alerts, customer reports, synthetic checks.
2. **Declare and triage:** severity (e.g. SEV1: major user impact), open a channel, assign roles.
3. **Mitigate first, diagnose later:** roll back the deploy, fail over, disable the feature flag, shed load, scale up. Restoring service beats understanding the root cause in the moment.
4. **Communicate** at regular intervals, even if the update is "still investigating".
5. **Resolve and monitor** for recurrence.
6. **Postmortem** within days.

Prepare **runbooks** for known failure modes: symptoms, dashboards, mitigation commands, escalation contacts. A runbook that says "check if X" without telling you how is not a runbook.

### Blameless postmortems

A good postmortem includes a summary, impact (users, duration, error budget consumed), a timeline, root cause *and contributing factors*, what went well, what went badly, where you got lucky, and **action items with owners and dates**. "Blameless" means assuming people acted reasonably with the information and tools they had, and fixing the system that allowed the mistake: missing safeguards, confusing tooling, absent alerts. People share the truth only when it's safe to.

Ask "how did our system allow this?" five ways, rather than "who did this?". Track action items to completion; a postmortem with undone action items predicts the next incident.

## Testing failure: fault injection and chaos engineering

Resilience mechanisms you've never exercised don't work when you need them. **Chaos engineering** is running controlled experiments to build confidence that the system handles turbulence.

The method (from the Principles of Chaos Engineering):

1. Define **steady state** in terms of business metrics (successful checkouts per minute, p99 latency).
2. **Hypothesise** it will hold during a fault ("if one Redis replica dies, checkout success stays above 99.5%").
3. **Inject** a realistic fault: kill instances, add latency, drop packets, fill disks, exhaust connections, fail a dependency, fail over a database.
4. **Minimise blast radius:** start in staging, then a small slice of production traffic, with a big red stop button and automatic abort on SLO burn.
5. **Learn:** if steady state broke, you found a weakness cheaply. Fix it and repeat.

```bash
# Add 300 ms latency to traffic leaving a container's eth0 (Linux tc / netem), then remove it
tc qdisc add dev eth0 root netem delay 300ms 50ms
tc qdisc del dev eth0 root

# Kubernetes: kill a random pod of a deployment
kubectl delete --wait=false $(kubectl get pods -l app=checkout -o name | shuf -n 1)
```

Tools: Chaos Mesh and LitmusChaos (Kubernetes), AWS Fault Injection Service, Gremlin, Toxiproxy (simulate bad networks between your app and its dependencies in tests). **Game days** are scheduled exercises where the team practises an incident scenario, including the human response.

## Backups and disaster recovery

### RPO and RTO

- **RPO (recovery point objective):** how much data you can afford to lose, measured in time. Nightly backups mean up to 24 hours of loss.
- **RTO (recovery time objective):** how long you can be down while recovering.

Set them per system with the business; they drive cost.

### Backup strategy

- **Full + incremental, or continuous:** for Postgres, a base backup plus continuous **WAL archiving** enables **point-in-time recovery** to any second (tools: pgBackRest, Barman, WAL-G; managed databases offer it built in). Logical dumps (`pg_dump`) are portable but slow for large databases and give a coarse RPO.
- **3-2-1 rule:** at least 3 copies, on 2 different media or services, 1 off-site. For cloud systems: a separate account or region, with **immutable** (object-lock) backups so ransomware or a compromised admin can't delete them.
- **Back up more than the database:** object storage (versioning plus replication), secrets and configuration, infrastructure as code (the code *is* the backup of your infrastructure), and queue contents if they're not reproducible.
- **Encrypt backups** and control access to them as tightly as production.

**Untested backups are hopes.** Schedule automated **restore drills**: restore the latest backup into an isolated environment, run integrity checks (row counts, checksums, application smoke tests), and record how long it took. That measured time is your real RTO.

### DR architectures

| Strategy | How | RPO | RTO | Cost |
| --- | --- | --- | --- | --- |
| Backup & restore | Restore from backups in another region | Hours (minutes with PITR) | Hours+ | Lowest |
| Pilot light | Data replicated; minimal core infrastructure ready, scaled up on disaster | Minutes | Tens of minutes to hours | Low |
| Warm standby | Scaled-down full copy running in another region | Seconds to minutes | Minutes | Medium |
| Multi-site active/active | Full capacity in several regions serving traffic | Near zero (depends on replication) | Near zero | Highest; data consistency is the hard part |

**Multi-AZ first:** most outages are single-instance or single-availability-zone failures. Run across at least two AZs with a synchronous database standby and automatic failover before considering multi-region. Multi-region adds major complexity: data replication across regions (latency vs consistency; see [distributed systems](/learn/distributed-systems-fundamentals/)), global traffic routing, and regional dependencies you forgot about (an auth provider or secrets store in one region).

Whatever you choose, **practise failover**: a DR plan that's never been executed will fail, usually on something mundane such as an expired credential, a hard-coded region, or DNS TTLs.

## Real-world scenarios

- A payment service with a 99.95% SLO on authorisations, burn-rate paging, a feature-flag kill switch for non-essential calls, and quarterly regional failover game days.
- A SaaS with daily PITR-capable backups to a separate account, monthly automated restore drills, and RPO 5 min / RTO 1 hour documented and measured.

## Common mistakes

- SLOs measured on server CPU instead of user experience.
- 100% or "five nines" targets nobody can meet or afford.
- Paging on every threshold, which leads to alert fatigue and ignored pages.
- Debugging root causes while users are down instead of mitigating first.
- Postmortems that blame people, or whose action items never get done.
- Backups never restored; DR plans never executed.

## Security considerations

- Backups are a prime target: immutable storage, separate credentials and accounts, encryption.
- Incident response must include security incidents: know how to rotate secrets fast, revoke sessions, and preserve evidence.
- Chaos tooling has destructive power: restrict who can run it and where.

## Performance considerations

- Latency SLOs make performance a measured reliability property.
- Failover capacity: the surviving AZ or region must handle full load, so plan headroom (N+1).

## Hands-on exercise

1. For an API you've built, define two SLIs and SLOs from a user journey, implement the metrics (Prometheus histograms and counters), and create multi-window burn-rate alerts. Trigger them with a fault and confirm they fire and resolve.
2. Write a runbook for "database connections exhausted".
3. Using Toxiproxy between your API and its database or Redis, run three chaos experiments (latency, connection reset, dependency down) with written hypotheses and results.
4. Set up Postgres WAL archiving (or use a managed provider's PITR), make some writes, "accidentally" drop a table, and restore to the moment before. Record the time taken.
5. Write a blameless postmortem for one of your experiments as if it had been a real incident.

## Completion criteria

- You can define SLIs and SLOs from user journeys and alert on burn rate.
- You can run and document an incident with clear roles and a blameless postmortem.
- You have restored from backup yourself and know your real RPO and RTO.
