# Backend Academy

A learning platform that takes you from backend fundamentals to production-grade engineering and large-scale system design. It has 12 levels, 51 lessons, 17 hands-on projects, 9 interactive simulations and 218 quiz questions. Everything is built from the Markdown in this repository.

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm build        # validates content, then exports a static site to out/
pnpm check-links  # verifies every external link and YouTube video
```

| Path | What |
| --- | --- |
| `backend/` | The original notes (unchanged; wrapped by lessons) |
| `content/curriculum.ts` | The roadmap: levels → modules → lessons |
| `content/lessons/` | Lessons (Markdown + frontmatter: objectives, videos, resources, quiz) |
| `content/projects/` | Project briefs |
| `src/` | The Next.js app (components, simulations in `src/components/viz/`) |
| `scripts/validate.mjs` | Content validation (runs on every build) |
| `docs/` | Inventory, roadmap, gaps, architecture and implementation report |

Progress, bookmarks and quiz scores are stored in your browser's localStorage. Use Progress → Export to move them to another device.
