import { useEffect, useState, type ReactElement } from "react";
import type { BootstrapState, InstallerKind } from "@shared/ipc-contract";
import { BootstrapScreen } from "./components/BootstrapScreen";

/**
 * The renderer's job is finished the moment the brainstem is ready:
 * main.ts then calls win.loadURL(BRAINSTEM_URL) and the user sees the
 * brainstem's own web UI inside this Electron window. There's no
 * ChatScreen here on purpose — we're not reimplementing the chat in
 * React; we're embedding the canonical one.
 *
 * While we wait, this component renders the install + platform-picker
 * flow. As soon as state.step transitions to "ready", main.ts
 * navigates the window away from us anyway, so this component is
 * unmounted automatically when the user lands in the brainstem UI.
 */
export function App(): ReactElement {
  const [bootstrap, setBootstrap] = useState<BootstrapState>({ step: "checking", message: "Checking your setup…" });

  useEffect(() => {
    void (async () => setBootstrap(await window.ezrapp.bootstrap.status()))();
    return window.ezrapp.bootstrap.onChange(setBootstrap);
  }, []);

  return (
    <BootstrapScreen
      state={bootstrap}
      onInstall={(kind?: InstallerKind) => void window.ezrapp.bootstrap.install(kind)}
    />
  );
}
