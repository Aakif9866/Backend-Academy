import "server-only";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { Marked, Renderer, type Tokens } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";
import { curriculum, type LevelDef, type Tone } from "@content/curriculum";

const ROOT = process.cwd();
const LESSONS = path.join(ROOT, "content/lessons");
const PROJECTS = path.join(ROOT, "content/projects");

export type Difficulty = "beginner" | "intermediate" | "advanced" | "expert";
export interface Video { id: string; title: string; channel: string; why: string }
export interface Resource { url: string; title: string; why: string; kind?: string }
export interface Question {
  type: "mcq" | "tf" | "scenario" | "code";
  q: string;
  code?: string;
  options: string[];
  answer: number;
  explain: string;
}
export interface Heading { id: string; text: string; depth: number }

export interface LessonMeta {
  slug: string;
  title: string;
  summary: string;
  difficulty: Difficulty;
  minutes: number;
  source?: string;
  prerequisites: string[];
  objectives: string[];
  videos: Video[];
  resources: Resource[];
  quiz: Question[];
  levelId: string;
  levelN: number;
  levelTitle: string;
  tone: Tone;
  module: string;
  order: number;
}
export interface Lesson extends LessonMeta { html: string; headings: Heading[]; text: string }

export interface ProjectMeta {
  slug: string;
  title: string;
  tier: "beginner" | "intermediate" | "advanced" | "expert";
  summary: string;
  stack: string[];
  lessons: string[];
  steps: string[];
  hours: string;
  order: number;
}
export interface Project extends ProjectMeta { html: string; headings: Heading[]; text: string }

// ---------- markdown ----------

// Matches GitHub's heading anchors so the existing notes' "Contents" links keep working.
export function slugify(text: string) {
  return text.toLowerCase().trim().replace(/<[^>]+>/g, "").replace(/[^\p{L}\p{N}\- _]/gu, "").replace(/ /g, "-");
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Old-notes filename (e.g. "14-choosing-databases.md") -> lesson slug, built from `source:` frontmatter.
let sourceMap: Map<string, string> | null = null;
function getSourceMap() {
  if (!sourceMap) {
    sourceMap = new Map();
    for (const file of fs.readdirSync(LESSONS)) {
      const { data } = matter(fs.readFileSync(path.join(LESSONS, file), "utf8"));
      if (data.source) sourceMap.set(path.basename(data.source), file.replace(/\.md$/, ""));
    }
  }
  return sourceMap;
}

function render(md: string) {
  const headings: Heading[] = [];
  const seen = new Map<string, number>();
  const marked = new Marked(
    markedHighlight({
      emptyLangClass: "hljs",
      langPrefix: "hljs language-",
      highlight(code, lang) {
        if (lang === "mermaid") return code;
        const language = hljs.getLanguage(lang) ? lang : "plaintext";
        return hljs.highlight(code, { language }).value;
      },
    }),
  );
  marked.use({
    gfm: true,
    renderer: {
      heading({ tokens, depth, text }: Tokens.Heading) {
        const plain = text.replace(/[`*_]/g, "");
        let id = slugify(plain);
        const n = seen.get(id) ?? 0;
        seen.set(id, n + 1);
        if (n) id = `${id}-${n}`;
        if (depth === 2 || depth === 3) headings.push({ id, text: plain, depth });
        return `<h${depth} id="${id}"><a class="anchor" href="#${id}" aria-hidden="true">#</a>${this.parser.parseInline(tokens)}</h${depth}>\n`;
      },
      code({ text, lang }: Tokens.Code) {
        if (lang === "mermaid") return `<pre class="mermaid">${escapeHtml(text)}</pre>\n`;
        return false;
      },
      link({ href, tokens }: Tokens.Link) {
        const label = this.parser.parseInline(tokens);
        if (/^(https?:|mailto:)/.test(href)) return `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
        if (href.startsWith("#") || href.startsWith("/")) return `<a href="${href}">${label}</a>`;
        const [file, hash] = href.split("#");
        const slug = getSourceMap().get(path.basename(file));
        if (slug) return `<a href="/learn/${slug}/${hash ? `#${hash}` : ""}">${label}</a>`;
        // Links into the separate PLOS project (or other files not on this site): keep the text, drop the link.
        return `<span class="offsite" title="Not part of this site: ${escapeHtml(href)}">${label}</span>`;
      },
      table(token: Tokens.Table) {
        return `<div class="table-wrap">${Renderer.prototype.table.call(this, token)}</div>`;
      },
    },
  });
  const html = marked.parse(md, { async: false }) as string;
  return { html, headings };
}

function plainText(md: string) {
  return md.replace(/```[\s\S]*?```/g, " ").replace(/<[^>]+>/g, " ").replace(/[#>*_`|\-[\]()]/g, " ").replace(/\s+/g, " ").trim();
}

// ---------- lessons ----------

const placement = new Map<string, { level: LevelDef; module: string; order: number }>();
{
  let order = 0;
  for (const level of curriculum) for (const m of level.modules) for (const slug of m.lessons) placement.set(slug, { level, module: m.title, order: order++ });
}

function readLessonFile(slug: string) {
  const raw = fs.readFileSync(path.join(LESSONS, `${slug}.md`), "utf8");
  return matter(raw);
}

function toMeta(slug: string, data: Record<string, unknown>): LessonMeta {
  const p = placement.get(slug);
  if (!p) throw new Error(`Lesson "${slug}" is not placed in content/curriculum.ts`);
  return {
    slug,
    title: String(data.title),
    summary: String(data.summary ?? ""),
    difficulty: (data.difficulty as Difficulty) ?? "beginner",
    minutes: Number(data.minutes ?? 20),
    source: data.source as string | undefined,
    prerequisites: (data.prerequisites as string[]) ?? [],
    objectives: (data.objectives as string[]) ?? [],
    videos: (data.videos as Video[]) ?? [],
    resources: (data.resources as Resource[]) ?? [],
    quiz: ((data.quiz as Question[]) ?? []).map((q) => (q.type === "tf" && !q.options ? { ...q, options: ["True", "False"] } : q)),
    levelId: p.level.id,
    levelN: p.level.n,
    levelTitle: p.level.title,
    tone: p.level.tone,
    module: p.module,
    order: p.order,
  };
}

const metaCache = new Map<string, LessonMeta>();
export function getLessonMeta(slug: string): LessonMeta {
  if (!metaCache.has(slug)) metaCache.set(slug, toMeta(slug, readLessonFile(slug).data));
  return metaCache.get(slug)!;
}

export function getAllLessonMeta(): LessonMeta[] {
  return [...placement.keys()].map(getLessonMeta);
}

export function getLesson(slug: string): Lesson {
  const { data, content } = readLessonFile(slug);
  let body = content;
  if (data.source) {
    // Preserved original notes: drop their "# Part N: ..." title (the page shows its own) and append the stub's extras.
    const original = fs.readFileSync(path.join(ROOT, data.source), "utf8").replace(/^# .*\n/, "")
      // Their hand-written "## Contents" list duplicates the generated table of contents.
      .replace(/^## Contents\n[\s\S]*?(?=^## )/m, "");
    body = `${original}\n\n${content}`;
  }
  const { html, headings } = render(body);
  return { ...getLessonMeta(slug), html, headings, text: plainText(body) };
}

// ---------- projects ----------

const TIERS = ["beginner", "intermediate", "advanced", "expert"] as const;

export function getAllProjectMeta(): ProjectMeta[] {
  return fs
    .readdirSync(PROJECTS)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const { data } = matter(fs.readFileSync(path.join(PROJECTS, f), "utf8"));
      return { slug: f.replace(/\.md$/, ""), ...(data as Omit<ProjectMeta, "slug">) };
    })
    .sort((a, b) => TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier) || a.order - b.order);
}

export function getProject(slug: string): Project {
  const { data, content } = matter(fs.readFileSync(path.join(PROJECTS, `${slug}.md`), "utf8"));
  const { html, headings } = render(content);
  return { slug, ...(data as Omit<ProjectMeta, "slug">), html, headings, text: plainText(content) };
}

// ---------- shapes passed to client components ----------

export interface NavLesson { slug: string; title: string; minutes: number; difficulty: Difficulty }
export interface NavLevel {
  id: string; n: number; title: string; short: string; tone: Tone; summary: string; outcome: string; optional?: boolean;
  modules: { title: string; lessons: NavLesson[] }[];
}

export function getNav(): NavLevel[] {
  return curriculum.map(({ modules, ...level }) => ({
    ...level,
    modules: modules.map((m) => ({
      title: m.title,
      lessons: m.lessons.map((slug) => {
        const l = getLessonMeta(slug);
        return { slug, title: l.title, minutes: l.minutes, difficulty: l.difficulty };
      }),
    })),
  }));
}
