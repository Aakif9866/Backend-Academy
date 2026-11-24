---
title: SQL and Relational Modelling
summary: Tables, keys and constraints, normalisation, every kind of join, aggregation and window functions, CTEs, and safe schema migrations, all with real PostgreSQL.
difficulty: beginner
minutes: 60
prerequisites: [sql-vs-nosql]
objectives:
  - Design tables with primary keys, foreign keys and constraints that protect data integrity
  - Normalise a schema to third normal form and know when to denormalise
  - Write inner, left, self and anti joins, aggregations and window functions
  - Use CTEs and upserts confidently
  - Change a live schema safely with migrations
videos:
  - id: zsjvFFKOm3c
    title: SQL Explained in 100 Seconds
    channel: Fireship
    why: A quick orientation if SQL is new to you.
  - id: n2Fluyr3lbc
    title: PostgreSQL in 100 Seconds
    channel: Fireship
    why: Why Postgres is the default relational database for so many teams.
resources:
  - url: https://www.postgresql.org/docs/current/tutorial-sql.html
    title: "PostgreSQL tutorial: The SQL Language"
    why: The official introduction to tables, queries, joins and aggregates.
  - url: https://www.postgresql.org/docs/current/ddl-constraints.html
    title: "PostgreSQL: Constraints"
    why: Check, not-null, unique, primary key, foreign key and exclusion constraints in detail.
  - url: https://www.postgresql.org/docs/current/tutorial-window.html
    title: "PostgreSQL: Window Functions"
    why: The clearest official explanation of OVER, PARTITION BY and frames.
  - url: https://pgexercises.com/
    title: PostgreSQL Exercises
    why: Free interactive SQL exercises on a realistic schema, from simple selects to recursive queries.
quiz:
  - type: code
    q: Users without any orders should appear with order_count 0. Which query does that?
    code: |
      -- A
      SELECT u.id, count(o.id) FROM users u JOIN orders o ON o.user_id = u.id GROUP BY u.id;
      -- B
      SELECT u.id, count(o.id) FROM users u LEFT JOIN orders o ON o.user_id = u.id GROUP BY u.id;
    options: ["A", "B", "Both", "Neither"]
    answer: 1
    explain: "An inner join drops users with no matching orders. A LEFT JOIN keeps every user, with NULLs for order columns, and count(o.id) counts only non-null values, giving 0."
  - type: mcq
    q: "orders(id, customer_id, customer_email, ...). The customer's email is stored on every order. What problem does this cause?"
    options: ["None", "An update anomaly: changing a customer's email requires updating every order, and missed rows disagree", "Orders can't be deleted", "Indexes stop working"]
    answer: 1
    explain: "Storing a fact in many places violates normalisation. Store email once in customers and join. Denormalise deliberately only when you've measured a need, and keep a plan for keeping copies in sync."
  - type: tf
    q: A foreign key constraint lets the database reject an order that references a non-existent customer, even if application code has a bug.
    answer: 0
    explain: "True. Constraints are enforced on every write from every client. That's why integrity rules belong in the database, not only in application code."
  - type: code
    q: What does this return?
    code: |
      SELECT user_id, amount,
             sum(amount) OVER (PARTITION BY user_id ORDER BY created_at) AS running_total
      FROM payments;
    options: ["One row per user with their total", "Every payment row, plus a running total per user ordered by time", "An error: you need GROUP BY", "Only the latest payment per user"]
    answer: 1
    explain: "Window functions compute across related rows without collapsing them. PARTITION BY restarts the calculation per user; ORDER BY makes it cumulative."
  - type: scenario
    q: You need to add a NOT NULL column to a 200-million-row table in production without downtime. What's the safe approach in modern Postgres?
    options: ["ALTER TABLE ADD COLUMN ... NOT NULL with no default and hope", "Add it as nullable (or with a constant default, which is metadata-only since PG 11), backfill in batches, then add the NOT NULL constraint (via a validated CHECK first)", "Recreate the table", "Do it in a single giant UPDATE"]
    answer: 1
    explain: "Expand, backfill in small batches to avoid long locks and bloat, then enforce. Adding a NOT VALID check constraint and validating it later avoids a long exclusive lock on a full scan."
---

## Why it matters

Your data outlives your code. Frameworks get rewritten, services get split, but the schema persists, and bad data, once written, is expensive to fix. A well-designed relational schema with real constraints makes whole classes of bugs impossible, and fluent SQL lets you answer questions in one query instead of hundreds of loops in application code.

## Tables, rows and keys

A **table** holds rows of the same shape. Every table needs a **primary key**: a column (or set of columns) that uniquely identifies each row, can't be null, and never changes.

```sql
create table customers (
  id          bigint generated always as identity primary key,  -- surrogate key
  email       text not null unique,                             -- natural key, enforced unique
  full_name   text not null,
  country     char(2) not null check (country ~ '^[A-Z]{2}$'),
  created_at  timestamptz not null default now()
);
```

**Surrogate vs natural keys.** A surrogate key (an identity integer or UUID) has no business meaning, so it never needs to change. Natural keys (email, SKU) change surprisingly often. Use surrogates as primary keys and enforce natural uniqueness with `unique` constraints.

**Identity integers vs UUIDs.** Integers are compact and index-friendly but leak volume and are guessable in URLs. Random UUIDv4 values are unguessable but scatter inserts across the index. UUIDv7 (time-ordered) gets you most of both. Many teams use integer keys internally and expose an opaque public id.

### Data types matter

| Use | For |
| --- | --- |
| `timestamptz` | Points in time (stored as UTC). Avoid `timestamp` without time zone for events. |
| `date` | Calendar dates (birthdays, due dates) |
| `numeric(12,2)` or `bigint` minor units | Money. Never `float`/`real`: 0.1 + 0.2 ≠ 0.3 in binary floating point. |
| `text` | Strings (Postgres `text` and `varchar` perform the same; add `check (length(...) <= n)` for limits) |
| `boolean` | Flags |
| `jsonb` | Genuinely variable attributes. Not a replacement for modelling. |
| `uuid` | Opaque identifiers |
| enums or a lookup table | A fixed set of states |

## Relationships and foreign keys

```sql
create table orders (
  id           bigint generated always as identity primary key,
  customer_id  bigint not null references customers(id) on delete restrict,
  status       text not null default 'pending'
               check (status in ('pending', 'paid', 'shipped', 'cancelled')),
  total_minor  bigint not null check (total_minor >= 0),
  currency     char(3) not null,
  created_at   timestamptz not null default now()
);

create table order_items (
  order_id     bigint not null references orders(id) on delete cascade,
  product_id   bigint not null references products(id),
  quantity     int not null check (quantity > 0),
  unit_minor   bigint not null check (unit_minor >= 0),   -- price at time of purchase, copied on purpose
  primary key (order_id, product_id)                      -- composite key: one line per product per order
);

create index on orders (customer_id, created_at desc);    -- FKs are NOT indexed automatically in Postgres
```

| Relationship | How |
| --- | --- |
| One-to-many (customer → orders) | Foreign key on the "many" side |
| Many-to-many (orders ↔ products) | A join table with two foreign keys (`order_items`) |
| One-to-one (user → profile) | Foreign key with a `unique` constraint, or the same primary key |

`on delete` choices: `restrict` (refuse, the safe default for important data), `cascade` (delete children too: right for order items, dangerous for customers), `set null` (keep the child, drop the link).

Postgres does **not** create indexes for foreign key columns automatically. Without one, deleting a parent or joining children scans the whole child table.

## Constraints: let the database guard the truth

```sql
alter table bookings add constraint no_double_booking
  exclude using gist (room_id with =, during with &&);       -- no two bookings for one room may overlap
alter table accounts add constraint non_negative check (balance_minor >= 0);
create unique index one_active_subscription on subscriptions (user_id) where status = 'active';   -- partial unique
```

Application validation gives users friendly messages; constraints guarantee integrity against bugs, race conditions, scripts and future services that skip your validation. Have both.

## Normalisation

Normalisation means storing each fact exactly once, so updates can't create contradictions.

- **1NF:** each column holds one atomic value (no comma-separated lists of tags; use a join table).
- **2NF:** every non-key column depends on the whole key (in `order_items(order_id, product_id, product_name)`, `product_name` depends only on `product_id`, so move it to `products`).
- **3NF:** non-key columns depend only on the key, not on other non-key columns (`orders(customer_id, customer_email)`: email depends on the customer, not the order).

The anomalies normalisation prevents: **update** (change a fact in one row but not the others), **insert** (can't record a customer until they order), **delete** (deleting the last order loses the customer).

**Denormalisation** copies data deliberately for read performance or historical accuracy:

- `order_items.unit_minor` copies the price *at purchase time*. That's correct modelling, not a shortcut, because the product's price will change.
- A `posts.comment_count` counter avoids `count(*)` on every page view, at the cost of keeping it in sync (in the same transaction, or via a trigger).
- Read models and search indexes are denormalised projections, rebuilt from the normalised source.

Normalise first; denormalise when a measured read problem justifies the write complexity.

## Querying

### Joins

```sql
-- INNER: only matches
select o.id, c.email, o.total_minor
from orders o
join customers c on c.id = o.customer_id
where o.created_at >= now() - interval '7 days';

-- LEFT: keep all customers, even those with no orders
select c.id, c.email, count(o.id) as orders
from customers c
left join orders o on o.customer_id = c.id
group by c.id, c.email;

-- ANTI-JOIN: customers who never ordered
select c.* from customers c
where not exists (select 1 from orders o where o.customer_id = c.id);

-- SELF-JOIN: employees and their managers
select e.name, m.name as manager
from employees e
left join employees m on m.id = e.manager_id;
```

Prefer `NOT EXISTS` over `NOT IN (subquery)`: if the subquery returns a NULL, `NOT IN` returns no rows at all, a classic surprise.

### Aggregation

```sql
select date_trunc('day', created_at) as day,
       count(*)                                   as orders,
       sum(total_minor) / 100.0                   as revenue,
       count(*) filter (where status = 'cancelled') as cancelled
from orders
where created_at >= date '2026-11-01'
group by 1
having count(*) > 10            -- filter groups (WHERE filters rows before grouping)
order by 1;
```

### Window functions

Window functions compute across related rows *without* collapsing them:

```sql
-- Each customer's latest order (top-1 per group)
select * from (
  select o.*, row_number() over (partition by customer_id order by created_at desc) as rn
  from orders o
) t where rn = 1;

-- Running revenue per day and day-over-day change
select day, revenue,
       sum(revenue) over (order by day) as cumulative,
       revenue - lag(revenue) over (order by day) as change
from daily_revenue;
```

`row_number`, `rank`, `dense_rank`, `lag`/`lead`, and aggregates with `over (...)` replace a surprising amount of application-side loop code.

### CTEs

Common table expressions name intermediate results and make complex queries readable:

```sql
with recent as (
  select customer_id, sum(total_minor) as spend
  from orders
  where created_at >= now() - interval '90 days' and status = 'paid'
  group by customer_id
)
select c.email, r.spend
from recent r join customers c on c.id = r.customer_id
order by r.spend desc
limit 10;
```

`with recursive` walks hierarchies (org charts, category trees, threaded comments).

### Upserts and returning

```sql
insert into product_views (product_id, day, views)
values ($1, current_date, 1)
on conflict (product_id, day) do update set views = product_views.views + 1
returning views;
```

`ON CONFLICT` makes "insert or update" atomic, with no read-then-write race. `RETURNING` gives back the written row and saves a round trip.

## Migrations: changing a live schema

Schema changes are code: versioned files applied in order by a tool (Flyway, Liquibase, Alembic, Prisma Migrate, node-pg-migrate, dbmate, golang-migrate).

```
migrations/
  0001_create_customers.sql
  0002_create_orders.sql
  0003_add_orders_customer_index.sql
```

Rules:

1. **Never edit an applied migration.** Write a new one.
2. Every migration runs in CI against a fresh database and against a copy of production-shaped data before it reaches production.
3. During a deploy, old and new code run at the same time, so every migration must be compatible with both. Use **expand/contract**:

| Step | Change | Code |
| --- | --- | --- |
| Expand | Add the new column or table (nullable) | Old code ignores it |
| Dual-write | — | New code writes old and new |
| Backfill | Copy data in batches | — |
| Switch reads | — | New code reads the new column |
| Contract | Drop the old column, add constraints | Old code is gone |

Know which statements lock tables. In Postgres: `create index concurrently` instead of plain `create index` on big tables; add constraints as `not valid` and `validate constraint` separately; set a `lock_timeout` so a migration waiting behind a long query fails fast instead of queueing every other query behind it.

```sql
set lock_timeout = '5s';
create index concurrently orders_status_created on orders (status, created_at);   -- no write lock (can't run inside a transaction)
alter table orders add constraint total_positive check (total_minor >= 0) not valid;
alter table orders validate constraint total_positive;                          -- scans without blocking writes
```

## Real-world scenarios

- **E-commerce:** prices copied into order lines, stock as a constrained integer, orders and payments linked by foreign keys.
- **SaaS:** every table carries `tenant_id`, composite indexes lead with it, and row-level security enforces isolation.
- **Booking systems:** exclusion constraints make double-booking impossible regardless of race conditions.

## Common mistakes

- Floats for money.
- Missing foreign keys "for flexibility", followed by orphaned rows.
- No indexes on foreign key columns.
- `timestamp` without a time zone for events.
- Using `jsonb` to avoid designing a schema, then querying inside it everywhere.
- `NOT IN` with nullable subqueries.
- Editing old migrations, or running blocking DDL on huge tables at peak.

## Security considerations

- Parameterised queries only (see [web vulnerabilities](/learn/web-vulnerabilities/)).
- The application's database role should own only what it needs: no superuser, and no DDL rights in production at runtime.
- Row-level security can enforce tenant isolation in the database itself.

## Performance considerations

- Joins are fast with the right indexes. Don't avoid them out of fear; avoid N+1 query loops instead.
- `select *` drags large columns across the network; select what you need.
- Aggregations over huge tables belong in summary tables or an analytics store. See [indexing lab](/learn/indexing-lab/).

## Hands-on exercise

Run Postgres in Docker (`docker run -d -e POSTGRES_PASSWORD=pw -p 5432:5432 postgres:17`) and:

1. Create `customers`, `products`, `orders` and `order_items` with all the constraints above. Try to violate each constraint and read the error codes (`23503`, `23505`, `23514`).
2. Generate data with `generate_series`: 10,000 customers, 500 products, 200,000 orders.
3. Write queries for: top 10 customers by 90-day spend; each customer's latest order; customers who never ordered; daily revenue with a 7-day moving average (window frame `rows between 6 preceding and current row`).
4. Write a migration sequence that renames `customers.full_name` to `display_name` with expand/contract, as separate files.

## Completion criteria

- You design schemas where constraints make invalid states impossible.
- You can write joins, aggregates, window functions and CTEs without looking up syntax.
- You can change a production schema without downtime.
