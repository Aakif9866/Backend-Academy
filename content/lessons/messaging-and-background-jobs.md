---
title: Messaging Systems and Background Jobs
summary: Queues vs event streams, RabbitMQ, Kafka, Redis Streams, SQS/SNS, BullMQ and Celery; ordering, delivery semantics, the outbox pattern and failure handling.
difficulty: intermediate
minutes: 60
source: backend/16-messaging-and-background-jobs.md
prerequisites: [system-design-async]
objectives:
  - Explain the difference between a message queue and a replayable event log
  - Choose between RabbitMQ, Kafka, SQS, Redis Streams and a job library for a given need
  - Explain how partitioning gives ordering and parallelism in Kafka
  - Solve the dual-write problem with a transactional outbox
videos:
  - id: uvb00oaa3k8
    title: Kafka in 100 Seconds
    channel: Fireship
    why: A quick mental model of topics, partitions and consumers before the deep comparison.
  - id: qu96DFXtbG4
    title: "Apache Kafka 101: Introduction (2023)"
    channel: Confluent, an IBM Company
    why: The first episode of Confluent's official Kafka course, from the company founded by Kafka's creators.
resources:
  - url: https://www.rabbitmq.com/tutorials
    title: RabbitMQ tutorials
    why: Official hands-on tutorials for work queues, pub/sub, routing and RPC.
  - url: https://kafka.apache.org/documentation/#design
    title: "Apache Kafka documentation: Design"
    why: Why Kafka is a log, how partitions and consumer groups work, from the project itself.
  - url: https://microservices.io/patterns/data/transactional-outbox.html
    title: "microservices.io: Transactional outbox"
    why: The pattern for publishing events reliably alongside a database write.
  - url: https://docs.bullmq.io/
    title: BullMQ documentation
    why: Redis-backed job queues for Node with retries, backoff and rate limits.
quiz:
  - type: mcq
    q: A new analytics service needs to process every order event from the last 30 days, then keep up with new ones. Which system makes this natural?
    options: ["RabbitMQ classic queue", "Kafka (a retained, replayable log)", "SQS standard queue", "Cron"]
    answer: 1
    explain: Kafka retains messages for a configured period regardless of consumption, so a new consumer group can start from an old offset. Traditional queues delete messages once they're acknowledged.
  - type: code
    q: What is the bug in this handler?
    code: |
      await db.query('INSERT INTO orders ...');
      await kafka.send({ topic: 'orders', messages: [orderCreated] });
    options: ["None", "Dual write: if the process crashes between the two lines, the order exists but the event is never published (or the reverse if reordered)", "Kafka can't accept JSON", "You must send before inserting"]
    answer: 1
    explain: Two systems can't be updated atomically. The transactional outbox writes the event into an `outbox` table in the same DB transaction, and a relay publishes it afterwards.
  - type: tf
    q: Kafka guarantees ordering of messages within a partition, not across a whole topic.
    answer: 0
    explain: True. Use a key (such as order_id) so all events for one entity go to the same partition and stay ordered.
  - type: scenario
    q: You have 6 partitions and scale your consumer group to 10 instances. What happens?
    options: ["Throughput rises 10/6×", "6 consumers get a partition each; 4 sit idle", "Kafka creates 4 new partitions", "Messages are duplicated to all 10"]
    answer: 1
    explain: Within a group, each partition is assigned to exactly one consumer. Parallelism is capped by the partition count, so plan partitions for peak consumers. Try it in the simulator.
---

<div data-viz="kafka-partitions"></div>

## Hands-on exercise

With Docker Compose, run Postgres and either RabbitMQ or Redpanda (Kafka-compatible, single binary):

1. Build an `orders` API that inserts the order **and** an outbox row in one transaction.
2. Write a relay process that polls the outbox, publishes to the broker, and marks rows as sent.
3. Write an email-consumer that is idempotent: it records processed `event_id`s in a table with a unique constraint and skips duplicates.
4. Kill the relay mid-run and restart it. Verify no event is lost and none is emailed twice.

## Completion criteria

- You can choose a messaging system with reasons, not habit.
- You've implemented a transactional outbox and an idempotent consumer.
