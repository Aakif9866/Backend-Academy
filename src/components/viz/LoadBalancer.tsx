"use client";
import { useRef, useState } from "react";
import { VizFrame, Seg, Slider, Btn, Stat, useInterval, mulberry32, fnv1a } from "./common";

type Algo = "rr" | "least" | "random" | "iphash";
interface Server { id: number; up: boolean; active: { until: number }[]; handled: number; slow: boolean }

const CLIENTS = 12; // distinct client IPs; matters for IP hash

export default function LoadBalancer() {
  const [n, setN] = useState(4);
  const [algo, setAlgo] = useState<Algo>("rr");
  const [rate, setRate] = useState(6);
  const [running, setRunning] = useState(false);
  const [servers, setServers] = useState<Server[]>(() => mk(4));
  const [dropped, setDropped] = useState(0);
  const t = useRef(0);
  const rr = useRef(0);
  const rand = useRef(mulberry32(7));

  function mk(count: number, prev: Server[] = []): Server[] {
    return Array.from({ length: count }, (_, i) => prev[i] ?? { id: i, up: true, active: [], handled: 0, slow: false });
  }

  const resize = (c: number) => {
    setN(c);
    setServers((s) => mk(c, s));
  };

  const tick = () => {
    t.current += 1;
    const now = t.current;
    const s = servers.map((x) => ({ ...x, active: x.active.filter((a) => a.until > now) }));
    const healthy = s.filter((x) => x.up);
    let lost = 0;
    // rate = requests per second; a tick is 100 ms
    const arrivals = Math.floor(rate / 10) + (rand.current() < (rate % 10) / 10 ? 1 : 0);
    for (let k = 0; k < arrivals; k++) {
      if (!healthy.length) { lost++; continue; }
      const client = Math.floor(rand.current() * CLIENTS);
      let target: Server;
      if (algo === "rr") target = healthy[rr.current++ % healthy.length];
      else if (algo === "least") target = healthy.reduce((a, b) => (b.active.length < a.active.length ? b : a));
      else if (algo === "random") target = healthy[Math.floor(rand.current() * healthy.length)];
      else target = healthy[fnv1a(`10.0.0.${client}`) % healthy.length];
      // Request duration: mostly short with an occasional slow one (heavy tail), 3x on a degraded server.
      const base = rand.current() < 0.1 ? 30 : 4 + Math.floor(rand.current() * 6);
      target.active.push({ until: now + base * (target.slow ? 3 : 1) });
      target.handled++;
    }
    if (lost) setDropped((d) => d + lost);
    setServers(s);
  };
  useInterval(tick, running ? 100 : null);

  const toggle = (id: number, key: "up" | "slow") => setServers((s) => s.map((x) => (x.id === id ? { ...x, [key]: !x[key], active: key === "up" ? [] : x.active } : x)));
  const reset = () => { setServers(mk(n)); setDropped(0); t.current = 0; rr.current = 0; rand.current = mulberry32(7); };

  const total = servers.reduce((a, s) => a + s.handled, 0);
  const maxActive = Math.max(8, ...servers.map((s) => s.active.length));
  const loads = servers.filter((s) => s.up).map((s) => s.active.length);
  const spread = loads.length ? Math.max(...loads) - Math.min(...loads) : 0;

  return (
    <VizFrame
      title="Load balancer: spread requests across servers"
      hint="Start traffic, then compare algorithms. Mark a server slow (3× latency) and watch round robin keep feeding it while least-connections routes around it. Take one down to see health checks remove it."
      controls={
        <>
          <Seg label="Algorithm" value={algo} onChange={setAlgo} options={[{ id: "rr", label: "Round robin" }, { id: "least", label: "Least connections" }, { id: "random", label: "Random" }, { id: "iphash", label: "IP hash" }]} />
          <Slider label="Servers" value={n} min={1} max={8} onChange={resize} />
          <Slider label="Requests / sec" value={rate} min={1} max={40} onChange={setRate} />
          <div className="flex gap-2">
            <Btn primary onClick={() => setRunning((r) => !r)}>{running ? "Pause" : "Start traffic"}</Btn>
            <Btn onClick={reset}>Reset</Btn>
          </div>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 grid-cols-2 sm:grid-cols-4">
        {servers.map((s) => {
          const pct = (s.active.length / maxActive) * 100;
          return (
            <div key={s.id} className={`border rounded-xl p-3.5 transition-colors ${s.up ? "border-line bg-surface-2" : "border-bad/60 bg-surface-2 opacity-60"}`}>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-heading text-sm">app-{s.id + 1}</span>
                <span className={`text-[10px] font-bold uppercase ${!s.up ? "text-bad" : s.slow ? "text-warn" : "text-ok"}`}>{!s.up ? "down" : s.slow ? "slow" : "healthy"}</span>
              </div>
              <div className="mt-3 h-24 bg-surface-3 rounded-lg relative overflow-hidden" aria-label={`${s.active.length} active requests`}>
                <div className="absolute bottom-0 inset-x-0 bg-grad-bright transition-[height] duration-100" style={{ height: `${pct}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-muted tabular-nums">
                <span>active {s.active.length}</span>
                <span>total {s.handled}</span>
              </div>
              <div className="mt-2.5 flex gap-1.5">
                <button onClick={() => toggle(s.id, "up")} className="flex-1 text-[11px] py-1.5 rounded-lg border border-line hover:border-line-strong">{s.up ? "Kill" : "Revive"}</button>
                <button onClick={() => toggle(s.id, "slow")} disabled={!s.up} className="flex-1 text-[11px] py-1.5 rounded-lg border border-line hover:border-line-strong disabled:opacity-40">{s.slow ? "Fix" : "Slow"}</button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <Stat label="Requests served" value={total} />
        <Stat label="Imbalance (max−min active)" value={spread} tone={spread > 6 ? "warn" : undefined} />
        <Stat label="Dropped (no healthy server)" value={dropped} tone={dropped ? "bad" : undefined} />
      </div>
      <p className="mt-4 text-muted">
        {algo === "rr" && "Round robin hands out requests in turn. Fair when every request costs the same, blind when one server is slow or some requests are long."}
        {algo === "least" && "Least connections sends each request to the server with the fewest in flight. A slow server accumulates in-flight requests, so it automatically gets fewer new ones."}
        {algo === "random" && "Random is surprisingly decent at scale, but with small numbers it produces visible imbalance. \"Power of two choices\" (pick 2 at random, take the less loaded) fixes most of it."}
        {algo === "iphash" && `IP hash pins each client to one server (sticky). Good for in-memory sessions, but only ${CLIENTS} clients here means uneven load, and changing the server count reshuffles almost everyone — see consistent hashing.`}
      </p>
    </VizFrame>
  );
}
