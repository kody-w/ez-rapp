import { app, BrowserWindow, ipcMain, shell } from "electron";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Bootstrap } from "./bootstrap";
import { BrainstemSupervisor } from "./brainstem-supervisor";
import { ThreadStore } from "./thread-store";
import * as client from "./brainstem-client";
import type { BootstrapState, ChatRequest, SendPhase } from "@shared/ipc-contract";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.setName("ez-rapp");

/** Enable CDP in dev so external tooling can drive the UI (same as rcon). */
if (!app.isPackaged) {
  app.commandLine.appendSwitch("remote-debugging-port", process.env.EZRAPP_CDP_PORT ?? "9223");
}

const bootstrap = new Bootstrap();
const supervisor = new BrainstemSupervisor();
const thread = new ThreadStore();
let bootstrapState: BootstrapState = bootstrap.current();

function broadcast(channel: string, payload: unknown): void {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send(channel, payload);
}

bootstrap.on("state", (s: BootstrapState) => {
  bootstrapState = s;
  broadcast("bootstrap:state", s);
});

supervisor.on("state", (s) => {
  // Surface supervisor state as bootstrap state to keep the renderer simple.
  if (s === "ready") {
    bootstrapState = { step: "ready", message: "Ready." };
    broadcast("bootstrap:state", bootstrapState);
  } else if (s === "starting") {
    bootstrapState = { step: "starting", message: "Starting the brainstem…" };
    broadcast("bootstrap:state", bootstrapState);
  }
});

async function ensureRunningAndReady(): Promise<{ ok: boolean; error?: string }> {
  if (bootstrap.isInstalled()) {
    if (supervisor.getState() !== "ready" && supervisor.getState() !== "starting") supervisor.start();
    return { ok: true };
  }
  const r = await bootstrap.run();
  if (!r.ok) return r;
  supervisor.start();
  return { ok: true };
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1080,
    height: 760,
    minWidth: 720,
    minHeight: 520,
    backgroundColor: "#0a0a0b",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: process.platform === "darwin" ? { x: 14, y: 14 } : undefined,
    title: "ez-rapp",
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void win.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

// ── IPC handlers ───────────────────────────────────────────────────────

ipcMain.handle("bootstrap:status", () => bootstrapState);
ipcMain.handle("bootstrap:install", async () => ensureRunningAndReady());

ipcMain.handle("brainstem:health", async () => {
  const r = await client.health();
  if (!r.ok) return { ok: false, error: r.error ?? "offline" };
  const b = r.body ?? {};
  const status = typeof b.status === "string" ? b.status : undefined;
  const agentsField = b.agents;
  return {
    ok: true,
    model: typeof b.model === "string" ? b.model : undefined,
    agents: typeof agentsField === "number" ? agentsField : Array.isArray(agentsField) ? agentsField.length : undefined,
    authStatus: status === "unauthenticated" ? "unauthenticated" : status === "authenticated" ? "authenticated" : undefined,
  };
});

ipcMain.handle("brainstem:loginStart", () => client.loginStart());
ipcMain.handle("brainstem:loginPoll", () => client.loginPoll());
ipcMain.handle("brainstem:chat", async (_e, req: ChatRequest) => client.chat(req));
ipcMain.handle("brainstem:openExternal", (_e, url: string) => {
  if (typeof url === "string" && /^https?:\/\//.test(url)) void shell.openExternal(url);
});

ipcMain.handle("thread:get", () => thread.list());
ipcMain.handle("thread:clear", () => { thread.clear(); broadcast("thread:update", thread.list()); });

ipcMain.handle("thread:send", async (_e, text: string) => {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return { ok: false, error: "empty" };
  const phase = (p: SendPhase, error?: string): void => broadcast("thread:send-status", { phase, error });
  thread.append({ role: "user", content: trimmed });
  broadcast("thread:update", thread.list());
  // If the brainstem isn't up yet, that's the "resolving" phase.
  if (supervisor.getState() !== "ready") {
    phase("resolving");
    const startReady = Date.now();
    while (supervisor.getState() !== "ready" && Date.now() - startReady < 30_000) {
      await new Promise((r) => setTimeout(r, 500));
    }
    if (supervisor.getState() !== "ready") {
      phase("failed", "brainstem didn't come up in 30s");
      return { ok: false, error: "brainstem not ready" };
    }
  }
  phase("delivered");
  try {
    const history = thread.list().slice(0, -1);
    phase("typing");
    const resp = await client.chat({ user_input: trimmed, conversation_history: history });
    thread.append({ role: "assistant", content: resp.response ?? "" });
    broadcast("thread:update", thread.list());
    phase("read");
    return { ok: true };
  } catch (e) {
    phase("failed", (e as Error).message);
    return { ok: false, error: (e as Error).message };
  }
});

app.whenReady().then(async () => {
  createWindow();
  void ensureRunningAndReady();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("before-quit", async (e) => {
  if (supervisor.getState() !== "stopped") {
    e.preventDefault();
    await supervisor.stop();
    app.quit();
  }
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
