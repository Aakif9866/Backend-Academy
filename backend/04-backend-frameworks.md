# Part 4: Backend frameworks

A backend framework takes an HTTP request ("POST /workouts with this JSON"), runs your code, and sends a response. They all do that. They differ in how much they decide for you.

- **Minimal ("micro") frameworks:** routing and little else. You pick every other piece. Express, Flask, Fastify, Hono.
- **"Batteries included" frameworks:** ORM, admin panel, auth, migrations, templates all built in. Django, Rails, Laravel, NestJS (structure more than batteries).

## The same endpoint in each

"Create a workout. Title is required." This helps you see the style differences.

### Express (Node.js)

```js
import express from "express";
const app = express();
app.use(express.json());

app.post("/workouts", requireAuth, async (req, res) => {
  if (!req.body.title) return res.status(400).json({ error: "Title is required" });
  const workout = await Workout.create({ ...req.body, userId: req.user.id });
  res.status(201).json(workout);
});

app.listen(3000);
```

### Fastify (Node.js)

```js
import Fastify from "fastify";
const app = Fastify();

app.post("/workouts", {
  schema: { body: { type: "object", required: ["title"], properties: { title: { type: "string" } } } },
}, async (req, reply) => {
  const workout = await createWorkout(req.body);
  return reply.code(201).send(workout);
});

app.listen({ port: 3000 });
```

### NestJS (Node.js, TypeScript)

```ts
@Controller("workouts")
export class WorkoutsController {
  constructor(private readonly workouts: WorkoutsService) {}

  @Post()
  @UseGuards(AuthGuard)
  create(@Body() dto: CreateWorkoutDto, @User() user: UserEntity) {
    return this.workouts.create(dto, user.id);
  }
}
// CreateWorkoutDto uses class-validator: @IsString() @IsNotEmpty() title: string;
```

### Hono (TypeScript, runs anywhere)

```ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

const app = new Hono();
app.post("/workouts", zValidator("json", z.object({ title: z.string().min(1) })), async (c) => {
  const workout = await createWorkout(c.req.valid("json"));
  return c.json(workout, 201);
});
export default app;
```

### Next.js Route Handler / Server Action (what PLOS uses)

```ts
// Server Action, as in src/lib/actions/records.ts
export const saveWorkout = defineAction(workoutSchema, async (input, { db }) =>
  must(await db.rpc("save_workout", { p: input })),
);
```

### FastAPI (Python)

```python
from fastapi import FastAPI, Depends
from pydantic import BaseModel, Field

app = FastAPI()

class WorkoutIn(BaseModel):
    title: str = Field(min_length=1)

@app.post("/workouts", status_code=201)
async def create_workout(body: WorkoutIn, user=Depends(current_user)):
    return await save_workout(body, user.id)
# Free interactive API docs at /docs
```

### Flask (Python)

```python
from flask import Flask, request, jsonify
app = Flask(__name__)

@app.post("/workouts")
@login_required
def create_workout():
    data = request.get_json()
    if not data.get("title"):
        return jsonify(error="Title is required"), 400
    return jsonify(save_workout(data, current_user.id)), 201
```

### Django + Django REST Framework (Python)

```python
# models.py
class Workout(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=120)

# serializers.py
class WorkoutSerializer(serializers.ModelSerializer):
    class Meta:
        model = Workout
        fields = ["id", "title"]

# views.py
class WorkoutViewSet(viewsets.ModelViewSet):
    serializer_class = WorkoutSerializer
    permission_classes = [IsAuthenticated]
    def get_queryset(self):
        return Workout.objects.filter(user=self.request.user)
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
# Plus: migrations, an admin panel and list/update/delete come free.
```

### Spring Boot (Java)

```java
@RestController
@RequestMapping("/workouts")
class WorkoutController {
  private final WorkoutService service;
  WorkoutController(WorkoutService service) { this.service = service; }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  Workout create(@Valid @RequestBody WorkoutDto dto, @AuthenticationPrincipal User user) {
    return service.create(dto, user.getId());
  }
}
```

### Go (standard library, Go 1.22+)

```go
http.HandleFunc("POST /workouts", func(w http.ResponseWriter, r *http.Request) {
    var in struct{ Title string `json:"title"` }
    if err := json.NewDecoder(r.Body).Decode(&in); err != nil || in.Title == "" {
        http.Error(w, "title is required", http.StatusBadRequest)
        return
    }
    workout, _ := saveWorkout(r.Context(), in.Title)
    w.WriteHeader(http.StatusCreated)
    json.NewEncoder(w).Encode(workout)
})
```

## Comparison

| Framework | Language | Style | Speed | Learning curve | Best for |
| --- | --- | --- | --- | --- | --- |
| **Express** | JS/TS | Minimal | OK | Easy | Learning, small/medium APIs, huge ecosystem |
| **Fastify** | JS/TS | Minimal, schema-first | Fast (often 2–3x Express in benchmarks) | Easy | Express-like but faster and with built-in validation |
| **NestJS** | TS | Structured (modules, controllers, services, DI) | Uses Express or Fastify underneath | Medium–hard | Big teams, enterprise, long-lived codebases |
| **Hono** | TS | Minimal, Web Standards | Very fast, tiny | Easy | Edge/serverless (Cloudflare Workers, Vercel, Bun, Deno) |
| **Next.js handlers / Server Actions** | TS | Backend inside the frontend app | Serverless | Easy if you know React | Full-stack apps where the backend mostly serves its own UI (PLOS) |
| **FastAPI** | Python | Minimal, type hints drive everything | Fast for Python (async) | Easy | APIs, ML/AI model serving, data apps |
| **Flask** | Python | Minimal | OK | Very easy | Small apps, prototypes, learning |
| **Django** | Python | Batteries included | OK | Medium | Content-heavy sites, admin panels, CRUD apps, quick MVPs with auth |
| **Spring Boot** | Java/Kotlin | Batteries + structure | Fast | Hard | Banks, large companies, long-lived systems |
| **Go (net/http, Gin, Echo, Fiber)** | Go | Minimal | Very fast, low memory | Medium | High-traffic services, infrastructure tools, microservices |
| **Ruby on Rails** | Ruby | Batteries included | OK | Medium | Startups shipping fast (GitHub, Shopify started here) |
| **Laravel** | PHP | Batteries included | OK | Easy–medium | Web apps, agencies, cheap hosting |
| **ASP.NET Core** | C# | Batteries + structure | Very fast | Medium | Microsoft shops, enterprise, games backends |
| **Elysia** | TS (Bun) | Minimal | Very fast | Easy | Bun-based apps |
| **Actix / Axum** | Rust | Minimal | Fastest tier | Hard | Performance-critical services |
| **Phoenix** | Elixir | Batteries included | Fast, great at many connections | Medium–hard | Realtime apps with huge numbers of connections |

## What "speed" really means

Framework speed matters much less than people think. A typical request spends:

```
~1 ms   in the framework
~5–50 ms waiting for the database
~20–200 ms on the network to the user
```

Switching Express → Fastify saves under a millisecond. Adding a missing database index can save 500 ms. **Fix the database and network first.** Framework speed matters when you serve tens of thousands of requests a second per machine.

## Python: FastAPI vs Django vs Flask

| Question | FastAPI | Django | Flask |
| --- | --- | --- | --- |
| Built-in ORM | No (use SQLAlchemy or SQLModel) | Yes | No |
| Built-in admin panel | No | Yes, very good | No |
| Built-in auth | No | Yes | No (Flask-Login) |
| Async | Yes, from the ground up | Partly | Limited |
| Automatic API docs | Yes (Swagger at `/docs`) | With DRF + extras | With extensions |
| Choose when | Building an API, ML serving, want types | Building a full website with users and admin quickly | Tiny app or learning |

**Example choices:**

- An AI chatbot API that calls a model → **FastAPI**.
- A school management system with teachers, students, marks and an admin panel → **Django**.
- A small webhook receiver → **Flask** or **FastAPI**.

## Node: Express vs Fastify vs NestJS vs Hono

- **Express**: the default everyone knows. Fine for most projects. Old design (Express 5 finally handles async errors properly).
- **Fastify**: choose over Express for a new project if you want speed and validation built in.
- **NestJS**: choose when the codebase will be big and many people will work on it. It forces a clear structure, which you'll appreciate later and find heavy at first.
- **Hono**: choose for serverless and edge. The same code runs on Cloudflare, Vercel, Bun, Deno and Node.

## Where do Next.js Server Actions fit?

PLOS has no separate backend framework because Next.js *is* the backend framework here:

- **Server Actions** replace `POST /something` routes for forms.
- **Route Handlers** (`src/app/api/*/route.ts`) replace Express routes for everything else.
- **Server Components** replace `GET` routes for pages.

**When this is enough:** the backend's main job is serving its own web app.

**When you'd add a separate backend** (Express, FastAPI, Go...):

- A mobile app and other clients need the same API.
- Long-running work: video processing, big imports, AI pipelines.
- WebSockets you run yourself.
- A team that owns the backend separately.
- Python-only libraries (machine learning, data science).

## How to choose

```
What language does your team know best?  ← this matters more than anything else
├── JavaScript/TypeScript
│   ├── Full-stack web app, backend serves its own UI → Next.js (handlers + Server Actions)
│   ├── Separate API, small/medium → Express or Fastify
│   ├── Separate API, big team → NestJS
│   └── Edge / serverless API → Hono
├── Python
│   ├── API or ML → FastAPI
│   ├── Full site with admin/auth → Django
│   └── Tiny → Flask
├── Java/Kotlin → Spring Boot
├── Go → net/http, Gin or Echo
├── C# → ASP.NET Core
├── Ruby → Rails
└── PHP → Laravel
```
