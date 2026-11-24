import type { Metadata } from "next";
import { Page, PageHeader } from "@/components/ui";
import { PracticeList } from "@/components/Views";
import { getAllLessonMeta } from "@/lib/content";

export const metadata: Metadata = { title: "Practice & Quizzes" };

export default function Practice() {
  const lessons = getAllLessonMeta().filter((l) => l.quiz.length);
  return (
    <Page>
      <PageHeader eyebrow="Practice" title={<>Test what you <span className="text-grad">actually know.</span></>} tone="emerald">
        Multiple choice, true/false, scenario, code-reading and architecture-decision questions, each with an explanation of why the right answer is right and the others are wrong. A perfect score marks the lesson complete.
      </PageHeader>
      <PracticeList lessons={lessons} />
    </Page>
  );
}
