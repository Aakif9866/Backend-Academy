"use client";
import { useRef, useState } from "react";
import { VizFrame, Seg, Slider, Btn, Stat, useInterval, mulberry32 } from "./common";

type Policy = "lru" | "lfu" | "fifo";
interface Entry { key: string; insertedAt: number; lastUsed: number; hits: number }
const KEYS = "ABCDEFGH".split("");

// Zipf-like popularity: A is requested far more often than H, as in most real workloads.
const WEIGHTS = KEYS.map((_, i) => 1 / (i + 1));
const SUM = WEIGHTS.reduce((a, b) => a + b, 0);

export default function CacheEviction() {
  const [policy, setPolicy] = useState<Policy>("lru");
  const [cap, setCap] = useState(3);
  const [cache, setCache] = useState<Entry[]>([]);
  const [stats, setStats] = useState({ hits: 0, misses: 0 });
  const [log, setLog] = useState<string[]>([]);
  const [auto, setAuto] = useState(false);
  const clock = useRef(0);
  const rand = useRef(mulberry32(42));

  const victim = (c: Entry[]) => {
    if (policy === "fifo") return c.reduce((a, b) => (b.insertedAt < a.insertedAt ? b : a));
    if (policy === "lru") return c.reduce((a, b) => (b.lastUsed < a.lastUsed ? b : a));
    // LFU: fewest hits; break ties by least recently used.
    return c.reduce((a, b) => (b.hits < a.hits || (b.hits === a.hits && b.lastUsed < a.lastUsed) ? b : a));
  };

  const access = (key: string) => {
    const now = ++clock.current;
    const hit = cache.find((e) => e.key === key);
    let next: Entry[];
    let msg: string;
    if (hit) {
      next = cache.map((e) => (e.key === key ? { ...e, lastUsed: now, hits: e.hits + 1 } : e));
      msg = `GET ${key} → HIT`;
    } else {
      next = [...cache];
      msg = `GET ${key} → MISS, load from DB`;
      if (next.length >= cap) {
        const v = victim(next);
        next = next.filter((e) => e !== v);
        msg += `, evict ${v.key}`;
      }
      next.push({ key, insertedAt: now, lastUsed: now, hits: 1 });
    }
    setCache(next);
    setStats((s) => ({ hits: s.hits + (hit ? 1 : 0), misses: s.misses + (hit ? 0 : 1) }));
    setLog((l) => [msg, ...l].slice(0, 6));
  };

  const randomKey = () => {
    let r = rand.current() * SUM;
    for (let i = 0; i < KEYS.length; i++) if ((r -= WEIGHTS[i]) <= 0) return KEYS[i];
    return KEYS[KEYS.length - 1];
  };
  useInterval(() => access(randomKey()), auto ? 450 : null);

  const reset = () => { setCache([]); setStats({ hits: 0, misses: 0 }); setLog([]); clock.current = 0; rand.current = mulberry32(42); };
  const changeCap = (c: number) => { setCap(c); reset(); };
  const total = stats.hits + stats.misses;
  const next = cache.length >= cap ? victim(cache) : null;

  return (
    <VizFrame
      title="Cache eviction: LRU vs LFU vs FIFO"
      hint="Click keys to request them, or run the Zipf-distributed workload (A is most popular, H least). Change capacity and policy and compare hit ratios."
      controls={
        <>
          <Seg label="Eviction policy" value={policy} onChange={(p) => { setPolicy(p); reset(); }} options={[{ id: "lru", label: "LRU" }, { id: "lfu", label: "LFU" }, { id: "fifo", label: "FIFO" }]} />
          <Slider label="Capacity" value={cap} min={2} max={7} onChange={changeCap} suffix=" slots" />
          <div className="flex gap-2">
            <Btn primary onClick={() => setAuto((a) => !a)}>{auto ? "Pause workload" : "Run workload"}</Btn>
            <Btn onClick={reset}>Reset</Btn>
          </div>
        </>
      }
    >
      <div className="flex flex-wrap gap-2">
        {KEYS.map((k) => (
          <button key={k} onClick={() => access(k)} className="size-11 rounded-xl border border-line font-mono font-semibold text-heading hover:border-[var(--c)] active:scale-95 transition">
            {k}
          </button>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-2.5">
        {Array.from({ length: cap }, (_, i) => {
          const e = cache[i];
          const isVictim = e && next === e;
          return (
            <div key={i} className={`w-[104px] rounded-xl border p-3 ${e ? (isVictim ? "border-warn" : "border-[var(--c)] bg-tone-soft") : "border-dashed border-line"}`}>
              {e ? (
                <>
                  <div className="font-mono text-2xl font-bold text-heading">{e.key}</div>
                  <div className="text-[11px] text-muted tabular-nums mt-1">used @{e.lastUsed} · hits {e.hits}</div>
                  {isVictim && <div className="text-[10px] text-warn font-semibold mt-1">next to evict</div>}
                </>
              ) : (
                <div className="text-muted text-xs py-3">empty</div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <Stat label="Hits" value={stats.hits} tone="ok" />
        <Stat label="Misses" value={stats.misses} />
        <Stat label="Hit ratio" value={total ? `${Math.round((stats.hits / total) * 100)}%` : "—"} />
      </div>
      <ul className="mt-4 font-mono text-xs text-muted space-y-1">{log.map((l, i) => <li key={i} className={i === 0 ? "text-heading" : ""}>{l}</li>)}</ul>
      <p className="mt-3 text-muted">
        {policy === "lru" && "LRU evicts whatever was used longest ago. Adapts quickly when popularity shifts, but one scan over many cold keys can flush the hot ones."}
        {policy === "lfu" && "LFU evicts the key with the fewest hits. Protects long-term favourites, but a key that was hot yesterday can squat forever (real LFU implementations, like Redis's, decay counts over time)."}
        {policy === "fifo" && "FIFO evicts the oldest insert regardless of use. Cheap, but it happily throws out your most popular key. Usually beaten by LRU on skewed workloads."}
      </p>
    </VizFrame>
  );
}
