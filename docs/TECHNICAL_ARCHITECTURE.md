# Technical architecture

## Stack

| Concern | Choice | Why |
| --- | --- | --- |
| Framework | **Next.js 16** (App Router), **static export** (`output: "export"`) | Every page is generated at build time, so it can be hosted on any static host or CDN, with no server to run |
| Language | TypeScript 5 (strict) | — |
| Styling | **Tailwind CSS 4** + CSS custom properties | Klyro "Spectrum" design tokens (`--bg`, `--surface`, `--c` tone…) in `src/app/globals.css`; light/dark themes swap tokens only |
| Markdown | `gray-matter` (frontmatter) + `marked` + `marked-highlight` + `highlight.js` | Rendered to HTML at build time; syntax colours come from the same tokens, so they work in both themes |
| Diagrams | **Mermaid** (lazy-loaded on pages that have diagrams; re-rendered on theme change) | Diagrams live in Markdown as ```` ```mermaid ```` blocks |
| Icons | `lucide-react` | One icon set |
| Progress | `localStorage` behind `useSyncExternalStore` | No backend needed; syncs across tabs |
| Fonts | Inter + JetBrains Mono via `next/font` | Self-hosted at build time |

No database, no auth, no analytics.

## Content pipeline

```
content/curriculum.ts        the roadmap: levels → modules → lesson slugs (the single source of order)
content/lessons/<slug>.md    frontmatter (metadata, videos, resources, quiz) + body
   └─ source: backend/NN-*.md   optional: wrap an original note; body = extras appended after it
content/projects/<slug>.md   project briefs (frontmatter: tier, stack, steps for milestone tracking)
content/guides.ts            decision-guide index (question → lesson + anchor)
        │
src/lib/content.ts           build-time loader: parses frontmatter, renders Markdown, builds nav
        │                    - GitHub-compatible heading ids (so the old notes' anchors still work)
        │                    - rewrites links between original notes to /learn/<slug>/#anchor
        │                    - links into the external PLOS project → plain text with a tooltip
        │                    - wraps tables for horizontal scroll; turns ```mermaid into <pre class="mermaid">
        ▼
src/app/**                   static pages via generateStaticParams
```

**Interactive simulations** are React components in `src/components/viz/`, registered by name in `viz/index.tsx` and embedded in Markdown with `<div data-viz="name"></div>`. `LessonBody` splits the HTML on those markers and mounts the components after hydration (they use timers and randomness, so they're client-only).

## Routes (141 static pages)

| Route | What |
| --- | --- |
| `/` | Dashboard: progress, continue, stats (completion, study time, quiz average, streak), path, recent, milestones, projects |
| `/roadmap/` | All levels with per-lesson completion |
| `/level/[id]/` | Level overview: modules, lesson cards, related projects |
| `/learn/[slug]/` | Lesson: header, objectives, prerequisites, body, simulations, videos, further reading, quiz, complete/bookmark, prev/next, sticky TOC, reading progress |
| `/projects/`, `/projects/[slug]/` | Project grid by tier; brief with tickable milestones |
| `/practice/`, `/practice/[slug]/` | Quiz hub with scores; standalone quiz |
| `/guides/` | Decision-guide index |
| `/resources/` | Filterable library of every reference and video |
| `/bookmarks/`, `/progress/` | Saved items; per-level progress, quiz table, history, export/import/reset |
| `/search-index.json` | Static search index (lessons, every section heading, projects, resources) |

## Search

`/search-index.json` is generated at build time. The ⌘K / `/` dialog fetches it once, then scores matches client-side (title-prefix > title > body, and every term must match) with filters (All, Lessons, Topics, Projects, Resources) and full keyboard navigation (↑↓, Enter, Tab to change filter, Esc).

## Progress data model

```ts
// localStorage key: "academy:v1:user:local"
interface ProgressState {
  version: 1;
  completed: Record<lessonSlug, timestampMs>;
  bookmarks: Record<lessonSlug | `project:${slug}`, timestampMs>;
  quiz: Record<lessonSlug, { score; total; best; at }>;
  projects: Record<projectSlug, { steps: number[]; startedAt; doneAt? }>;
  history: { slug; at }[];   // most recent 30
}
```

The key is per user (`user:local` today), and the shape is a plain JSON document, so adding accounts later means swapping `src/lib/progress.ts`'s storage functions for API calls keyed by user id. No component changes are needed. Export and import on the Progress page already move this document between devices.

## Validation and QA

- `pnpm validate` runs before every build (`scripts/validate.mjs`): every placed slug has a file and every file is placed; frontmatter schema; difficulty and quiz types; quiz answers in range; prerequisites exist and don't point forward; videos have ids, titles and channels; resources are https with title and description; `data-viz` names exist; internal `/learn/` and `/projects/` links resolve; code fences are balanced; every original note except PLOS is used; guides point at real lessons.
- `pnpm check-links` also fetches every resource URL and checks every YouTube video via oEmbed (warning if the stored title differs from YouTube's).
- `scripts/quote-frontmatter.mjs` is an authoring helper that quotes YAML values containing `: `.

## Design system (Klyro, Spectrum vibe)

Pitch-black neutral surfaces in dark mode (`#000 / #0a0a0a / #151515`) and a clean light theme; each level owns a **tone** (colour, deep gradient, bright gradient) set with `data-tone`, so links, chips, strips and progress dials re-tint automatically. Signature pieces: 3px brand strip, gradient top strips on cards, opposite-corner rounding (`.corner`), soft corner glows on hero cards, conic progress dials, borders instead of shadows, the CTA slide-up reveal on project cards, and motion wrapped in `prefers-reduced-motion`. All text and tone colours measured ≥ 4.5:1 (WCAG AA) on every surface in both themes.

## Running

```bash
pnpm install
pnpm dev            # http://localhost:3000
pnpm build          # validate + static export to out/
pnpm start          # serve out/ locally
pnpm check-links    # online link + video verification
```
