import type { Metadata } from "next";
import Link from "next/link";
import { getAllLessonMeta, getLessonMeta } from "@/lib/content";
import { Page, PageHeader } from "@/components/ui";
import { Quiz } from "@/components/Quiz";

export function generateStaticParams() {
  return getAllLessonMeta().filter((l) => l.quiz.length).map((l) => ({ slug: l.slug }));
}
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return { title: `Quiz: ${getLessonMeta((await params).slug).title}` };
}

export default async function PracticeQuiz({ params }: { params: Promise<{ slug: string }> }) {
  const l = getLessonMeta((await params).slug);
  return (
    <Page>
      <div data-tone={l.tone} className="max-w-[800px]">
        <PageHeader eyebrow={`Level ${l.levelN} · Quiz`} title={l.title} tone={l.tone}>
          {l.quiz.length} questions. <Link href={`/learn/${l.slug}/`} className="text-tone hover:underline">Review the lesson</Link> first if you need to.
        </PageHeader>
        <Quiz slug={l.slug} questions={l.quiz} />
      </div>
    </Page>
  );
}
