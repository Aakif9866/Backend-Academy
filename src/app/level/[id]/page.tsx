import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { curriculum } from "@content/curriculum";
import { Page } from "@/components/ui";
import { LevelView } from "@/components/Views";
import { getAllProjectMeta, getLessonMeta } from "@/lib/content";
import { levelIcons } from "@/components/icons";

export function generateStaticParams() {
  return curriculum.map((l) => ({ id: l.id }));
}
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: curriculum.find((x) => x.id === id)?.title };
}

export default async function LevelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const level = curriculum.find((l) => l.id === id);
  if (!level) notFound();
  const Icon = levelIcons[level.id];
  const modules = level.modules.map((m) => ({ title: m.title, lessons: m.lessons.map(getLessonMeta) }));
  const slugs = new Set(level.modules.flatMap((m) => m.lessons));
  const projects = getAllProjectMeta().filter((p) => p.lessons.some((l) => slugs.has(l)));
  const prev = curriculum[level.n - 1];
  const next = curriculum[level.n + 1];
  const minutes = modules.flatMap((m) => m.lessons).reduce((a, l) => a + l.minutes, 0);

  return (
    <Page>
      <header data-tone={level.tone} className="glow strip border border-line bg-surface corner p-6 lg:p-10 mb-8 rise">
        <div className="flex items-center gap-3">
          <span className="bg-grad corner-sm size-11 grid place-items-center text-white"><Icon size={20} /></span>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-tone">Level {level.n}{level.optional ? " · Optional track" : ""}</span>
        </div>
        <h1 className="mt-5 text-3xl lg:text-5xl font-bold tracking-tight text-heading leading-[1.1]">{level.title}</h1>
        <p className="mt-5 text-lg text-muted leading-relaxed max-w-[65ch]">{level.summary}</p>
        <p className="mt-6 text-sm text-ink max-w-[65ch] border-l-2 border-[var(--c)] pl-4"><strong className="text-heading">By the end:</strong> {level.outcome}</p>
        <p className="mt-6 text-sm text-muted">{modules.flatMap((m) => m.lessons).length} lessons · about {Math.round(minutes / 60)} hours of reading{projects.length ? ` · ${projects.length} related projects` : ""}</p>
      </header>
      <LevelView tone={level.tone} modules={modules} projects={projects} />
      <nav className="mt-12 flex flex-wrap justify-between gap-4 text-sm">
        {prev ? <Link data-tone={prev.tone} className="text-tone hover:underline" href={`/level/${prev.id}/`}>← Level {prev.n}: {prev.short}</Link> : <span />}
        {next && <Link data-tone={next.tone} className="text-tone hover:underline" href={`/level/${next.id}/`}>Level {next.n}: {next.short} →</Link>}
      </nav>
    </Page>
  );
}
