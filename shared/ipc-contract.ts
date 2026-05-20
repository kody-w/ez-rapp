/**
 * IPC surface between the main process and the renderer.
 *
 * ez-rapp is intentionally tiny: bootstrap → auth → chat. Nothing else.
 * Every method that talks to the brainstem points at the canonical
 * install location at ~/.brainstem/ — the rapp-installer's output is
 * sacred and ez-rapp only reads from it.
 */

export type BootstrapStep =
  | "checking"             // is ~/.brainstem/ there?
  | "needs-install"        // we have to run the installer (auto-detected OS)
  | "needs-platform-pick"  // auto-detect failed; user picks which one-liner to run
  | "installing-python"    // installer is fetching python
  | "cloning-repo"         // installer is cloning rapp-installer
  | "creating-venv"        // installer is making the venv
  | "installing-deps"      // pip install -r requirements.txt
  | "starting"             // launching brainstem.py
  | "ready"                // brainstem is responding on 7071
  | "error";               // anything went wrong

/**
 * The two installer paths the rapp-installer publishes. macOS and Linux
 * share install.sh; Windows uses install.ps1. ez-rapp picks one based
 * on process.platform — if that detection fails the user picks manually.
 */
export type InstallerKind = "posix" | "windows";

export interface BootstrapState {
  step: BootstrapStep;
  message: string;
  detail?: string;
  error?: string;
  /** When step is "needs-platform-pick", which platforms the user can choose. */
  options?: Array<{ kind: InstallerKind; label: string; hint: string }>;
}

export type HealthResult =
  | { ok: true; model?: string; agents?: number; authStatus?: "authenticated" | "unauthenticated" }
  | { ok: false; error: string };

export type LoginStart =
  | { ok: true; userCode: string; verificationUri: string }
  | { ok: false; error: string };

export type LoginPoll =
  | { status: "pending" }
  | { status: "ok"; username?: string }
  | { status: "expired"; error: string }
  | { status: "error"; error: string };

export interface ChatTurn {
  role: "user" | "assistant" | "system";
  content: string;
  name?: string;
}

export interface ChatRequest {
  user_input: string;
  conversation_history?: ChatTurn[];
}

export interface ChatResponse {
  response: string;
  session_id?: string;
}

export type SendPhase = "resolving" | "delivered" | "typing" | "read" | "failed";

export interface SendStatusEvent {
  phase: SendPhase;
  error?: string;
}

export interface EzRappBridge {
  bootstrap: {
    status: () => Promise<BootstrapState>;
    onChange: (cb: (s: BootstrapState) => void) => () => void;
    /**
     * Kick off the install flow if needed. Idempotent. Pass `kind` to force
     * the POSIX (bash) or Windows (PowerShell) installer — used when auto-
     * detection failed and the user manually picked their platform.
     */
    install: (kind?: InstallerKind) => Promise<{ ok: boolean; error?: string }>;
    /**
     * Best-effort guess at the right installer to run on this hardware,
     * if we can guess. Renderer falls back to a picker if this returns null.
     */
    detectKind: () => Promise<InstallerKind | null>;
    /** Re-open the platform picker (e.g. after a wrong-platform spawn error). */
    reopenPicker: () => Promise<void>;
  };
  brainstem: {
    health: () => Promise<HealthResult>;
    loginStart: () => Promise<LoginStart>;
    loginPoll: () => Promise<LoginPoll>;
    chat: (req: ChatRequest) => Promise<ChatResponse>;
    openExternal: (url: string) => Promise<void>;
  };
  thread: {
    /** Local persistence of the chat for live re-render. */
    get: () => Promise<ChatTurn[]>;
    send: (text: string) => Promise<{ ok: boolean; error?: string }>;
    clear: () => Promise<void>;
    onUpdate: (cb: (turns: ChatTurn[]) => void) => () => void;
    onSendStatus: (cb: (e: SendStatusEvent) => void) => () => void;
  };
}

declare global {
  interface Window { ezrapp: EzRappBridge }
}
