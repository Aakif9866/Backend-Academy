---
title: "Design Walkthroughs: URL Shortener, Chat, Food Delivery"
summary: Three classic designs worked end to end (requirements, estimates, API, data model, deep dives, trade-offs) plus how a small app evolves to a million users.
difficulty: intermediate
minutes: 50
source: backend/11-design-walkthroughs.md
prerequisites: [system-design-method]
objectives:
  - Run a full design from requirements to trade-offs
  - Generate short codes without collisions at scale
  - Design message storage and delivery for a chat app
  - Handle real-time location and dispatch for delivery apps
videos:
  - id: vvhC64hQZMk
    title: "WHATSAPP System Design: Chat Messaging Systems for Interviews"
    channel: Gaurav Sen
    why: An alternative take on the chat design. Compare its choices with the ones in this lesson.
resources:
  - url: https://github.com/donnemartin/system-design-primer/blob/master/solutions/system_design/pastebin/README.md
    title: "System Design Primer: Pastebin / URL shortener solution"
    why: A second worked solution to compare against, including base62 encoding and analytics.
  - url: https://discord.com/blog/how-discord-stores-trillions-of-messages
    title: "Discord: How Discord stores trillions of messages"
    why: A real migration from Cassandra to ScyllaDB for chat messages, with the partitioning problems they hit.
quiz:
  - type: mcq
    q: A URL shortener uses 7-character base62 codes. About how many distinct codes is that?
    options: ["About 78 million", "About 3.5 trillion", "About 62 thousand", "About 10 billion"]
    answer: 1
    explain: 62^7 ≈ 3.52 × 10^12. Plenty for a shortener; the design question is generating them without collisions (counter ranges per server, or random with a uniqueness check).
  - type: scenario
    q: In a chat app, how should messages for a conversation be partitioned in a wide-column store?
    options: ["By message id only", "By conversation id (bucketed by time for very busy conversations), clustered by message time", "By user's country", "One partition for all messages"]
    answer: 1
    explain: The main query is "latest messages in this conversation", so the conversation is the partition key and time is the clustering key. Time buckets stop one huge group chat from making an unbounded partition.
  - type: tf
    q: For a URL shortener, redirects (reads) vastly outnumber creations (writes), so caching and a CDN are high-leverage.
    answer: 0
    explain: True. Read-heavy, immutable mappings are ideal for caching. A popular link should almost never reach the database.
---

## Hands-on exercise

Pick the food-delivery design and extend it with one feature the walkthrough doesn't cover: **live ETA updates to the customer**.

Write: the new API or events, which component computes ETAs and how often, how updates reach the customer's phone (choose a real-time technique and justify it), what happens if the courier's phone loses connectivity for 2 minutes, and the rough message rate at 50,000 concurrent active deliveries with a location ping every 4 seconds.

## Completion criteria

- You can present any of the three designs from memory with numbers and trade-offs.
- You can extend a design with a new feature and reason about its load.
