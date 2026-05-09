# Supervisor Agent

AutoGen-based multi-agent orchestrator for the Demo Insurance Corp demo. A FastAPI
service exposes a WebSocket chat endpoint that routes a single user
conversation across a team of specialist agents.

## Agents

- **supervisor** - routes the user to one of the specialists below.
- **new_policy_agent** - quotes and submits new auto policy applications.
  Tools: `get_customer`, `create_customer`, `get_application_details`,
  `create_policy_application`, `credit_check` (external MCP).
- **existing_policy_agent** - looks up policies and claims.
  Tools: `get_policy_details`, `list_customer_policies`, `get_claim_details`,
  `list_customer_claims`.
- **general_qa_agent** - answers educational insurance questions from the KB.
  Tools: `search_knowledge_base`, `get_knowledge_base_article`.

The team is wired as an AutoGen `Swarm` with handoff-based routing.

## Environment

Copy `.env.example` to `.env` and fill in:

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `GEMINI_API_KEY` | _(required)_ | Google AI Studio API key. |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Gemini chat model used by every agent. |
| `GEMINI_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta/openai/` | Gemini's OpenAI-compatible endpoint. |
| `BACKEND_BASE_URL` | `http://backend:8001` | Demo Insurance Corp REST backend. |
| `MCP_CREDIT_CHECK_URL` | `http://mcp-credit-check:8003/mcp` | Credit-bureau MCP server. |
| `LOG_LEVEL` | `info` | Python log level. |

## Run

```bash
pip install -r requirements.txt
uvicorn app.service:app --host 0.0.0.0 --port 8000
```

Or with Docker:

```bash
docker build -t insureco-supervisor .
docker run --rm -p 8000:8000 --env-file .env insureco-supervisor
```

## API

### `GET /health`

```json
{"status": "ok"}
```

### `WS /chat?session_id={session_id}`

Each `session_id` has its own in-memory team and chat history.

**Inbound** (client -> server):

```json
{"type": "user_message", "content": "I'd like a quote for a 2022 Camry"}
```

**Outbound** (server -> client):

```json
{"type": "assistant_message", "agent": "supervisor|new_policy|existing_policy|general_qa", "content": "..."}
{"type": "agent_handoff", "from": "supervisor", "to": "new_policy_agent"}
{"type": "tool_call", "agent": "new_policy_agent", "tool": "create_customer", "args": {...}}
{"type": "tool_result", "agent": "new_policy_agent", "tool": "create_customer", "result": "<truncated to ~500 chars>"}
{"type": "done"}
{"type": "error", "message": "..."}
```

The WebSocket stays open across multiple turns; send another `user_message`
after `done` to continue the conversation.
