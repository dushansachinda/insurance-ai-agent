# Insurance AI Agent Backend

FastAPI backend for the auto insurance AI agent demo. Serves customer, policy,
application, claim, and knowledge-base data over a small REST API. There is no
authentication; data is loaded from JSON seeds and Markdown files into memory
on startup.

## Quick start (local)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

The service listens on `http://localhost:8001`. CORS is enabled for
`http://localhost:3000` and `http://localhost:8000`.

## Quick start (Docker)

```bash
cd backend
docker build -t insurance-ai-backend .
docker run --rm -p 8001:8001 insurance-ai-backend
```

## Endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET    | `/health` | Liveness probe |
| GET    | `/api/customers/{customer_id}` | Fetch a customer |
| POST   | `/api/customers` | Create a customer (auto-generated `CUST-XXXX`) |
| GET    | `/api/customers/{customer_id}/policies` | Customer's policies |
| GET    | `/api/policies/{policy_id}` | Fetch a policy |
| GET    | `/api/applications/{application_id}` | Fetch an application |
| GET    | `/api/customers/{customer_id}/applications` | Customer's applications |
| POST   | `/api/applications` | Submit an application; auto-quotes premium |
| GET    | `/api/customers/{customer_id}/claims` | Customer's claims |
| GET    | `/api/claims/{claim_id}` | Fetch a claim |
| GET    | `/api/knowledge-base/articles` | List article summaries |
| GET    | `/api/knowledge-base/articles/{article_id}` | Fetch full article markdown |
| GET    | `/api/knowledge-base/search?q=...&limit=5` | Search articles |

Missing resources return HTTP 404 with `{"detail": "..."}`.

## Premium quote heuristic

`POST /api/applications` automatically computes `quoted_premium_monthly`:

```
base = 80
+ {full:60, comprehensive:40, collision:25, liability:0}[coverage]
+ {250:30, 500:15, 1000:0, 1500:-10}.get(deductible, 0)
+ (20 if vehicle.year < 2010 else 0)
+ (25 if vehicle.year > 2022 else 0)
```

## Layout

```
backend/
  app/
    __init__.py
    main.py          FastAPI app, routes, premium heuristic
    schemas.py       Pydantic models
    data_store.py    In-memory store loaded from JSON + Markdown
  data/              JSON seeds (customers, policies, applications, claims)
  knowledge_base/    Markdown articles with YAML frontmatter for tags
  Dockerfile
  requirements.txt
  .env.example
```

## Seed data

The seed files are intentionally small and human-readable. Alice Johnson
(`CUST-0001`) is the canonical demo customer with an active full-coverage
policy on a 2021 Toyota Camry (`POL-0001`).
