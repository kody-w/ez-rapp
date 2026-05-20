/**
 * IPC surface between the main process and the renderer.
 *
 * ez-rapp is intentionally tiny: bootstrap → auth → chat. Nothing else.
 * Every method that talks to the brainstem points at the canonical
 * install location at ~/.brainstem/ — the rapp-installer's output is
 * sacred and ez-rapp only reads from it.
 */

export type BootstrapStep =
  | "checking"          // is ~/.brainstem/ there?
  | "needs-install"     // we have to run the installer
  | "installing-python" // installer is fetching python
  | "cloning-repo"      // installer is cloning rapp-installer
  | "creating-venv"     // installer is making the venv
  | "installing-deps"   // pip install -r requirements.txt
  | "starting"          // launching brainstem.py
  | "ready"             // brainstem is responding on 7071
  | "error";            // anything went wrong

export interface BootstrapState {
  step: BootstrapStep;
  message: string;
  detail?: string;
  error?: string;
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
    /** Kick off the install flow if needed. Idempotent. */
    install: () => Promise<{ ok: boolean; error?: string }>;
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
