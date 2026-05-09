"""MCP client for the credit-check service (underwriting-agent copy)."""

import asyncio
import json
import logging
import os
from contextlib import AsyncExitStack
from typing import Any

logger = logging.getLogger(__name__)

MCP_CREDIT_CHECK_URL = os.getenv("MCP_CREDIT_CHECK_URL", "http://mcp-credit-check:8003/mcp")

_session = None
_exit_stack: AsyncExitStack | None = None
_lock = asyncio.Lock()


async def _ensure_session():
    global _session, _exit_stack
    if _session is not None:
        return _session
    async with _lock:
        if _session is not None:
            return _session
        try:
            from mcp import ClientSession
            from mcp.client.streamable_http import streamablehttp_client
        except ImportError as e:
            raise RuntimeError("mcp SDK not installed") from e

        logger.info(f"[uw/mcp_client] Connecting to {MCP_CREDIT_CHECK_URL}")
        stack = AsyncExitStack()
        try:
            transport = await stack.enter_async_context(streamablehttp_client(MCP_CREDIT_CHECK_URL))
            read_stream, write_stream = transport[0], transport[1]
            session = await stack.enter_async_context(ClientSession(read_stream, write_stream))
            await session.initialize()
            _session = session
            _exit_stack = stack
            logger.info("[uw/mcp_client] MCP session ready")
            return _session
        except Exception:
            await stack.aclose()
            raise


def _extract_payload(result: Any) -> dict:
    content = getattr(result, "content", None)
    if content:
        for block in content:
            text = getattr(block, "text", None)
            if text:
                try:
                    return json.loads(text)
                except json.JSONDecodeError:
                    return {"text": text}
    structured = getattr(result, "structuredContent", None) or getattr(result, "structured_content", None)
    if structured:
        return structured if isinstance(structured, dict) else {"value": structured}
    return {"raw": str(result)}


async def credit_check(customer_id: str, ssn_last4: str) -> dict:
    """Run credit check via the MCP bureau aggregator."""
    session = await _ensure_session()
    try:
        result = await session.call_tool("credit_check", arguments={"customer_id": customer_id, "ssn_last4": ssn_last4})
        return _extract_payload(result)
    except Exception as e:
        logger.error(f"[uw/mcp_client] credit_check failed: {e}")
        global _exit_stack
        if _exit_stack:
            try:
                await _exit_stack.aclose()
            except Exception:
                pass
        _session = None
        _exit_stack = None
        raise
