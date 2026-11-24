"use client";
import { useMemo, useState } from "react";
import { VizFrame, Slider, Btn, Stat, fnv1a } from "./common";

const NAMES = ["A", "B", "C", "D", "E", "F", "G", "H"];
const COLORS = ["#22d3ee", "#f472b6", "#34d399", "#fbbf24", "#a78bfa", "#fb923c", "#93c5fd", "#fb7185"];
const KEYS = Array.from({ length: 60 }, (_, i) => `user:${i + 1}`);
const MAX = 2 ** 32;

// Avalanche the FNV output a little so short similar strings spread around the ring.
const h = (s: string) => {
  let x = fnv1a(s);
  x ^= x >>> 16; x = Math.imul(x, 0x85ebca6b) >>> 0; x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35) >>> 0; x ^= x >>> 16;
  return x >>> 0;
};

function ring(nodes: string[], vnodes: number) {
  return nodes.flatMap((n) => Array.from({ length: vnodes }, (_, i) => ({ node: n, pos: h(`${n}#${i}`) }))).sort((a, b) => a.pos - b.pos);
}
function owner(points: { node: string; pos: number }[], key: string) {
  const k = h(key);
  return (points.find((p) => p.pos >= k) ?? points[0]).node; // first point clockwise, wrapping around
}

export default function ConsistentHashing() {
  const [count, setCount] = useState(4);
  const [vnodes, setVnodes] = useState(1);
  const [prevCount, setPrevCount] = useState<number | null>(null);

  const nodes = NAMES.slice(0, count);
  const points = useMemo(() => ring(nodes, vnodes), [count, vnodes]); // eslint-disable-line react-hooks/exhaustive-deps

  const assign = (nodeList: string[], pts: ReturnType<typeof ring>) => ({
    ch: Object.fromEntries(KEYS.map((k) => [k, owner(pts, k)])),
    mod: Object.fromEntries(KEYS.map((k) => [k, nodeList[h(k) % nodeList.length]])),
  });
  const now = assign(nodes, points);
  let moved: { ch: number; mod: number } | null = null;
  if (prevCount !== null && prevCount !== count) {
    const prevNodes = NAMES.slice(0, prevCount);
    const before = assign(prevNodes, ring(prevNodes, vnodes));
    moved = { ch: KEYS.filter((k) => before.ch[k] !== now.ch[k]).length, mod: KEYS.filter((k) => before.mod[k] !== now.mod[k]).length };
  }

  const setNodes = (c: number) => { setPrevCount(count); setCount(c); };
  const load = nodes.map((n) => KEYS.filter((k) => now.ch[k] === n).length);
  const ideal = KEYS.length / count;

  const R = 120, C = 150;
  const xy = (pos: number, r: number) => {
    const a = (pos / MAX) * Math.PI * 2 - Math.PI / 2;
    return [C + r * Math.cos(a), C + r * Math.sin(a)];
  };

  return (
    <VizFrame
      title="Consistent hashing ring"
      hint="60 keys and up to 8 cache nodes. Each key belongs to the first node point clockwise from its hash. Add or remove a node and compare how many keys move versus naive hash(key) % N."
      controls={
        <>
          <div className="flex gap-2">
            <Btn onClick={() => setNodes(Math.max(1, count - 1))} disabled={count <= 1}>Remove node</Btn>
            <Btn primary onClick={() => setNodes(Math.min(8, count + 1))} disabled={count >= 8}>Add node</Btn>
          </div>
          <Slider label="Virtual nodes per server" value={vnodes} min={1} max={64} onChange={(v) => { setPrevCount(null); setVnodes(v); }} />
        </>
      }
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[300px_1fr] items-start">
        <svg viewBox="0 0 300 300" className="w-full max-w-[300px] mx-auto" role="img" aria-label="Hash ring">
          <circle cx={C} cy={C} r={R} fill="none" stroke="var(--border-strong)" strokeWidth={2} />
          {KEYS.map((k) => {
            const [x, y] = xy(h(k), R - 14);
            return <circle key={k} cx={x} cy={y} r={3} fill={COLORS[NAMES.indexOf(now.ch[k])]} opacity={0.85}><title>{k} → node {now.ch[k]}</title></circle>;
          })}
          {points.map((p, i) => {
            const [x, y] = xy(p.pos, R);
            const show = vnodes <= 4;
            return (
              <g key={i}>
                <circle cx={x} cy={y} r={show ? 9 : 4} fill={COLORS[NAMES.indexOf(p.node)]} stroke="var(--surface)" strokeWidth={2} />
                {show && <text x={x} y={y + 3.5} textAnchor="middle" className="text-[9px] font-bold fill-black">{p.node}</text>}
              </g>
            );
          })}
          <text x={C} y={C - 4} textAnchor="middle" className="text-[12px] font-semibold fill-[var(--heading)]">{count} nodes</text>
          <text x={C} y={C + 12} textAnchor="middle" className="text-[10px] fill-[var(--muted)]">{points.length} ring points</text>
        </svg>
        <div>
          <p className="text-xs text-muted mb-2">Keys per node (ideal ≈ {ideal.toFixed(1)})</p>
          <div className="space-y-1.5">
            {nodes.map((n, i) => (
              <div key={n} className="flex items-center gap-2 text-xs">
                <span className="w-14 font-mono text-heading">node {n}</span>
                <div className="flex-1 h-4 bg-surface-3 rounded overflow-hidden">
                  <div className="h-full rounded transition-[width] duration-300" style={{ width: `${(load[i] / Math.max(...load, 1)) * 100}%`, background: COLORS[i] }} />
                </div>
                <span className="w-6 text-right tabular-nums">{load[i]}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Stat label="Moved: consistent hashing" value={moved ? `${moved.ch}/${KEYS.length}` : "—"} tone={moved ? "ok" : undefined} />
            <Stat label="Moved: hash % N" value={moved ? `${moved.mod}/${KEYS.length}` : "—"} tone={moved ? "bad" : undefined} />
          </div>
          <p className="mt-4 text-muted">
            Changing N under <code>hash % N</code> remaps most keys (from {prevCount ?? "N"} to {count} nodes, roughly {Math.round((1 - 1 / Math.max(count, prevCount ?? count)) * 100)}% would be expected to move), which for a cache means a sudden flood of misses onto the database. With a ring, only the keys in the arc next to the added or removed node move: about 1/N.
            With 1 point per node the arcs are uneven; raise virtual nodes and watch the bars even out. Cassandra, DynamoDB's original design and many cache clients work this way.
          </p>
        </div>
      </div>
    </VizFrame>
  );
}
