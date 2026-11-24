"use client";
import { useRef, useState } from "react";
import { VizFrame, Seg, Slider, Btn, Stat, useInterval, mulberry32 } from "./common";

type State = "closed" | "open" | "half-open";
type Health = "healthy" | "failing" | "flaky";
interface Call { id: number; result: "ok" | "fail" | "rejected"; state: State }

export default function CircuitBreaker() {
  const [health, setHealth] = useState<Health>("healthy");
  const [threshold, setThreshold] = useState(5);
  const [cooldown, setCooldown] = useState(3);
  const [running, setRunning] = useState(true);
  const [state, setState] = useState<State>("closed");
  const [calls, setCalls] = useState<Call[]>([]);
  const [failStreak, setFailStreak] = useState(0);
  const [openedAt, setOpenedAt] = useState(0);
  const [t, setT] = useState(0); // in ticks of 250 ms
  const id = useRef(0);
  const rand = useRef(mulberry32(3));

  const tick = () => {
    const now = t + 1;
    setT(now);
    let s = state;
    // Open → half-open once the cooldown has elapsed: let one trial request through.
    if (s === "open" && now - openedAt >= cooldown * 4) s = "half-open";
    let result: Call["result"];
    if (s === "open") {
      result = "rejected"; // fail fast: no call reaches the sick dependency
    } else {
      const failP = health === "healthy" ? 0.02 : health === "flaky" ? 0.4 : 1;
      result = rand.current() < failP ? "fail" : "ok";
    }
    let streak = failStreak;
    if (s === "half-open") {
      if (result === "ok") { s = "closed"; streak = 0; }
      else { s = "open"; setOpenedAt(now); }
    } else if (s === "closed") {
      streak = result === "fail" ? streak + 1 : 0;
      if (streak >= threshold) { s = "open"; setOpenedAt(now); streak = 0; }
    }
    setFailStreak(streak);
    setState(s);
    setCalls((c) => [{ id: id.current++, result, state: s }, ...c].slice(0, 48));
  };
  useInterval(tick, running ? 250 : null);

  const reset = () => { setState("closed"); setCalls([]); setFailStreak(0); setT(0); };
  const counts = { ok: calls.filter((c) => c.result === "ok").length, fail: calls.filter((c) => c.result === "fail").length, rejected: calls.filter((c) => c.result === "rejected").length };
  const remaining = state === "open" ? Math.max(0, (cooldown * 4 - (t - openedAt)) / 4) : 0;

  const node = (s: State, x: number, label: string, sub: string) => {
    const active = state === s;
    const tone = s === "closed" ? "emerald" : s === "open" ? "rose" : "amber";
    return (
      <g data-tone={tone}>
        <rect x={x - 70} y={30} width={140} height={58} rx={14} fill={active ? "var(--accent-soft)" : "var(--surface-2)"} stroke={active ? "var(--c)" : "var(--border-strong)"} strokeWidth={active ? 2.5 : 1} />
        <text x={x} y={56} textAnchor="middle" className={`text-[13px] font-bold ${active ? "fill-[var(--c)]" : "fill-[var(--muted)]"}`}>{label}</text>
        <text x={x} y={74} textAnchor="middle" className="text-[10px] fill-[var(--muted)]">{sub}</text>
      </g>
    );
  };

  return (
    <VizFrame
      title="Circuit breaker state machine"
      hint="Calls flow to a downstream service every 250 ms. Make it fail and watch the breaker trip open, reject calls instantly, then probe with a single trial call in half-open."
      controls={
        <>
          <Seg label="Downstream service" value={health} onChange={setHealth} options={[{ id: "healthy", label: "Healthy" }, { id: "flaky", label: "Flaky (40% fail)" }, { id: "failing", label: "Down" }]} />
          <Slider label="Trip after consecutive failures" value={threshold} min={2} max={10} onChange={setThreshold} />
          <Slider label="Open cooldown" value={cooldown} min={1} max={8} onChange={setCooldown} suffix="s" />
          <div className="flex gap-2">
            <Btn primary onClick={() => setRunning((r) => !r)}>{running ? "Pause" : "Resume"}</Btn>
            <Btn onClick={reset}>Reset</Btn>
          </div>
        </>
      }
    >
      <div className="overflow-x-auto">
        <svg viewBox="0 0 620 150" className="w-full min-w-[520px]" role="img" aria-label={`Breaker is ${state}`}>
          <defs>
            <marker id="cb-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--muted)" /></marker>
          </defs>
          {node("closed", 100, "CLOSED", "calls pass through")}
          {node("open", 310, "OPEN", "fail fast, no calls")}
          {node("half-open", 520, "HALF-OPEN", "one trial call")}
          <path d="M170 48 L240 48" stroke="var(--muted)" markerEnd="url(#cb-arrow)" />
          <text x={205} y={40} textAnchor="middle" className="text-[9.5px] fill-[var(--muted)]">{threshold} failures</text>
          <path d="M380 48 L450 48" stroke="var(--muted)" markerEnd="url(#cb-arrow)" />
          <text x={415} y={40} textAnchor="middle" className="text-[9.5px] fill-[var(--muted)]">after {cooldown}s</text>
          <path d="M450 78 L380 78" stroke="var(--muted)" markerEnd="url(#cb-arrow)" />
          <text x={415} y={94} textAnchor="middle" className="text-[9.5px] fill-[var(--muted)]">trial fails</text>
          <path d="M520 90 Q 310 160 100 90" fill="none" stroke="var(--muted)" markerEnd="url(#cb-arrow)" />
          <text x={310} y={138} textAnchor="middle" className="text-[9.5px] fill-[var(--muted)]">trial succeeds</text>
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap gap-1" aria-label="Recent calls, newest first">
        {calls.map((c) => (
          <span key={c.id} title={c.result} className={`size-4 rounded ${c.result === "ok" ? "bg-ok" : c.result === "fail" ? "bg-bad" : "bg-surface-3 border border-line-strong"}`} />
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <Stat label="Succeeded" value={counts.ok} tone="ok" />
        <Stat label="Failed (hit downstream)" value={counts.fail} tone={counts.fail ? "bad" : undefined} />
        <Stat label="Rejected fast" value={counts.rejected} />
        <Stat label={state === "open" ? "Half-open in" : "Failure streak"} value={state === "open" ? `${remaining.toFixed(1)}s` : `${failStreak}/${threshold}`} tone={state === "open" ? "warn" : undefined} />
      </div>
      <p className="mt-4 text-muted">
        Grey squares are calls the breaker rejected without touching the dependency. That is the point: the failing service gets room to recover, and your callers get an instant error (or a fallback) instead of waiting for a timeout and tying up threads and connections.
        Real breakers (resilience4j, Polly) usually trip on a failure <em>rate</em> over a sliding window rather than a streak; the state machine is the same.
      </p>
    </VizFrame>
  );
}
