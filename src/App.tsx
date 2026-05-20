import { useEffect, useState, type ReactElement } from "react";
import type { BootstrapState, HealthResult, InstallerKind } from "@shared/ipc-contract";
import { ChatScreen } from "./components/ChatScreen";
import { BootstrapScreen } from "./components/BootstrapScreen";
import { LoginGate } from "./components/LoginGate";

export function App(): ReactElement {
  const [bootstrap, setBootstrap] = useState<BootstrapState>({ step: "checking", message: "Checking your setup…" });
  const [health, setHealth] = useState<HealthResult>({ ok: false, error: "loading" });

  useEffect(() => {
    void (async () => setBootstrap(await window.ezrapp.bootstrap.status()))();
    return window.ezrapp.bootstrap.onChange(setBootstrap);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const tick = async (): Promise<void> => {
      if (cancelled) return;
      try { setHealth(await window.ezrapp.brainstem.health()); }
      catch (e) { setHealth({ ok: false, error: (e as Error).message }); }
    };
    void tick();
    const t = setInterval(tick, 2_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  const installed = bootstrap.step === "ready" || bootstrap.step === "starting";
  const needsInstall = !installed && bootstrap.step !== "ready";
  const needsAuth = health.ok && health.authStatus === "unauthenticated";

  if (needsInstall) {
    return (
      <BootstrapScreen
        state={bootstrap}
        onInstall={(kind?: InstallerKind) => void window.ezrapp.bootstrap.install(kind)}
      />
    );
  }
  if (needsAuth) {
    return <LoginGate onSignedIn={async () => setHealth(await window.ezrapp.brainstem.health())} />;
  }
  return <ChatScreen health={health} />;
}
