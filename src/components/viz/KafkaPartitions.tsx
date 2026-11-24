"use client";
import { useRef, useState } from "react";
import { VizFrame, Slider, Btn, Stat, useInterval, mulberry32, fnv1a } from "./common";

const COLORS = ["#22d3ee", "#f472b6", "#34d399", "#fbbf24", "#a78bfa", "#fb923c", "#93c5fd", "#fb7185", "#2dd4bf", "#c084fc"];
const KEYS = ["order-17", "order-42", "order-7", "order-99", "order-3", "order-58", "order-21", "order-80"];

interface Partition { log: string[]; committed: number }

// Round-robin assignment: partition i goes to consumer i % C.
function assign(p: number, c: number) {
  const out: number[][] = Array.from({ length: c }, () => []);
  for (let i = 0; i < p; i++) out[i % c].push(i);
  return out;
}

export default function KafkaPartitions() {
  const [pCount, setP] = useState(3);
  const [cCount, setC] = useState(2);
  const [rate, setRate] = useState(6);
  const [perConsumer, setPerConsumer] = useState(3);
  const [running, setRunning] = useState(false);
  const [parts, setParts] = useState<Partition[]>(() => Array.from({ length: 3 }, () => ({ log: [], committed: 0 })));
  const rand = useRef(mulberry32(11));
  const seq = useRef(0);
  const sub = useRef(0);

  const resetWith = (p: number) => setParts(Array.from({ length: p }, () => ({ log: [], committed: 0 })));
  const assignment = assign(pCount, cCount);

  // Ticks every 250ms. Producer writes `rate` msgs/s, each consumer processes `perConsumer` msgs/s (shared across its partitions).
  useInterval(() => {
    sub.current++;
    const next = parts.map((p) => ({ log: [...p.log], committed: p.committed }));
    const produce = Math.floor(rate / 4) + (rand.current() < (rate % 4) / 4 ? 1 : 0);
    for (let i = 0; i < produce; i++) {
      const key = KEYS[Math.floor(rand.current() * KEYS.length)];
      // Same key → same partition, which is what preserves per-key ordering.
      next[fnv1a(key) % pCount].log.push(`${key}#${++seq.current}`);
    }
    assignment.forEach((owned) => {
      const budget = Math.floor(perConsumer / 4) + (rand.current() < (perConsumer % 4) / 4 ? 1 : 0);
      for (let b = 0; b < budget; b++) {
        // consume from the owned partition with the most lag
        const target = owned.filter((i) => next[i].committed < next[i].log.length).sort((a, z) => next[z].log.length - next[z].committed - (next[a].log.length - next[a].committed))[0];
        if (target === undefined) break;
        next[target].committed++;
      }
    });
    setParts(next);
  }, running ? 250 : null);

  const totalLag = parts.reduce((a, p) => a + p.log.length - p.committed, 0);
  const idle = Math.max(0, cCount - pCount);

  return (
    <VizFrame
      title="Kafka partitions and consumer groups"
      hint="Messages are routed to a partition by hash(key). Within a group, each partition is read by exactly one consumer. Add consumers to cut lag, then add more consumers than partitions and see the extras sit idle."
      controls={
        <>
          <Slider label="Partitions" value={pCount} min={1} max={8} onChange={(v) => { setP(v); resetWith(v); }} />
          <Slider label="Consumers in group" value={cCount} min={1} max={10} onChange={setC} />
          <Slider label="Produce rate" value={rate} min={1} max={30} onChange={setRate} suffix="/s" />
          <Slider label="Each consumer handles" value={perConsumer} min={1} max={10} onChange={setPerConsumer} suffix="/s" />
          <div className="flex gap-2">
            <Btn primary onClick={() => setRunning((r) => !r)}>{running ? "Pause" : "Start"}</Btn>
            <Btn onClick={() => resetWith(pCount)}>Reset</Btn>
          </div>
        </>
      }
    >
      <div className="space-y-2.5">
        {parts.map((p, i) => {
          const consumer = assignment.findIndex((owned) => owned.includes(i));
          const lag = p.log.length - p.committed;
          const tail = p.log.slice(-18);
          const offset0 = p.log.length - tail.length;
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="w-12 shrink-0 text-xs font-mono text-heading">P{i}</span>
              <div className="flex-1 min-w-0 flex gap-[3px] overflow-hidden h-7 items-center bg-surface-2 border border-line rounded-lg px-1.5">
                {tail.map((m, j) => {
                  const done = offset0 + j < p.committed;
                  return <span key={offset0 + j} title={m} className={`h-4 w-3 shrink-0 rounded-sm ${done ? "opacity-25" : ""}`} style={{ background: COLORS[KEYS.indexOf(m.split("#")[0]) % COLORS.length] }} />;
                })}
              </div>
              <span className={`w-16 shrink-0 text-right text-xs tabular-nums ${lag > 10 ? "text-warn font-semibold" : "text-muted"}`}>lag {lag}</span>
              <span className="w-20 shrink-0 text-xs flex items-center gap-1.5">
                <span className="size-2.5 rounded-full" style={{ background: COLORS[consumer % COLORS.length] }} />C{consumer + 1}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {Array.from({ length: cCount }, (_, c) => (
          <span key={c} className={`text-xs px-2.5 py-1.5 rounded-lg border ${assignment[c].length ? "border-line" : "border-dashed border-line text-muted"}`}>
            <span className="inline-block size-2 rounded-full mr-1.5" style={{ background: COLORS[c % COLORS.length] }} />
            C{c + 1}: {assignment[c].length ? assignment[c].map((x) => `P${x}`).join(", ") : "idle"}
          </span>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <Stat label="Total consumer lag" value={totalLag} tone={totalLag > 30 ? "warn" : undefined} />
        <Stat label="Max parallelism" value={Math.min(pCount, cCount)} />
        <Stat label="Idle consumers" value={idle} tone={idle ? "warn" : undefined} />
      </div>
      <p className="mt-4 text-muted">
        Colours are message keys: every <code>order-42</code> lands in the same partition, so its events stay in order. Faded blocks are committed offsets. Parallelism is capped by the partition count, which is why you choose partitions for your expected peak consumer count up front: adding partitions later changes which partition a key maps to.
      </p>
    </VizFrame>
  );
}
