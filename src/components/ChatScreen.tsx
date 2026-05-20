import { useEffect, useState, useRef, useCallback, type FormEvent, type ReactElement } from "react";
import type { ChatTurn, HealthResult, SendPhase } from "@shared/ipc-contract";

export function ChatScreen({ health }: { health: HealthResult }): ReactElement {
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [sendPhase, setSendPhase] = useState<SendPhase | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async (): Promise<void> => {
    setMessages(await window.ezrapp.thread.get());
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => window.ezrapp.thread.onUpdate(setMessages), []);
  useEffect(() => window.ezrapp.thread.onSendStatus((e) => setSendPhase(e.phase)), []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, sendPhase]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [draft]);

  const submit = async (e?: FormEvent): Promise<void> => {
    e?.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    setSendPhase("resolving");
    await window.ezrapp.thread.send(text);
  };

  const showThinking = sendPhase === "typing";
  const empty = messages.length === 0;

  const authed = health.ok && health.authStatus !== "unauthenticated";

  return (
    <div className="h-screen w-screen flex flex-col bg-surface-0 text-ink-0">
      <header className="h-10 drag-region flex items-center bg-surface-0 border-b border-line-subtle pr-3 relative">
        <div className="flex-1 min-w-0 pl-[80px] flex items-center gap-2">
          <span className="text-ink-2 text-[12px] tracking-wide font-medium">ez-rapp</span>
          {health.ok && (
            <span className="text-ink-3 text-[11px]">· brainstem ready</span>
          )}
        </div>
        <div className="no-drag flex items-center gap-2">
          <span className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded border ${
            !health.ok ? "text-ink-2 border-line-subtle bg-surface-1"
              : !authed ? "text-amber-200 border-amber-900/40 bg-amber-900/20"
              : "text-ink-1 border-line-subtle bg-surface-1"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${!health.ok ? "bg-rose-500/80" : !authed ? "bg-amber-400" : "bg-emerald-500/90"}`} />
            <span>{!health.ok ? "offline" : !authed ? "sign in" : "connected"}</span>
          </span>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
        {empty ? (
          <div className="h-full flex flex-col items-center justify-center px-6">
            <div className="max-w-2xl w-full text-center space-y-6">
              <h2 className="text-2xl font-medium">How can I help today?</h2>
              <p className="text-ink-2 text-sm">
                Ask anything. I'm running locally on your laptop, powered by your GitHub Copilot subscription.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {["What can you do?", "Remember my name", "Get my latest news"].map((p) => (
                  <button
                    key={p}
                    onClick={() => { setDraft(p); textareaRef.current?.focus(); }}
                    className="px-3 py-1.5 bg-accent-soft border border-accent/30 hover:bg-accent/30 rounded-full text-sm text-ink-0 transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
            {messages.map((m, i) => <Bubble key={i} turn={m} />)}
            {showThinking && <ThinkingBubble />}
          </div>
        )}
      </div>

      <form onSubmit={(e) => void submit(e)} className="px-6 pb-4 pt-2 no-drag">
        <div className="max-w-3xl mx-auto bg-surface-2 border border-line-base rounded-2xl px-3 py-2 flex items-end gap-2 focus-within:border-accent transition-colors">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submit(); }
            }}
            placeholder={!health.ok ? "Brainstem starting…" : "Message the brainstem"}
            disabled={!health.ok}
            rows={1}
            className="flex-1 bg-transparent text-ink-0 placeholder:text-ink-3 text-sm resize-none focus:outline-none py-1.5 max-h-[220px]"
          />
          <button
            type="submit"
            disabled={!health.ok || !draft.trim()}
            className="shrink-0 h-8 px-4 rounded-full flex items-center justify-center bg-accent text-white hover:bg-accent-hover disabled:bg-surface-3 disabled:text-ink-3 transition-colors text-sm font-medium"
          >
            Send
          </button>
        </div>
        <p className="max-w-3xl mx-auto text-ink-3 text-[11px] mt-1.5 pl-1">
          Enter to send · Shift+Enter for newline
        </p>
      </form>
    </div>
  );
}

function Bubble({ turn }: { turn: ChatTurn }): ReactElement {
  const isUser = turn.role === "user";
  if (turn.role === "system") {
    return <div className="text-center text-ink-3 text-[12px] italic">{turn.content}</div>;
  }
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium ${
        isUser ? "bg-accent text-white" : "bg-surface-3 text-ink-1"
      }`}>
        {isUser ? "You" : "AI"}
      </div>
      <div className={`flex-1 min-w-0 ${isUser ? "text-right" : ""}`}>
        <div className={`inline-block max-w-full text-sm leading-relaxed whitespace-pre-wrap text-left ${
          isUser
            ? "bg-accent-soft border border-accent/30 px-3.5 py-2 rounded-2xl rounded-tr-md"
            : ""
        }`}>
          {turn.content}
        </div>
      </div>
    </div>
  );
}

function ThinkingBubble(): ReactElement {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] bg-surface-3 text-ink-1">AI</div>
      <div className="flex items-center gap-1 px-3 py-2 bg-surface-2 rounded-2xl rounded-tl-md">
        <span className="w-1.5 h-1.5 rounded-full bg-ink-3 animate-pulse" style={{ animationDelay: "0ms" }} />
        <span className="w-1.5 h-1.5 rounded-full bg-ink-3 animate-pulse" style={{ animationDelay: "150ms" }} />
        <span className="w-1.5 h-1.5 rounded-full bg-ink-3 animate-pulse" style={{ animationDelay: "300ms" }} />
      </div>
    </div>
  );
}
