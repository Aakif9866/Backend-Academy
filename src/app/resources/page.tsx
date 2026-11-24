import type { Metadata } from "next";
import { Page, PageHeader } from "@/components/ui";
import { ResourceLibrary } from "@/components/Views";
import { getAllLessonMeta } from "@/lib/content";

export const metadata: Metadata = { title: "Resource Library" };

export default function Resources() {
  const seen = new Set<string>();
  const items = getAllLessonMeta().flatMap((l) => {
    const base = { lesson: l.slug, lessonTitle: l.title, tone: l.tone, levelN: l.levelN };
    return [
      ...l.resources.map((r) => ({ ...r, ...base, kind: "doc" as const })),
      ...l.videos.map((v) => ({ ...v, ...base, kind: "video" as const, url: `https://www.youtube.com/watch?v=${v.id}` })),
    ];
  }).filter((i) => (seen.has(i.url) ? false : (seen.add(i.url), true)));
  return (
    <Page>
      <PageHeader eyebrow="Resource library" title={<>Primary sources, <span className="text-grad">hand-picked.</span></>} tone="cyan">
        Official documentation, RFCs, papers, engineering blogs and talks, each tied to the lesson it supports and checked to resolve. The lessons teach; these go deeper.
      </PageHeader>
      <ResourceLibrary items={items} />
    </Page>
  );
}
