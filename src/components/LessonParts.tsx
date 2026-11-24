"use client";
import { useEffect, useState } from "react";
import { Bookmark, BookmarkCheck, CheckCircle2, Circle, Play } from "lucide-react";
import type { Heading, Video } from "@/lib/content";
import { progress, useProgress } from "@/lib/progress";

export function ReadingProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const on = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setP(max > 0 ? Math.min(100, (h.scrollTop / max) * 100) : 0);
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <div className="fixed left-0 right-0 top-[67px] z-30 h-[2px]" aria-hidden>
      <div className="h-full bg-grad-bright transition-[width] duration-150 ease-out" style={{ width: `${p}%` }} />
    </div>
  );
}

export function VisitTracker({ slug }: { slug: string }) {
  useEffect(() => progress.visit(slug), [slug]);
  return null;
}

export function Toc({ headings }: { headings: Heading[] }) {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const els = headings.map((h) => document.getElementById(h.id)).filter(Boolean) as HTMLElement[];
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -70% 0px" },
    );
    els.forEach((e) => obs.observe(e));
    return () => obs.disconnect();
  }, [headings]);

  if (!headings.length) return null;
  return (
    <nav aria-label="On this page" className="text-[0.84rem]">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">On this page</p>
      <ul className="space-y-0.5 border-l border-line">
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              className={`block -ml-px border-l py-1 leading-snug transition-colors duration-150 ${h.depth === 3 ? "pl-6" : "pl-3.5"} ${
                active === h.id ? "border-[var(--c)] text-tone font-medium" : "border-transparent text-muted hover:text-heading"
              }`}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function CompleteButton({ slug, large }: { slug: string; large?: boolean }) {
  const { completed, ready } = useProgress();
  const done = ready && !!completed[slug];
  return (
    <button
      onClick={() => progress.toggleComplete(slug)}
      className={`inline-flex items-center gap-2 font-medium active:scale-95 transition duration-150 corner-sm ${
        large ? "px-6 py-3.5 text-base" : "px-4 py-2.5 text-sm"
      } ${done ? "border border-[var(--c)] text-tone bg-tone-soft" : "bg-grad text-white hover:brightness-110"}`}
    >
      {done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
      {done ? "Completed" : "Mark as completed"}
    </button>
  );
}

export function BookmarkButton({ id }: { id: string }) {
  const { bookmarks, ready } = useProgress();
  const on = ready && !!bookmarks[id];
  const Icon = on ? BookmarkCheck : Bookmark;
  return (
    <button
      onClick={() => progress.toggleBookmark(id)}
      className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium corner-sm border active:scale-95 transition duration-150 ${
        on ? "border-[var(--c)] text-tone" : "border-line text-muted hover:text-heading hover:border-line-strong"
      }`}
      aria-pressed={on}
    >
      <Icon size={17} />
      {on ? "Bookmarked" : "Bookmark"}
    </button>
  );
}

// Click-to-load facade: no YouTube scripts or cookies until the learner presses play.
export function VideoCard({ v }: { v: Video }) {
  const [playing, setPlaying] = useState(false);
  return (
    <figure className="border border-line bg-surface corner overflow-hidden">
      <div className="relative aspect-video bg-surface-2">
        {playing ? (
          <iframe
            className="absolute inset-0 size-full"
            src={`https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0`}
            title={v.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button onClick={() => setPlaying(true)} className="group absolute inset-0 size-full" aria-label={`Play video: ${v.title}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`} alt="" loading="lazy" className="size-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-200" />
            <span className="absolute inset-0 grid place-items-center">
              <span className="size-14 rounded-full bg-grad grid place-items-center text-white shadow-xl group-hover:scale-110 transition-transform duration-200">
                <Play size={22} fill="currentColor" />
              </span>
            </span>
          </button>
        )}
      </div>
      <figcaption className="p-5">
        <p className="font-semibold text-heading leading-snug">{v.title}</p>
        <p className="text-xs text-tone mt-1 font-medium">{v.channel}</p>
        <p className="text-sm text-muted mt-2.5 leading-relaxed">{v.why}</p>
      </figcaption>
    </figure>
  );
}
