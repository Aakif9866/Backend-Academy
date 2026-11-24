import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, Clock, Target, ListTree, ExternalLink, BookOpen, Play, ListChecks, FileText } from "lucide-react";
import { getAllLessonMeta, getLesson, getLessonMeta } from "@/lib/content";
import { LessonBody } from "@/components/LessonBody";
import { ReadingProgress, VisitTracker, Toc, CompleteButton, BookmarkButton, VideoCard } from "@/components/LessonParts";
import { Quiz } from "@/components/Quiz";
import { DifficultyBadge, SectionTitle } from "@/components/ui";
import { levelIcons } from "@/components/icons";

export function generateStaticParams() {
  return getAllLessonMeta().map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const l = getLessonMeta((await params).slug);
  return { title: l.title, description: l.summary };
}

export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lesson = getLesson(slug);
  const all = getAllLessonMeta();
  const prev = all[lesson.order - 1];
  const next = all[lesson.order + 1];
  const LevelIcon = levelIcons[lesson.levelId];
  const prereqs = lesson.prerequisites.map(getLessonMeta);
  const extraToc = [
    ...(lesson.videos.length ? [{ id: "videos", text: "Video resources", depth: 2 }] : []),
    ...(lesson.resources.length ? [{ id: "further-reading", text: "Further reading", depth: 2 }] : []),
    ...(lesson.quiz.length ? [{ id: "knowledge-check", text: "Knowledge check", depth: 2 }] : []),
  ];

  return (
    <div data-tone={lesson.tone}>
      <ReadingProgress />
      <VisitTracker slug={slug} />
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-10 pt-6 lg:pt-10 pb-24 flex gap-12">
        <article className="min-w-0 flex-1 max-w-[800px]">
          {/* header */}
          <header className="glow strip border border-line bg-surface corner p-6 lg:p-9 rise">
            <Link href={`/level/${lesson.levelId}/`} className="inline-flex items-center gap-2 text-sm text-tone font-medium hover:underline">
              <LevelIcon size={16} /> Level {lesson.levelN} · {lesson.levelTitle}
            </Link>
            <p className="mt-1 text-xs uppercase tracking-[0.12em] text-muted">{lesson.module}</p>
            <h1 className="mt-5 text-3xl lg:text-5xl font-bold tracking-tight text-heading leading-[1.1]">{lesson.title}</h1>
            <p className="mt-5 text-lg text-muted leading-relaxed max-w-[62ch]">{lesson.summary}</p>
            <div className="mt-6 flex flex-wrap items-center gap-2.5 text-sm">
              <DifficultyBadge d={lesson.difficulty} />
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-line text-muted">
                <Clock size={14} /> {lesson.minutes} min
              </span>
              {lesson.source && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-line text-muted" title={`Original notes: ${lesson.source}`}>
                  <FileText size={14} /> From your notes
                </span>
              )}
              {lesson.quiz.length > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-line text-muted">
                  <ListChecks size={14} /> {lesson.quiz.length}-question check
                </span>
              )}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <CompleteButton slug={slug} />
              <BookmarkButton id={slug} />
            </div>
          </header>

          {(lesson.objectives.length > 0 || prereqs.length > 0) && (
            <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
              {lesson.objectives.length > 0 && (
                <section className={`border border-line bg-surface corner p-5 lg:p-6 ${prereqs.length ? "" : "md:col-span-2"}`}>
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-heading">
                    <Target size={16} className="text-tone" /> You will be able to
                  </h2>
                  <ul className="mt-4 space-y-2.5 text-[0.95rem] leading-relaxed">
                    {lesson.objectives.map((o) => (
                      <li key={o} className="flex gap-2.5">
                        <span className="mt-[9px] size-1.5 rounded-full bg-grad-bright shrink-0" />
                        {o}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {prereqs.length > 0 && (
                <section className="border border-line bg-surface corner p-5 lg:p-6">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-heading">
                    <ListTree size={16} className="text-tone" /> Read first
                  </h2>
                  <ul className="mt-4 space-y-1">
                    {prereqs.map((p) => (
                      <li key={p.slug} data-tone={p.tone}>
                        <Link href={`/learn/${p.slug}/`} className="flex items-center justify-between gap-3 py-2 text-[0.95rem] hover:text-heading group">
                          <span>{p.title}</span>
                          <ArrowRight size={15} className="shrink-0 text-tone group-hover:translate-x-0.5 transition-transform" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}

          <div className="mt-6">
            <LessonBody html={lesson.html} />
          </div>

          {lesson.videos.length > 0 && (
            <section className="mt-16">
              <SectionTitle id="videos" icon={<Play size={18} />}>Video resources</SectionTitle>
              <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
                {lesson.videos.map((v) => (
                  <VideoCard key={v.id} v={v} />
                ))}
              </div>
            </section>
          )}

          {lesson.resources.length > 0 && (
            <section className="mt-16">
              <SectionTitle id="further-reading" icon={<BookOpen size={18} />}>Further reading</SectionTitle>
              <ul className="mt-6 space-y-3">
                {lesson.resources.map((r) => (
                  <li key={r.url}>
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="group flex gap-4 border border-line bg-surface corner-sm p-5 hover:border-[var(--c)] transition-colors duration-150">
                      <ExternalLink size={17} className="mt-0.5 text-tone shrink-0" />
                      <span className="min-w-0">
                        <span className="block font-medium text-heading group-hover:text-tone transition-colors">{r.title}</span>
                        <span className="block text-sm text-muted mt-1 leading-relaxed">{r.why}</span>
                        <span className="block text-xs text-muted/70 mt-2 truncate">{new URL(r.url).host}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {lesson.quiz.length > 0 && (
            <section className="mt-16">
              <SectionTitle id="knowledge-check" icon={<ListChecks size={18} />}>Knowledge check</SectionTitle>
              <div className="mt-6">
                <Quiz slug={slug} questions={lesson.quiz} />
              </div>
            </section>
          )}

          <section className="mt-16 glow border border-line bg-surface corner p-6 lg:p-8 flex flex-col sm:flex-row sm:items-center gap-5 justify-between">
            <div>
              <p className="font-semibold text-heading text-lg">Finished this lesson?</p>
              <p className="text-sm text-muted mt-1">Mark it complete to track your progress through Level {lesson.levelN}.</p>
            </div>
            <CompleteButton slug={slug} large />
          </section>

          <nav className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2" aria-label="Lesson navigation">
            {prev ? (
              <Link href={`/learn/${prev.slug}/`} data-tone={prev.tone} className="group border border-line bg-surface corner-sm p-5 hover:border-[var(--c)] transition-colors">
                <span className="flex items-center gap-1.5 text-xs text-muted"><ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" /> Previous</span>
                <span className="block mt-2 font-medium text-heading">{prev.title}</span>
              </Link>
            ) : <span />}
            {next && (
              <Link href={`/learn/${next.slug}/`} data-tone={next.tone} className="group border border-line bg-surface corner-sm p-5 hover:border-[var(--c)] transition-colors text-right">
                <span className="flex items-center justify-end gap-1.5 text-xs text-muted">Next <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" /></span>
                <span className="block mt-2 font-medium text-heading">{next.title}</span>
              </Link>
            )}
          </nav>
        </article>

        <aside className="hidden xl:block w-60 shrink-0">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto scroll-thin pb-6">
            <Toc headings={[...lesson.headings.filter((h) => h.depth === 2 || lesson.headings.length < 30), ...extraToc]} />
          </div>
        </aside>
      </div>
    </div>
  );
}
