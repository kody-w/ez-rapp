/**
 * Spawn ~/.brainstem/src/rapp_brainstem/brainstem.py on localhost:7071
 * and keep it alive. Sacred: we never edit anything under ~/.brainstem,
 * we only run what the installer put there.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { createWriteStream, mkdirSync, type WriteStream } from "node:fs";
import { join } from "node:path";
import { homedir, platform } from "node:os";
import { BRAINSTEM_PY, BRAINSTEM_SRC, BRAINSTEM_URL, VENV_PYTHON } from "./paths";

export type SupervisorState = "stopped" | "starting" | "ready" | "crashed";

function logDir(): string {
  if (platform() === "darwin") return join(homedir(), "Library/Logs/ez-rapp");
  if (platform() === "win32") return join(homedir(), "AppData/Local/ez-rapp/logs");
  return join(homedir(), ".ez-rapp/logs");
}

export class BrainstemSupervisor extends EventEmitter {
  private child: ChildProcess | null = null;
  private state: SupervisorState = "stopped";
  private logStream: WriteStream | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private restartTimer: NodeJS.Timeout | null = null;
  private stopRequested = false;
  private restartCount = 0;

  getState(): SupervisorState { return this.state; }

  start(): void {
    if (this.state === "starting" || this.state === "ready") return;
    this.stopRequested = false;
    this.setState("starting");
    // Coexistence with the rapp-installer one-liner: if the brainstem is
    // already running (someone launched it from the terminal, or a prior
    // `brainstem` command is still alive), adopt it. We only spawn when
    // nothing's listening on :7071/health. The supervisor polls /health
    // every 1.5s regardless, so an externally-managed brainstem flips
    // us to "ready" the same way our own child would.
    void this.adoptOrSpawn();
    this.startPolling();
  }

  private async adoptOrSpawn(): Promise<void> {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 1000);
      const res = await fetch(`${BRAINSTEM_URL}/health`, { signal: ctrl.signal });
      clearTimeout(t);
      if (res.ok) {
        // External brainstem already serving — don't spawn a competitor.
        // (Two processes on :7071 would EADDRINUSE anyway.)
        this.setState("ready");
        return;
      }
    } catch { /* nothing's listening — proceed to spawn */ }
    this.spawnChild();
  }

  async stop(): Promise<void> {
    this.stopRequested = true;
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
    if (this.restartTimer) { clearTimeout(this.restartTimer); this.restartTimer = null; }
    if (this.child) {
      const c = this.child;
      this.child = null;
      await new Promise<void>((resolve) => {
        c.once("exit", () => resolve());
        c.kill("SIGTERM");
        setTimeout(() => { if (!c.killed) c.kill("SIGKILL"); }, 2000);
      });
    }
    this.logStream?.end();
    this.logStream = null;
    this.setState("stopped");
  }

  private spawnChild(): void {
    const dir = logDir();
    mkdirSync(dir, { recursive: true });
    this.logStream = createWriteStream(join(dir, "brainstem.log"), { flags: "a" });
    this.logStream.write(`\n--- spawn ${new Date().toISOString()} ---\n`);
    try {
      this.child = spawn(VENV_PYTHON, [BRAINSTEM_PY], {
        cwd: BRAINSTEM_SRC,
        env: { ...process.env, PYTHONUNBUFFERED: "1" },
        stdio: ["ignore", "pipe", "pipe"],
      });
      this.child.stdout?.on("data", (b: Buffer) => this.logStream?.write(b));
      this.child.stderr?.on("data", (b: Buffer) => this.logStream?.write(b));
      this.child.once("exit", (code, signal) => {
        this.logStream?.write(`\n--- exit code=${code} signal=${signal} ---\n`);
        if (this.stopRequested) return;
        this.setState("crashed");
        this.scheduleRestart();
      });
    } catch (e) {
      this.logStream?.write(`spawn failed: ${(e as Error).message}\n`);
      this.setState("crashed");
      this.scheduleRestart();
    }
  }

  private scheduleRestart(): void {
    if (this.restartCount >= 5) return;
    const backoff = Math.min(30_000, 500 * Math.pow(2, this.restartCount));
    this.restartCount += 1;
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      this.setState("starting");
      this.spawnChild();
    }, backoff);
  }

  private startPolling(): void {
    if (this.pollTimer) return;
    const tick = async (): Promise<void> => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 1500);
        const res = await fetch(`${BRAINSTEM_URL}/health`, { signal: ctrl.signal });
        clearTimeout(t);
        if (res.ok && this.state !== "ready") {
          this.restartCount = 0;
          this.setState("ready");
        }
      } catch { /* not yet */ }
    };
    void tick();
    this.pollTimer = setInterval(tick, 1500);
  }

  private setState(s: SupervisorState): void {
    if (this.state === s) return;
    this.state = s;
    this.emit("state", s);
  }
}
