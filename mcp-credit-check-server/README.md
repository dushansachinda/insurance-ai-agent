# mcp-credit-check-server

A local **dummy** MCP (Model Context Protocol) server that exposes a single
`credit_check` tool for the insurance AI agent demo. Output is canned but
deterministic for the same `(customer_id, ssn_last4)` input.

## What it is

- A Python MCP server built with the official `mcp` SDK (`FastMCP`).
- Exposes one tool: `credit_check(customer_id: str, ssn_last4: str) -> dict`.
- Transport: **streamable-http**, mounted at `/mcp`.
- Default port: `8003`.

## Run locally

```bash
pip install -r requirements.txt
python server.py
```

## Run via Docker

```bash
docker build -t mcp-credit-check-server .
docker run --rm -p 8003:8003 mcp-credit-check-server
```

In a docker-compose network, other services can reach it at
`http://mcp-credit-check:8003/mcp`.

## MCP endpoint

```
http://localhost:8003/mcp
```

## Tool signature

```python
credit_check(customer_id: str, ssn_last4: str) -> dict
```

Returns a dict with `customer_id`, `score` (500-820), `status`
(`approved` / `review` / `declined`), `risk_tier`, `checked_at`, and
`provider`.

## Configuration

See `.env.example`:

- `MCP_PORT` (default `8003`)
- `LOG_LEVEL` (default `info`)

## Warning

This is a **dummy** server. The score is derived from a SHA-256 hash of the
inputs. **Never use this in real underwriting** or any production decisioning.
