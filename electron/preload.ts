import { contextBridge, ipcRenderer } from "electron";
import type { BootstrapState, EzRappBridge, InstallerKind } from "@shared/ipc-contract";

/**
 * Preload contract is intentionally tiny: just the bootstrap flow. Once
 * the brainstem is up, the main process navigates the window to
 * http://localhost:7071/ — that page is a stock browser page, not under
 * our renderer, and doesn't need any of our IPC. The user gets the
 * brainstem UI verbatim, just hosted inside our Electron window.
 */

const bridge: EzRappBridge = {
  bootstrap: {
    status: () => ipcRenderer.invoke("bootstrap:status"),
    onChange: (cb) => {
      const listener = (_e: unknown, s: BootstrapState): void => cb(s);
      ipcRenderer.on("bootstrap:state", listener);
      return () => ipcRenderer.removeListener("bootstrap:state", listener);
    },
    install: (kind?: InstallerKind) => ipcRenderer.invoke("bootstrap:install", kind),
    detectKind: () => ipcRenderer.invoke("bootstrap:detectKind"),
    reopenPicker: () => ipcRenderer.invoke("bootstrap:reopenPicker"),
  },
};

contextBridge.exposeInMainWorld("ezrapp", bridge);
