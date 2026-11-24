// Content validation. Runs before every build; `--online` also checks every external link and video.
//   node scripts/validate.mjs            structure, schema, references
//   node scripts/validate.mjs --online   + HTTP check of resource URLs and YouTube oEmbed for videos
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { curriculum } from "../content/curriculum.ts";
import { guides } from "../content/guides.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const online = process.argv.includes("--online");
const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

const DIFF = ["beginner", "intermediate", "advanced", "expert"];
const QTYPES = ["mcq", "tf", "scenario", "code"];
const vizNames = [...fs.readFileSync(path.join(ROOT, "src/components/viz/index.tsx"), "utf8").matchAll(/^\s+"?([\w-]+)"?: \w+,$/gm)].map((m) => m[1]);

const lessonDir = path.join(ROOT, "content/lessons");
const projectDir = path.join(ROOT, "content/projects");
const placed = curriculum.flatMap((l) => l.modules.flatMap((m) => m.lessons));
const order = new Map(placed.map((s, i) => [s, i]));
const files = fs.readdirSync(lessonDir).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3));
const projects = fs.readdirSync(projectDir).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3));

// duplicates / placement
const dup = placed.filter((s, i) => placed.indexOf(s) !== i);
dup.forEach((s) => err("curriculum", `lesson "${s}" is placed twice`));
placed.filter((s) => !files.includes(s)).forEach((s) => err("curriculum", `missing file content/lessons/${s}.md`));
files.filter((f) => !order.has(f)).forEach((f) => err(`lessons/${f}.md`, "not placed in content/curriculum.ts"));

const urls = new Map(); // url -> where
const videos = new Map(); // id -> {title, where}
const usedSources = new Set();

function checkBody(where, body) {
  for (const m of body.matchAll(/<div data-viz="([\w-]+)"><\/div>/g)) if (!vizNames.includes(m[1])) err(where, `unknown visualisation "${m[1]}"`);
  for (const m of body.matchAll(/\]\(\/learn\/([\w-]+)\/?(#[\w-]+)?\)/g)) if (!order.has(m[1])) err(where, `link to unknown lesson /learn/${m[1]}`);
  for (const m of body.matchAll(/\]\(\/projects\/([\w-]+)\/?\)/g)) if (!projects.includes(m[1])) err(where, `link to unknown project /projects/${m[1]}`);
  const fences = (body.match(/^```/gm) ?? []).length;
  if (fences % 2) err(where, "unbalanced ``` code fences");
}

for (const slug of files.filter((f) => order.has(f))) {
  const where = `lessons/${slug}.md`;
  const { data, content } = matter(fs.readFileSync(path.join(lessonDir, `${slug}.md`), "utf8"));
  if (data.draft) err(where, "still marked draft: true");
  for (const k of ["title", "summary", "difficulty", "minutes"]) if (data[k] === undefined) err(where, `missing frontmatter "${k}"`);
  if (data.difficulty && !DIFF.includes(data.difficulty)) err(where, `difficulty must be one of ${DIFF.join(", ")}`);
  if (!Array.isArray(data.objectives) || !data.objectives.length) err(where, "needs at least one objective");
  let body = content;
  if (data.source) {
    const src = path.join(ROOT, data.source);
    if (!fs.existsSync(src)) err(where, `source ${data.source} does not exist`);
    else body = fs.readFileSync(src, "utf8") + content;
    usedSources.add(path.basename(data.source));
  } else if (content.trim().length < 3000) warn(where, `body is short (${content.trim().length} chars)`);
  checkBody(where, body);

  for (const p of data.prerequisites ?? []) {
    if (!order.has(p)) err(where, `prerequisite "${p}" is not a lesson`);
    else if (order.get(p) > order.get(slug)) warn(where, `prerequisite "${p}" comes later in the roadmap`);
  }
  (data.quiz ?? []).forEach((q, i) => {
    const w = `${where} quiz[${i}]`;
    if (!QTYPES.includes(q.type)) err(w, `type must be one of ${QTYPES.join(", ")}`);
    const opts = q.type === "tf" && !q.options ? ["True", "False"] : q.options;
    if (!q.q) err(w, "missing q");
    if (!Array.isArray(opts) || opts.length < 2) err(w, "needs at least 2 options");
    else if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= opts.length) err(w, `answer ${q.answer} out of range`);
    if (!q.explain) err(w, "missing explain");
  });
  if (!(data.quiz ?? []).length) warn(where, "no quiz");
  for (const v of data.videos ?? []) {
    if (!/^[\w-]{11}$/.test(v.id ?? "")) err(where, `bad YouTube id "${v.id}"`);
    for (const k of ["title", "channel", "why"]) if (!v[k]) err(where, `video ${v.id} missing "${k}"`);
    videos.set(v.id, { title: v.title, where });
  }
  for (const r of data.resources ?? []) {
    if (!/^https:\/\//.test(r.url ?? "")) err(where, `resource url must be https: ${r.url}`);
    if (!r.title || !r.why) err(where, `resource ${r.url} needs title and why`);
    if (urls.has(r.url) && urls.get(r.url) === where) err(where, `duplicate resource ${r.url}`);
    urls.set(r.url, where);
  }
}

// every original note (except the PLOS-specific one) must be accounted for
for (const f of fs.readdirSync(path.join(ROOT, "backend")).filter((f) => /^\d\d-.*\.md$/.test(f))) {
  if (f.startsWith("01-")) continue; // PLOS walkthrough: separate project, intentionally excluded
  if (!usedSources.has(f)) err("backend/", `${f} is not used by any lesson (source:)`);
}

for (const slug of projects) {
  const where = `projects/${slug}.md`;
  const { data, content } = matter(fs.readFileSync(path.join(projectDir, `${slug}.md`), "utf8"));
  for (const k of ["title", "tier", "summary", "stack", "lessons", "steps", "hours", "order"]) if (data[k] === undefined) err(where, `missing frontmatter "${k}"`);
  if (data.tier && !DIFF.includes(data.tier)) err(where, `tier must be one of ${DIFF.join(", ")}`);
  for (const l of data.lessons ?? []) if (!order.has(l)) err(where, `lesson "${l}" does not exist`);
  if ((data.steps ?? []).length < 3) err(where, "needs at least 3 steps");
  for (const h of ["Requirements", "Architecture", "API", "Testing", "Evaluation"]) if (!new RegExp(`^## .*${h}`, "mi").test(content)) warn(where, `no "## …${h}…" section`);
  checkBody(where, content);
}

for (const g of guides) if (!order.has(g.lesson)) err("content/guides.ts", `unknown lesson "${g.lesson}"`);

if (online) {
  const list = [...urls.keys()];
  console.log(`Checking ${list.length} resource URLs and ${videos.size} videos…`);
  const UA = { "user-agent": "Mozilla/5.0 (Macintosh) backend-academy-link-check", accept: "text/html,*/*" };
  const check = async (url) => {
    for (const method of ["HEAD", "GET"]) {
      try {
        const r = await fetch(url, { method, headers: UA, redirect: "follow", signal: AbortSignal.timeout(20000) });
        if (r.status < 400) return null;
        if (method === "GET") return r.status;
      } catch (e) {
        if (method === "GET") return e.cause?.code ?? e.name;
      }
    }
  };
  const pool = async (items, n, fn) => {
    const out = [];
    let i = 0;
    await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
    return out;
  };
  const res = await pool(list, 8, check);
  res.forEach((status, i) => status && (status === 403 || status === 429 ? warn : err)(urls.get(list[i]), `${list[i]} → ${status}`));
  const vids = [...videos.entries()];
  const vres = await pool(vids, 8, async ([id]) => {
    const r = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`);
    return r.ok ? (await r.json()).title : null;
  });
  vres.forEach((title, i) => {
    const [id, v] = vids[i];
    if (!title) err(v.where, `video ${id} is unavailable`);
    else if (title !== v.title) warn(v.where, `video ${id} title is "${title}" (frontmatter says "${v.title}")`);
  });
}

const qCount = files.reduce((a, f) => a + (matter(fs.readFileSync(path.join(lessonDir, `${f}.md`), "utf8")).data.quiz ?? []).length, 0);
warnings.forEach((w) => console.warn(`  warn  ${w}`));
errors.forEach((e) => console.error(`  ERROR ${e}`));
console.log(`\n${placed.length} lessons · ${projects.length} projects · ${qCount} quiz questions · ${urls.size} resources · ${videos.size} videos · ${vizNames.length} visualisations`);
console.log(`${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
