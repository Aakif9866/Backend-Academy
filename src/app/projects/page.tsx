import type { Metadata } from "next";
import { Page, PageHeader } from "@/components/ui";
import { ProjectGrid } from "@/components/Views";
import { getAllProjectMeta } from "@/lib/content";

export const metadata: Metadata = { title: "Hands-on Projects" };
const TIERS = [
  { id: "beginner", label: "Beginner", blurb: "One service, one database. Get the fundamentals right: validation, errors, tests." },
  { id: "intermediate", label: "Intermediate", blurb: "Caches, queues, real-time connections and files. Several moving parts." },
  { id: "advanced", label: "Advanced", blurb: "Distributed workflows, multi-tenancy and money. Correctness under concurrency and failure." },
  { id: "expert", label: "Expert", blurb: "Build the infrastructure itself: a Redis, a broker, a replicated key-value store." },
] as const;

export default function Projects() {
  const all = getAllProjectMeta();
  return (
    <Page>
      <PageHeader eyebrow="Hands-on projects" title={<>Learn it by <span className="text-grad">building it.</span></>} tone="orange">
        {all.length} projects from a first REST API to a replicated key-value store. Each has requirements, architecture, data model, API contract, milestones you can tick off, tests, and an evaluation rubric. Everything runs locally with Docker; no paid cloud needed.
      </PageHeader>
      <div className="space-y-12">
        {TIERS.map((t) => {
          const ps = all.filter((p) => p.tier === t.id);
          if (!ps.length) return null;
          return (
            <section key={t.id}>
              <h2 className="text-2xl font-bold text-heading tracking-tight">{t.label}</h2>
              <p className="mt-1 mb-5 text-muted">{t.blurb}</p>
              <ProjectGrid projects={ps} />
            </section>
          );
        })}
      </div>
    </Page>
  );
}
