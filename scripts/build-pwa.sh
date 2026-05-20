#!/usr/bin/env bash
# Build docs/app.html from public/brainstem-shell.html by appending the
# PWA extras (manifest link, SW registration, brainstem-not-reachable
# banner) right after the Electron patch block.
#
# Single source of truth: public/brainstem-shell.html. Run this whenever
# that file changes (sync-brainstem-shell.sh does it automatically).

set -e
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SHELL_HTML="$REPO_ROOT/public/brainstem-shell.html"
APP_HTML="$REPO_ROOT/docs/app.html"

python3 - "$SHELL_HTML" "$APP_HTML" <<'PY'
import sys
src_path, out_path = sys.argv[1], sys.argv[2]
src = open(src_path).read()

pwa_extras = '''
  <!-- ─────────────────────────────────────────────────────────────
       ez-rapp PWA shell — same shell as the Electron build, hosted
       at https://kody-w.github.io/ez-rapp/app.html so it can be
       installed as a Progressive Web App without waiting on the
       Electron release pipeline. Updates instantly when we push
       to main.
       ─────────────────────────────────────────────────────────── -->
  <link rel="manifest" href="manifest.webmanifest">
  <meta name="theme-color" content="#0d1117">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="ez-rapp">
  <script>
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js").catch((e) => {
          console.warn("[ez-rapp] SW registration failed:", e);
        });
      });
    }
    // If the brainstem isn't reachable, paint a friendly install banner.
    window.addEventListener("DOMContentLoaded", async () => {
      try {
        const r = await fetch("http://127.0.0.1:7071/health", { mode: "cors" });
        if (!r.ok) throw new Error("HTTP " + r.status);
      } catch (e) {
        const banner = document.createElement("div");
        banner.style.cssText = "position:fixed;top:0;left:0;right:0;background:#7c2d12;color:#fef2f2;padding:10px 20px;font:13px -apple-system,sans-serif;z-index:9999;text-align:center;";
        banner.innerHTML = `Brainstem isn't reachable at <code style="background:rgba(0,0,0,0.3);padding:2px 6px;border-radius:4px;">localhost:7071</code>. Run <code style="background:rgba(0,0,0,0.3);padding:2px 6px;border-radius:4px;">curl -fsSL https://kody-w.github.io/ez-rapp/install.sh | bash</code> to install it.`;
        document.body && document.body.prepend(banner);
      }
    });
  </script>
  <!-- /ez-rapp PWA shell ─────────────────────────────────────────── -->
'''

marker = "<!-- /ez-rapp Electron patches"
i = src.find(marker)
if i < 0:
    raise SystemExit("electron patch marker not found in shell HTML")
end = src.find(">", i) + 1
out = src[:end] + pwa_extras + src[end:]
open(out_path, "w").write(out)
print(f"wrote {out_path} ({len(out):,} bytes)")
PY
echo "  ✓ docs/app.html refreshed from public/brainstem-shell.html"
