# Insurance AI Agent - Setup Guide

End-to-end instructions for running the demo on a developer laptop, either via
Docker Compose or natively with `start-services.sh`.

## 1. Prerequisites

- Python 3.11 or later
- Node.js 20 or later, with `npm`
- Docker 24+ and Docker Compose v2 (only for the Docker path)
- A Google AI Studio API key with Gemini access (free tier works; create one at https://aistudio.google.com/apikey)
- macOS or Linux. Windows users should use WSL2.

Verify:

```bash
python3 --version
node --version
npm --version
docker --version
docker compose version
```

## 2. Configure environment files

Each service ships a `.env.example`. Copy it to `.env` for every service:

```bash
cp backend/.env.example                backend/.env
cp mcp-credit-check-server/.env.example mcp-credit-check-server/.env
cp supervisor-agent/.env.example       supervisor-agent/.env
cp frontend/.env.example               frontend/.env
```

Edit `supervisor-agent/.env` and set your Gemini key:

```
GEMINI_API_KEY=AIza...
```

(Optionally override `GEMINI_MODEL`; defaults to `gemini-2.5-flash`.)

URL defaults differ between Docker and local-dev runs. For Docker, internal
service names are used (`http://backend:8001`, `http://mcp-credit-check:8003/mcp`);
for local dev, use `http://localhost:...`. The example files document both.

## 3. Make the helper scripts executable

```bash
chmod +x start-services.sh stop-services.sh
```

## 4. Start the demo

### Option A - Docker Compose

```bash
docker compose up --build
```

`backend` exposes a `/health` endpoint that the compose file uses as a
healthcheck; `supervisor-agent` waits for backend to be healthy before it
starts. To run detached:

```bash
docker compose up --build -d
docker compose logs -f
```

### Option B - Local dev

```bash
./start-services.sh
```

The script will:

1. Verify `python3`, `node`, `npm` are installed.
2. Free ports 8000, 8001, 8003, 3000 if anything is listening.
3. For each Python service: create a `venv/` if missing, install
   `requirements.txt`, and launch with `uvicorn` in the background.
4. For the frontend: run `npm install` if `node_modules/` is missing, then
   `npm start` in the background.
5. Probe `/health` on each service and print a status summary.

PIDs live in `logs/<service>.pid`, console output in `logs/<service>.log`.

## 5. Verify the services

```bash
curl http://localhost:8001/health           # backend
curl http://localhost:8000/health           # supervisor-agent
curl http://localhost:8003/health           # mcp-credit-check
curl -I http://localhost:3000               # frontend (expect 200)
```

Open http://localhost:3000 in a browser. The chat widget should connect to
`ws://localhost:8000/chat` automatically.

## 6. Try a sample prompt

In the chat widget, paste:

```
I'd like a quote on my 2022 Honda Civic. I'm 34, live in 94110.
```

You should see the supervisor agent route the request to `NewPolicyAgent`,
collect a few extra details, call the `credit_check` tool, and return a quote.

Other prompts to try:

- `Pull up policy POL-1042`
- `What's the difference between collision and comprehensive?`

## 7. Stopping the demo

```bash
docker compose down            # Docker path
./stop-services.sh             # Local dev path
```

`stop-services.sh` reads `logs/*.pid`, kills those processes, and as a safety
net kills anything still listening on ports 8000, 8001, 8003, 3000.

## 8. Troubleshooting

**Port already in use**

```bash
lsof -i :8000
lsof -i :8001
lsof -i :8003
lsof -i :3000
```

`./stop-services.sh` clears these ports unconditionally. For Docker, run
`docker compose down` and verify no host process owns the port.

**`GEMINI_API_KEY` missing or invalid**

Symptom: supervisor-agent returns 500 from `/chat`, log shows
`AuthenticationError` or `PermissionDenied`. Confirm `supervisor-agent/.env`
contains a valid Gemini key (https://aistudio.google.com/apikey),
then restart only that service:

```bash
docker compose restart supervisor-agent
# or
kill "$(cat logs/supervisor-agent.pid)" && ./start-services.sh
```

**MCP server not reachable**

Symptom: supervisor-agent log shows `connection refused` for
`http://mcp-credit-check:8003/mcp` (Docker) or `http://localhost:8003/mcp`
(local). Check the MCP server's log:

```bash
docker compose logs mcp-credit-check
# or
tail -f logs/mcp-credit-check.log
```

In local-dev mode, ensure `MCP_URL` in `supervisor-agent/.env` uses
`localhost`, not the Docker service name.

**WebSocket connection fails in the browser**

The frontend connects to `ws://localhost:8000/chat`. If you see
`WebSocket connection failed` in the browser console:

- Confirm the supervisor agent is running on port 8000.
- Check CORS / origin settings if you've changed the frontend port.
- If running behind a corporate proxy, allow direct connections to
  `localhost`.

**A service refuses to start under `start-services.sh`**

The script is tolerant: if one service fails the others still start. Check
its log:

```bash
tail -f logs/<service>.log
```

Common causes: missing `.env`, missing `requirements.txt`, or a Python
version mismatch (the venv must use Python 3.11+).
