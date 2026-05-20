#!/usr/bin/env bash
# ez-rapp installer — macOS & Linux
#   curl -fsSL https://kody-w.github.io/ez-rapp/install.sh | bash
#
# Why this exists: when you download a .app from a browser on macOS,
# the OS sets com.apple.quarantine on it, and Gatekeeper on Sequoia
# refuses to open unsigned apps. curl doesn't set that xattr, so this
# script side-steps the warning entirely — Apple's malware scanner
# never engages. No Apple Developer account needed.

set -e

REPO="kody-w/ez-rapp"
INSTALL_DIR_MAC="/Applications"
INSTALL_DIR_LINUX="$HOME/.local/bin"

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

echo -e "\n${CYAN}🧠 ez-rapp installer${NC}\n"

OS=""
case "$(uname -s)" in
  Darwin) OS="mac" ;;
  Linux)  OS="linux" ;;
  *)
    echo -e "${RED}This installer is for macOS and Linux.${NC}"
    echo "Windows users: run the PowerShell installer instead:"
    echo "  irm https://kody-w.github.io/ez-rapp/install.ps1 | iex"
    exit 1
    ;;
esac

echo "Fetching the latest release from $REPO..."
TAG=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
  | grep '"tag_name"' | head -1 | sed -E 's/.*"([^"]+)".*/\1/')
if [ -z "$TAG" ]; then
  echo -e "${RED}Couldn't read the latest release. Check https://github.com/$REPO/releases${NC}"
  exit 1
fi
echo "  latest: $TAG"

if [ "$OS" = "mac" ]; then
  # Pick arm64 or x64 zip from the release assets
  ARCH=$(uname -m)
  case "$ARCH" in
    arm64) ASSET_PATTERN="arm64-mac.zip" ;;
    x86_64) ASSET_PATTERN="x64-mac.zip" ;;
    *) echo -e "${RED}Unknown mac architecture: $ARCH${NC}"; exit 1 ;;
  esac

  ASSET_URL=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
    | grep '"browser_download_url"' | grep "$ASSET_PATTERN" | head -1 \
    | sed -E 's/.*"(https:[^"]+)".*/\1/')
  if [ -z "$ASSET_URL" ]; then
    # Fall back to any mac.zip if arch-specific isn't there.
    ASSET_URL=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
      | grep '"browser_download_url"' | grep -E 'mac\.zip|darwin' | head -1 \
      | sed -E 's/.*"(https:[^"]+)".*/\1/')
  fi
  [ -n "$ASSET_URL" ] || { echo -e "${RED}No mac zip in release $TAG${NC}"; exit 1; }

  TMP=$(mktemp -d)
  echo "Downloading $(basename "$ASSET_URL")..."
  curl -fsSL -o "$TMP/ez-rapp.zip" "$ASSET_URL"

  echo "Unzipping to $INSTALL_DIR_MAC..."
  unzip -q -o "$TMP/ez-rapp.zip" -d "$TMP/extracted"

  # Find the .app and move it into /Applications.
  APP=$(find "$TMP/extracted" -maxdepth 3 -type d -name "*.app" -print -quit)
  [ -n "$APP" ] || { echo -e "${RED}No .app found in zip${NC}"; exit 1; }
  rm -rf "$INSTALL_DIR_MAC/$(basename "$APP")"
  mv "$APP" "$INSTALL_DIR_MAC/"

  # Curl-installed bundles don't get the quarantine xattr, but we strip
  # it defensively anyway (handles edge cases like network restarts).
  xattr -dr com.apple.quarantine "$INSTALL_DIR_MAC/$(basename "$APP")" 2>/dev/null || true

  rm -rf "$TMP"

  echo -e "\n${GREEN}✓ Installed to $INSTALL_DIR_MAC/$(basename "$APP")${NC}"
  echo "Opening ez-rapp..."
  open "$INSTALL_DIR_MAC/$(basename "$APP")"

elif [ "$OS" = "linux" ]; then
  ASSET_URL=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
    | grep '"browser_download_url"' | grep -E 'AppImage' | head -1 \
    | sed -E 's/.*"(https:[^"]+)".*/\1/')
  [ -n "$ASSET_URL" ] || { echo -e "${RED}No AppImage in release $TAG${NC}"; exit 1; }

  mkdir -p "$INSTALL_DIR_LINUX"
  DEST="$INSTALL_DIR_LINUX/ez-rapp.AppImage"
  echo "Downloading to $DEST..."
  curl -fsSL -o "$DEST" "$ASSET_URL"
  chmod +x "$DEST"

  echo -e "\n${GREEN}✓ Installed to $DEST${NC}"
  echo "Running ez-rapp..."
  "$DEST" &
fi

echo ""
echo "Update later by re-running this command."
