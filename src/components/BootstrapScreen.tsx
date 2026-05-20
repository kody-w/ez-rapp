import type { BootstrapState, InstallerKind } from "@shared/ipc-contract";
import { type ReactElement } from "react";

const STEP_LABEL: Record<BootstrapState["step"], string> = {
  "checking":             "Checking your setup",
  "needs-install":        "First-time setup",
  "needs-platform-pick":  "Pick your platform",
  "installing-python":    "Installing Python",
  "cloning-repo":         "Downloading the brainstem",
  "creating-venv":        "Creating a Python environment",
  "installing-deps":      "Installing dependencies",
  "starting":             "Starting the brainstem",
  "ready":                "Ready",
  "error":                "Something went wrong",
};

export function BootstrapScreen({ state, onInstall }: { state: BootstrapState; onInstall: (kind?: InstallerKind) => void }): ReactElement {
  const busy = state.step !== "needs-install"
    && state.step !== "needs-platform-pick"
    && state.step !== "error"
    && state.step !== "ready";

  return (
    <div className="h-screen w-screen flex flex-col">
      <div className="h-10 drag-region bg-surface-0 border-b border-line-subtle" />
      <div className="flex-1 flex items-center justify-center px-8">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">ez-rapp</h1>
            <p className="text-ink-2 text-sm">Plain-English AI on your laptop. No terminal. No API keys.</p>
          </div>

          <div className="bg-surface-1 border border-line-subtle rounded-xl px-5 py-6 text-left space-y-3">
            <div className="flex items-center gap-3">
              {busy && (
                <span className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin shrink-0" />
              )}
              <div>
                <div className="text-ink-0 text-sm font-medium">{STEP_LABEL[state.step]}</div>
                <div className="text-ink-3 text-xs">{state.message}</div>
              </div>
            </div>
            {state.detail && (
              <div className="text-ink-3 text-[11px] break-words border-t border-line-subtle pt-2">
                {state.detail}
              </div>
            )}
            {state.error && state.step !== "needs-platform-pick" && (
              <div className="text-rose-400 text-xs border-t border-line-subtle pt-2">{state.error}</div>
            )}
          </div>

          {state.step === "needs-platform-pick" && state.options && (
            <div className="space-y-2">
              {state.options.map((opt) => (
                <button
                  key={opt.kind}
                  onClick={() => onInstall(opt.kind)}
                  className="w-full px-4 py-3 bg-surface-2 hover:bg-surface-3 border border-line-base hover:border-accent rounded-lg text-left transition-colors group"
                >
                  <div className="text-ink-0 text-sm font-medium group-hover:text-accent transition-colors">{opt.label}</div>
                  <div className="text-ink-3 text-[11px] mt-0.5">{opt.hint}</div>
                </button>
              ))}
              <p className="text-ink-3 text-[10px] pt-1">
                Not sure? macOS or Linux uses bash; Windows uses PowerShell.
              </p>
            </div>
          )}

          {state.step === "needs-install" && (
            <button
              onClick={() => onInstall()}
              className="w-full px-4 py-2.5 bg-accent hover:bg-accent-hover rounded-lg text-white text-sm font-medium transition-colors"
            >
              Install (1–2 minutes)
            </button>
          )}
          {state.step === "error" && (
            <div className="space-y-2">
              <div className="text-rose-400 text-xs text-left bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2 break-words">
                {state.error}
              </div>
              <button
                onClick={() => onInstall()}
                className="w-full px-4 py-2.5 bg-accent hover:bg-accent-hover rounded-lg text-white text-sm font-medium transition-colors"
              >
                Try again
              </button>
              <button
                onClick={() => void window.ezrapp.bootstrap.reopenPicker()}
                className="w-full px-4 py-2 bg-surface-2 hover:bg-surface-3 border border-line-base rounded-lg text-ink-1 text-xs font-medium transition-colors"
              >
                Pick a different platform
              </button>
            </div>
          )}
          <p className="text-ink-3 text-[11px]">
            ez-rapp uses your GitHub Copilot subscription — no separate API key. After install you sign in with one click.
          </p>
        </div>
      </div>
    </div>
  );
}
