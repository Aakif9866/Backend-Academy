---
title: Technology Decision Matrix
summary: Requirement → technology tables for application types, data, communication, processing, non-functional needs and infrastructure, five complete architectures, and common anti-patterns.
difficulty: advanced
minutes: 50
source: backend/17-technology-decision-matrix.md
prerequisites: [system-design-basics]
objectives:
  - Map requirements to technology choices with explicit trade-offs
  - Record decisions as ADRs
  - Recognise common wrong choices before you make them
videos:
  - id: wgdBVIX9ifA
    title: Microservices • Martin Fowler • GOTO 2014
    channel: GOTO Conferences
    why: Fowler on what microservices really require; useful context for several anti-patterns in section 9.
resources:
  - url: https://adr.github.io/
    title: Architectural Decision Records (adr.github.io)
    why: Templates and tooling for ADRs like the example in section 1.
  - url: https://roadmap.sh/backend
    title: roadmap.sh Backend roadmap
    why: A broad map of backend technologies to cross-check what you have and haven't covered.
quiz:
  - type: mcq
    q: What makes an ADR useful months later?
    options: ["It's long", "It records the context and alternatives, so future readers know why and when to revisit", "It names the person to blame", "It contains the code"]
    answer: 1
    explain: Decisions are judged later without the original context. Recording the forces, options and consequences lets the team reopen a decision deliberately when the context changes.
  - type: scenario
    q: A 3-developer team with 2,000 users proposes Kubernetes, Kafka and 12 microservices. Which anti-pattern is this?
    options: ["Premature optimisation / resume-driven architecture", "Polyglot persistence", "Vertical scaling", "Caching"]
    answer: 0
    explain: The operational cost far exceeds the need. A modular monolith on a managed platform with Postgres would ship faster and run cheaper; add pieces when real load or team size demands them.
---

## Hands-on exercise

Choose an app you use daily. Fill in the requirement tables from this lesson for it (application type, data needs, communication, processing, non-functional), then propose a stack. Finally, swap one requirement (for example "must work offline" or "must keep data in the EU") and show which choices change.

## Completion criteria

- You can go from a requirement list to a defensible stack, and show how changing a requirement changes it.
