---
title: Real-time Systems
summary: Polling, streaming, SSE, WebSockets, Socket.IO, WebRTC and MQTT; auth, heartbeats, reconnection, delivery guarantees, and scaling persistent connections.
difficulty: intermediate
minutes: 60
source: backend/15-real-time-systems.md
prerequisites: [http-deep-dive, system-design-async]
objectives:
  - Choose between polling, SSE and WebSockets for a feature
  - Authenticate WebSocket connections safely
  - Implement heartbeats and reconnection with backoff
  - Scale WebSockets across servers with a pub/sub backbone
videos:
  - id: 1BfCnjr_Vjg
    title: WebSockets in 100 Seconds & Beyond with Socket.io
    channel: Fireship
    why: Shows the upgrade handshake and a Socket.IO chat in a few minutes.
  - id: vvhC64hQZMk
    title: "WHATSAPP System Design: Chat Messaging Systems for Interviews"
    channel: Gaurav Sen
    why: Connection gateways, message routing and delivery receipts at chat-app scale; pairs with worked example B.
resources:
  - url: https://www.rfc-editor.org/rfc/rfc6455.html
    title: "RFC 6455: The WebSocket Protocol"
    why: "The protocol spec: opening handshake, framing, ping/pong and close codes."
  - url: https://html.spec.whatwg.org/multipage/server-sent-events.html
    title: "HTML Standard: Server-sent events"
    why: The SSE spec, including automatic reconnection and Last-Event-ID.
  - url: https://socket.io/docs/v4/redis-adapter/
    title: Socket.IO Redis adapter
    why: How Socket.IO broadcasts across multiple server instances via Redis pub/sub.
quiz:
  - type: scenario
    q: A dashboard must show new orders as they arrive. The browser never sends data back over the channel. Simplest robust choice?
    options: ["WebSockets with a custom protocol", "Server-Sent Events", "WebRTC", "MQTT"]
    answer: 1
    explain: SSE is one-way server-to-client over plain HTTP, with built-in reconnection and Last-Event-ID resume. WebSockets work too but bring more machinery than a one-way feed needs.
  - type: mcq
    q: You run 4 WebSocket servers behind a load balancer. User A is connected to server 1 and user B to server 3. How does A's message reach B?
    options: ["The load balancer forwards it", "Server 1 publishes to a shared pub/sub (Redis, NATS, Kafka); server 3 is subscribed and pushes it to B", "B's browser polls server 1", "It can't; both must be on the same server"]
    answer: 1
    explain: Each server only knows its own sockets. A pub/sub backbone fans messages out to whichever servers hold the recipients' connections.
  - type: tf
    q: Browsers let you set an Authorization header on the WebSocket handshake with the native WebSocket API.
    answer: 1
    explain: False. The browser WebSocket constructor can't set custom headers. Common approaches are a cookie (with an Origin check), a short-lived ticket in the query string obtained over HTTPS, or an auth message right after connecting.
  - type: mcq
    q: Why do real-time clients add jitter to reconnection backoff?
    options: ["To lower latency", "To avoid a thundering herd where every client reconnects at once after a server restart", "WebSockets require it", "To save battery"]
    answer: 1
    explain: A deploy or crash disconnects everyone at the same instant. Randomized backoff spreads the reconnections so the fleet isn't flattened again.
---

## Hands-on exercise

Build a minimal chat with rooms:

1. A Node (`ws` or Socket.IO) or Python (`websockets`) server: join a room, send a message, broadcast to the room.
2. Heartbeats: ping every 25 s and drop clients that miss two pongs.
3. A client that reconnects with exponential backoff and jitter, and on reconnect fetches missed messages over HTTP using the last message id it saw.
4. Run **two** server instances behind Nginx with Redis pub/sub between them. Prove a user on instance 1 can chat with a user on instance 2.

## Completion criteria

- You can pick the right real-time technique for a feature and explain why.
- You've scaled a WebSocket app horizontally with pub/sub.
