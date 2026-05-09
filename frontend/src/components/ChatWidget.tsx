import React, { useEffect, useRef, useState } from "react";
import { MessageSquare, X, Send, Loader2 } from "lucide-react";
import { useAgentChat } from "../hooks/useAgentChat";
import ChatMessage from "./ChatMessage";

const ChatWidget: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const { messages, status, sendMessage } = useAgentChat(open);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages, status]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    sendMessage(draft);
    setDraft("");
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          aria-label="Open chat"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white rounded-full px-5 py-3 shadow-lg shadow-brand-600/30 transition"
        >
          <MessageSquare className="w-5 h-5" />
          <span className="font-medium">Ask the agent</span>
        </button>
      )}

      {open && (
        <div className="fixed bottom-0 right-0 sm:bottom-6 sm:right-6 z-40 w-full sm:w-[400px] h-[80vh] sm:h-[600px] sm:rounded-2xl bg-white border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-brand-600 text-white">
                <MessageSquare className="w-4 h-4" />
              </span>
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Demo Insurance Corp Assistant
                </div>
                <div className="text-[11px] text-slate-500 capitalize">
                  {status === "thinking" ? "thinking..." : status}
                </div>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close chat"
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div
            ref={scrollerRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50"
          >
            {messages.length === 0 && status !== "connecting" && (
              <div className="text-center text-sm text-slate-500 mt-12">
                <p className="font-medium text-slate-700">
                  Hi! I am the Demo Insurance Corp agent.
                </p>
                <p className="mt-1">
                  Ask about your policies, file a claim, or get a quote.
                </p>
              </div>
            )}
            {status === "connecting" && messages.length === 0 && (
              <div className="text-center text-sm text-slate-500 mt-12 inline-flex items-center justify-center gap-2 w-full">
                <Loader2 className="w-4 h-4 animate-spin" /> Connecting...
              </div>
            )}
            {messages.map((m) => (
              <ChatMessage key={m.id} message={m} />
            ))}
            {status === "thinking" && (
              <div className="flex items-center gap-2 text-xs text-slate-500 italic">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> thinking...
              </div>
            )}
          </div>

          <form
            onSubmit={onSubmit}
            className="border-t border-slate-200 p-3 flex items-center gap-2 bg-white"
          >
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 border border-slate-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              disabled={status === "connecting" || status === "error"}
            />
            <button
              type="submit"
              disabled={
                !draft.trim() || status === "connecting" || status === "error"
              }
              className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-brand-600 text-white hover:bg-brand-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
              aria-label="Send"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default ChatWidget;
