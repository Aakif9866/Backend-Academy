"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Map, Hammer, ListChecks, Library, Bookmark, TrendingUp, Search, Menu, X, Sun, Moon,
  ChevronRight, Check, Scale,
} from "lucide-react";
import type { NavLevel } from "@/lib/content";
import { useProgress } from "@/lib/progress";
import { levelIcons } from "./icons";
import { SearchDialog } from "./SearchDialog";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, tone: "brand" },
  { href: "/roadmap/", label: "Learning Roadmap", icon: Map, tone: "indigo" },
  { href: "/projects/", label: "Hands-on Projects", icon: Hammer, tone: "orange" },
  { href: "/practice/", label: "Practice & Quizzes", icon: ListChecks, tone: "emerald" },
  { href: "/guides/", label: "Decision Guides", icon: Scale, tone: "purple" },
  { href: "/resources/", label: "Resource Library", icon: Library, tone: "cyan" },
  { href: "/bookmarks/", label: "Bookmarks", icon: Bookmark, tone: "pink" },
  { href: "/progress/", label: "Progress", icon: TrendingUp, tone: "amber" },
];

export function Shell({ nav, children }: { nav: NavLevel[]; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      } else if (e.key === "/" && !/input|textarea/i.test((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <div className="h-[3px] bg-grad-bright fixed inset-x-0 top-0 z-50" data-tone="brand" />
      <header className="sticky top-[3px] z-40 h-16 border-b border-line bg-bg/80 backdrop-blur-xl">
        <div className="h-full flex items-center gap-3 px-4 sm:px-6">
          <button
            className="lg:hidden -ml-1 p-2.5 rounded-lg hover:bg-surface-2 text-muted hover:text-heading"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>
          <Link href="/" className="flex items-center gap-3 shrink-0" data-tone="brand">
            <span className="bg-grad corner-sm size-9 grid place-items-center text-white font-bold text-sm tracking-tight">BA</span>
            <span className="hidden sm:block font-semibold text-heading tracking-tight">
              Backend <span className="text-grad">Academy</span>
            </span>
          </Link>
          <button
            onClick={() => setSearchOpen(true)}
            className="ml-auto lg:ml-10 min-w-0 flex-1 lg:flex-none lg:w-full flex items-center gap-3 h-10 max-w-md px-3.5 rounded-xl border border-line bg-surface text-muted text-sm hover:border-line-strong transition-colors duration-150"
          >
            <Search size={16} />
            <span className="truncate">Search lessons, projects, terms…</span>
            <kbd className="ml-auto hidden sm:block text-[11px] font-mono px-1.5 py-0.5 rounded border border-line bg-surface-2">⌘K</kbd>
          </button>
          <ThemeToggle />
        </div>
      </header>

      <div className="flex">
        {/* desktop sidebar */}
        <aside className="hidden lg:block w-[288px] shrink-0 sticky top-[67px] h-[calc(100vh-67px)] overflow-y-auto scroll-thin border-r border-line">
          <SidebarContent nav={nav} pathname={pathname} />
        </aside>

        {/* mobile drawer */}
        {open && (
          <div className="lg:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
            <aside className="absolute left-0 top-0 bottom-0 w-[86%] max-w-[320px] bg-surface border-r border-line overflow-y-auto scroll-thin motion-safe:animate-[rise_200ms_ease-out]">
              <div className="flex items-center justify-between px-5 h-16 border-b border-line">
                <span className="font-semibold text-heading">Navigate</span>
                <button onClick={() => setOpen(false)} className="p-2.5 rounded-lg hover:bg-surface-2" aria-label="Close navigation">
                  <X size={20} />
                </button>
              </div>
              <SidebarContent nav={nav} pathname={pathname} />
            </aside>
          </div>
        )}

        <main className="flex-1 min-w-0">{children}</main>
      </div>
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

function SidebarContent({ nav, pathname }: { nav: NavLevel[]; pathname: string }) {
  const { completed, ready } = useProgress();
  const activeLesson = pathname.startsWith("/learn/") ? pathname.split("/")[2] : null;
  const activeLevel =
    nav.find((l) => l.modules.some((m) => m.lessons.some((x) => x.slug === activeLesson)))?.id ??
    (pathname.startsWith("/level/") ? pathname.split("/")[2] : null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const isOpen = (id: string) => expanded[id] ?? id === activeLevel;

  return (
    <nav className="px-3 py-6 space-y-8 text-[0.92rem]">
      <ul className="space-y-0.5">
        {links.map(({ href, label, icon: Icon, tone }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href.slice(0, -1));
          return (
            <li key={href} data-tone={tone}>
              <Link
                href={href}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-150 ${
                  active ? "bg-tone-soft text-heading font-medium" : "text-ink hover:bg-surface-2 hover:text-heading"
                }`}
              >
                {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-grad-bright" />}
                <Icon size={18} className="text-tone shrink-0" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div>
        <p className="px-3 mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Curriculum</p>
        <ul className="space-y-0.5">
          {nav.map((level) => {
            const Icon = levelIcons[level.id];
            const lessons = level.modules.flatMap((m) => m.lessons);
            const done = ready ? lessons.filter((l) => completed[l.slug]).length : 0;
            const opened = isOpen(level.id);
            return (
              <li key={level.id} data-tone={level.tone}>
                <div className={`flex items-center rounded-lg ${activeLevel === level.id ? "bg-tone-soft" : "hover:bg-surface-2"}`}>
                  <Link href={`/level/${level.id}/`} className="flex-1 min-w-0 flex items-center gap-3 pl-3 py-2.5 text-ink hover:text-heading">
                    <Icon size={18} className="text-tone shrink-0" />
                    <span className="truncate">
                      <span className="text-muted tabular-nums mr-1.5">{level.n}</span>
                      {level.short}
                    </span>
                  </Link>
                  <span className="text-[11px] tabular-nums text-muted">{done}/{lessons.length}</span>
                  <button
                    onClick={() => setExpanded((e) => ({ ...e, [level.id]: !opened }))}
                    className="p-2.5 text-muted hover:text-heading"
                    aria-label={`${opened ? "Collapse" : "Expand"} ${level.short}`}
                    aria-expanded={opened}
                  >
                    <ChevronRight size={15} className={`transition-transform duration-200 ${opened ? "rotate-90" : ""}`} />
                  </button>
                </div>
                {opened && (
                  <div className="ml-[21px] border-l border-line pl-3 py-2 space-y-3">
                    {level.modules.map((m) => (
                      <div key={m.title}>
                        <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted">{m.title}</p>
                        <ul>
                          {m.lessons.map((l) => {
                            const active = l.slug === activeLesson;
                            const isDone = ready && completed[l.slug];
                            return (
                              <li key={l.slug}>
                                <Link
                                  href={`/learn/${l.slug}/`}
                                  className={`flex items-start gap-2 px-2 py-1.5 rounded-md text-[0.86rem] leading-snug transition-colors duration-150 ${
                                    active ? "text-tone font-medium bg-surface-2" : "text-muted hover:text-heading"
                                  }`}
                                >
                                  <span
                                    className={`mt-[3px] size-3.5 shrink-0 rounded-full border grid place-items-center ${
                                      isDone ? "bg-grad border-transparent" : "border-line-strong"
                                    }`}
                                  >
                                    {isDone && <Check size={9} strokeWidth={4} className="text-white" />}
                                  </span>
                                  {l.title}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<string | null>(null);
  useEffect(() => setTheme(document.documentElement.dataset.theme ?? "dark"), []);
  const flip = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("academy:theme", next);
    } catch {}
    setTheme(next);
  };
  return (
    <button
      onClick={flip}
      className="shrink-0 p-2.5 rounded-xl border border-line text-muted hover:text-heading hover:border-line-strong active:scale-95 transition duration-150"
      aria-label="Toggle colour theme"
    >
      {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
    </button>
  );
}
