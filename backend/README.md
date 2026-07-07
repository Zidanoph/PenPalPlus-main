# PenPal+ — Backend (FastAPI)

The API and database for **PenPal+**, a slow, global pen-pal & cultural-exchange
platform. Letters take *real time to travel* based on the geographic distance
between correspondents — the signature mechanic of the product.

Built with **FastAPI + SQLAlchemy 2.0 + Pydantic v2**. Runs on **SQLite** out of
the box (zero setup) and on **PostgreSQL** by changing a single environment
variable.

---

## Quick start

```bash
cd backend
python -m venv .venv && source .venv/bin/activate     # optional but recommended
pip install -r requirements.txt
cp .env.example .env                                  # sensible defaults included
python -m app.seed                                    # create + populate the database
uvicorn app.main:app --reload                         # http://127.0.0.1:8000
```

Open the interactive API docs at **http://127.0.0.1:8000/docs**.

### Demo accounts (created by the seed)

| Role  | Email               | Password      | Who                         |
|-------|---------------------|---------------|-----------------------------|
| User  | `demo@penpal.app`   | `password123` | Layla Hassan — Cairo 🇪🇬     |
| Admin | `admin@penpal.app`  | `password123` | Postmaster (admin console)  |

Every seeded pen pal (Tokyo, Reykjavík, São Paulo, Berlin, Nairobi, Seoul,
Buenos Aires, Toronto, Mumbai, Lisbon, …) uses the same password, so you can log
in as any of them to see both sides of a correspondence.

> **Tip — see a letter arrive in seconds.** Letters normally travel for hours.
> To demo the full arc quickly, set `DEMO_FAST_DELIVERY=true` in `.env`
> (delivers every letter after `DEMO_DELIVERY_SECONDS`, default 20s), then
> re-run `python -m app.seed --force`.

---

## How the signature mechanics work

**Distance-based delivery.** When a letter is sent, the server computes the
great-circle distance (haversine) between sender and recipient and derives an
ETA: `distance / DELIVERY_SPEED_KMH`, clamped between `DELIVERY_MIN_HOURS` and
`DELIVERY_MAX_HOURS`. The letter is stored `in_transit` with a `deliver_at`
timestamp; its body is **withheld from the recipient** until it lands. There is
no background worker — delivery is applied lazily whenever the inbox/letter
endpoints are read (`deliver_due_letters`), which keeps the stack simple and
fully synchronous.

**Match scoring.** `/discover` ranks pen pals with a transparent weighted score
(`app/services.compute_match`): shared + complementary languages (teach/learn
pairs), shared topics, distance preference (near / far / anywhere), and recent
activity. Every card returns a human-readable breakdown so the UI can explain
*why* two people were matched.

---

## Configuration (`.env`)

| Variable | Default | Meaning |
|---|---|---|
| `SECRET_KEY` | dev value | JWT signing secret — **change in production** |
| `ACCESS_TOKEN_MINUTES` | `30` | Access-token lifetime |
| `REFRESH_TOKEN_DAYS` | `30` | Refresh-token lifetime |
| `DATABASE_URL` | `sqlite:///./penpal.db` | Any SQLAlchemy URL; e.g. `postgresql+psycopg2://user:pass@localhost/penpal` |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins (the Vite dev server) |
| `DELIVERY_SPEED_KMH` | `140` | Notional travel speed used for ETA |
| `DELIVERY_MIN_HOURS` / `DELIVERY_MAX_HOURS` | `2` / `168` | ETA clamp (2h … 7 days) |
| `DEMO_FAST_DELIVERY` | `false` | If true, deliver after a few seconds (for demos) |
| `DEMO_DELIVERY_SECONDS` | `20` | The "few seconds" above |

### Switching to PostgreSQL

1. `pip install psycopg2-binary` (already listed, commented, in `requirements.txt`).
2. Set `DATABASE_URL=postgresql+psycopg2://user:pass@localhost:5432/penpal`.
3. `python -m app.seed --force` and start the server. No code changes.

---

## Project layout

```
backend/
├── app/
│   ├── main.py            app factory, CORS, router registration, /health
│   ├── config.py          pydantic-settings (reads .env)
│   ├── database.py        engine + session + Base
│   ├── security.py        bcrypt hashing, JWT access/refresh encode/decode
│   ├── deps.py            get_current_user / get_current_admin
│   ├── models.py          all SQLAlchemy models (27 tables, 8 domains)
│   ├── schemas.py         all Pydantic v2 request/response schemas
│   ├── services.py        haversine, delivery ETA, match scoring, achievements
│   ├── seed.py            rich, idempotent demo data (python -m app.seed)
│   └── routers/           auth, profiles, discovery, letters, friends,
│                          stamps, achievements, subscriptions, communities,
│                          notifications, admin
├── schema.sql             readable DDL reference (auto-generated)
├── smoke_test.py          end-to-end test of the full core loop
├── requirements.txt
└── .env.example
```

---

## Verifying it works

A self-contained end-to-end test exercises the whole loop — register → onboard →
discover → send a letter → read a delivered letter → achievements → premium →
admin RBAC:

```bash
# with the server running on port 8137:
python smoke_test.py
```

---

## API surface (high level)

- **Auth** — `POST /auth/register`, `POST /auth/login` (OAuth2 form),
  `POST /auth/refresh-token`, `POST /auth/logout`,
  `POST /auth/forgot-password`, `POST /auth/reset-password`
- **Profile** — `GET /profile/me`, `GET /profile/{id}`, `PUT /profile`,
  `GET/PUT /profile/settings`
- **Discover** — `GET /discover/suggestions`, `POST /discover/search`,
  `POST /discover/filter`
- **Letters** — `POST /letters`, `GET /letters/inbox`, `GET /letters/sent`,
  `GET /letters/{id}`, `POST /letters/{id}/save`, `…/drafts`
- **Friends** — `POST /friends/request/{id}`, `GET /friends/requests`,
  `POST /friends/requests/{id}/respond`, `GET /friends`,
  `DELETE /friends/{id}`, `POST/DELETE /blocks/{id}`, `POST /reports`
- **Stamps** — `GET /stamps`, `GET /stamps/mine`, `POST /stamps/{id}/claim`
- **Achievements** — `GET /achievements`
- **Communities** — `GET /communities`, `POST /communities/{id}/join`,
  posts & comments
- **Subscriptions** — `GET /plans`, `GET /subscriptions/me`,
  `POST /subscriptions` (mock payment), `POST /subscriptions/cancel`
- **Notifications** — `GET /notifications`, `…/unread-count`, `…/read`, `…/read-all`
- **Admin** — `GET /admin/stats`, `GET /admin/users`, `GET /admin/reports`
  (require an admin token)

See `/docs` for the full, always-current schema.
