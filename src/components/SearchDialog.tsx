"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, Hash, Hammer, ExternalLink, CornerDownLeft } from "lucide-react";
import type { SearchDoc } from "@/app/search-index.json/route";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "lesson", label: "Lessons" },
  { id: "section", label: "Topics" },
  { id: "project", label: "Projects" },
  { id: "resource", label: "Resources" },
] as const;
const ICON = { lesson: FileText, section: Hash, project: Hammer, resource: ExternalLink };

let cache: Promise<SearchDoc[]> | null = null;
const loadIndex = () => (cache ??= fetch("/search-index.json").then((r) => r.json()));

function score(d: SearchDoc, terms: string[]) {
  const title = d.title.toLowerCase();
  const rest = `${d.context} ${d.body}`.toLowerCase();
  let s = 0;
  for (const t of terms) {
    if (title.startsWith(t)) s += 12;
    else if (title.includes(t)) s += 8;
    else if (rest.includes(t)) s += 1;
    else return 0; // every term must match somewhere
  }
  return s + (d.kind === "lesson" ? 3 : d.kind === "project" ? 2 : 0);
}

function snippet(body: string, term: string) {
  const i = body.toLowerCase().indexOf(term);
  if (i < 0) return body.slice(0, 120);
  const start = Math.max(0, i - 50);
  return (start ? "…" : "") + body.slice(start, i + 90) + "…";
}

export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [docs, setDocs] = useState<SearchDoc[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    loadIndex().then(setDocs);
    setTimeout(() => input.current?.focus(), 10);
  }, [open]);

  const results = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return docs
      .filter((d) => filter === "all" || d.kind === filter)
      .map((d) => ({ d, s: score(d, terms) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 40)
      .map((x) => x.d);
  }, [docs, q, filter]);

  useEffect(() => setSel(0), [q, filter]);
  useEffect(() => {
    list.current?.querySelector(`[data-i="${sel}"]`)?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  if (!open) return null;

  const go = (d: SearchDoc) => {
    onClose();
    if (d.kind === "resource") window.open(d.href, "_blank", "noopener");
    else router.push(d.href);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowDown") (e.preventDefault(), setSel((s) => Math.min(s + 1, results.length - 1)));
    else if (e.key === "ArrowUp") (e.preventDefault(), setSel((s) => Math.max(s - 1, 0)));
    else if (e.key === "Enter" && results[sel]) go(results[sel]);
    else if (e.key === "Tab") {
      e.preventDefault();
      const i = FILTERS.findIndex((f) => f.id === filter);
      setFilter(FILTERS[(i + (e.shiftKey ? FILTERS.length - 1 : 1)) % FILTERS.length].id);
    }
  };
  const first = q.toLowerCase().split(/\s+/).filter(Boolean)[0] ?? "";

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[10vh]" onKeyDown={onKey}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-label="Search"
        className="relative w-full max-w-2xl bg-surface-2 border border-line-strong corner shadow-2xl overflow-hidden motion-safe:animate-[rise_180ms_ease-out]"
      >
        <div className="flex items-center gap-3 px-5 border-b border-line">
          <Search size={18} className="text-muted" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search: “isolation levels”, “consistent hashing”, “kafka”…"
            className="flex-1 h-14 bg-transparent outline-none text-heading placeholder:text-muted"
            aria-label="Search query"
          />
          <kbd className="text-[11px] font-mono px-1.5 py-0.5 rounded border border-line text-muted">esc</kbd>
        </div>
        <div className="flex gap-1.5 px-4 py-2.5 border-b border-line overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors duration-150 ${
                filter === f.id ? "bg-heading text-bg" : "text-muted hover:text-heading hover:bg-surface-3"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <ul ref={list} className="max-h-[55vh] overflow-y-auto scroll-thin p-2">
          {q && !results.length && <li className="px-4 py-10 text-center text-muted text-sm">No matches for “{q}”.</li>}
          {!q && <li className="px-4 py-10 text-center text-muted text-sm">Type to search {docs.length ? `${docs.length} items` : "the curriculum"}. ↑↓ to move, Tab to change filter.</li>}
          {results.map((d, i) => {
            const Icon = ICON[d.kind];
            return (
              <li key={d.kind + d.href + i} data-i={i} data-tone={d.tone}>
                <button
                  onMouseMove={() => setSel(i)}
                  onClick={() => go(d)}
                  className={`w-full text-left flex gap-3 px-3.5 py-3 rounded-xl ${i === sel ? "bg-surface-3" : ""}`}
                >
                  <Icon size={17} className="mt-0.5 shrink-0 text-tone" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-heading text-sm font-medium truncate">{d.title}</span>
                    <span className="block text-xs text-muted truncate">{d.context}</span>
                    {d.body && d.kind !== "section" && <span className="block text-xs text-muted/80 mt-1 line-clamp-1">{snippet(d.body, first)}</span>}
                  </span>
                  {i === sel && <CornerDownLeft size={14} className="mt-1 text-muted shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
