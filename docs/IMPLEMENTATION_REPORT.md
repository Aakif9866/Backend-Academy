# Implementation report

## What was built

**Backend Academy** is a static Next.js 16 + Tailwind 4 learning platform in the Klyro "Spectrum" design language, generated entirely from Markdown content in this repository. It follows a local roadmap (`content/curriculum.ts`) from computer-science foundations to distributed systems, production operations and optional expert tracks.

| | Count |
| --- | --- |
| Levels | 12 (0–10 core, 11 optional) |
| Lessons | 51 (18 from the original notes, 33 new) |
| Lesson content | ~11,200 lines of Markdown, plus the ~4,900 lines of original notes |
| Hands-on projects | 17 (3 beginner, 6 intermediate, 5 advanced, 3 expert) |
| Quiz questions | 218 across 51 lessons (multiple choice, true/false, scenario, code reading) |
| Interactive simulations | 9 |
| External resources | 189, all verified reachable |
| YouTube videos | 79 distinct videos, all verified via YouTube oEmbed |
| Static pages | 141 |

## Curriculum structure

See [CURRICULUM_ROADMAP.md](CURRICULUM_ROADMAP.md). Every new lesson follows the requested structure: objectives, why it matters, prerequisites, conceptual explanation, internals, diagrams (Mermaid and/or simulations), working code, real-world scenarios, trade-offs, common mistakes, security, performance, hands-on exercise, knowledge check, further reading, videos, completion criteria. Wrapped original notes keep their own structure and gain objectives, videos, references, a quiz, an exercise and completion criteria.

## Existing content migrated

All 18 relevant notes in `backend/` are used unchanged via `source:` wrappers. `01-read-the-plos-backend.md` is excluded because PLOS is a separate project. Cross-links between notes were rewritten to lesson URLs with working anchors. Links into PLOS render as text with an explanatory tooltip. Full audit: [CONTENT_INVENTORY.md](CONTENT_INVENTORY.md).

## New content

33 lessons filling the gaps listed in [CONTENT_GAPS.md](CONTENT_GAPS.md), covering foundations, networking, API design, SQL, MVCC, indexing, authentication, web security, caching, architecture styles, CQRS/sagas, resilience, the design method, distributed systems, consensus, eight additional system designs, decision guides, performance, reliability, Docker, Kubernetes, CI/CD and IaC, observability, storage engines, Kafka and stream processing, and AI-enabled backends. Plus 17 project briefs, each with overview, requirements, architecture, database design, API contracts, technology choices, steps, starter structure, testing, deployment, an evaluation rubric and extensions.

No benchmarks or statistics were invented. Where numbers appear they are either standard orders of magnitude, explicit assumptions in worked estimates, or prompts for the learner to measure. Labs ask learners to record their own measurements.

## Interactive features

| Simulation | Lesson(s) | What learners do |
| --- | --- | --- |
| Request lifecycle | How the Internet Works | Step through DNS, TCP, TLS 1.3 and HTTP; compare HTTP/3 and reused connections by round-trip count |
| Load balancer | Proxies; System Design Basics | Change server count, algorithm and rate; kill or slow servers; compare imbalance |
| Cache eviction | Caching in Depth | LRU / LFU / FIFO with adjustable capacity and a Zipf workload; hit ratio |
| Rate limiter | Async Design; Web Vulnerabilities | Token bucket vs fixed vs sliding window; bursts; see the fixed-window boundary problem |
| Circuit breaker | Resilience Patterns | Healthy/flaky/down downstream; thresholds and cooldown; watch closed → open → half-open |
| Consistent hashing | Distributed Systems Fundamentals | Add or remove nodes and virtual nodes; keys moved vs `hash % N` |
| Quorum | Distributed Systems Fundamentals | Set N/R/W, crash replicas, observe stale reads when R + W ≤ N, and read repair |
| Kafka partitions | Messaging; Kafka Internals | Partitions vs consumers, lag, idle consumers, keyed ordering |
| Lost update | Choosing Databases; Transactions | Step through naive, atomic, FOR UPDATE and optimistic strategies |

Platform features: dashboard (progress, continue, study time, quiz average, streak, path, recent, milestones, projects), roadmap, level pages, lesson pages (sidebar tree, sticky TOC with active section, reading progress, mark complete, bookmark, copy-code buttons, Mermaid diagrams re-themed live, lazy click-to-play videos via youtube-nocookie, resource cards, quiz with explanations, prev/next), project pages with tickable milestones, practice hub, decision guides, resource library with filters, bookmarks, a progress page with export, import and reset, ⌘K search with filters and keyboard navigation, dark/light themes with no flash, and a responsive mobile drawer.

## Testing performed

| Check | Result |
| --- | --- |
| `pnpm validate` (schema, references, coverage, embeds) | 0 errors, 0 warnings |
| `pnpm check-links` (189 URLs, 79 video embeds) | All resolve. One unverifiable link (LinkedIn blocks automated checks) was removed; one moved Firebase page and one timing-out GNU URL were replaced; one video title corrected |
| Production build | 141 static pages, TypeScript clean |
| Static link check over the built HTML | 0 broken internal links or anchors |
| Browser crawl of all 139 routes at 390, 768 and 1440 px (Playwright/Chromium) | 0 console errors, 0 page errors, 0 failed Mermaid diagrams, 0 horizontal overflow (after fixing quiz fieldset sizing, grid min-widths, long inline code and links, two Mermaid syntax issues and one hydration mismatch) |
| End-to-end interactions (21 checks) | Completion persists across reload; bookmarks; quiz scoring and Progress table; dashboard returning-user state; project milestone persistence; search → section anchor; theme persistence; all 9 simulations respond correctly (for example, cold HTTP/2 = 4 round trips, HTTP/3 = 3; naive lost update ends at 50); mobile drawer navigation |
| WCAG contrast (all text and tone tokens on all surfaces, both themes; white on all gradient stops) | All ≥ 4.5:1 after darkening three light-mode tones |
| Visual review | Dashboard, roadmap, lesson, projects at desktop and mobile in both themes |

## Remaining limitations

- **No user accounts:** progress lives in the browser's localStorage (exportable). The data model is per-user and ready for an API-backed store.
- **No in-browser code execution:** practice is quizzes (including code reading) plus project briefs. There's no auto-graded coding sandbox.
- **Topics without dedicated lessons yet:** search-engine internals, GraphQL and gRPC deep dives, multi-region as its own lesson, serverless/edge, CDN and object-storage internals, FinOps, platform engineering, testing strategy. See [CONTENT_GAPS.md](CONTENT_GAPS.md).
- **External content can change:** links and videos were verified on 2026-11-10. Rerun `pnpm check-links` periodically.
- **Simulations are teaching models:** they implement the real algorithms (token bucket, LRU/LFU, quorum overlap, consistent hashing, circuit-breaker states, Kafka assignment) at small scale, but they aren't performance simulators.
- **Original notes are shown as written,** including their PLOS-specific examples and dated pricing; accuracy notes are added beside them rather than editing them.
