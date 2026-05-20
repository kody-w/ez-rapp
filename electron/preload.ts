import { contextBridge, ipcRenderer } from "electron";
import type { BootstrapState, ChatRequest, ChatTurn, EzRappBridge, InstallerKind, SendStatusEvent } from "@shared/ipc-contract";

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
  },
  brainstem: {
    health: () => ipcRenderer.invoke("brainstem:health"),
    loginStart: () => ipcRenderer.invoke("brainstem:loginStart"),
    loginPoll: () => ipcRenderer.invoke("brainstem:loginPoll"),
    chat: (req: ChatRequest) => ipcRenderer.invoke("brainstem:chat", req),
    openExternal: (url: string) => ipcRenderer.invoke("brainstem:openExternal", url),
  },
  thread: {
    get: () => ipcRenderer.invoke("thread:get"),
    send: (text: string) => ipcRenderer.invoke("thread:send", text),
    clear: () => ipcRenderer.invoke("thread:clear"),
    onUpdate: (cb) => {
      const listener = (_e: unknown, turns: ChatTurn[]): void => cb(turns);
      ipcRenderer.on("thread:update", listener);
      return () => ipcRenderer.removeListener("thread:update", listener);
    },
    onSendStatus: (cb) => {
      const listener = (_e: unknown, evt: SendStatusEvent): void => cb(evt);
      ipcRenderer.on("thread:send-status", listener);
      return () => ipcRenderer.removeListener("thread:send-status", listener);
    },
  },
};

contextBridge.exposeInMainWorld("ezrapp", bridge);
