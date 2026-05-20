/**
 * Bootstrap: ensure ~/.brainstem/ has everything it needs to run, then
 * stop. The rapp-installer's install.sh handles the heavy lifting — we
 * just invoke it from inside the Electron app instead of asking the
 * user to paste a curl-pipe-bash one-liner into a terminal.
 *
 * Sacred rule: we never touch files under ~/.brainstem/ ourselves. We
 * delegate to install.sh which IS the canonical writer.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { EventEmitter } from "node:events";
import type { BootstrapState, BootstrapStep } from "@shared/ipc-contract";
import { BRAINSTEM_PY, REQUIREMENTS_FILE, VENV_PYTHON } from "./paths";

const INSTALL_URL_BASH = "https://kody-w.github.io/rapp-installer/install.sh";
const INSTALL_URL_PS1 = "https://raw.githubusercontent.com/kody-w/rapp-installer/main/install.ps1";

export class Bootstrap extends EventEmitter {
  private state: BootstrapState = { step: "checking", message: "Checking your setup…" };

  current(): BootstrapState { return this.state; }

  /** Are we already installed (or do we need to run the installer)? */
  isInstalled(): boolean {
    return existsSync(BRAINSTEM_PY) && existsSync(VENV_PYTHON) && existsSync(REQUIREMENTS_FILE);
  }

  async run(): Promise<{ ok: boolean; error?: string }> {
    if (this.isInstalled()) {
      this.set({ step: "ready", message: "Ready." });
      return { ok: true };
    }
    this.set({ step: "needs-install", message: "Setting up the brainstem on your machine…", detail: "First-time setup takes 1–2 minutes." });
    try {
      await this.runInstaller();
      if (!this.isInstalled()) throw new Error("installer ran but ~/.brainstem/ is incomplete");
      this.set({ step: "ready", message: "Ready." });
      return { ok: true };
    } catch (e) {
      const msg = (e as Error).message;
      this.set({ step: "error", message: "Setup didn't finish.", error: msg });
      return { ok: false, error: msg };
    }
  }

  private set(next: Partial<BootstrapState> & { step: BootstrapStep }): void {
    this.state = { ...this.state, ...next } as BootstrapState;
    this.emit("state", this.state);
  }

  private runInstaller(): Promise<void> {
    return new Promise((resolve, reject) => {
      // OS detection — ez-rapp picks the right canonical one-liner so
      // the user gets the same outcome whether they run this from a
      // terminal or click our install button. Same files on disk either
      // way, so the two paths are interchangeable forever after.
      const isWin = process.platform === "win32";
      const isMacOrLinux = process.platform === "darwin" || process.platform === "linux";
      if (!isWin && !isMacOrLinux) {
        reject(new Error(`unsupported platform: ${process.platform}`));
        return;
      }
      // Tell install.sh / install.ps1 to bring the kernel down to disk
      // but NOT to auto-launch the brainstem at the end — we do that
      // ourselves through the supervisor so the chat happens inside this
      // window, not in a browser.
      const env = { ...process.env, RAPP_INSTALLER_NO_LAUNCH: "1" };

      const child = isWin
        ? spawn("powershell.exe", [
            "-NoProfile", "-ExecutionPolicy", "Bypass",
            "-Command", `irm ${INSTALL_URL_PS1} | iex`,
          ], { env, stdio: ["ignore", "pipe", "pipe"] })
        : spawn("bash", ["-lc", `curl -fsSL ${INSTALL_URL_BASH} | bash`], { env, stdio: ["ignore", "pipe", "pipe"] });

      const onLine = (buf: Buffer): void => {
        const line = buf.toString();
        // Pattern-match installer chatter so the UI can show a real step.
        const lower = line.toLowerCase();
        if (lower.includes("python")) this.set({ step: "installing-python", message: "Installing Python…", detail: line.trim() });
        else if (lower.includes("clon") || lower.includes("brainstem repo")) this.set({ step: "cloning-repo", message: "Cloning the brainstem…", detail: line.trim() });
        else if (lower.includes("venv") || lower.includes("virtualenv")) this.set({ step: "creating-venv", message: "Creating a Python environment…", detail: line.trim() });
        else if (lower.includes("pip install") || lower.includes("requirements")) this.set({ step: "installing-deps", message: "Installing dependencies…", detail: line.trim() });
      };
      child.stdout?.on("data", onLine);
      child.stderr?.on("data", onLine);
      child.on("error", (e) => reject(e));
      child.on("exit", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`installer exited with code ${code}`));
      });
    });
  }
}
