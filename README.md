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

### Policy application — Approved ✅

**Customer:** CUST-0001 · Alice Johnson · SSN last 4: `0008`
Credit composite: **778** (BureauAlpha 755, BureauBeta 802) — tier: low

**Chat input:**
```
I'd like a new auto insurance policy. I'm an existing customer with customer
ID CUST-0001. The vehicle is a 2022 Honda Civic, VIN 1HGCM82633A123456.
Driver information: Alice Johnson, driver's license D1234567, licensed for
10 years. Requested coverage is full coverage with a $500 deductible.
Last four digits of SSN: 0008.
```

**What happens:**
```
Supervisor  → create_policy_application
              → credit_check via MCP (composite 778, low) → application submitted
              → POST /review to underwriting-agent (fire & forget)
              → responds to user with APP-XXXX, premium $155/month

Background  → underwriting-agent fetches application + customer + credit check
              → all 4 rules pass → Gemini writes approval rationale
              → PATCH APP-XXXX → status: approved
```

---

### Policy application — Needs Review 🔍

**Customer:** CUST-0002 · Bob Smith · SSN last 4: `0004`
Credit composite: **710** (elevated tier) — manual review required

**Chat input:**
```
I'd like a new auto insurance policy. I'm an existing customer with customer
ID CUST-0002. The vehicle is a 2020 Ford F-150, VIN 1FTFW1E50MFA12345.
Driver information: Bob Smith, driver's license TX-5678901, licensed for
8 years. Requested coverage is full coverage with a $500 deductible.
Last four digits of SSN: 0004.
```

**What happens:**
```
Supervisor  → create_policy_application
              → credit_check via MCP (composite 710, elevated) → application submitted
              → POST /review to underwriting-agent (fire & forget)
              → responds to user with APP-XXXX, premium quoted

Background  → underwriting-agent: credit tier elevated → FLAG
              → Gemini writes review rationale
              → PATCH APP-XXXX → status: needs_review
```

---

### Policy application — Declined ❌

**Customer:** CUST-0003 · Carol Davis · SSN last 4: `0000`
Credit composite: **558** (BureauAlpha 568, BureauBeta 549) — tier: high

**Chat input:**
```
I'd like a new auto insurance policy. I'm an existing customer with customer
ID CUST-0003. The vehicle is a 2019 Toyota Camry, VIN 4T1BF1FK5MU654321.
Driver information: Carol Davis, driver's license WA-3456789, licensed for
6 years. Requested coverage is full coverage with a $500 deductible.
Last four digits of SSN: 0000.
```

**What happens:**
```
Supervisor  → create_policy_application
              → credit_check via MCP (composite 558, high) → DECLINED
              → application not submitted, user informed politely

              (No underwriting review triggered — credit check blocked submission)
```

---

### Existing policy lookup

**Chat input:**
```
Can you list the policies for customer CUST-0001?
```

Agent calls `list_customer_policies` and returns policy details for
POL-0001 (2021 Toyota Camry, full coverage, $145/month, active).

---

### Knowledge base Q&A

**Chat input:**
```
What is collision coverage and how is it different from comprehensive?
```

Agent calls `search_knowledge_base` then fetches both articles and
explains the difference in plain language with article citations.

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
