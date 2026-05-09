"""FastAPI WebSocket service for the WSO2 InsureCo supervisor agent.

Each session_id maps to a long-lived AutoGen Swarm team. Inbound user messages
are run through `team.run_stream(...)` and the resulting events are translated
into structured JSON messages on the WebSocket.
"""

import logging
import os
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket
from starlette.websockets import WebSocketDisconnect

from app.agents import build_agent

load_dotenv()

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="WSO2 InsureCo Supervisor Agent")


class _Session:
    """Per-session agent state."""

    def __init__(self) -> None:
        self.agent = build_agent()


# session_id -> _Session
_sessions: dict[str, _Session] = {}

# Truncate tool result payloads sent to the UI so we don't flood the channel.
TOOL_RESULT_MAX_CHARS = 500


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


def _truncate(text: str, limit: int = TOOL_RESULT_MAX_CHARS) -> str:
    if text is None:
        return ""
    s = str(text)
    if len(s) <= limit:
        return s
    return s[: limit - 3] + "..."


def _get_session(session_id: str) -> _Session:
    sess = _sessions.get(session_id)
    if sess is None:
        logger.info(f"[service] Building new team for session_id={session_id}")
        sess = _Session()
        _sessions[session_id] = sess
    return sess


async def _safe_send(websocket: WebSocket, payload: dict) -> None:
    try:
        await websocket.send_json(payload)
    except Exception as e:
        logger.warning(f"[service] Failed to send WS message: {e}")


def _translate_event(event: Any) -> list[dict]:
    """Convert an AutoGen stream event into one or more outbound WS messages."""
    # Lazy imports so module import doesn't fail if internals shift.
    try:
        from autogen_agentchat.base import TaskResult
        from autogen_agentchat.messages import (
            HandoffMessage,
            TextMessage,
            ToolCallExecutionEvent,
            ToolCallRequestEvent,
        )
    except ImportError:
        TaskResult = type(None)  # type: ignore
        TextMessage = HandoffMessage = ToolCallRequestEvent = ToolCallExecutionEvent = type(None)  # type: ignore

    msgs: list[dict] = []

    # Final task result -> done marker.
    if isinstance(event, TaskResult):
        msgs.append({"type": "done"})
        return msgs

    if isinstance(event, HandoffMessage):
        msgs.append(
            {
                "type": "agent_handoff",
                "from": getattr(event, "source", ""),
                "to": getattr(event, "target", ""),
            }
        )
        return msgs

    if isinstance(event, ToolCallRequestEvent):
        for call in getattr(event, "content", []) or []:
            args = getattr(call, "arguments", None)
            # arguments are typically a JSON-serialized string; pass through as-is
            # if we can't parse, the UI can still display it.
            if isinstance(args, str):
                import json

                try:
                    args = json.loads(args)
                except json.JSONDecodeError:
                    pass
            msgs.append(
                {
                    "type": "tool_call",
                    "agent": getattr(event, "source", ""),
                    "tool": getattr(call, "name", ""),
                    "args": args,
                }
            )
        return msgs

    if isinstance(event, ToolCallExecutionEvent):
        for res in getattr(event, "content", []) or []:
            content = getattr(res, "content", "")
            msgs.append(
                {
                    "type": "tool_result",
                    "agent": getattr(event, "source", ""),
                    "tool": getattr(res, "name", ""),
                    "result": _truncate(content),
                }
            )
        return msgs

    if isinstance(event, TextMessage):
        source = getattr(event, "source", "")
        if source == "user":
            return msgs  # don't echo the user
        content = getattr(event, "content", "")
        if not content or not str(content).strip():
            return msgs  # drop empty assistant messages (LLM glitches, reflection no-ops)
        msgs.append(
            {
                "type": "assistant_message",
                "agent": source,
                "content": content,
            }
        )
        return msgs

    return msgs


async def _run_turn(sess: _Session, user_message: str, websocket: WebSocket) -> None:
    """Stream a single user turn through the team and forward events."""
    try:
        stream = sess.agent.run_stream(task=user_message)
    except Exception as e:
        logger.exception("[service] Failed to start team.run_stream")
        await _safe_send(websocket, {"type": "error", "message": str(e)})
        return

    sent_done = False
    try:
        async for event in stream:
            try:
                outbound = _translate_event(event)
            except Exception as e:
                logger.exception("[service] Failed to translate event")
                await _safe_send(websocket, {"type": "error", "message": f"event translation failed: {e}"})
                continue

            for payload in outbound:
                if payload.get("type") == "done":
                    sent_done = True
                await _safe_send(websocket, payload)
    except Exception as e:
        logger.exception("[service] Error while streaming team events")
        await _safe_send(websocket, {"type": "error", "message": str(e)})

    if not sent_done:
        await _safe_send(websocket, {"type": "done"})


@app.websocket("/chat")
async def chat_endpoint(websocket: WebSocket, session_id: str) -> None:
    """Bidirectional chat WebSocket.

    Query parameter `session_id` identifies the conversation; a fresh team is
    built on first connect and reused on subsequent messages.
    """
    await websocket.accept()
    logger.info(f"[service] WS connected session_id={session_id}")

    try:
        sess = _get_session(session_id)
    except Exception as e:
        logger.exception("[service] Failed to build team")
        await _safe_send(websocket, {"type": "error", "message": f"failed to build team: {e}"})
        await websocket.close()
        return

    try:
        while True:
            try:
                msg = await websocket.receive_json()
            except WebSocketDisconnect:
                raise
            except Exception as e:
                logger.warning(f"[service] Invalid WS payload: {e}")
                await _safe_send(websocket, {"type": "error", "message": f"invalid payload: {e}"})
                continue

            if not isinstance(msg, dict):
                await _safe_send(websocket, {"type": "error", "message": "expected JSON object"})
                continue

            mtype = msg.get("type")
            if mtype != "user_message":
                await _safe_send(
                    websocket,
                    {"type": "error", "message": f"unsupported message type: {mtype!r}"},
                )
                continue

            content = (msg.get("content") or "").strip()
            if not content:
                await _safe_send(websocket, {"type": "error", "message": "empty content"})
                continue

            await _run_turn(sess, content, websocket)
    except WebSocketDisconnect:
        logger.info(f"[service] WS disconnected session_id={session_id}")
    except Exception as e:
        logger.exception("[service] Unexpected error in WS loop")
        await _safe_send(websocket, {"type": "error", "message": str(e)})
        try:
            await websocket.close()
        except Exception:
            pass
