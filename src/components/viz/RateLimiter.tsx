"use client";
import { useRef, useState } from "react";
import { VizFrame, Seg, Slider, Btn, Stat, useInterval } from "./common";

type Algo = "token" | "fixed" | "sliding";
interface Req { t: number; ok: boolean }
const SPAN = 10; // seconds shown on the timeline

export default function RateLimiter() {
  const [algo, setAlgo] = useState<Algo>("token");
  const [limit, setLimit] = useState(5);
  const [windowS, setWindowS] = useState(2);
  const [autoRate, setAutoRate] = useState(0);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [now, setNow] = useState(0);
  const start = useRef<number | null>(null);
  // Limiter state lives in refs: it is mutated per request, not per render.
  const bucket = useRef({ tokens: 5, last: 0 });
  const fixed = useRef({ windowStart: 0, count: 0 });
  const log = useRef<number[]>([]);

  const clock = () => {
    if (start.current === null) start.current = performance.now();
    return (performance.now() - start.current) / 1000;
  };
  useInterval(() => setNow(clock()), 100);
  useInterval(() => hit(1), autoRate ? 1000 / autoRate : null);

  const allow = (t: number): boolean => {
    if (algo === "token") {
      const rate = limit / windowS; // tokens per second, same average as the window algorithms
      const b = bucket.current;
      b.tokens = Math.min(limit, b.tokens + (t - b.last) * rate);
      b.last = t;
      if (b.tokens >= 1) { b.tokens -= 1; return true; }
      return false;
    }
    if (algo === "fixed") {
      const f = fixed.current;
      const ws = Math.floor(t / windowS) * windowS;
      if (ws !== f.windowStart) { f.windowStart = ws; f.count = 0; }
      if (f.count < limit) { f.count++; return true; }
      return false;
    }
    log.current = log.current.filter((x) => x > t - windowS);
    if (log.current.length < limit) { log.current.push(t); return true; }
    return false;
  };

  const hit = (n: number) => {
    const t = clock();
    const batch: Req[] = [];
    for (let i = 0; i < n; i++) batch.push({ t: t + i * 0.001, ok: allow(t + i * 0.001) });
    setReqs((r) => [...r.filter((x) => x.t > t - SPAN), ...batch]);
  };

  const reset = () => {
    const t = clock();
    bucket.current = { tokens: limit, last: t };
    fixed.current = { windowStart: Math.floor(t / windowS) * windowS, count: 0 };
    log.current = [];
    setReqs([]);
  };
  const change = (fn: () => void) => { fn(); setTimeout(reset, 0); };

  const visible = reqs.filter((r) => r.t > now - SPAN);
  const okN = visible.filter((r) => r.ok).length;
  const x = (t: number) => ((t - (now - SPAN)) / SPAN) * 100;

  // Current state readout
  let state = "";
  if (algo === "token") {
    const b = bucket.current;
    const tokens = Math.min(limit, b.tokens + (now - b.last) * (limit / windowS));
    state = `${tokens.toFixed(1)} / ${limit} tokens (refill ${(limit / windowS).toFixed(1)}/s)`;
  } else if (algo === "fixed") {
    const ws = Math.floor(now / windowS) * windowS;
    const count = ws === fixed.current.windowStart ? fixed.current.count : 0;
    state = `${count} / ${limit} used in window [${ws.toFixed(0)}s, ${(ws + windowS).toFixed(0)}s)`;
  } else {
    state = `${log.current.filter((t) => t > now - windowS).length} / ${limit} in the last ${windowS}s`;
  }
  const boundaries = algo === "fixed" ? Array.from({ length: Math.ceil(SPAN / windowS) + 1 }, (_, i) => (Math.floor((now - SPAN) / windowS) + i) * windowS).filter((b) => b > now - SPAN) : [];

  return (
    <VizFrame
      title="Rate limiting algorithms"
      hint={`Allow ${limit} requests per ${windowS}s. Fire single requests and bursts. Try the fixed window: burst at the end of one window and again at the start of the next to get 2× the limit through in a moment.`}
      controls={
        <>
          <Seg label="Algorithm" value={algo} onChange={(a) => change(() => setAlgo(a))} options={[{ id: "token", label: "Token bucket" }, { id: "fixed", label: "Fixed window" }, { id: "sliding", label: "Sliding window log" }]} />
          <Slider label="Limit" value={limit} min={1} max={10} onChange={(v) => change(() => setLimit(v))} />
          <Slider label="Window" value={windowS} min={1} max={5} onChange={(v) => change(() => setWindowS(v))} suffix="s" />
          <Slider label="Auto traffic" value={autoRate} min={0} max={10} onChange={setAutoRate} suffix="/s" />
          <div className="flex gap-2">
            <Btn primary onClick={() => hit(1)}>Send request</Btn>
            <Btn onClick={() => hit(8)}>Burst ×8</Btn>
            <Btn onClick={reset}>Reset</Btn>
          </div>
        </>
      }
    >
      <div className="relative h-28 rounded-xl border border-line bg-surface-2 overflow-hidden" aria-label="Timeline of the last 10 seconds">
        {boundaries.map((b) => (
          <div key={b} className="absolute top-0 bottom-0 border-l border-dashed border-line-strong" style={{ left: `${x(b)}%` }}>
            <span className="absolute top-1 left-1 text-[10px] text-muted">{b.toFixed(0)}s</span>
          </div>
        ))}
        {visible.map((r, i) => (
          <span
            key={i}
            className={`absolute size-3 rounded-full -translate-x-1/2 ${r.ok ? "bg-ok" : "bg-bad"}`}
            style={{ left: `${x(r.t)}%`, top: r.ok ? `${26 + (i % 4) * 9}%` : `${66 + (i % 3) * 9}%` }}
            title={r.ok ? "allowed" : "429 Too Many Requests"}
          />
        ))}
        <span className="absolute right-2 bottom-1 text-[10px] text-muted">now</span>
        <span className="absolute left-2 top-[30%] text-[10px] text-ok font-semibold">allowed</span>
        <span className="absolute left-2 top-[70%] text-[10px] text-bad font-semibold">429</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <Stat label="Allowed (last 10s)" value={okN} tone="ok" />
        <Stat label="Rejected (last 10s)" value={visible.length - okN} tone={visible.length - okN ? "bad" : undefined} />
        <div className="border border-line bg-surface-2 rounded-xl px-3.5 py-2.5"><div className="text-[11px] text-muted">Limiter state</div><div className="text-sm font-mono text-heading mt-1">{state}</div></div>
      </div>
      <p className="mt-4 text-muted">
        {algo === "token" && "Token bucket: the bucket holds up to the limit in tokens and refills continuously. Bursts up to the bucket size pass instantly, then traffic is smoothed to the refill rate. Stores 2 numbers per client. Used by AWS API Gateway and Stripe."}
        {algo === "fixed" && "Fixed window: one counter per client per window. Cheapest to implement (a Redis INCR with EXPIRE), but the counter resets at the boundary, so up to 2× the limit can pass across it."}
        {algo === "sliding" && "Sliding window log: keep every timestamp in the window and count them. Exact, no boundary burst, but memory grows with the limit. The sliding window counter approximates it with two counters."}
      </p>
    </VizFrame>
  );
}
