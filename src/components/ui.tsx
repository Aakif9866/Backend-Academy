import type { Difficulty } from "@/lib/content";

const D: Record<Difficulty, string> = {
  beginner: "emerald",
  intermediate: "blue",
  advanced: "purple",
  expert: "rose",
};

export function DifficultyBadge({ d }: { d: Difficulty }) {
  return (
    <span data-tone={D[d]} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-tone-soft text-tone text-xs font-semibold capitalize">
      <span className="size-1.5 rounded-full bg-[var(--c)]" />
      {d}
    </span>
  );
}

export function SectionTitle({ id, icon, children }: { id?: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-24 flex items-center gap-3 text-2xl font-bold tracking-tight text-heading">
      {icon && <span className="bg-grad corner-sm size-9 grid place-items-center text-white">{icon}</span>}
      {children}
    </h2>
  );
}

export function PageHeader({ eyebrow, title, children, tone = "brand" }: { eyebrow?: string; title: React.ReactNode; children?: React.ReactNode; tone?: string }) {
  return (
    <header data-tone={tone} className="glow strip border border-line bg-surface corner p-6 lg:p-10 mb-8 rise">
      {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.14em] text-tone">{eyebrow}</p>}
      <h1 className="mt-3 text-3xl lg:text-5xl font-bold tracking-tight text-heading leading-[1.1]">{title}</h1>
      {children && <div className="mt-5 text-lg text-muted leading-relaxed max-w-[65ch]">{children}</div>}
    </header>
  );
}

export function Page({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-10 pt-6 lg:pt-10 pb-24">{children}</div>;
}
