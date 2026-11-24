"use client";
import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, Flame, Hammer, ListChecks, Clock, Trophy } from "lucide-react";
import type { NavLevel, ProjectMeta } from "@/lib/content";
import { useProgress } from "@/lib/progress";
import { levelIcons } from "./icons";

export function ProgressDial({ pct, size = 56, label }: { pct: number; size?: number; label?: string }) {
  return (
    <div className="progress-dial grid place-items-center shrink-0" style={{ width: size, height: size, ["--p" as string]: pct }} role="img" aria-label={`${Math.round(pct)}% complete`}>
      <div className="bg-surface rounded-full grid place-items-center text-heading font-semibold tabular-nums" style={{ width: size - 10, height: size - 10, fontSize: size / 4.4 }}>
        {label ?? `${Math.round(pct)}%`}
      </div>
    </div>
  );
}

export function useLevelStats(nav: NavLevel[]) {
  const p = useProgress();
  const levels = nav.map((l) => {
    const lessons = l.modules.flatMap((m) => m.lessons);
    const done = p.ready ? lessons.filter((x) => p.completed[x.slug]).length : 0;
    return { ...l, lessons, done, pct: (done / lessons.length) * 100 };
  });
  const all = levels.flatMap((l) => l.lessons.map((x) => ({ ...x, level: l })));
  return { p, levels, all };
}

function daysStreak(times: number[]) {
  const days = new Set(times.map((t) => new Date(t).toDateString()));
  let streak = 0;
  const d = new Date();
  if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1); // today not done yet doesn't break the streak
  while (days.has(d.toDateString())) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export function Dashboard({ nav, projects, quizLessons }: { nav: NavLevel[]; projects: ProjectMeta[]; quizLessons: number }) {
  const { p, levels, all } = useLevelStats(nav);
  const doneCount = all.filter((x) => p.completed[x.slug]).length;
  const pct = all.length ? (doneCount / all.length) * 100 : 0;
  const nextLesson = all.find((x) => !p.completed[x.slug] && !x.level.optional) ?? all.find((x) => !p.completed[x.slug]);
  const current = nextLesson?.level;
  const recent = p.history.map((h) => all.find((x) => x.slug === h.slug)).filter(Boolean).slice(0, 5) as typeof all;
  const quizzes = Object.values(p.quiz);
  const quizAvg = quizzes.length ? Math.round((quizzes.reduce((a, q) => a + q.best / q.total, 0) / quizzes.length) * 100) : null;
  const projDone = projects.filter((x) => p.projects[x.slug]?.doneAt).length;
  const projActive = projects.filter((x) => p.projects[x.slug] && !p.projects[x.slug].doneAt);
  const minutesDone = all.filter((x) => p.completed[x.slug]).reduce((a, x) => a + x.minutes, 0);
  const streak = daysStreak([...Object.values(p.completed), ...p.history.map((h) => h.at)]);
  const milestones = levels.filter((l) => l.done < l.lessons.length).slice(0, 3);
  const started = p.ready && (doneCount > 0 || p.history.length > 0);

  return (
    <div className="space-y-8">
      {/* hero */}
      <section data-tone="brand" className="glow strip border border-line bg-surface corner p-6 sm:p-8 lg:p-12 rise">
        <div className="flex flex-col lg:flex-row gap-10 lg:items-center justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-tone">Backend Engineering Academy</p>
            <h1 className="mt-4 text-3xl lg:text-6xl font-bold tracking-tight text-heading leading-[1.05]">
              {started ? <>Welcome back. <span className="text-grad">Keep building.</span></> : <>From first request to <span className="text-grad">planet-scale systems.</span></>}
            </h1>
            <p className="mt-6 text-lg text-muted leading-relaxed">
              {nav.length} levels, {all.length} lessons, {projects.length} hands-on projects and 9 interactive simulations. Follow the roadmap in order, or jump to what you need.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {nextLesson && (
                <Link href={`/learn/${nextLesson.slug}/`} className="inline-flex items-center gap-2 px-6 py-3.5 corner-sm bg-grad text-white font-medium active:scale-95 hover:brightness-110 transition duration-150">
                  {started ? "Continue" : "Start learning"}: {nextLesson.title} <ArrowRight size={18} />
                </Link>
              )}
              <Link href="/roadmap/" className="inline-flex items-center gap-2 px-6 py-3.5 corner-sm border border-line text-ink hover:border-line-strong hover:text-heading transition">
                View roadmap
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-6 lg:flex-col lg:items-end">
            <ProgressDial pct={pct} size={132} />
            <div className="lg:text-right">
              <p className="text-heading font-semibold tabular-nums">{doneCount} / {all.length} lessons</p>
              <p className="text-sm text-muted">{current ? `Current: Level ${current.n} · ${current.short}` : "Curriculum complete"}</p>
            </div>
          </div>
        </div>
      </section>

      {/* stats */}
      <section className="grid grid-cols-1 gap-5 grid-cols-2 lg:grid-cols-4">
        {[
          { icon: CheckCircle2, tone: "emerald", label: "Lessons completed", value: doneCount, sub: `${Math.round(pct)}% of the curriculum` },
          { icon: Clock, tone: "cyan", label: "Study time", value: `${Math.round(minutesDone / 60)}h`, sub: `${minutesDone} min of lessons finished` },
          { icon: Trophy, tone: "amber", label: "Quiz average", value: quizAvg === null ? "—" : `${quizAvg}%`, sub: `${quizzes.length} of ${quizLessons} quizzes taken` },
          { icon: Flame, tone: "rose", label: "Day streak", value: streak, sub: streak ? "Days in a row with activity" : "Learn today to start one" },
        ].map(({ icon: Icon, tone, label, value, sub }, i) => (
          <div key={label} data-tone={tone} className="strip border border-line bg-surface corner p-5 lg:p-6 rise" style={{ animationDelay: `${i * 60}ms` }}>
            <span className="bg-grad corner-sm size-10 grid place-items-center text-white"><Icon size={18} /></span>
            <p className="mt-4 text-3xl font-bold text-heading tabular-nums">{p.ready ? value : "—"}</p>
            <p className="mt-1 text-sm font-medium text-ink">{label}</p>
            <p className="text-xs text-muted mt-1">{sub}</p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* levels */}
        <section className="lg:col-span-2 border border-line bg-surface corner p-5 lg:p-7">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-heading">Your learning path</h2>
            <Link href="/progress/" className="text-sm text-tone hover:underline" data-tone="brand">Details</Link>
          </div>
          <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {levels.map((l) => {
              const Icon = levelIcons[l.id];
              return (
                <li key={l.id} data-tone={l.tone}>
                  <Link href={`/level/${l.id}/`} className="group flex items-center gap-4 border border-line rounded-xl p-4 hover:border-[var(--c)] hover:-translate-y-0.5 transition duration-200">
                    <span className="bg-grad corner-sm size-10 grid place-items-center text-white shrink-0"><Icon size={18} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] text-muted">Level {l.n}{l.optional ? " · optional" : ""}</span>
                      <span className="block font-medium text-heading truncate">{l.short}</span>
                      <span className="mt-2 block h-1.5 rounded-full bg-surface-3 overflow-hidden">
                        <span className="block h-full bg-grad-bright rounded-full transition-[width] duration-500" style={{ width: `${l.pct}%` }} />
                      </span>
                    </span>
                    <span className="text-xs text-muted tabular-nums">{l.done}/{l.lessons.length}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="space-y-5">
          {/* recent */}
          <section className="border border-line bg-surface corner p-5 lg:p-6">
            <h2 className="flex items-center gap-2 font-bold text-heading"><BookOpen size={17} className="text-tone" /> Recently viewed</h2>
            {recent.length ? (
              <ul className="mt-4 space-y-1">
                {recent.map((x) => (
                  <li key={x.slug} data-tone={x.level.tone}>
                    <Link href={`/learn/${x.slug}/`} className="flex items-center gap-3 py-2 group">
                      <span className="size-2 rounded-full bg-[var(--c)] shrink-0" />
                      <span className="text-sm text-ink group-hover:text-heading truncate flex-1 min-w-0">{x.title}</span>
                      {p.completed[x.slug] && <CheckCircle2 size={15} className="text-tone shrink-0" />}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">Lessons you open will appear here.</p>
            )}
          </section>

          {/* milestones */}
          <section className="border border-line bg-surface corner p-5 lg:p-6">
            <h2 className="flex items-center gap-2 font-bold text-heading"><ListChecks size={17} className="text-tone" /> Upcoming milestones</h2>
            <ul className="mt-4 space-y-3.5">
              {milestones.map((l) => (
                <li key={l.id} data-tone={l.tone} className="text-sm">
                  <p className="text-heading font-medium">Finish Level {l.n}: {l.short}</p>
                  <p className="text-muted text-xs mt-0.5">{l.lessons.length - l.done} lessons left · {l.outcome}</p>
                </li>
              ))}
            </ul>
          </section>

          {/* projects */}
          <section data-tone="orange" className="border border-line bg-surface corner p-5 lg:p-6">
            <h2 className="flex items-center gap-2 font-bold text-heading"><Hammer size={17} className="text-tone" /> Projects</h2>
            <p className="mt-3 text-sm text-muted">
              <span className="text-heading font-semibold tabular-nums">{projDone}</span> completed · <span className="text-heading font-semibold tabular-nums">{projActive.length}</span> in progress · {projects.length} total
            </p>
            {projActive.slice(0, 3).map((x) => (
              <Link key={x.slug} href={`/projects/${x.slug}/`} className="mt-3 block text-sm text-tone hover:underline">
                {x.title} ({p.projects[x.slug].steps.length}/{x.steps.length})
              </Link>
            ))}
            <Link href="/projects/" className="mt-4 inline-flex items-center gap-1.5 text-sm text-tone hover:underline">Browse projects <ArrowRight size={14} /></Link>
          </section>
        </div>
      </div>
    </div>
  );
}
