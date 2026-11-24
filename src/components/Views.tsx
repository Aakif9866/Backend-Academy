"use client";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ArrowRight, Check, CheckCircle2, Clock, ExternalLink, Play, Search, Trophy, Download, Upload, RotateCcw, Bookmark } from "lucide-react";
import type { LessonMeta, NavLevel, ProjectMeta, Resource, Video } from "@/lib/content";
import type { Tone } from "@content/curriculum";
import { progress, useProgress } from "@/lib/progress";
import { levelIcons } from "./icons";
import { DifficultyBadge } from "./ui";
import { ProgressDial, useLevelStats } from "./Dashboard";

const TIER_TONE: Record<ProjectMeta["tier"], Tone> = { beginner: "emerald", intermediate: "blue", advanced: "purple", expert: "rose" };

// ---------------- roadmap ----------------
export function RoadmapView({ nav }: { nav: NavLevel[] }) {
  const { p, levels } = useLevelStats(nav);
  return (
    <ol className="relative space-y-6 before:absolute before:left-[27px] before:top-4 before:bottom-4 before:w-px before:bg-line">
      {levels.map((l, i) => {
        const Icon = levelIcons[l.id];
        return (
          <li key={l.id} data-tone={l.tone} className="relative pl-[76px] rise" style={{ animationDelay: `${i * 40}ms` }}>
            <span className="absolute left-0 top-1">
              <ProgressDial pct={l.pct} size={56} label={String(l.n)} />
            </span>
            <div className="strip border border-line bg-surface corner p-5 lg:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-2xl">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-tone">
                    <Icon size={15} /> Level {l.n}{l.optional ? " · optional" : ""}
                  </p>
                  <h2 className="mt-2 text-xl lg:text-2xl font-bold text-heading tracking-tight">
                    <Link href={`/level/${l.id}/`} className="hover:text-tone transition-colors">{l.title}</Link>
                  </h2>
                  <p className="mt-2 text-muted leading-relaxed">{l.summary}</p>
                </div>
                <span className="text-sm text-muted tabular-nums">{l.done}/{l.lessons.length} done</span>
              </div>
              <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {l.modules.map((m) => (
                  <div key={m.title}>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{m.title}</p>
                    <ul className="mt-2 space-y-1">
                      {m.lessons.map((x) => {
                        const done = p.ready && !!p.completed[x.slug];
                        return (
                          <li key={x.slug}>
                            <Link href={`/learn/${x.slug}/`} className="group flex items-start gap-2.5 py-1 text-[0.92rem]">
                              <span className={`mt-1 size-4 shrink-0 rounded-full border grid place-items-center ${done ? "bg-grad border-transparent" : "border-line-strong group-hover:border-[var(--c)]"}`}>
                                {done && <Check size={10} strokeWidth={4} className="text-white" />}
                              </span>
                              <span className={`leading-snug ${done ? "text-muted" : "text-ink group-hover:text-heading"}`}>{x.title}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
              <p className="mt-5 pt-4 border-t border-line text-sm text-muted"><span className="text-heading font-medium">Outcome:</span> {l.outcome}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ---------------- level ----------------
export function LevelView({ tone, modules, projects }: { tone: Tone; modules: { title: string; lessons: LessonMeta[] }[]; projects: ProjectMeta[] }) {
  const p = useProgress();
  let n = 0;
  return (
    <div data-tone={tone} className="space-y-10">
      {modules.map((m) => (
        <section key={m.title}>
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted mb-4">{m.title}</h2>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {m.lessons.map((l) => {
              const done = p.ready && !!p.completed[l.slug];
              const idx = ++n;
              return (
                <Link key={l.slug} href={`/learn/${l.slug}/`} className="group strip border border-line bg-surface corner p-5 lg:p-6 hover:-translate-y-1 hover:border-[var(--c)] transition duration-200 flex flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-xs text-muted tabular-nums">Lesson {idx}</span>
                    {done ? <CheckCircle2 size={18} className="text-tone" /> : <span className="size-[18px] rounded-full border border-line-strong" />}
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-heading line-clamp-2 group-hover:text-tone transition-colors">{l.title}</h3>
                  <p className="mt-2 text-sm text-muted leading-relaxed line-clamp-3 flex-1">{l.summary}</p>
                  <div className="mt-5 flex flex-wrap items-center gap-2.5 text-xs">
                    <DifficultyBadge d={l.difficulty} />
                    <span className="inline-flex items-center gap-1 text-muted"><Clock size={13} /> {l.minutes} min</span>
                    {l.quiz.length > 0 && <span className="text-muted">· quiz</span>}
                    {l.videos.length > 0 && <span className="text-muted">· {l.videos.length} video{l.videos.length > 1 ? "s" : ""}</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
      {projects.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted mb-4">Practise with a project</h2>
          <ProjectGrid projects={projects} />
        </section>
      )}
    </div>
  );
}

// ---------------- projects ----------------
export function ProjectGrid({ projects }: { projects: ProjectMeta[] }) {
  const p = useProgress();
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {projects.map((x, i) => {
        const st = p.ready ? p.projects[x.slug] : undefined;
        const pct = st ? (st.steps.length / x.steps.length) * 100 : 0;
        return (
          <Link
            key={x.slug}
            href={`/projects/${x.slug}/`}
            data-tone={TIER_TONE[x.tier]}
            className="group relative overflow-hidden strip border border-line bg-surface corner p-5 lg:p-6 hover:border-[var(--c)] transition duration-300 rise flex flex-col min-h-[248px]"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-tone">{x.tier}</span>
              <span className="text-xs text-muted">{x.hours}</span>
            </div>
            <h3 className="mt-3 text-lg font-semibold text-heading line-clamp-2">{x.title}</h3>
            <p className="mt-2 text-sm text-muted leading-relaxed line-clamp-3 group-hover:line-clamp-2 transition-all">{x.summary}</p>
            <div className="mt-auto pt-4 flex flex-wrap gap-1.5">
              {x.stack.slice(0, 4).map((s) => (
                <span key={s} className="text-[11px] px-2 py-0.5 rounded-md bg-surface-2 border border-line text-muted">{s}</span>
              ))}
            </div>
            {st && (
              <div className="mt-4 flex items-center gap-2 text-xs text-muted">
                <span className="flex-1 h-1.5 rounded-full bg-surface-3 overflow-hidden"><span className="block h-full bg-grad-bright" style={{ width: `${pct}%` }} /></span>
                {st.doneAt ? "Done" : `${st.steps.length}/${x.steps.length}`}
              </div>
            )}
            {/* Klyro reveal: CTA bar slides up on hover */}
            <span className="absolute inset-x-0 -bottom-16 group-hover:bottom-0 transition-all duration-300 bg-grad text-white text-sm font-medium px-6 py-3 flex items-center justify-between">
              {st ? "Continue project" : "Open project brief"} <ArrowRight size={16} />
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export function ProjectSteps({ slug, steps }: { slug: string; steps: string[] }) {
  const p = useProgress();
  const st = p.ready ? p.projects[slug] : undefined;
  const done = st?.steps ?? [];
  return (
    <div>
      <div className="flex items-center gap-3">
        <ProgressDial pct={(done.length / steps.length) * 100} size={52} />
        <div>
          <p className="font-semibold text-heading">Milestones</p>
          <p className="text-xs text-muted">{st?.doneAt ? "Project complete" : `${done.length} of ${steps.length} done`}</p>
        </div>
      </div>
      <ol className="mt-4 space-y-1">
        {steps.map((s, i) => {
          const on = done.includes(i);
          return (
            <li key={i}>
              <label className="flex items-start gap-3 py-2 px-2 -mx-2 rounded-lg cursor-pointer hover:bg-surface-2 text-sm leading-snug">
                <input type="checkbox" checked={on} onChange={() => progress.toggleProjectStep(slug, i, steps.length)} className="mt-0.5 size-4 accent-[var(--c)] shrink-0" />
                <span className={on ? "text-muted line-through decoration-[var(--c)]" : "text-ink"}>{s}</span>
              </label>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ---------------- practice ----------------
export function PracticeList({ lessons }: { lessons: LessonMeta[] }) {
  const p = useProgress();
  const taken = lessons.filter((l) => p.ready && p.quiz[l.slug]);
  const avg = taken.length ? Math.round((taken.reduce((a, l) => a + p.quiz[l.slug].best / p.quiz[l.slug].total, 0) / taken.length) * 100) : null;
  const byLevel = lessons.reduce<Record<string, LessonMeta[]>>((acc, l) => ((acc[l.levelTitle] ??= []).push(l), acc), {});
  return (
    <div className="space-y-10">
      <div className="flex flex-wrap gap-5">
        <div className="border border-line bg-surface corner p-5 min-w-[180px]"><p className="text-xs text-muted">Quizzes taken</p><p className="text-3xl font-bold text-heading tabular-nums mt-1">{taken.length}<span className="text-base text-muted">/{lessons.length}</span></p></div>
        <div className="border border-line bg-surface corner p-5 min-w-[180px]"><p className="text-xs text-muted">Average best score</p><p className="text-3xl font-bold text-heading tabular-nums mt-1">{avg === null ? "—" : `${avg}%`}</p></div>
        <div className="border border-line bg-surface corner p-5 min-w-[180px]"><p className="text-xs text-muted">Questions available</p><p className="text-3xl font-bold text-heading tabular-nums mt-1">{lessons.reduce((a, l) => a + l.quiz.length, 0)}</p></div>
      </div>
      {Object.entries(byLevel).map(([level, ls]) => (
        <section key={level} data-tone={ls[0].tone}>
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-tone mb-4">Level {ls[0].levelN} · {level}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ls.map((l) => {
              const q = p.ready ? p.quiz[l.slug] : undefined;
              return (
                <Link key={l.slug} href={`/practice/${l.slug}/`} className="group border border-line bg-surface corner-sm p-5 hover:border-[var(--c)] hover:-translate-y-0.5 transition duration-200">
                  <p className="font-medium text-heading line-clamp-2 group-hover:text-tone transition-colors">{l.title}</p>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted">
                    <span>{l.quiz.length} questions · {[...new Set(l.quiz.map((x) => x.type))].length} types</span>
                    {q ? <span className={`inline-flex items-center gap-1 font-semibold tabular-nums ${q.best === q.total ? "text-ok" : "text-heading"}`}><Trophy size={13} /> {q.best}/{q.total}</span> : <span>Not taken</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

// ---------------- resources ----------------
type LibItem = (Resource & { kind: "doc" }) | (Video & { kind: "video"; url: string });
export function ResourceLibrary({ items }: { items: (LibItem & { lesson: string; lessonTitle: string; tone: Tone; levelN: number })[] }) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | "doc" | "video">("all");
  const [level, setLevel] = useState<number | "all">("all");
  const levels = [...new Set(items.map((i) => i.levelN))].sort((a, b) => a - b);
  const shown = useMemo(() => {
    const t = q.toLowerCase();
    return items.filter((i) => (kind === "all" || i.kind === kind) && (level === "all" || i.levelN === level) && (!t || `${i.title} ${i.why} ${i.lessonTitle} ${i.kind === "video" ? i.channel : ""}`.toLowerCase().includes(t)));
  }, [items, q, kind, level]);

  return (
    <div>
      <div className="flex flex-wrap gap-3 items-center mb-6">
        <label className="flex items-center gap-2 h-11 px-3.5 rounded-xl border border-line bg-surface flex-1 min-w-[220px] max-w-md focus-within:border-line-strong">
          <Search size={16} className="text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter resources…" className="bg-transparent outline-none flex-1 text-sm" aria-label="Filter resources" />
        </label>
        <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="h-11 px-3 rounded-xl border border-line bg-surface text-sm" aria-label="Type">
          <option value="all">All types</option><option value="doc">Docs & articles</option><option value="video">Videos</option>
        </select>
        <select value={String(level)} onChange={(e) => setLevel(e.target.value === "all" ? "all" : Number(e.target.value))} className="h-11 px-3 rounded-xl border border-line bg-surface text-sm" aria-label="Level">
          <option value="all">All levels</option>
          {levels.map((l) => <option key={l} value={l}>Level {l}</option>)}
        </select>
        <span className="text-sm text-muted">{shown.length} of {items.length}</span>
      </div>
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {shown.map((r) => (
          <li key={r.url + r.lesson} data-tone={r.tone}>
            <a href={r.url} target="_blank" rel="noopener noreferrer" className="group flex gap-4 h-full border border-line bg-surface corner-sm p-5 hover:border-[var(--c)] transition-colors">
              <span className="bg-grad corner-sm size-9 grid place-items-center text-white shrink-0">{r.kind === "video" ? <Play size={15} /> : <ExternalLink size={15} />}</span>
              <span className="min-w-0">
                <span className="block font-medium text-heading group-hover:text-tone transition-colors">{r.title}</span>
                <span className="block text-xs text-tone mt-0.5">{r.kind === "video" ? r.channel : new URL(r.url).host}</span>
                <span className="block text-sm text-muted mt-2 leading-relaxed">{r.why}</span>
                <span className="block text-xs text-muted mt-2">Used in: {r.lessonTitle}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------- bookmarks ----------------
export function BookmarkList({ lessons, projects }: { lessons: LessonMeta[]; projects: ProjectMeta[] }) {
  const p = useProgress();
  const saved = Object.entries(p.ready ? p.bookmarks : {}).sort((a, b) => b[1] - a[1]);
  const items = saved
    .map(([key]) => {
      const l = lessons.find((x) => x.slug === key);
      if (l) return { key, href: `/learn/${l.slug}/`, title: l.title, sub: `Level ${l.levelN} · ${l.module}`, tone: l.tone };
      const pr = projects.find((x) => `project:${x.slug}` === key);
      if (pr) return { key, href: `/projects/${pr.slug}/`, title: pr.title, sub: `${pr.tier} project`, tone: TIER_TONE[pr.tier] };
      return null;
    })
    .filter(Boolean) as { key: string; href: string; title: string; sub: string; tone: Tone }[];

  if (!p.ready) return null;
  if (!items.length)
    return (
      <div className="border border-dashed border-line corner p-12 text-center">
        <Bookmark size={28} className="mx-auto text-muted" />
        <p className="mt-4 text-heading font-medium">No bookmarks yet</p>
        <p className="mt-1 text-sm text-muted">Use the Bookmark button on any lesson or project to save it here.</p>
      </div>
    );
  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {items.map((i) => (
        <li key={i.key} data-tone={i.tone} className="flex items-center gap-4 border border-line bg-surface corner-sm p-5">
          <span className="size-2.5 rounded-full bg-[var(--c)] shrink-0" />
          <Link href={i.href} className="flex-1 min-w-0">
            <span className="block font-medium text-heading hover:text-tone truncate">{i.title}</span>
            <span className="block text-xs text-muted mt-0.5 capitalize">{i.sub}</span>
          </Link>
          <button onClick={() => progress.toggleBookmark(i.key)} className="text-xs text-muted hover:text-bad px-2 py-1">Remove</button>
        </li>
      ))}
    </ul>
  );
}

// ---------------- progress ----------------
export function ProgressView({ nav, lessons, projects }: { nav: NavLevel[]; lessons: LessonMeta[]; projects: ProjectMeta[] }) {
  const { p, levels, all } = useLevelStats(nav);
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  const done = all.filter((x) => p.completed[x.slug]).length;
  const quizRows = lessons.filter((l) => p.quiz[l.slug]);
  const timeline = Object.entries(p.completed).sort((a, b) => b[1] - a[1]).slice(0, 12);

  const download = () => {
    const blob = new Blob([progress.export()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `backend-academy-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const upload = async (f: File) => {
    try {
      progress.import(await f.text());
      setMsg("Progress imported.");
    } catch (e) {
      setMsg(`Import failed: ${(e as Error).message}`);
    }
  };

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="border border-line bg-surface corner p-6 flex items-center gap-5"><ProgressDial pct={(done / all.length) * 100} size={76} /><div><p className="text-xs text-muted">Lessons</p><p className="text-2xl font-bold text-heading tabular-nums">{done}/{all.length}</p></div></div>
        <div className="border border-line bg-surface corner p-6"><p className="text-xs text-muted">Levels completed</p><p className="text-2xl font-bold text-heading tabular-nums mt-1">{levels.filter((l) => l.done === l.lessons.length).length}/{levels.length}</p></div>
        <div className="border border-line bg-surface corner p-6"><p className="text-xs text-muted">Projects completed</p><p className="text-2xl font-bold text-heading tabular-nums mt-1">{projects.filter((x) => p.projects[x.slug]?.doneAt).length}/{projects.length}</p></div>
      </section>

      <section className="border border-line bg-surface corner p-5 lg:p-7">
        <h2 className="text-xl font-bold text-heading">By level</h2>
        <ul className="mt-5 space-y-4">
          {levels.map((l) => (
            <li key={l.id} data-tone={l.tone} className="grid grid-cols-[1fr_auto] sm:grid-cols-[240px_1fr_auto] gap-x-4 gap-y-1.5 items-center">
              <Link href={`/level/${l.id}/`} className="text-sm text-ink hover:text-tone truncate"><span className="text-muted tabular-nums mr-2">{l.n}</span>{l.short}</Link>
              <span className="order-3 sm:order-none col-span-2 sm:col-span-1 h-2 rounded-full bg-surface-3 overflow-hidden"><span className="block h-full bg-grad-bright rounded-full transition-[width] duration-500" style={{ width: `${l.pct}%` }} /></span>
              <span className="text-xs text-muted tabular-nums text-right">{l.done}/{l.lessons.length}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="border border-line bg-surface corner p-5 lg:p-7">
          <h2 className="text-xl font-bold text-heading">Quiz scores</h2>
          {quizRows.length ? (
            <table className="mt-4 w-full text-sm">
              <thead><tr className="text-left text-xs text-muted"><th className="py-2 font-medium">Lesson</th><th className="font-medium text-right">Last</th><th className="font-medium text-right">Best</th></tr></thead>
              <tbody>
                {quizRows.map((l) => (
                  <tr key={l.slug} className="border-t border-line">
                    <td className="py-2.5 pr-3"><Link href={`/practice/${l.slug}/`} className="hover:text-tone">{l.title}</Link></td>
                    <td className="text-right tabular-nums">{p.quiz[l.slug].score}/{p.quiz[l.slug].total}</td>
                    <td className="text-right tabular-nums font-semibold text-heading">{p.quiz[l.slug].best}/{p.quiz[l.slug].total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="mt-3 text-sm text-muted">No quizzes taken yet. <Link href="/practice/" className="text-tone hover:underline">Start practising</Link>.</p>}
        </section>
        <section className="border border-line bg-surface corner p-5 lg:p-7">
          <h2 className="text-xl font-bold text-heading">Learning history</h2>
          {timeline.length ? (
            <ul className="mt-4 space-y-2.5">
              {timeline.map(([slug, at]) => {
                const l = lessons.find((x) => x.slug === slug);
                return l ? (
                  <li key={slug} data-tone={l.tone} className="flex items-center gap-3 text-sm">
                    <CheckCircle2 size={15} className="text-tone shrink-0" />
                    <Link href={`/learn/${slug}/`} className="flex-1 min-w-0 truncate hover:text-heading">{l.title}</Link>
                    <span className="text-xs text-muted tabular-nums">{new Date(at).toLocaleDateString()}</span>
                  </li>
                ) : null;
              })}
            </ul>
          ) : <p className="mt-3 text-sm text-muted">Completed lessons will appear here.</p>}
        </section>
      </div>

      <section className="border border-line bg-surface corner p-5 lg:p-7">
        <h2 className="text-xl font-bold text-heading">Your data</h2>
        <p className="mt-2 text-sm text-muted max-w-2xl">Progress is stored only in this browser (localStorage). Export it to move to another device or keep a backup.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button onClick={download} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-line hover:border-line-strong text-sm"><Download size={16} /> Export</button>
          <button onClick={() => file.current?.click()} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-line hover:border-line-strong text-sm"><Upload size={16} /> Import</button>
          <input ref={file} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <button onClick={() => confirm("Erase all progress, quiz scores, bookmarks and project milestones in this browser?") && progress.reset()} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-line hover:border-bad text-sm text-bad"><RotateCcw size={16} /> Reset</button>
        </div>
        {msg && <p className="mt-3 text-sm text-muted">{msg}</p>}
      </section>
    </div>
  );
}

