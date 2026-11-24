import type { Metadata } from "next";
import { Page, PageHeader } from "@/components/ui";
import { RoadmapView } from "@/components/Views";
import { getAllLessonMeta, getNav } from "@/lib/content";

export const metadata: Metadata = { title: "Learning Roadmap" };

export default function Roadmap() {
  const lessons = getAllLessonMeta();
  return (
    <Page>
      <PageHeader eyebrow="Learning roadmap" title={<>Twelve levels, <span className="text-grad">one path.</span></>} tone="indigo">
        Each level builds on the one before. Levels 0–10 are the core path ({lessons.filter((l) => l.levelN <= 10).length} lessons); Level 11 is a set of optional deep dives. Projects slot in as you go.
      </PageHeader>
      <RoadmapView nav={getNav()} />
    </Page>
  );
}
