import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { guides } from "@content/guides";
import { Page, PageHeader } from "@/components/ui";
import { getLessonMeta } from "@/lib/content";

export const metadata: Metadata = { title: "Decision Guides" };

export default function Guides() {
  return (
    <Page>
      <PageHeader eyebrow="Technology decision guides" title={<>No silver bullets, <span className="text-grad">only trade-offs.</span></>} tone="purple">
        The questions engineers actually argue about, each answered with the requirements that favour every option: performance, complexity, operational overhead, scaling, cost and security. No technology is declared universally better.
      </PageHeader>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {guides.map((g, i) => {
          const l = getLessonMeta(g.lesson);
          return (
            <Link
              key={g.question}
              href={`/learn/${g.lesson}/${g.anchor ? `#${g.anchor}` : ""}`}
              data-tone={l.tone}
              className="group strip border border-line bg-surface corner p-5 lg:p-6 hover:-translate-y-1 hover:border-[var(--c)] transition duration-200 rise"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <h2 className="text-lg font-semibold text-heading group-hover:text-tone transition-colors">{g.question}</h2>
              <p className="mt-2 text-sm text-muted leading-relaxed">{g.gist}</p>
              <p className="mt-4 flex items-center gap-1.5 text-xs text-tone font-medium">
                {l.title} <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
              </p>
            </Link>
          );
        })}
      </div>
    </Page>
  );
}
