import { app, BrowserWindow, Menu, ipcMain, shell } from "electron";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Bootstrap, detectInstallerKind } from "./bootstrap";
import { BrainstemSupervisor } from "./brainstem-supervisor";
import { BRAINSTEM_URL } from "./paths";
import type { BootstrapState, InstallerKind } from "@shared/ipc-contract";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.setName("ez-rapp");

/** Enable CDP in dev so external tooling can drive the UI. */
if (!app.isPackaged) {
  app.commandLine.appendSwitch("remote-debugging-port", process.env.EZRAPP_CDP_PORT ?? "9223");
}

const bootstrap = new Bootstrap();
const supervisor = new BrainstemSupervisor();
let bootstrapState: BootstrapState = bootstrap.current();
/** The single window we manage. We pass it the bootstrap UI on launch
 *  and navigate it to the brainstem URL once that's serving. */
let win: BrowserWindow | null = null;
/** Track whether we've already promoted the window to the brainstem UI,
 *  so a transient supervisor-state change doesn't reload the page out
 *  from under the user. */
let promoted = false;

function broadcast(channel: string, payload: unknown): void {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send(channel, payload);
}

bootstrap.on("state", (s: BootstrapState) => {
  bootstrapState = s;
  broadcast("bootstrap:state", s);
});

supervisor.on("state", (s) => {
  if (s === "ready") {
    bootstrapState = { step: "ready", message: "Ready." };
    broadcast("bootstrap:state", bootstrapState);
    // Hand the window over to the brainstem UI exactly like the browser
    // would see it. The user can't tell they're in an Electron wrapper —
    // it's the same page localhost:7071 serves.
    promoteToBrainstemUI();
  } else if (s === "starting") {
    bootstrapState = { step: "starting", message: "Starting the brainstem…" };
    broadcast("bootstrap:state", bootstrapState);
  }
});

function promoteToBrainstemUI(): void {
  if (promoted || !win || win.isDestroyed()) return;
  promoted = true;
  // Instead of navigating to http://127.0.0.1:7071/ (the brainstem's
  // own served HTML), we load our vendored clone at public/brainstem-
  // shell.html. The clone is the upstream UI with an Electron-specific
  // patch block injected in <head> — fixes things like the macOS
  // traffic-light overlap and makes the header draggable. All XHR/fetch
  // calls in the patch are rewritten to go to localhost:7071 so the
  // brainstem stays the API source of truth.
  //
  // Why this layout: rapp-installer's index.html is sacred — we never
  // touch the original on disk. Our clone in public/brainstem-shell.html
  // is the Electron view; refresh it from upstream via
  //   curl http://127.0.0.1:7071/ > public/brainstem-shell.html
  // then re-apply the patch block at the top of <head>.
  const shellPath = process.env.ELECTRON_RENDERER_URL
    ? `${process.env.ELECTRON_RENDERER_URL}/brainstem-shell.html`
    : null;
  if (shellPath) void win.loadURL(shellPath);
  else void win.loadFile(join(__dirname, "../renderer/brainstem-shell.html"));
}

async function ensureRunningAndReady(kind?: InstallerKind): Promise<{ ok: boolean; error?: string }> {
  if (bootstrap.isInstalled()) {
    if (supervisor.getState() !== "ready" && supervisor.getState() !== "starting") supervisor.start();
    return { ok: true };
  }
  const r = await bootstrap.run(kind);
  if (!r.ok) return r;
  supervisor.start();
  return { ok: true };
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1080,
    height: 760,
    minWidth: 720,
    minHeight: 520,
    backgroundColor: "#0d1117", // match the brainstem UI's bg so the swap is seamless
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: process.platform === "darwin" ? { x: 14, y: 14 } : undefined,
    title: "ez-rapp",
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      // sandbox: false because once we navigate to localhost:7071 the
      // brainstem UI needs a normal web context (XHR, fetch, dynamic
      // script execution, marked.js CDN). Sandboxed render processes
      // block enough of the page's bootstrap that it lands blank.
      sandbox: false,
      webSecurity: true,
      // Allow CDN scripts (marked.min.js) and any other resources the
      // brainstem UI loads. The page is local; the CDN is the only
      // remote dependency.
      allowRunningInsecureContent: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void win.loadFile(join(__dirname, "../renderer/index.html"));
  }

  // External links open in the user's actual browser, not inside our
  // window — keeps the brainstem UI in here without surprises.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) void shell.openExternal(url);
    return { action: "deny" };
  });

  // If the brainstem is already up when the window opens (rapid reopen,
  // background install completed before window was created), promote now.
  if (supervisor.getState() === "ready") promoteToBrainstemUI();
}

// ── IPC handlers (the renderer only needs bootstrap surface; once we
// navigate to the brainstem UI the renderer is a stock browser page) ──

ipcMain.handle("bootstrap:status", () => bootstrapState);
ipcMain.handle("bootstrap:install", async (_e, kind?: InstallerKind) => ensureRunningAndReady(kind));
ipcMain.handle("bootstrap:detectKind", () => detectInstallerKind());
ipcMain.handle("bootstrap:reopenPicker", () => { bootstrap.reopenPlatformPicker(); });

function buildMenu(): void {
  const isMac = process.platform === "darwin";
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: "appMenu" as const }] : []),
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [
        {
          label: "Open ez-rapp on GitHub",
          click: () => void shell.openExternal("https://github.com/kody-w/ez-rapp"),
        },
        {
          label: "Open brainstem in browser",
          click: () => void shell.openExternal(BRAINSTEM_URL),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(async () => {
  buildMenu();
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
