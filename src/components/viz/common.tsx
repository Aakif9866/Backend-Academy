"use client";
import { useEffect, useRef } from "react";
import { MousePointerClick } from "lucide-react";

export function VizFrame({ title, hint, children, controls }: { title: string; hint: string; children: React.ReactNode; controls?: React.ReactNode }) {
  return (
    <figure className="viz not-prose strip border border-line bg-surface corner p-5 lg:p-6 !my-10" style={{ maxWidth: "none" }}>
      <figcaption className="flex items-start gap-3">
        <span className="bg-grad corner-sm size-8 grid place-items-center text-white shrink-0">
          <MousePointerClick size={16} />
        </span>
        <span>
          <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-tone">Interactive</span>
          <span className="block font-semibold text-heading leading-snug">{title}</span>
          <span className="block text-sm text-muted mt-1 leading-relaxed">{hint}</span>
        </span>
      </figcaption>
      {controls && <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-4">{controls}</div>}
      <div className="mt-5 text-[0.9rem] leading-relaxed">{children}</div>
    </figure>
  );
}

export function Slider({ label, value, min, max, step = 1, onChange, suffix = "" }: { label: string; value: number; min: number; max: number; step?: number; onChange: (n: number) => void; suffix?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs text-muted min-w-[140px]">
      <span className="flex justify-between gap-3">
        {label} <span className="text-heading font-semibold tabular-nums">{value}{suffix}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="accent-[var(--c)] h-6" />
    </label>
  );
}

export function Seg<T extends string>({ label, value, options, onChange }: { label?: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-col gap-1.5 text-xs text-muted">
      {label && <span>{label}</span>}
      <div className="inline-flex flex-wrap rounded-xl border border-line bg-surface-2 p-1 gap-1" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.id}
            role="radio"
            aria-checked={value === o.id}
            onClick={() => onChange(o.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 ${value === o.id ? "bg-grad text-white" : "text-muted hover:text-heading"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Btn({ children, onClick, primary, disabled }: { children: React.ReactNode; onClick: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-xl text-sm font-medium active:scale-95 transition duration-150 disabled:opacity-40 ${
        primary ? "bg-grad text-white" : "border border-line text-ink hover:border-line-strong hover:text-heading"
      }`}
    >
      {children}
    </button>
  );
}

export function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "ok" | "bad" | "warn" }) {
  const color = tone === "ok" ? "text-ok" : tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : "text-heading";
  return (
    <div className="border border-line bg-surface-2 rounded-xl px-3.5 py-2.5 min-w-[96px]">
      <div className="text-[11px] text-muted">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

export function useInterval(fn: () => void, ms: number | null) {
  const saved = useRef(fn);
  saved.current = fn;
  useEffect(() => {
    if (ms === null) return;
    const id = setInterval(() => saved.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}

// Deterministic PRNG so server and client render the same first frame.
export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a 32-bit: the same tiny hash many real systems use for bucketing.
export function fnv1a(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
