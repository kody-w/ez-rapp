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
import type { BootstrapState, BootstrapStep, InstallerKind } from "@shared/ipc-contract";
import { BRAINSTEM_PY, REQUIREMENTS_FILE, VENV_PYTHON } from "./paths";

const INSTALL_URL_BASH = "https://kody-w.github.io/rapp-installer/install.sh";
const INSTALL_URL_PS1 = "https://raw.githubusercontent.com/kody-w/rapp-installer/main/install.ps1";

/**
 * Map the running OS to the canonical one-liner the rapp-installer
 * publishes. Returns null when we can't guess (rare — embedded Linux
 * builds, future platforms, weird Electron forks). The renderer falls
 * back to a manual platform picker in that case.
 */
export function detectInstallerKind(): InstallerKind | null {
  if (process.platform === "darwin" || process.platform === "linux") return "posix";
  if (process.platform === "win32") return "windows";
  // FreeBSD / OpenBSD / SunOS / AIX etc. — bash is usually available.
  // We still return null so the user picks explicitly; we don't want to
  // run a Linux script on a system that needs a different python source.
  return null;
}

export class Bootstrap extends EventEmitter {
  private state: BootstrapState = { step: "checking", message: "Checking your setup…" };

  current(): BootstrapState { return this.state; }

  /** Are we already installed (or do we need to run the installer)? */
  isInstalled(): boolean {
    return existsSync(BRAINSTEM_PY) && existsSync(VENV_PYTHON) && existsSync(REQUIREMENTS_FILE);
  }

  async run(kind?: InstallerKind): Promise<{ ok: boolean; error?: string }> {
    if (this.isInstalled()) {
      this.set({ step: "ready", message: "Ready." });
      return { ok: true };
    }
    // Auto-detect first; if it failed and the renderer hasn't picked one
    // yet, surface the platform picker. The renderer calls run() again
    // with an explicit kind once the user chooses.
    const resolved = kind ?? detectInstallerKind();
    if (!resolved) {
      this.set({
        step: "needs-platform-pick",
        message: "Tell us about your computer.",
        detail: "We couldn't auto-detect which installer to run. Pick the one that matches your OS and we'll do the rest.",
        options: [
          { kind: "posix",   label: "macOS or Linux",         hint: "Uses the bash one-liner from rapp-installer." },
          { kind: "windows", label: "Windows (10 or later)",  hint: "Uses the PowerShell one-liner from rapp-installer." },
        ],
      });
      return { ok: false, error: "platform-pick" };
    }
    this.set({ step: "needs-install", message: "Setting up the brainstem on your machine…", detail: "First-time setup takes 1–2 minutes." });
    try {
      await this.runInstaller(resolved);
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

  private runInstaller(kind: InstallerKind): Promise<void> {
    return new Promise((resolve, reject) => {
      // Tell install.sh / install.ps1 to bring the kernel down to disk
      // but NOT to auto-launch the brainstem at the end — we do that
      // ourselves through the supervisor so the chat happens inside this
      // window, not in a browser.
      const env = { ...process.env, RAPP_INSTALLER_NO_LAUNCH: "1" };

      const cmd = kind === "windows" ? "powershell.exe" : "bash";
      const args = kind === "windows"
        ? ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", `irm ${INSTALL_URL_PS1} | iex`]
        : ["-lc", `curl -fsSL ${INSTALL_URL_BASH} | bash`];

      let child;
      try {
        child = spawn(cmd, args, { env, stdio: ["ignore", "pipe", "pipe"] });
      } catch (e) {
        // Synchronous spawn failure (rare — usually surfaces via "error" event).
        reject(this.translateSpawnError(e as NodeJS.ErrnoException, kind, cmd));
        return;
      }

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
      child.on("error", (e) => reject(this.translateSpawnError(e as NodeJS.ErrnoException, kind, cmd)));
      child.on("exit", (code) => {
        if (code === 0) resolve();
        else reject(new Error(
          `The ${kind === "windows" ? "Windows" : "macOS/Linux"} installer exited with code ${code}. ` +
          `Try again, or if you picked the wrong platform, choose a different one. ` +
          `Full logs are at ~/Library/Logs/ez-rapp/ (macOS) or %USERPROFILE%\\AppData\\Local\\ez-rapp\\logs\\ (Windows).`
        ));
      });
    });
  }

  /**
   * Friendly translation of spawn errors. The common one is ENOENT —
   * the user picked Windows but powershell.exe isn't on PATH (or
   * picked POSIX but bash isn't available). Tell them in plain English
   * and route them back to the picker if it looks wrong-platform.
   */
  private translateSpawnError(err: NodeJS.ErrnoException, kind: InstallerKind, cmd: string): Error {
    if (err.code === "ENOENT") {
      const friendly = kind === "windows"
        ? `We tried to run PowerShell ("${cmd}") but it isn't available on this machine. ` +
          `That usually means this isn't a Windows computer — try going back and picking macOS / Linux.`
        : `We tried to run bash ("${cmd}") but it isn't available on this machine. ` +
          `That usually means this is a Windows computer — try going back and picking Windows.`;
      const e = new Error(friendly);
      (e as NodeJS.ErrnoException).code = "ENOENT";
      return e;
    }
    return new Error(`Couldn't start the installer (${err.code ?? "unknown"}): ${err.message}`);
  }

  /**
   * Re-open the platform picker — used after a manual pick failed (e.g.
   * the user chose Windows on a Mac and spawning powershell ENOENT'd).
   * Renderer wires its "Try a different platform" button to this.
   */
  reopenPlatformPicker(): void {
    this.set({
      step: "needs-platform-pick",
      message: "Pick your platform again.",
      detail: "The last attempt couldn't find the installer command on this machine. Pick the OS that actually matches your computer.",
      options: [
        { kind: "posix",   label: "macOS or Linux",         hint: "Uses the bash one-liner from rapp-installer." },
        { kind: "windows", label: "Windows (10 or later)",  hint: "Uses the PowerShell one-liner from rapp-installer." },
      ],
    });
  }
}
