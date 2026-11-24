import { getAllLessonMeta, getLesson, getAllProjectMeta, getProject } from "@/lib/content";

export const dynamic = "force-static";

export interface SearchDoc { kind: "lesson" | "section" | "project" | "resource"; title: string; href: string; context: string; body: string; tone: string }

export function GET() {
  const docs: SearchDoc[] = [];
  const seenUrls = new Set<string>();
  for (const meta of getAllLessonMeta()) {
    const l = getLesson(meta.slug);
    const href = `/learn/${l.slug}/`;
    const context = `Level ${l.levelN} · ${l.module}`;
    docs.push({ kind: "lesson", title: l.title, href, context, body: `${l.summary} ${l.text.slice(0, 20000)}`, tone: l.tone });
    for (const h of l.headings) docs.push({ kind: "section", title: h.text, href: `${href}#${h.id}`, context: l.title, body: "", tone: l.tone });
    for (const r of [...l.resources, ...l.videos.map((v) => ({ url: `https://www.youtube.com/watch?v=${v.id}`, title: v.title, why: `${v.channel}: ${v.why}` }))]) {
      if (seenUrls.has(r.url)) continue;
      seenUrls.add(r.url);
      docs.push({ kind: "resource", title: r.title, href: r.url, context: l.title, body: r.why, tone: l.tone });
    }
  }
  for (const meta of getAllProjectMeta()) {
    const p = getProject(meta.slug);
    docs.push({ kind: "project", title: p.title, href: `/projects/${p.slug}/`, context: `${p.tier} project`, body: `${p.summary} ${p.stack.join(" ")} ${p.text.slice(0, 8000)}`, tone: "orange" });
  }
  return Response.json(docs);
}
