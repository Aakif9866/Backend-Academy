// Authoring helper: quote frontmatter scalar values that YAML would misparse (": ", " #", leading special chars).
import fs from "node:fs";
import path from "node:path";
const dirs = ["content/lessons", "content/projects"];
const KEY = /^(\s*(?:- )?)(title|summary|why|explain|q|channel|gist|hours):\s(.+)$/;
for (const d of dirs) for (const f of fs.readdirSync(d)) {
  const p = path.join(d, f);
  const src = fs.readFileSync(p, "utf8");
  const end = src.indexOf("\n---", 4);
  if (!src.startsWith("---") || end < 0) continue;
  let changed = false;
  const fm = src.slice(0, end).split("\n").map((line) => {
    const m = line.match(KEY);
    if (!m) return line;
    const v = m[3];
    if (/^["'|>[]/.test(v)) return line;
    if (!/: |\s#|^[&*!%@`{?-]/.test(v)) return line;
    changed = true;
    return `${m[1]}${m[2]}: ${JSON.stringify(v)}`;
  });
  if (changed) { fs.writeFileSync(p, fm.join("\n") + src.slice(end)); console.log("quoted", p); }
}
