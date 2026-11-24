---
title: Backend Frameworks Compared
summary: The same endpoint in Express, Fastify, NestJS, Hono, Next.js, FastAPI, Flask, Django, Spring Boot and Go, then how to choose between them.
difficulty: beginner
minutes: 40
source: backend/04-backend-frameworks.md
prerequisites: [languages-and-frameworks]
objectives:
  - Read and write a basic endpoint in at least three major frameworks
  - Explain the difference between minimal (Express, Flask) and batteries-included (NestJS, Django, Spring) frameworks
  - Explain why raw "requests per second" benchmarks rarely decide a framework choice
  - Choose a framework for a given team, product and deadline
videos:
  - id: lsMQRaeKNDk
    title: What is a REST API?
    channel: IBM Technology
    why: Every framework in this lesson is ultimately mapping HTTP requests to handlers; this reminds you what they're all implementing.
resources:
  - url: https://expressjs.com/en/guide/routing.html
    title: Express routing guide
    why: The canonical middleware-and-routing model most Node frameworks copy.
  - url: https://fastapi.tiangolo.com/tutorial/
    title: FastAPI tutorial
    why: An excellent official tutorial showing type-hint-driven validation and automatic OpenAPI docs.
  - url: https://docs.nestjs.com/
    title: NestJS documentation
    why: Modules, providers and dependency injection explained by the framework authors.
  - url: https://spring.io/guides/gs/rest-service
    title: "Spring guide: Building a RESTful Web Service"
    why: The official 15-minute Spring Boot starting point.
  - url: https://go.dev/blog/routing-enhancements
    title: "Go blog: Routing enhancements for Go 1.22"
    why: Explains the method and wildcard patterns in the standard library mux used in this lesson's Go example.
quiz:
  - type: mcq
    q: What does a "batteries-included" framework like Django or NestJS give you that Express or Flask leave to you?
    options: ["Faster raw throughput", "Opinionated structure, ORM/DI, admin or modules out of the box", "The ability to handle HTTP", "Support for JSON"]
    answer: 1
    explain: Batteries-included frameworks decide project structure and ship integrated pieces (ORM, DI, auth, admin). Minimal frameworks handle routing and middleware and let you assemble the rest. Throughput is usually not the differentiator.
  - type: scenario
    q: A two-person startup must ship an admin-heavy CRUD product in three weeks and both founders know Python. Which choice is most defensible?
    options: ["Spring Boot", "Django with Django REST Framework", "Hand-rolled Go net/http", "Rust with Actix"]
    answer: 1
    explain: Django's ORM, migrations, auth and free admin panel match an admin-heavy CRUD product, and the team already knows Python. The others may be excellent but cost time in learning or building what Django gives free.
  - type: tf
    q: If framework A handles 3x the requests per second of framework B in a "hello world" benchmark, your real API will also be about 3x faster on A.
    answer: 1
    explain: False. Real request time is dominated by database queries, network calls and serialisation. Framework overhead is often a small fraction, so the benchmark gap shrinks to near zero for typical endpoints.
  - type: code
    q: In this Express code, what happens when the database call throws in Express 4?
    code: |
      app.get('/users/:id', async (req, res) => {
        const user = await db.findUser(req.params.id); // throws
        res.json(user);
      });
    options: ["Express catches it and returns 500", "The rejection is unhandled; the request may hang with no response", "Express retries the handler", "The server returns 404"]
    answer: 1
    explain: Express 4 does not catch rejected promises from async handlers, so the request can hang and Node logs an unhandled rejection. You need try/catch with next(err), a wrapper, or Express 5, which forwards rejected promises to the error handler.
---

## Hands-on exercise

Pick **two** frameworks from different languages (for example FastAPI and Express). In each, build:

- `GET /health` returning `{ "status": "ok" }`
- `POST /notes` that validates `{ title: string (1–100 chars), body: string }` and returns `201` with the created note and an `id`
- `GET /notes/{id}` returning `404` with a JSON error body for unknown ids

Then write half a page comparing: lines of code, how validation errors look by default, how you'd add a database, and how each generates (or doesn't) API docs.

## Completion criteria

- You've built the same endpoint in two frameworks and can explain the structural differences.
- You can recommend a framework for a described team and defend it without citing hello-world benchmarks.
