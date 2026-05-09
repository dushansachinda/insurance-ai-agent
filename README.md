# Insurance AI Agent (Local Demo)

A multi-agent demo for an auto insurance assistant. A React frontend talks to a
supervisor agent built on Microsoft AutoGen, which routes user requests to one
of three specialised sub-agents and calls a FastAPI backend plus a local MCP
server for a credit check tool. The whole thing runs locally against
Google Gemini (via its OpenAI-compatible API) - no cloud account, IAM, or
external infrastructure required.

## Architecture

```
+----------+   WebSocket    +------------------+
| Frontend | -------------> | Supervisor Agent | (port 8000, AutoGen + Gemini)
| (React)  |                |                  |
| port     |   REST         |  +-- NewPolicy   |
| 3000     | -------------> |  +-- ExistingPolicy
+----------+                |  +-- GeneralQA   |
      |                     +--------+---------+
      |                              |
      | REST                         +-- REST -->  +---------+
      +----------------------------> |              | Backend | (port 8001, FastAPI)
                                     |              +---------+
                                     |
                                     +-- MCP --->  +------------------+
                                                   | Credit Check MCP | (port 8003)
                                                   +------------------+
```

## Components

| Service              | Port | Tech                                    | Purpose                                                                 |
|----------------------|------|-----------------------------------------|-------------------------------------------------------------------------|
| `frontend`           | 3000 | React 18, TypeScript, Tailwind          | User-facing chat UI and policy dashboards.                              |
| `supervisor-agent`   | 8000 | Python 3.11, FastAPI, AutoGen, Gemini   | Multi-agent orchestrator; exposes `/chat` WebSocket.                    |
| `backend`            | 8001 | Python 3.11, FastAPI                    | Policy / quote / customer REST API used by frontend and supervisor.     |
| `mcp-credit-check`   | 8003 | Python 3.11, MCP (HTTP transport)       | Local MCP server providing a dummy `credit_check` tool.                 |

## Agent Topology

The supervisor agent is a coordinator. It inspects the incoming user message,
hands the conversation to one sub-agent, then returns the response. Three
sub-agents share the same Gemini model:

- **NewPolicyAgent** - quotes new auto policies. Collects vehicle and driver
  info, calls the MCP `credit_check` tool, and submits an application via the
  backend.
- **ExistingPolicyAgent** - looks up an existing policy by id, summarises
  coverage, supports endorsements (add driver, change vehicle).
- **GeneralQAAgent** - answers general questions about coverage types,
  deductibles, and the claims process. No tool calls.

Typical user flows:

1. *New policy quote*: user describes a vehicle - supervisor routes to
   `NewPolicyAgent` - agent calls `credit_check` (MCP) and `POST /applications`
   (backend) - returns a quote.
2. *Existing policy lookup*: user gives a policy id - supervisor routes to
   `ExistingPolicyAgent` - agent calls `GET /policies/{id}` (backend).
3. *General Q&A*: user asks "what is comprehensive coverage?" - supervisor
   routes to `GeneralQAAgent` - direct LLM answer, no tools.

## Quickstart

### Option A - Docker Compose

```bash
# Each service ships its own .env.example
cp backend/.env.example                backend/.env
cp mcp-credit-check-server/.env.example mcp-credit-check-server/.env
cp supervisor-agent/.env.example       supervisor-agent/.env
cp frontend/.env.example               frontend/.env

# Set your Gemini key in supervisor-agent/.env
#   GEMINI_API_KEY=AIza...   (https://aistudio.google.com/apikey)

docker compose up --build
```

When the containers are healthy, open http://localhost:3000.

### Option B - Local dev (no Docker)

```bash
chmod +x start-services.sh stop-services.sh
./start-services.sh         # creates venvs, installs deps, starts everything
./stop-services.sh          # tears it all down
```

Logs land in `logs/<service>.log`; PIDs in `logs/<service>.pid`.

## Configuration

Each service owns its own `.env`. The only key you must set yourself is the
Gemini key used by the supervisor agent.

| File                              | Variable             | Notes                                    |
|-----------------------------------|----------------------|------------------------------------------|
| `supervisor-agent/.env`           | `GEMINI_API_KEY`     | Required. Used for all LLM calls.        |
| `supervisor-agent/.env`           | `GEMINI_MODEL`       | Defaults to `gemini-2.5-flash`. Override for a different Gemini model (e.g. `gemini-2.5-pro`). |
| `supervisor-agent/.env`           | `BACKEND_BASE_URL`   | `http://backend:8001` (Docker) or `http://localhost:8001` (local). |
| `supervisor-agent/.env`           | `MCP_CREDIT_CHECK_URL` | `http://mcp-credit-check:8003/mcp` (Docker) or `http://localhost:8003/mcp` (local). |
| `backend/.env`                    | -                 | See `backend/.env.example`.              |
| `mcp-credit-check-server/.env`    | -                 | See `mcp-credit-check-server/.env.example`. |
| `frontend/.env`                   | `REACT_APP_*`     | API base URLs for the UI.                |

## Sample Flows

**1. New policy quote**

```
User: I'd like a quote on my 2022 Honda Civic.
Agent (NewPolicyAgent): Happy to help. Could you share your full name,
   date of birth, and ZIP code so I can run a quote?
... [collects info, calls credit_check via MCP, calls POST /applications] ...
Agent: Based on your profile your 6-month premium is $612.40. Application
   APP-00031 has been created. Would you like to bind the policy?
```

**2. Existing policy lookup**

```
User: Can you pull up policy POL-1042?
Agent (ExistingPolicyAgent): Policy POL-1042 covers a 2019 Toyota RAV4 with
   liability + comprehensive, $500 deductible, renewing 2026-08-15.
```

**3. General Q&A**

```
User: What is the difference between collision and comprehensive coverage?
Agent (GeneralQAAgent): Collision pays for damage to your vehicle from a
   crash; comprehensive covers non-collision losses such as theft, hail,
   or hitting an animal. ...
```

## Repository Layout

```
insurance-ai-agent/
  backend/                     # FastAPI policy/quote/customer service (port 8001)
  supervisor-agent/            # AutoGen-based multi-agent orchestrator (port 8000)
  mcp-credit-check-server/     # Local MCP server exposing credit_check (port 8003)
  frontend/                    # React + TypeScript chat UI (port 3000)
  logs/                        # PID + log files for ./start-services.sh
  docker-compose.yml           # Container orchestration for all 4 services
  start-services.sh            # Local dev launcher (venv + npm)
  stop-services.sh             # Local dev teardown
  README.md                    # This file
  SETUP.md                     # Step-by-step setup instructions
```

## Tech Stack

- Python 3.11
- FastAPI / Uvicorn
- Microsoft AutoGen (multi-agent orchestration)
- Google Gemini (via OpenAI-compatible endpoint)
- Model Context Protocol (MCP)
- React 18, TypeScript, Tailwind CSS
- Docker Compose

## Credits

This demo is patterned after the AWS sample
[sample-building-agentic-ai-applications-on-aws](https://github.com/aws-samples/sample-building-agentic-ai-applications-on-aws),
adapted to run entirely locally without AWS - using Google Gemini for
inference and a local dummy MCP server in place of Bedrock-hosted tools.
