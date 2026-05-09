import { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { AGENT_WS_URL } from "../config";
import { ChatOutbound } from "../types";
import { DisplayMessage } from "../components/ChatMessage";

const SESSION_KEY = "insureco-chat-session";

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return uuidv4();
  const existing = window.localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const fresh = uuidv4();
  try {
    window.localStorage.setItem(SESSION_KEY, fresh);
  } catch {
    // ignore
  }
  return fresh;
}

export type ChatStatus =
  | "idle"
  | "connecting"
  | "open"
  | "thinking"
  | "closed"
  | "error";

export interface UseAgentChatResult {
  messages: DisplayMessage[];
  status: ChatStatus;
  sendMessage: (text: string) => void;
  sessionId: string;
  reconnect: () => void;
}

export function useAgentChat(enabled: boolean): UseAgentChatResult {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const sessionIdRef = useRef<string>(getOrCreateSessionId());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptedRef = useRef<boolean>(false);
  const manuallyClosedRef = useRef<boolean>(false);

  const appendMessage = useCallback((msg: DisplayMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const handleIncoming = useCallback(
    (raw: string) => {
      let parsed: ChatOutbound;
      try {
        parsed = JSON.parse(raw) as ChatOutbound;
      } catch {
        appendMessage({
          kind: "error",
          id: uuidv4(),
          message: "Received malformed message from agent.",
        });
        return;
      }

      switch (parsed.type) {
        case "assistant_message":
          appendMessage({
            kind: "assistant",
            id: uuidv4(),
            agent: parsed.agent,
            content: parsed.content,
          });
          break;
        case "agent_handoff":
          appendMessage({
            kind: "handoff",
            id: uuidv4(),
            from: parsed.from,
            to: parsed.to,
          });
          break;
        case "tool_call":
          appendMessage({
            kind: "tool",
            id: uuidv4(),
            agent: parsed.agent,
            tool: parsed.tool,
            args: parsed.args,
          });
          break;
        case "tool_result": {
          // Capture narrowed fields before entering the setState closure;
          // TypeScript widens `parsed` back to the union inside the callback.
          const { agent, tool, result } = parsed;
          setMessages((prev) => {
            const next = [...prev];
            for (let i = next.length - 1; i >= 0; i -= 1) {
              const m = next[i];
              if (
                m.kind === "tool" &&
                m.agent === agent &&
                m.tool === tool &&
                m.result === undefined
              ) {
                next[i] = { ...m, result };
                return next;
              }
            }
            next.push({
              kind: "tool",
              id: uuidv4(),
              agent,
              tool,
              args: {},
              result,
            });
            return next;
          });
          break;
        }
        case "done":
          setStatus("open");
          break;
        case "error":
          appendMessage({
            kind: "error",
            id: uuidv4(),
            message: parsed.message,
          });
          setStatus("open");
          break;
        default:
          // exhaustive guard
          break;
      }
    },
    [appendMessage]
  );

  const connect = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
    }

    setStatus("connecting");
    const url = `${AGENT_WS_URL}/chat?session_id=${encodeURIComponent(
      sessionIdRef.current
    )}`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      setStatus("error");
      appendMessage({
        kind: "error",
        id: uuidv4(),
        message: "Failed to open chat connection.",
      });
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptedRef.current = false;
      setStatus("open");
    };
    ws.onmessage = (event: MessageEvent<string>) => {
      handleIncoming(event.data);
    };
    ws.onerror = () => {
      setStatus("error");
    };
    ws.onclose = () => {
      if (manuallyClosedRef.current) {
        setStatus("closed");
        return;
      }
      if (!reconnectAttemptedRef.current) {
        reconnectAttemptedRef.current = true;
        setTimeout(() => {
          if (!manuallyClosedRef.current) {
            connect();
          }
        }, 800);
      } else {
        setStatus("error");
        appendMessage({
          kind: "error",
          id: uuidv4(),
          message:
            "Lost connection to the agent. Please refresh to try again.",
        });
      }
    };
  }, [appendMessage, handleIncoming]);

  useEffect(() => {
    if (!enabled) return;
    manuallyClosedRef.current = false;
    connect();
    return () => {
      manuallyClosedRef.current = true;
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          // ignore
        }
      }
    };
  }, [enabled, connect]);

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        appendMessage({
          kind: "error",
          id: uuidv4(),
          message: "Chat is not connected yet. Please wait a moment.",
        });
        return;
      }
      appendMessage({ kind: "user", id: uuidv4(), content: trimmed });
      setStatus("thinking");
      ws.send(JSON.stringify({ type: "user_message", content: trimmed }));
    },
    [appendMessage]
  );

  const reconnect = useCallback(() => {
    reconnectAttemptedRef.current = false;
    manuallyClosedRef.current = false;
    connect();
  }, [connect]);

  return {
    messages,
    status,
    sendMessage,
    sessionId: sessionIdRef.current,
    reconnect,
  };
}
