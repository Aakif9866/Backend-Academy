import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Layers } from "lucide-react";
import { getAllProjectMeta, getProject, getLessonMeta } from "@/lib/content";
import { LessonBody } from "@/components/LessonBody";
import { BookmarkButton, ReadingProgress, Toc } from "@/components/LessonParts";
import { ProjectSteps } from "@/components/Views";

const TONE = { beginner: "emerald", intermediate: "blue", advanced: "purple", expert: "rose" } as const;

export function generateStaticParams() {
  return getAllProjectMeta().map((p) => ({ slug: p.slug }));
}
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = getProject((await params).slug);
  return { title: p.title, description: p.summary };
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const p = getProject((await params).slug);
  const lessons = p.lessons.map(getLessonMeta);
  return (
    <div data-tone={TONE[p.tier]}>
      <ReadingProgress />
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-10 pt-6 lg:pt-10 pb-24 flex gap-12">
        <article className="min-w-0 flex-1 max-w-[800px]">
          <header className="glow strip border border-line bg-surface corner p-6 lg:p-9 rise">
            <Link href="/projects/" className="text-sm text-tone font-medium hover:underline">← Projects</Link>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-tone">{p.tier} project</p>
            <h1 className="mt-3 text-3xl lg:text-5xl font-bold tracking-tight text-heading leading-[1.1]">{p.title}</h1>
            <p className="mt-5 text-lg text-muted leading-relaxed">{p.summary}</p>
            <div className="mt-6 flex flex-wrap gap-2.5 text-sm">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-line text-muted"><Clock size={14} /> {p.hours}</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-line text-muted"><Layers size={14} /> {p.stack.join(" · ")}</span>
            </div>
            <div className="mt-7"><BookmarkButton id={`project:${p.slug}`} /></div>
          </header>
          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
            <section className="border border-line bg-surface corner p-5 lg:p-6"><ProjectSteps slug={p.slug} steps={p.steps} /></section>
            <section className="border border-line bg-surface corner p-5 lg:p-6">
              <p className="font-semibold text-heading">Learn first</p>
              <ul className="mt-3 space-y-1">
                {lessons.map((l) => (
                  <li key={l.slug} data-tone={l.tone}>
                    <Link href={`/learn/${l.slug}/`} className="flex items-center gap-2.5 py-1.5 text-sm hover:text-heading">
                      <span className="size-2 rounded-full bg-[var(--c)] shrink-0" />{l.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>
          <div className="mt-6"><LessonBody html={p.html} /></div>
        </article>
        <aside className="hidden xl:block w-60 shrink-0">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto scroll-thin"><Toc headings={p.headings.filter((h) => h.depth === 2)} /></div>
        </aside>
      </div>
    </div>
  );
}
