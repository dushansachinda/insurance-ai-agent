import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { ChevronDown, ChevronRight, Wrench } from "lucide-react";

export type DisplayMessage =
  | { kind: "user"; id: string; content: string }
  | { kind: "assistant"; id: string; agent: string; content: string }
  | { kind: "handoff"; id: string; from: string; to: string }
  | {
      kind: "tool";
      id: string;
      agent: string;
      tool: string;
      args: Record<string, unknown>;
      result?: string;
    }
  | { kind: "error"; id: string; message: string };

const ChatMessage: React.FC<{ message: DisplayMessage }> = ({ message }) => {
  const [open, setOpen] = useState(false);

  if (message.kind === "user") {
    return (
      <div className="flex justify-end">
        <div className="bg-brand-600 text-white rounded-2xl rounded-br-sm px-4 py-2 max-w-[85%] text-sm whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }

  if (message.kind === "assistant") {
    return (
      <div className="flex flex-col items-start max-w-[90%]">
        <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">
          {message.agent}
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-2 text-sm text-slate-800 prose prose-sm max-w-none">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
      </div>
    );
  }

  if (message.kind === "handoff") {
    return (
      <div className="text-center text-xs italic text-slate-500 py-1">
        Handing off from <span className="font-medium">{message.from}</span> to{" "}
        <span className="font-medium">{message.to}</span>
      </div>
    );
  }

  if (message.kind === "tool") {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs">
        <button
          type="button"
          className="flex items-center gap-2 w-full text-left text-slate-600 hover:text-slate-900"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
          <Wrench className="w-3.5 h-3.5 text-brand-600" />
          <span className="font-medium">{message.agent}</span>
          <span className="text-slate-400">called</span>
          <span className="font-mono text-slate-700">{message.tool}</span>
        </button>
        {open && (
          <div className="mt-2 space-y-2">
            <div>
              <div className="text-slate-500 mb-1">Arguments</div>
              <pre className="bg-white border border-slate-200 rounded p-2 overflow-x-auto text-[11px]">
                {JSON.stringify(message.args, null, 2)}
              </pre>
            </div>
            {message.result !== undefined && (
              <div>
                <div className="text-slate-500 mb-1">Result</div>
                <pre className="bg-white border border-slate-200 rounded p-2 overflow-x-auto text-[11px] whitespace-pre-wrap">
                  {message.result}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // error
  return (
    <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2 text-sm">
      {message.message}
    </div>
  );
};

export default ChatMessage;
