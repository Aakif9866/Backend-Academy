# Part 15: Real-time systems

"Real-time" on the web means the server **pushes** updates to clients the moment something happens, instead of the client asking again and again.

## Contents

1. [The techniques compared](#1-the-techniques-compared)
2. [Each technique in detail](#2-each-technique-in-detail)
3. [Which technique for which application](#3-which-technique-for-which-application)
4. [Managing persistent connections](#4-managing-persistent-connections)
5. [Authentication and authorisation for WebSockets](#5-authentication-and-authorisation-for-websockets)
6. [Heartbeats, timeouts and reconnection](#6-heartbeats-timeouts-and-reconnection)
7. [Message delivery guarantees](#7-message-delivery-guarantees)
8. [Scaling across multiple servers](#8-scaling-across-multiple-servers)
9. [Worked examples](#9-worked-examples)
10. [Managed services vs building your own](#10-managed-services-vs-building-your-own)

---

## 1. The techniques compared

| Technique | Direction | Transport | Browser support | Best for | Main limitation |
| --- | --- | --- | --- | --- | --- |
| **Short polling** | Client asks repeatedly | HTTP | Everywhere | Rare updates, simplest possible | Wasteful; delay up to the poll interval |
| **Long polling** | Client asks; server holds until news | HTTP | Everywhere | Fallback when nothing else works | Overhead per message; one request open per client |
| **HTTP streaming** | Server → client (one response that keeps sending) | HTTP chunked / `ReadableStream` | Modern browsers | Streaming one long result (AI text, big exports) | Ends when the response ends |
| **Server-Sent Events (SSE)** | Server → client | HTTP, `text/event-stream` | All modern browsers (`EventSource`) | Notifications, live feeds, dashboards, AI streaming | One-way; text only; about 6 connections per domain on HTTP/1.1 (fine on HTTP/2) |
| **WebSockets** | Both ways, full duplex | Own protocol after an HTTP upgrade | All modern browsers | Chat, games, collaboration, trading | Stateful connections are harder to scale and load-balance |
| **Socket.IO** | Both ways | WebSocket with long-polling fallback + own protocol | Needs its client library | Chat/realtime apps wanting rooms, acks, auto-reconnect | Not plain WebSocket: a Socket.IO client can't talk to a plain WS server, or the reverse |
| **WebRTC** | Peer to peer (browser ↔ browser) | UDP (SRTP, data channels) | Modern browsers | Video/voice calls, screen share, low-latency game data | Needs signalling, STUN/TURN servers; complex |
| **MQTT** | Both ways via a broker (publish/subscribe) | TCP (or over WebSockets) | Via MQTT-over-WS library | IoT devices on weak networks, low power | Needs a broker; not a general web API |

---

## 2. Each technique in detail

### Short and long polling

```js
// Short polling: every 5 seconds
setInterval(async () => render(await (await fetch("/api/notifications")).json()), 5000);
```

```js
// Long polling: server answers only when there's news (or after ~30 s with nothing)
async function poll(since) {
  const res = await fetch(`/api/messages?since=${since}`);   // server holds this open
  const msgs = await res.json();
  render(msgs);
  poll(msgs.at(-1)?.id ?? since);                              // immediately ask again
}
```

**Use when:** updates are rare (every few minutes) or as a fallback. Polling every 5 s with 100,000 users = 20,000 requests per second, mostly answering "nothing new".

### HTTP streaming

One response that sends data in chunks as it becomes ready. This is how AI chat apps show text as it's generated.

```ts
// Next.js Route Handler
export async function GET() {
  const stream = new ReadableStream({
    async start(controller) {
      for (const chunk of ["Hello", " ", "world"]) {
        controller.enqueue(new TextEncoder().encode(chunk));
        await new Promise((r) => setTimeout(r, 200));
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
```

### Server-Sent Events (SSE)

```ts
// Server (Node/Express)
app.get("/events", (req, res) => {
  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  const send = (id: string, data: unknown) => res.write(`id: ${id}\nevent: notification\ndata: ${JSON.stringify(data)}\n\n`);
  const unsubscribe = notifications.subscribe(req.user.id, (n) => send(n.id, n));
  const ping = setInterval(() => res.write(": ping\n\n"), 25_000);   // comment line keeps proxies from closing it
  req.on("close", () => { clearInterval(ping); unsubscribe(); });
});
```

```js
// Browser
const es = new EventSource("/events");                    // sends cookies (same origin)
es.addEventListener("notification", (e) => showToast(JSON.parse(e.data)));
// Reconnects automatically and sends Last-Event-ID so the server can replay missed events.
```

**Strengths:** plain HTTP (works through most proxies and firewalls), automatic reconnect, built-in resume. **Use for** anything where only the server talks: notifications, live scores, stock tickers, progress bars, dashboards.

### WebSockets

```ts
// Server with the "ws" library
import { WebSocketServer } from "ws";
const wss = new WebSocketServer({ port: 8080 });
wss.on("connection", (ws, req) => {
  ws.on("message", (raw) => {
    const msg = JSON.parse(raw.toString());
    // validate! never trust client messages
    broadcastToRoom(msg.roomId, { type: "message", text: msg.text });
  });
});
```

```js
// Browser
const ws = new WebSocket("wss://chat.example.com/ws");
ws.onmessage = (e) => render(JSON.parse(e.data));
ws.send(JSON.stringify({ type: "message", roomId: "r1", text: "Hi!" }));
```

**Strengths:** lowest overhead per message, both directions. **Costs:** you build reconnection, heartbeats, rooms, acks and scaling yourself (or use Socket.IO or a managed service).

### Socket.IO

A library on top of WebSockets that adds what you'd otherwise build yourself:

```ts
io.use(authMiddleware);                                  // auth on connect
io.on("connection", (socket) => {
  socket.join(`user:${socket.data.userId}`);
  socket.on("chat:send", async (msg, ack) => {
    const saved = await saveMessage(msg);                // persist first
    io.to(`room:${msg.roomId}`).emit("chat:new", saved);
    ack({ ok: true, id: saved.id });                     // acknowledgement back to the sender
  });
});
```

Adds: rooms, namespaces, acknowledgements, automatic reconnection, fallback to long-polling, and a **Redis adapter** for multiple servers.

### WebRTC

Browsers send audio, video and data **directly to each other**. Your server is still needed for:

- **Signalling:** exchanging connection details (usually over WebSocket).
- **STUN:** helps peers discover their public address.
- **TURN:** relays traffic when a direct connection is impossible (strict firewalls). Costs bandwidth.
- **SFU** (Selective Forwarding Unit) for group calls: each person uploads once and the SFU forwards to the others. LiveKit, mediasoup, Janus.

**Use for:** video calls, screen sharing, voice chat, peer-to-peer file transfer, very low-latency game data.

### MQTT

A tiny publish/subscribe protocol designed for devices with little power and bad networks.

```
Topic examples:     factory/line1/machine7/temperature
Wildcards:          factory/+/+/temperature    (+ = one level)    factory/#   (# = everything below)
```

| Feature | Meaning |
| --- | --- |
| **QoS 0** | At most once (fire and forget) |
| **QoS 1** | At least once (may duplicate) |
| **QoS 2** | Exactly once (slowest) |
| **Retained message** | Broker keeps the last value; new subscribers get it at once ("current temperature") |
| **Last Will and Testament** | Broker announces "device offline" if a device disconnects unexpectedly |
| **Persistent session** | Broker queues messages while a device is briefly offline |

```python
# Device (paho-mqtt)
client.connect("broker.example.com", 8883)              # TLS port
client.publish("home/livingroom/temp", "24.5", qos=1, retain=True)
```

Brokers: Mosquitto (small), EMQX and HiveMQ (large scale), AWS IoT Core, Azure IoT Hub. The backend subscribes to topics and writes readings to a time-series database ([Part 14](14-choosing-databases.md#iot-application)).

---

## 3. Which technique for which application

| Application | Technique | Why | Notes |
| --- | --- | --- | --- |
| **Chat** | WebSockets / Socket.IO | Two-way, frequent, low latency | Persist messages in a database; WS is just the delivery pipe |
| **Live notifications** | SSE | One-way server → client; auto-reconnect | Plus push notifications (FCM/APNs/Web Push) when the app is closed |
| **Collaborative editor** (Google Docs-style) | WebSockets + **CRDT** (Yjs, Automerge) or OT | Many people editing the same document | CRDTs merge concurrent edits without conflicts; Liveblocks, Hocuspocus, y-websocket |
| **Live dashboard** | SSE (or polling every 10–30 s if "live-ish" is enough) | One-way | Send changes (deltas), not the whole dataset |
| **Multiplayer game** | WebSockets for turn-based/casual; WebRTC data channels or UDP for fast action | Latency | Authoritative server, tick rate, client-side prediction |
| **Stock prices** | WebSockets or SSE | Many updates per second | Throttle/merge updates (send latest every 100–250 ms) |
| **Live location** (delivery driver) | Driver → server: HTTP or WS every few seconds; server → customer: SSE/WS | Mostly one-way to the viewer | Store the latest location in Redis GEO |
| **Real-time monitoring** | SSE/WS to dashboards; agents push metrics over HTTP | One-way | Aggregate on the server; alert separately |
| **AI response streaming** | HTTP streaming or SSE | One long response | Handle client disconnect (stop generating, save cost) |
| **IoT** | MQTT | Weak networks, low power | Bridge into Kafka/the database on the backend |
| **Video call** | WebRTC + a signalling WebSocket | Peer-to-peer media | Use an SFU for groups |

---

## 4. Managing persistent connections

Each open connection uses memory (roughly tens of KB, more with buffers) and a file descriptor.

- **Raise OS limits** (`ulimit -n`) on WebSocket servers; the default is often 1,024.
- **Keep per-connection state small.** Store user id and subscriptions; keep everything else in Redis or the database.
- **Clean up on disconnect:** remove from rooms, clear timers, unsubscribe. Leaked listeners are the classic WebSocket memory leak.
- **Backpressure:** if a client reads slowly, its send buffer grows. Check `ws.bufferedAmount` and drop or merge messages for slow clients instead of buffering forever.
- **Graceful shutdown on deploy:** stop accepting new connections, tell clients to reconnect (send a "reconnect" message, or close with code 1012 "service restart"), then exit. Spread reconnects with jitter so they don't all arrive at once.
- **Load balancer settings:** enable WebSocket upgrade; raise idle timeouts (many proxies close idle connections after about 60 s); a long-polling fallback needs **sticky sessions**.

---

## 5. Authentication and authorisation for WebSockets

**Problem:** the browser `WebSocket` constructor can't set custom headers such as `Authorization`.

| Option | How | Notes |
| --- | --- | --- |
| **Cookie** | Same-site cookie is sent with the upgrade request | Simple. **Must check the `Origin` header**, or another site can open a socket using your user's cookie (Cross-Site WebSocket Hijacking) |
| **Short-lived ticket** | Client calls `POST /ws-ticket` (authenticated) → gets a one-time token valid for 30 s → connects with `wss://.../ws?ticket=...` | Good for cross-origin; avoid long-lived tokens in URLs (they end up in logs) |
| **Token in the first message** | Connect, then send `{type:"auth", token}`; the server drops the connection if it doesn't arrive within a few seconds | Works anywhere; keep unauthenticated sockets on a short timer |
| **Socket.IO `auth`** | `io({ auth: { token } })`, checked in `io.use()` | Built-in handshake |

**Authorisation doesn't stop at connect:**

- Check **every subscription**: "may user 42 join room `r9`?" Check membership in the database. Don't trust the room id the client sends.
- Check **every message**: "may this user post in this room?"
- **Expiry:** connections can live for hours. Re-check periodically, or disconnect when the token expires or the user is removed from a room.
- **Validate message size and shape** (Zod/JSON Schema) and **rate-limit messages** per connection.

---

## 6. Heartbeats, timeouts and reconnection

### Heartbeats

Connections can die silently (Wi-Fi drops, phone sleeps, a NAT forgets the connection). Neither side finds out without traffic.

```ts
// Server: ping every 30 s; if no pong by the next round, terminate
wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.on("pong", () => (ws.isAlive = true));
});
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30_000);
```

The interval should be shorter than the shortest idle timeout on the path (load balancers, proxies, mobile networks).

### Reconnection (client)

```ts
let attempt = 0;
function connect() {
  const ws = new WebSocket(URL);
  ws.onopen = () => { attempt = 0; ws.send(JSON.stringify({ type: "resume", lastId: lastSeenId })); };
  ws.onclose = () => {
    const base = Math.min(30_000, 1000 * 2 ** attempt++);   // exponential backoff, capped at 30 s
    setTimeout(connect, base / 2 + Math.random() * base / 2); // jitter: avoids a "thundering herd" after an outage
  };
}
```

**Resume after reconnecting:** the client sends the id of the last message it saw; the server sends everything newer from the database. Without this, messages sent during a 5-second disconnect are lost.

---

## 7. Message delivery guarantees

The WebSocket connection itself guarantees nothing once it breaks. Delivery guarantees come from **your design**:

1. **Persist first, then deliver.** Save the message to the database, then push it. If the push fails, the client gets it on resume.
2. **Client-generated ids** → the server upserts → retries don't duplicate (idempotency, as in [Part 8](08-system-design-async.md#idempotency-doing-it-twice--doing-it-once)).
3. **Acknowledgements:** the server acks the sender ("sent ✓"); the recipient's client acks ("delivered ✓✓").
4. **Ordering:** give messages a server-assigned, increasing sequence per conversation (or time-sortable ids such as ULID/Snowflake). Clients sort by it; don't rely on arrival order or phone clocks.
5. **Offline users:** store the message + send a push notification; deliver on next connect.

| Guarantee | How |
| --- | --- |
| At most once | Push only, no persistence (fine for typing indicators, cursor positions) |
| At least once | Persist + resume + retries |
| Effectively once | At least once + idempotent handling (dedupe by message id) |

---

## 8. Scaling across multiple servers

### The problem

```
Alice ──WS──▶ [ Server 1 ]        [ Server 2 ] ◀──WS── Bob
Alice sends Bob a message. Server 1 doesn't hold Bob's connection.
```

### The fix: a pub/sub backbone

```
Alice ──▶ [ Server 1 ] ──publish "room:r1" ──▶ [ Redis Pub/Sub / NATS / Kafka ]
                                                     │ subscribed
                                                     ▼
                                              [ Server 2 ] ──▶ Bob
```

| Backbone | Persistence | Use when |
| --- | --- | --- |
| **Redis Pub/Sub** | None: if a server is down, it misses the message | Simple fan-out; durability handled by your database + resume |
| **Redis Streams** | Yes, with consumer groups and replay | Need replay/acks without Kafka |
| **NATS / NATS JetStream** | Optional (JetStream) | Very fast messaging; many services |
| **Kafka** | Yes, long retention | Huge volume; other consumers (analytics, search) also need the events |

Socket.IO has ready-made adapters (`@socket.io/redis-adapter`, `@socket.io/redis-streams-adapter`).

### Other scaling points

- **Separate connection servers from business logic.** Gateways only hold connections and route messages; stateless services do the work. Each scales separately.
- **Presence** ("who's online, on which gateway") in Redis with TTL keys refreshed by heartbeats.
- **Sticky sessions** are needed only for transports that use several HTTP requests (Socket.IO's polling fallback). Pure WebSockets stay on one server anyway.
- **Large fan-out** (one message to 1 million subscribers, e.g. a live sports score) → a tree of relays, or a managed realtime/CDN service. Don't loop over 1 million sockets on one machine.
- **Capacity planning:** a well-tuned Node or Go server can hold tens to hundreds of thousands of idle connections; message rate and payload size usually run out first. Load-test with k6 or Artillery's WebSocket support.

---

## 9. Worked examples

### A. Live notifications for a SaaS app (simple, scales well)

```
Event happens (comment added) ──▶ save notification row (Postgres) ──▶ publish "user:42" (Redis)
                                                                              │
Browser ◀── SSE /events ── [ any app server subscribed to user:42 ] ◀─────────┘
App closed? ──▶ Web Push / FCM
```

- SSE because it's one-way and reconnects automatically.
- The database is the source of truth; on reconnect, `Last-Event-ID` → send unread notifications newer than that id.

### B. Chat for 100k concurrent users

```
Clients ══WS══▶ Load balancer ══▶ Gateway pool (Node/Go, holds sockets, auth via ticket)
                                         │  ▲
                              publish    │  │ deliver
                                         ▼  │
                                  Redis Pub/Sub (by room)          Presence: Redis keys with TTL
                                         │
                                  Chat service (stateless): validate, check membership, save to Postgres
                                  (partitioned by month; Cassandra later if needed), assign sequence number
                                         │
                                  Push service (FCM/APNs) for offline members
```

### C. Live delivery tracking

```
Driver app ──HTTP POST every 4 s──▶ Location API ──▶ Redis GEO (latest position) ──▶ publish "order:o1"
                                          └──▶ Kafka ──▶ time-series store (route history, ETA model)
Customer app ◀── SSE /orders/o1/track ── server subscribed to order:o1
```

- HTTP for the driver because it's simple, battery-friendly, and the server can process positions in batches.
- Only the latest position is "hot"; history goes to cheaper storage.

### D. Collaborative document editing

```
Editors ══WS══▶ Collaboration server (Yjs/Hocuspocus) ── merges CRDT updates, broadcasts to the document's room
                         │
                         ├──▶ periodically saves the document snapshot to Postgres/S3
                         └──▶ Redis/pub-sub so several collaboration servers can share a document
Awareness (cursors, who's here): sent but not stored (at-most-once is fine)
```

---

## 10. Managed services vs building your own

| Option | Examples | Good | Trade-off |
| --- | --- | --- | --- |
| **Database-integrated realtime** | Supabase Realtime, Firebase/Firestore listeners, Convex | Changes in the database reach clients automatically; works on serverless hosts | Tied to that platform; less control over the protocol |
| **Managed pub/sub over WebSockets** | Pusher, Ably, PubNub | Scale, presence and history handled; easy SDKs | Per-message/connection pricing; vendor dependency |
| **Collaboration platforms** | Liveblocks, Yjs-based hosted services | CRDT, presence, comments out of the box | Pricing; lock-in |
| **Edge stateful compute** | Cloudflare Durable Objects | One object per room/document, WebSockets at the edge | Cloudflare-specific programming model |
| **Self-hosted** | `ws`, Socket.IO, Centrifugo, Phoenix Channels (Elixir) | Full control, cheapest at large steady scale | You run gateways, scaling, monitoring, deploys |

**Rule of thumb:** on serverless hosting (Vercel), use a managed service or database-integrated realtime. On always-on servers, Socket.IO or `ws` with a Redis adapter is a solid default. Move to custom gateways only when scale or cost demands it.
