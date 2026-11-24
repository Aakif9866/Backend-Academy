"use client";
import { useState } from "react";
import { VizFrame, Seg, Btn } from "./common";

type Lane = 0 | 1 | 2 | 3; // browser, resolver, dns hierarchy, server
interface Step { from: Lane; to: Lane; label: string; phase: "DNS" | "TCP" | "TLS" | "QUIC" | "HTTP"; rtt?: boolean; explain: string }

const LANES = ["Browser", "Recursive resolver", "Root / TLD / authoritative", "Web server"];

const DNS: Step[] = [
  { from: 0, to: 1, label: "A? shop.example.com", phase: "DNS", explain: "Browser and OS caches missed, so the stub resolver asks the configured recursive resolver (your ISP's, or 1.1.1.1 / 8.8.8.8) over UDP port 53." },
  { from: 1, to: 2, label: "ask root → .com TLD → example.com NS", phase: "DNS", explain: "On a cold cache the resolver walks the hierarchy: a root server refers it to the .com TLD servers, which refer it to example.com's authoritative nameservers. Each referral is cached for its TTL, so this walk is rare in practice." },
  { from: 2, to: 1, label: "A 203.0.113.10 (TTL 300)", phase: "DNS", explain: "The authoritative server answers with the IP address and a TTL. The resolver caches the answer for up to TTL seconds." },
  { from: 1, to: 0, label: "203.0.113.10", phase: "DNS", rtt: true, explain: "The answer returns to the browser, which also caches it. Now the browser knows where to connect." },
];
const TCP: Step[] = [
  { from: 0, to: 3, label: "SYN (seq=x)", phase: "TCP", explain: "TCP connection to port 443 starts with SYN carrying a random initial sequence number." },
  { from: 3, to: 0, label: "SYN-ACK (seq=y, ack=x+1)", phase: "TCP", rtt: true, explain: "The server acknowledges and sends its own sequence number. One full round trip has passed." },
  { from: 0, to: 3, label: "ACK (ack=y+1)", phase: "TCP", explain: "The client acknowledges. It may send data immediately after this ACK, so the handshake costs 1 RTT before the first byte of application data." },
];
const TLS: Step[] = [
  { from: 0, to: 3, label: "ClientHello + key share", phase: "TLS", explain: "TLS 1.3: the client proposes cipher suites and already sends its (EC)DHE key share, guessing the group the server will pick." },
  { from: 3, to: 0, label: "ServerHello, cert, Finished", phase: "TLS", rtt: true, explain: "The server picks parameters, sends its key share, its certificate chain, a signature proving it owns the key, and Finished, all encrypted after ServerHello." },
  { from: 0, to: 3, label: "Finished", phase: "TLS", explain: "The client verifies the certificate chain and hostname, then sends Finished. TLS 1.3 needs 1 RTT (TLS 1.2 needed 2)." },
];
const QUIC: Step[] = [
  { from: 0, to: 3, label: "QUIC Initial (ClientHello)", phase: "QUIC", explain: "HTTP/3 runs over QUIC on UDP. The QUIC handshake carries TLS 1.3 inside it, so transport and encryption are set up together." },
  { from: 3, to: 0, label: "Initial + Handshake (ServerHello, cert, Finished)", phase: "QUIC", rtt: true, explain: "One round trip establishes both the connection and the keys: 1 RTT total instead of TCP's 1 + TLS's 1." },
];
const HTTP: Step[] = [
  { from: 0, to: 3, label: "GET /products  Host, Cookie, Accept…", phase: "HTTP", explain: "The HTTP request goes out encrypted. With HTTP/2 or HTTP/3 it is one stream among many multiplexed on the same connection." },
  { from: 3, to: 0, label: "200 OK  Content-Type, Cache-Control + body", phase: "HTTP", rtt: true, explain: "Server time (routing, DB queries, rendering) is added on top of the network round trip. Time to first byte = network RTTs + server processing." },
];

const PHASE_TONE: Record<Step["phase"], string> = { DNS: "cyan", TCP: "blue", TLS: "purple", QUIC: "pink", HTTP: "emerald" };

export default function RequestLifecycle() {
  const [proto, setProto] = useState<"h2" | "h3">("h2");
  const [visit, setVisit] = useState<"cold" | "warm">("cold");
  const [i, setI] = useState(0);

  const steps = [...(visit === "cold" ? DNS : []), ...(visit === "cold" ? (proto === "h2" ? [...TCP, ...TLS] : QUIC) : []), ...HTTP];
  const shown = steps.slice(0, i);
  const rtts = shown.filter((s) => s.rtt).length;
  const cur = steps[i - 1];

  const W = 640, laneX = (l: number) => 70 + l * ((W - 140) / 3), rowH = 34;
  const H = 56 + steps.length * rowH;

  return (
    <VizFrame
      title="What happens when you load https://shop.example.com"
      hint="Step through DNS, the TCP and TLS handshakes, and the HTTP exchange. Switch to HTTP/3 or a repeat visit and count round trips."
      controls={
        <>
          <Seg label="Protocol" value={proto} onChange={(v) => { setProto(v); setI(0); }} options={[{ id: "h2", label: "HTTP/2 over TCP+TLS 1.3" }, { id: "h3", label: "HTTP/3 over QUIC" }]} />
          <Seg label="Visit" value={visit} onChange={(v) => { setVisit(v); setI(0); }} options={[{ id: "cold", label: "First visit" }, { id: "warm", label: "Reused connection" }]} />
          <div className="flex gap-2">
            <Btn onClick={() => setI(0)}>Reset</Btn>
            <Btn primary onClick={() => setI((n) => Math.min(n + 1, steps.length))} disabled={i >= steps.length}>Next step</Btn>
            <Btn onClick={() => setI(steps.length)}>All</Btn>
          </div>
        </>
      }
    >
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]" role="img" aria-label="Sequence diagram of the request">
          {LANES.map((name, l) => (
            <g key={name}>
              <text x={laneX(l)} y={18} textAnchor="middle" className="fill-[var(--heading)] text-[11px] font-semibold">{name}</text>
              <line x1={laneX(l)} x2={laneX(l)} y1={28} y2={H - 6} stroke="var(--border-strong)" strokeDasharray="3 4" />
            </g>
          ))}
          {shown.map((s, k) => {
            const y = 50 + k * rowH, x1 = laneX(s.from), x2 = laneX(s.to), dir = x2 > x1 ? 1 : -1;
            return (
              <g key={k} data-tone={PHASE_TONE[s.phase]} className="motion-safe:animate-[rise_250ms_ease-out]">
                <line x1={x1} x2={x2 - dir * 6} y1={y} y2={y} stroke="var(--c)" strokeWidth={k === i - 1 ? 2.5 : 1.5} />
                <path d={`M ${x2} ${y} l ${-dir * 8} -4 v 8 z`} fill="var(--c)" />
                <text x={(x1 + x2) / 2} y={y - 7} textAnchor="middle" className="fill-[var(--text)] text-[10.5px]">{s.label}</text>
                <text x={8} y={y + 4} className="fill-[var(--c)] text-[9px] font-bold">{s.phase}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr] items-start">
        <div className="border border-line bg-surface-2 rounded-xl px-4 py-3">
          <div className="text-[11px] text-muted">Round trips so far</div>
          <div className="text-2xl font-semibold text-heading tabular-nums">{rtts}</div>
          <div className="text-[11px] text-muted">of {steps.filter((s) => s.rtt).length} total</div>
        </div>
        <p className="text-ink" data-tone={cur ? PHASE_TONE[cur.phase] : undefined}>
          {cur ? (<><strong className="text-tone">{cur.phase}: </strong>{cur.explain}</>) : "Press Next step to begin. At 100 ms RTT (e.g. Mumbai to Virginia) every round trip costs 100 ms before the server does any work."}
        </p>
      </div>
    </VizFrame>
  );
}
