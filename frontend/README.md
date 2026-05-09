# Demo Insurance Corp Frontend

React 18 + TypeScript + Tailwind CSS frontend for the Demo Insurance Corp AI Agent demo.

## Quick Start

```bash
npm install
npm start
```

The app runs on http://localhost:3000 and proxies API requests to http://localhost:8001.

## Environment Variables

Copy `.env.example` to `.env` and adjust as needed.

| Variable | Default | Description |
| --- | --- | --- |
| `REACT_APP_API_BASE_URL` | `http://localhost:8001` | Insurance backend REST API |
| `REACT_APP_AGENT_WS_URL` | `ws://localhost:8000` | Supervisor agent WebSocket endpoint |

## Demo Customer Selection

There is no authentication. A demo customer is selected from a dropdown in the
header (Alice / Bob / Carol) and persisted to `localStorage` under the key
`insureco-demo-customer`.

## Structure

- `src/api/client.ts` — typed axios client for backend REST API
- `src/contexts/DemoCustomerContext.tsx` — selected customer state
- `src/components/ChatWidget.tsx` — floating chat widget connecting via WS to the supervisor agent
- `src/pages/` — route-level pages (Home, Policies, Apply, Claims, KB)

## Docker

```bash
docker build -t insureco-frontend .
docker run -p 3000:3000 insureco-frontend
```
