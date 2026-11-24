"use client";
import { useRef, useState } from "react";
import { VizFrame, Slider, Btn, Stat, mulberry32 } from "./common";

interface Replica { up: boolean; value: number; version: number }

export default function Quorum() {
  const [n, setN] = useState(3);
  const [w, setW] = useState(2);
  const [r, setR] = useState(2);
  const [reps, setReps] = useState<Replica[]>(() => mk(3));
  const [latest, setLatest] = useState({ value: 100, version: 1 });
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "bad" | "warn" } | null>(null);
  const [touched, setTouched] = useState<number[]>([]);
  const rand = useRef(mulberry32(5));

  function mk(count: number): Replica[] {
    return Array.from({ length: count }, () => ({ up: true, value: 100, version: 1 }));
  }
  const pick = (alive: number[], k: number) => [...alive].sort(() => rand.current() - 0.5).slice(0, k);

  const write = () => {
    const alive = reps.map((x, i) => (x.up ? i : -1)).filter((i) => i >= 0);
    if (alive.length < w) {
      setTouched([]);
      return setMsg({ text: `Write failed: only ${alive.length} replicas reachable, need W=${w}. Availability was traded for consistency.`, tone: "bad" });
    }
    const version = latest.version + 1;
    const value = latest.value + 10;
    // Coordinator waits for W acks. Sending to the rest is "best effort"; we model only the W that acknowledged.
    const acked = pick(alive, w);
    setReps(reps.map((x, i) => (acked.includes(i) ? { ...x, value, version } : x)));
    setLatest({ value, version });
    setTouched(acked);
    setMsg({ text: `Wrote value ${value} (v${version}) to replicas ${acked.map((i) => i + 1).join(", ")}. The others still hold old data until repair.`, tone: "ok" });
  };

  const read = () => {
    const alive = reps.map((x, i) => (x.up ? i : -1)).filter((i) => i >= 0);
    if (alive.length < r) {
      setTouched([]);
      return setMsg({ text: `Read failed: only ${alive.length} replicas reachable, need R=${r}.`, tone: "bad" });
    }
    const asked = pick(alive, r);
    const best = asked.map((i) => reps[i]).reduce((a, b) => (b.version > a.version ? b : a));
    setTouched(asked);
    const fresh = best.version === latest.version;
    // Read repair: bring stale replicas we contacted up to date.
    setReps(reps.map((x, i) => (asked.includes(i) && x.version < best.version ? { ...x, value: best.value, version: best.version } : x)));
    setMsg({
      text: fresh
        ? `Read replicas ${asked.map((i) => i + 1).join(", ")}: newest is ${best.value} (v${best.version}). Correct, and stale replicas we touched were read-repaired.`
        : `Read replicas ${asked.map((i) => i + 1).join(", ")}: got ${best.value} (v${best.version}) but the latest write was v${latest.version}. STALE READ, because R + W ≤ N lets the read set miss the write set.`,
      tone: fresh ? "ok" : "warn",
    });
  };

  const resize = (k: number) => { setN(k); setW(Math.min(w, k)); setR(Math.min(r, k)); setReps(mk(k)); setLatest({ value: 100, version: 1 }); setMsg(null); setTouched([]); };
  const overlap = r + w > n;

  return (
    <VizFrame
      title="Quorum reads and writes (N, R, W)"
      hint="Data is replicated to N nodes. A write succeeds after W acks; a read asks R nodes and keeps the newest version. Click replicas to crash them. Try R=1, W=1 with N=3 and do write, read, read…"
      controls={
        <>
          <Slider label="Replicas N" value={n} min={1} max={7} onChange={resize} />
          <Slider label="Write quorum W" value={w} min={1} max={n} onChange={setW} />
          <Slider label="Read quorum R" value={r} min={1} max={n} onChange={setR} />
          <div className="flex gap-2">
            <Btn primary onClick={write}>Write</Btn>
            <Btn primary onClick={read}>Read</Btn>
            <Btn onClick={() => resize(n)}>Reset</Btn>
          </div>
        </>
      }
    >
      <div className="flex flex-wrap gap-3">
        {reps.map((x, i) => (
          <button
            key={i}
            onClick={() => setReps(reps.map((y, j) => (j === i ? { ...y, up: !y.up } : y)))}
            className={`w-[104px] text-left rounded-xl border p-3 transition ${!x.up ? "border-bad/60 opacity-50" : touched.includes(i) ? "border-[var(--c)] bg-tone-soft" : "border-line bg-surface-2"}`}
            aria-label={`Replica ${i + 1}, ${x.up ? "up" : "down"}. Click to toggle.`}
          >
            <div className="text-xs text-muted">replica {i + 1}</div>
            <div className="text-xl font-bold text-heading tabular-nums">{x.value}</div>
            <div className={`text-[11px] tabular-nums ${x.version < latest.version ? "text-warn" : "text-muted"}`}>v{x.version}{x.version < latest.version ? " · stale" : ""}</div>
            <div className={`text-[10px] font-bold uppercase mt-1 ${x.up ? "text-ok" : "text-bad"}`}>{x.up ? "up" : "down"}</div>
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <Stat label="R + W" value={`${r + w} ${overlap ? ">" : "≤"} ${n}`} tone={overlap ? "ok" : "warn"} />
        <Stat label="Writes survive" value={`${n - w} down`} />
        <Stat label="Reads survive" value={`${n - r} down`} />
      </div>
      {msg && <p className={`mt-4 font-medium ${msg.tone === "ok" ? "text-ok" : msg.tone === "bad" ? "text-bad" : "text-warn"}`}>{msg.text}</p>}
      <p className="mt-3 text-muted">
        When R + W &gt; N, every read set shares at least one node with every write set, so a read sees the latest acknowledged write (under normal operation; sloppy quorums and concurrent writes add caveats).
        N=3, W=2, R=2 is the common default: tolerates one node down for both reads and writes. W=N, R=1 makes reads cheap but a single dead node blocks writes.
      </p>
    </VizFrame>
  );
}
