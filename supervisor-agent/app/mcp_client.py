"""MCP client for the external credit-check service.

Uses the official `mcp` SDK over streamable HTTP. The session is opened lazily
on first use and protected by an asyncio lock so concurrent tool invocations
don't race during initialization.
"""

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
    """Open the MCP session if not already open. Returns the ClientSession."""
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
            raise RuntimeError(
                "The 'mcp' SDK is not installed. Add `mcp>=1.2.0` to requirements."
            ) from e

        logger.info(f"[mcp_client] Connecting to MCP server: {MCP_CREDIT_CHECK_URL}")
        stack = AsyncExitStack()
        try:
            transport = await stack.enter_async_context(
                streamablehttp_client(MCP_CREDIT_CHECK_URL)
            )
            # streamablehttp_client yields (read_stream, write_stream, ...) -
            # tuple length varies by SDK version; first two are always the streams.
            read_stream, write_stream = transport[0], transport[1]
            session = await stack.enter_async_context(
                ClientSession(read_stream, write_stream)
            )
            await session.initialize()
            _session = session
            _exit_stack = stack
            logger.info("[mcp_client] MCP session initialized")
            return _session
        except Exception:
            await stack.aclose()
            raise


def _extract_payload(result: Any) -> dict:
    """Normalize an MCP CallToolResult into a plain dict for the LLM."""
    # Most SDK versions: result.content is a list of ContentBlock; for text
    # blocks the JSON is in `.text`.
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
    """Run a credit check via the external MCP credit bureau service.

    Args:
        customer_id: The InsureCo customer_id (e.g. 'CUST-0001').
        ssn_last4: Last 4 digits of SSN, used to verify identity at the bureau.

    Returns a dict with at least `score`, `risk_tier`, and `decision`.
    """
    session = await _ensure_session()
    try:
        result = await session.call_tool(
            "credit_check",
            arguments={"customer_id": customer_id, "ssn_last4": ssn_last4},
        )
        return _extract_payload(result)
    except Exception as e:
        logger.error(f"[mcp_client] credit_check failed: {type(e).__name__}: {e}")
        # Reset session so the next call can reconnect.
        await _close_session()
        raise


async def _close_session() -> None:
    global _session, _exit_stack
    if _exit_stack is not None:
        try:
            await _exit_stack.aclose()
        except Exception as e:
            logger.warning(f"[mcp_client] Error closing MCP session: {e}")
    _session = None
    _exit_stack = None
