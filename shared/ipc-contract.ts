/**
 * IPC surface between the main process and the renderer.
 *
 * Intentionally tiny: just the bootstrap flow. Once the brainstem is
 * serving on localhost:7071, the main process navigates the window
 * directly to that URL — the user sees the brainstem UI verbatim, no
 * Electron-side re-skin. So nothing past install needs a typed IPC.
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

/** macOS / Linux share install.sh (POSIX); Windows uses install.ps1. */
export type InstallerKind = "posix" | "windows";

export interface BootstrapState {
  step: BootstrapStep;
  message: string;
  detail?: string;
  error?: string;
  /** When step is "needs-platform-pick", which platforms the user can choose. */
  options?: Array<{ kind: InstallerKind; label: string; hint: string }>;
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
    /** Best-effort guess at the right installer for this hardware. */
    detectKind: () => Promise<InstallerKind | null>;
    /** Re-open the platform picker (e.g. after a wrong-platform spawn error). */
    reopenPicker: () => Promise<void>;
  };
}

declare global {
  interface Window { ezrapp: EzRappBridge }
}
