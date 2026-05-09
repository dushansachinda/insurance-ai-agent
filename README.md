# Demo Insurance Corp — AI Agent Demo

A full-stack auto insurance demo that shows how multiple AI agents collaborate
to handle customer requests, run mandatory underwriting checks, and issue
binding decisions — all locally, no cloud account required.

Built with Microsoft AutoGen, Google Gemini (via OpenAI-compatible API),
Model Context Protocol (MCP), React, and FastAPI.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Browser                                                                │
│  ┌──────────────┐                                                       │
│  │   Frontend   │  port 3000  (React 18 + TypeScript + Tailwind)        │
│  └──────┬───────┘                                                       │
│         │ WebSocket /chat                    REST /api/*                │
└─────────┼──────────────────────────────────────────────┬───────────────┘
          │                                              │
          ▼                                              ▼
┌─────────────────────┐   REST /api/*       ┌───────────────────┐
│  Supervisor Agent   │────────────────────►│     Backend       │
│  port 8000          │                     │     port 8001     │
│                     │                     │  (FastAPI, in-    │
│  AutoGen            │                     │   memory store)   │
│  AssistantAgent     │                     └───────────────────┘
│  + Gemini 2.5 Flash │                               ▲
│                     │  POST /review (fire & forget) │ PATCH /api/applications
│  Tools:             │──────────────┐                │
│  • get_customer     │              │                │
│  • create_customer  │              ▼                │
│  • list_policies    │   ┌─────────────────────┐     │
│  • get_policy       │   │  Underwriting Agent │─────┘
│  • list_claims      │   │  port 8006          │
│  • get_claim        │   │                     │
│  • search_kb        │   │  Python pipeline:   │
│  • get_kb_article   │   │  1. get_application │  REST /api/*
│  • create_application   │  2. get_customer    │────────────►  Backend
│    (credit check    │   │  3. credit_check    │
│     built-in ▼)     │   │     via MCP ───────────────────┐
│                     │   │  4. apply rules     │           │
└──────────┬──────────┘   │  5. Gemini → notes  │           │
           │              │  6. PATCH decision  │           │
           │ MCP (streamable-http)               └───────────┼──────────┘
           │                                                 │ MCP
           ▼                                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                  MCP Credit-Check Aggregator  port 8003          │
│                                                                  │
│  Calls both bureaus in parallel via httpx.AsyncClient            │
│  Composite score = average; final tier = stricter of the two     │
└──────────────────────┬──────────────────────┬───────────────────┘
                       │                      │
           HTTP POST /check        HTTP POST /check
                       │                      │
                       ▼                      ▼
           ┌───────────────────┐  ┌───────────────────┐
           │   BureauAlpha     │  │   BureauBeta      │
           │   port 8004       │  │   port 8005       │
           │  score 480–820    │  │  score 510–820    │
           │  model ALPHA-v3.1 │  │  model BETA-v2.7  │
           └───────────────────┘  └───────────────────┘
```

### Agent-to-agent flow (new policy application)

```
User chat                  Supervisor              Underwriting         Backend
   │                          │                       │                   │
   │── "I want a policy" ────►│                       │                   │
   │                          │── get_customer ──────────────────────────►│
   │                          │◄─ customer ───────────────────────────────│
   │                          │                       │                   │
   │                          │── create_policy_application               │
   │                          │     (credit check runs inside tool)       │
   │                          │       └─ MCP credit_check ─► bureaus      │
   │                          │◄─ APP-XXXX pending ──────────────────────►│
   │◄── "submitted" ──────────│                       │                   │
   │                          │── POST /review ───────►│                  │
   │                          │◄─ 202 Accepted ────────│                  │
   │                          │                       │── get_application►│
   │  (user already has       │                       │── get_customer ──►│
   │   their response)        │                       │── credit_check ─► MCP
   │                          │                       │── apply rules     │
   │                          │                       │── Gemini notes    │
   │                          │                       │── PATCH status ──►│
   │                          │                    ✓ "approved"/"declined"│
```

---

## Services

| Service | Port | Tech | Purpose |
|---|---|---|---|
| `frontend` | 3000 | React 18, TypeScript, Tailwind | Chat UI and policy dashboards |
| `supervisor-agent` | 8000 | Python, FastAPI, AutoGen, Gemini | WebSocket chat; single `AssistantAgent` with all customer-facing tools |
| `backend` | 8001 | Python, FastAPI | Policy / application / customer / claims / KB REST API |
| `mcp-credit-check` | 8003 | Python, FastMCP | MCP aggregator — queries both bureaus in parallel, returns composite score |
| `bureau-alpha` | 8004 | Python, FastAPI | Dummy credit bureau A (seed: "alpha\|…", score 480–820) |
| `bureau-beta` | 8005 | Python, FastAPI | Dummy credit bureau B (seed: "beta\|…", score 510–820) |
| `underwriting-agent` | 8006 | Python, FastAPI, Gemini | Background underwriting reviewer; called by supervisor after application submission |

---

## Key Design Decisions

### Single AssistantAgent (not a Swarm)
The supervisor is one AutoGen `AssistantAgent` with all 9 tools. A Swarm of
specialised sub-agents was tried first but Gemini's OpenAI-compat endpoint
calls handoff tools without producing text, causing empty bubbles and stuck
"Thinking…" states in the UI.

### Credit check is code-enforced, not prompt-enforced
`create_policy_application` calls `credit_check` internally before posting
to the backend. The LLM cannot skip it — it is not a separate visible tool.

### Background underwriting (agent-to-agent)
After the supervisor returns a chat response, it fires a fire-and-forget
`POST /review` to the underwriting agent. The underwriting agent runs a
4-step Python pipeline (data gathering) + one Gemini call (decision notes),
then patches the application status in the backend. The user sees the
updated status on their policies page.

### MCP for credit bureaus
The MCP credit-check server demonstrates the Model Context Protocol. Both
the supervisor and the underwriting agent call the same MCP service, which
in turn fans out to two independent bureau HTTP services and returns a
composite decision.

---

## Quickstart

### Option A — Docker Compose

```bash
cp backend/.env.example                 backend/.env
cp mcp-credit-check-server/.env.example mcp-credit-check-server/.env
cp supervisor-agent/.env.example        supervisor-agent/.env
cp underwriting-agent/.env.example      underwriting-agent/.env
cp frontend/.env.example                frontend/.env

# Set GEMINI_API_KEY in supervisor-agent/.env and underwriting-agent/.env
#   https://aistudio.google.com/apikey

docker compose up --build
```

Open http://localhost:3000 when all containers are healthy.

### Option B — Local dev (no Docker)

```bash
chmod +x start-services.sh stop-services.sh
./start-services.sh     # creates venvs, installs deps, starts all 7 services
./stop-services.sh      # tears everything down
```

Logs: `logs/<service>.log` — PIDs: `logs/<service>.pid`

---

## Configuration

Both the supervisor and underwriting agents need `GEMINI_API_KEY`.

| File | Variable | Notes |
|---|---|---|
| `supervisor-agent/.env` | `GEMINI_API_KEY` | Required |
| `supervisor-agent/.env` | `GEMINI_MODEL` | Default `gemini-2.5-flash` |
| `supervisor-agent/.env` | `BACKEND_BASE_URL` | `http://backend:8001` (Docker) / `http://localhost:8001` (local) |
| `supervisor-agent/.env` | `MCP_CREDIT_CHECK_URL` | `http://mcp-credit-check:8003/mcp` (Docker) / `http://localhost:8003/mcp` (local) |
| `supervisor-agent/.env` | `UNDERWRITING_AGENT_URL` | `http://underwriting-agent:8006` (Docker) / `http://localhost:8006` (local) |
| `underwriting-agent/.env` | `GEMINI_API_KEY` | Required (separate agent process) |
| `underwriting-agent/.env` | `BACKEND_BASE_URL` | Same as above |
| `underwriting-agent/.env` | `MCP_CREDIT_CHECK_URL` | Same as above |

---

## Demo Scenarios

### 1. New policy application (with underwriting)

```
User:  I'd like a quote on a new auto policy. I'm existing customer CUST-0001.
       Vehicle: 2022 Honda Civic, VIN 1HGCM82633A123456.
       Driver: Alice Johnson, D1234567, 10 years. Full coverage, $500 deductible.
       SSN last 4: 0008.

Agent: [calls create_policy_application]
         → credit_check via MCP → BureauAlpha (755) + BureauBeta (802) → approved
         → POST /api/applications → APP-XXXX pending
         → POST /review to underwriting-agent (fire & forget)

       Your application APP-XXXX has been submitted.
       Quoted premium: $155.00/month. Credit composite score: 778, tier: low.

[background — underwriting agent]
         → get_application, get_customer, credit_check via MCP
         → rules: driver ✓, vehicle age ✓, deductible ✓, credit ✓ → approved
         → Gemini writes rationale
         → PATCH APP-XXXX → status: approved

User visits Policies page → sees APP-XXXX: approved
```

> **Tip:** SSN `0008` for CUST-0001 produces composite score 778 (both bureaus approve).
> SSN `4821` (stored on CUST-0001) produces score 660 (elevated → needs_review).

### 2. Existing policy lookup

```
User:  List the policies for customer CUST-0001.
Agent: [calls list_customer_policies]
       Policy POL-0001 — 2021 Toyota Camry, full coverage, $500 deductible,
       premium $145/month, active.
```

### 3. Knowledge base Q&A

```
User:  What is collision coverage and how is it different from comprehensive?
Agent: [calls search_knowledge_base → get_knowledge_base_article × 2]
       Collision covers damage from accidents regardless of fault.
       Comprehensive covers non-collision losses: theft, hail, fire, animals…
```

---

## Repository Layout

```
insurance-ai-agent/
  backend/                    # FastAPI policy/customer/KB REST API (port 8001)
  supervisor-agent/           # AutoGen AssistantAgent + WebSocket (port 8000)
  underwriting-agent/         # Background underwriting pipeline (port 8006)
  mcp-credit-check-server/    # MCP aggregator calling both bureaus (port 8003)
  credit-bureaus/             # BureauAlpha (8004) + BureauBeta (8005)
  frontend/                   # React + TypeScript chat UI (port 3000)
  logs/                       # Runtime logs and PIDs
  docker-compose.yml          # All 7 services
  start-services.sh           # Local dev launcher
  stop-services.sh            # Local dev teardown
```

---

## Tech Stack

- **Python 3.11** — all backend services
- **FastAPI / Uvicorn** — HTTP and WebSocket servers
- **AutoGen (autogen-agentchat 0.4)** — agent orchestration
- **Google Gemini 2.5 Flash** — LLM for both agents (via OpenAI-compat endpoint)
- **Model Context Protocol (MCP)** — credit-check tool transport
- **httpx** — async HTTP between services
- **React 18, TypeScript, Tailwind CSS** — frontend
- **Docker Compose** — container orchestration
