import type { Metadata } from "next";
import { Page, PageHeader } from "@/components/ui";
import { BookmarkList } from "@/components/Views";
import { getAllLessonMeta, getAllProjectMeta } from "@/lib/content";

export const metadata: Metadata = { title: "Bookmarks" };

export default function Bookmarks() {
  return (
    <Page>
      <PageHeader eyebrow="Bookmarks" title="Saved for later" tone="pink" />
      <BookmarkList lessons={getAllLessonMeta()} projects={getAllProjectMeta()} />
    </Page>
  );
}
