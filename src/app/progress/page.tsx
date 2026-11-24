import type { Metadata } from "next";
import { Page, PageHeader } from "@/components/ui";
import { ProgressView } from "@/components/Views";
import { getAllLessonMeta, getAllProjectMeta, getNav } from "@/lib/content";

export const metadata: Metadata = { title: "Progress" };

export default function ProgressPage() {
  return (
    <Page>
      <PageHeader eyebrow="Progress" title="How far you've come" tone="amber" />
      <ProgressView nav={getNav()} lessons={getAllLessonMeta()} projects={getAllProjectMeta()} />
    </Page>
  );
}
