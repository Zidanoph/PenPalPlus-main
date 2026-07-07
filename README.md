# PenPal+ ✉

> The slow way to know someone. A global pen-pal & cultural-exchange platform
> where letters take **real time to travel**, scaled to the geographic distance
> between you and the person you're writing to.

This repository is a complete, runnable implementation of PenPal+ across **all
layers** — a FastAPI backend, a SQLAlchemy data model with seed data, and a
React frontend — built around the product's signature idea: correspondence that
rewards patience.

It's adapted from a platform spec (originally Flutter + NestJS microservices)
onto a single, cohesive stack that runs end-to-end on one machine with no cloud
dependencies, while keeping the same product: the same modules, the same data
model, and the same two signature algorithms (distance-based delivery and
language/interest match scoring).

---

## What's inside

```
penpal/
├── backend/            FastAPI + SQLAlchemy + SQLite/PostgreSQL
│   ├── app/            models, schemas, services (the algorithms), routers, seed
│   ├── schema.sql      readable DDL reference (27 tables)
│   ├── smoke_test.py   end-to-end test of the whole core loop
│   └── README.md       ← full backend docs, config, API surface
├── frontend/           React + Vite, wired to the API
│   ├── src/            pages, components, the airmail design system
│   └── .env.example
├── PenPalShowcase.jsx  a self-contained, interactive demo of the core loop
└── docker-compose.yml  optional: run the API against PostgreSQL
```

---

## Run it locally (two terminals)

### 1 · Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m app.seed                 # creates + populates penpal.db
uvicorn app.main:app --reload      # → http://127.0.0.1:8000  (docs at /docs)
```

### 2 · Frontend

```bash
cd frontend
npm install
cp .env.example .env               # defaults to the Vite dev proxy at /api
npm run dev                        # → http://127.0.0.1:5173
```

Open **http://127.0.0.1:5173** and sign in with the seeded demo account:

> **demo@penpal.app** · **password123**

Every seeded pen pal (Tokyo, Reykjavík, São Paulo, Berlin, Nairobi, Seoul,
Buenos Aires, Toronto, Mumbai, Lisbon …) uses the same password, so you can log
in as two of them in separate browsers and watch a letter travel between them.

> **See a letter arrive in seconds:** set `DEMO_FAST_DELIVERY=true` in
> `backend/.env`, re-run `python -m app.seed --force`, and letters deliver after
> ~20s instead of hours.

---

## The signature mechanic

When you send a letter, the backend computes the great-circle distance between
you and the recipient and turns it into a delivery time. The letter sits
`in_transit` — its contents sealed from the recipient — until its `deliver_at`
moment passes, at which point it's delivered and postmarked. Delivery is applied
lazily when mailboxes are read, so the whole thing stays synchronous and simple:
no queues, no workers.

A Cairo → Tokyo letter really does travel farther (and longer) than a Cairo →
Berlin one. Distance is the point.

The other algorithm, **match scoring**, ranks potential pen pals on a
transparent weighted blend of shared/complementary languages (so a native Arabic
speaker learning Japanese is matched with a native Japanese speaker learning
Arabic), shared interests, distance preference, and recent activity — and every
match comes with a human-readable explanation.

Both live in `backend/app/services.py`.

---

## Try the core loop without installing anything

`PenPalShowcase.jsx` is a single self-contained React component (no backend, no
storage) that walks through the whole experience: arrive → discover a pen pal →
write a letter → watch it cross a real distance with a live ETA → read the reply,
postmarked. It's the fastest way to feel what the product is.

---

## Design

The interface takes its cues from **vintage airmail**: deep navy fountain-pen
ink on warm manila paper, with postal-red and airmail-blue accents used
sparingly. Type pairs **Fraunces** (a characterful old-style serif) for display,
**Spectral** for letter bodies, and **Courier Prime** (typewriter) for addresses,
tracking and data. The recurring devices — the red-and-blue dashed airmail
border, the circular postmark stamped over delivered mail, and the postal-style
transit tracker — all come from the world of physical letters.

---

## Optional: PostgreSQL

The app runs on SQLite by default. To run the API against PostgreSQL instead:

```bash
docker compose up -d db        # starts Postgres on :5432
cd backend
# in .env: DATABASE_URL=postgresql+psycopg2://penpal:penpal@localhost:5432/penpal
pip install psycopg2-binary
python -m app.seed --force
uvicorn app.main:app --reload
```

No application code changes — SQLAlchemy maps the models to either database.

---

## Notes & scope

- Authentication is JWT access + refresh tokens with refresh rotation and
  session revocation.
- Payments for Plus are mocked end-to-end (subscription → invoice → transaction)
  with no real processor — clearly labelled as a demo checkout.
- The backend is verified by `backend/smoke_test.py`, which exercises register →
  onboard → discover → send → deliver/read → achievements → premium → admin RBAC.
"# PenPalPlus-main" 
