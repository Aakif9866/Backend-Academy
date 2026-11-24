"use client";
import { Fragment, useEffect, useRef, useState } from "react";
import { vizRegistry } from "./viz";

// Lesson HTML is rendered at build time. Interactive simulations are marked in Markdown as
// <div data-viz="name"></div>; we split on those and mount the React component in place.
export function LessonBody({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const parts = html.split(/<div data-viz="([\w-]+)"><\/div>/);
  // Simulations are client-only (timers, randomness, live state); render them after hydration.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    // Copy buttons on code blocks.
    root.querySelectorAll<HTMLPreElement>("pre:not(.mermaid)").forEach((pre) => {
      if (pre.querySelector(".copy-btn")) return;
      const btn = document.createElement("button");
      btn.className = "copy-btn";
      btn.textContent = "Copy";
      btn.setAttribute("aria-label", "Copy code");
      btn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(pre.querySelector("code")?.innerText ?? pre.innerText);
          btn.textContent = "Copied";
        } catch {
          btn.textContent = "Press ⌘C";
        }
        setTimeout(() => (btn.textContent = "Copy"), 1500);
      };
      pre.appendChild(btn);
    });

    // Mermaid diagrams: render on load and again when the theme changes.
    const diagrams = [...root.querySelectorAll<HTMLElement>("pre.mermaid")];
    if (!diagrams.length) return;
    diagrams.forEach((d) => (d.dataset.src ??= d.textContent ?? ""));
    let cancelled = false;
    const draw = async () => {
      const mermaid = (await import("mermaid")).default;
      if (cancelled) return;
      const dark = document.documentElement.dataset.theme !== "light";
      mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: dark ? "dark" : "neutral", fontFamily: "var(--font-inter)" });
      diagrams.forEach((d) => {
        d.removeAttribute("data-processed");
        d.textContent = d.dataset.src!;
      });
      try {
        await mermaid.run({ nodes: diagrams });
      } catch (e) {
        console.warn("Mermaid diagram failed to render", e);
      }
    };
    draw();
    const obs = new MutationObserver(draw);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      cancelled = true;
      obs.disconnect();
    };
  }, [html]);

  return (
    <div ref={ref} className="prose-a">
      {parts.map((part, i) => {
        if (i % 2 === 0) return <div key={i} className="contents" dangerouslySetInnerHTML={{ __html: part }} />;
        const Viz = vizRegistry[part];
        return (
          <Fragment key={i}>
            {!mounted ? <div className="viz !my-10 h-96 border border-line bg-surface corner animate-pulse" aria-hidden /> : Viz ? <Viz /> : <p className="text-bad">Unknown visualisation: {part}</p>}
          </Fragment>
        );
      })}
    </div>
  );
}
