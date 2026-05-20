import { useEffect, useState, type ReactElement } from "react";

export function LoginGate({ onSignedIn }: { onSignedIn: () => void | Promise<void> }): ReactElement {
  const [phase, setPhase] = useState<"idle" | "starting" | "pending" | "error">("idle");
  const [userCode, setUserCode] = useState<string>("");
  const [verifyUri, setVerifyUri] = useState<string>("");
  const [error, setError] = useState<string>("");

  const start = async (): Promise<void> => {
    setPhase("starting");
    setError("");
    const r = await window.ezrapp.brainstem.loginStart();
    if (!r.ok) { setPhase("error"); setError(r.error); return; }
    setUserCode(r.userCode);
    setVerifyUri(r.verificationUri);
    setPhase("pending");
    void window.ezrapp.brainstem.openExternal(r.verificationUri);
  };

  useEffect(() => {
    if (phase !== "pending") return;
    let cancelled = false;
    const tick = async (): Promise<void> => {
      if (cancelled) return;
      const r = await window.ezrapp.brainstem.loginPoll();
      if (cancelled) return;
      if (r.status === "ok") { await onSignedIn(); return; }
      if (r.status === "expired" || r.status === "error") {
        setPhase("error");
        setError(r.error);
        return;
      }
    };
    const t = setInterval(tick, 2_500);
    return () => { cancelled = true; clearInterval(t); };
  }, [phase, onSignedIn]);

  return (
    <div className="h-screen w-screen flex flex-col">
      <div className="h-10 drag-region bg-surface-0 border-b border-line-subtle" />
      <div className="flex-1 flex items-center justify-center px-8">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">Sign in with GitHub</h1>
            <p className="text-ink-2 text-sm">Your GitHub Copilot subscription powers the chat. No separate API key.</p>
          </div>

          {phase === "idle" && (
            <button onClick={() => void start()} className="w-full px-4 py-2.5 bg-accent hover:bg-accent-hover rounded-lg text-white text-sm font-medium transition-colors">
              Sign in
            </button>
          )}

          {phase === "starting" && (
            <div className="text-ink-2 text-sm flex items-center justify-center gap-3">
              <span className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
              <span>Connecting to GitHub…</span>
            </div>
          )}

          {phase === "pending" && (
            <div className="bg-surface-1 border border-line-subtle rounded-xl p-5 space-y-3">
              <p className="text-ink-2 text-sm">A browser tab just opened. Paste this code into GitHub:</p>
              <div className="text-3xl font-mono tracking-[0.4em] text-accent bg-surface-2 border border-line-base rounded-lg py-3">
                {userCode}
              </div>
              <div className="text-ink-3 text-[11px]">
                Or open it manually: <a className="text-accent hover:underline" onClick={() => void window.ezrapp.brainstem.openExternal(verifyUri)}>{verifyUri}</a>
              </div>
              <div className="text-ink-3 text-[11px]">Waiting for you to confirm in GitHub…</div>
            </div>
          )}

          {phase === "error" && (
            <div className="space-y-3">
              <div className="text-rose-400 text-sm">{error || "Sign-in didn't complete."}</div>
              <button onClick={() => void start()} className="w-full px-4 py-2.5 bg-surface-2 hover:bg-surface-3 border border-line-base rounded-lg text-ink-0 text-sm font-medium transition-colors">
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
