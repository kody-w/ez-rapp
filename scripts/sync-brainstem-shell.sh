#!/usr/bin/env bash
# Refresh our vendored copy of the rapp-installer's brainstem UI.
#
# Why this exists: the upstream index.html at ~/.brainstem/src/
# rapp_brainstem/index.html is sacred — we never edit it on disk.
# We instead vendor a copy at public/brainstem-shell.html with an
# Electron-specific <head> patch block (traffic-light room, drag
# region, fetch/XHR rewrite to localhost:7071). When upstream gets
# a new version, run this script: it fetches the upstream HTML and
# re-applies our patch block at the top of <head>.
#
# Requirements:
#   - Brainstem running locally (`brainstem` from rapp-installer)
#   - python3 (for the in-place head splice)
#
# Usage:
#   bash scripts/sync-brainstem-shell.sh

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PUBLIC_HTML="$REPO_ROOT/public/brainstem-shell.html"
PATCH_FILE="$REPO_ROOT/scripts/brainstem-shell-patch.html"
SOURCE_URL="${BRAINSTEM_SOURCE:-http://127.0.0.1:7071/}"

if ! curl -sf -o /dev/null "$SOURCE_URL"; then
  echo "Upstream not reachable at $SOURCE_URL"
  echo "Start the brainstem first:"
  echo "  brainstem        # from the rapp-installer one-liner"
  exit 1
fi

[ -f "$PATCH_FILE" ] || { echo "missing patch file at $PATCH_FILE"; exit 1; }

TMP=$(mktemp)
curl -fsSL "$SOURCE_URL" -o "$TMP"

python3 - "$TMP" "$PATCH_FILE" "$PUBLIC_HTML" <<'PY'
import sys
upstream = open(sys.argv[1]).read()
patch    = open(sys.argv[2]).read()
out_path = sys.argv[3]

i = upstream.find('<head>')
if i < 0:
    sys.exit("upstream HTML has no <head> tag — bailing")
out = upstream[:i + len('<head>')] + '\n' + patch + upstream[i + len('<head>'):]

with open(out_path, 'w') as fh:
    fh.write(out)
print(f"wrote {out_path} ({len(out):,} bytes)")
PY

rm -f "$TMP"
echo "  ✓ vendored copy refreshed at public/brainstem-shell.html"

# Rebuild the PWA mirror at docs/app.html from the freshly-patched shell.
bash "$REPO_ROOT/scripts/build-pwa.sh"

echo "  next: pnpm dev                              # verify Electron build"
echo "        open https://kody-w.github.io/ez-rapp/app.html   # PWA"
