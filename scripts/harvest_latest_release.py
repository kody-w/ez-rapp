#!/usr/bin/env python3
"""harvest_latest_release.py — snapshot the latest release as static data.

docs/index.html used to fetch the releases/latest endpoint from the visitor's
browser on every page load to pick platform-specific installer assets. This
harvester makes that call ONCE, here in CI (or by hand, run as the
harvester), and commits the result trimmed to the fields the page actually
reads, in the same shape releases/latest returns for those fields — the page
reads the static snapshot instead of api.github.com. Article XXIV (the Static
Data Covenant, kody-w/RAR CONSTITUTION.md).

Non-fatal by design: an API problem leaves the existing snapshot untouched.
"""

import json
import os
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "state" / "latest_release.json"
SRC = "https://api.github.com/repos/kody-w/ez-rapp/releases/latest"


def main():
    req = urllib.request.Request(SRC, headers={
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "ez-rapp-release-harvester",
        **({"Authorization": f"Bearer {os.environ['GITHUB_TOKEN']}"}
           if os.environ.get("GITHUB_TOKEN") else {}),
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            rel = json.load(r)
    except Exception as e:
        print(f"· upstream unreadable ({type(e).__name__}) — existing snapshot left untouched")
        return 0

    if not isinstance(rel, dict):
        print("· unexpected response shape — existing snapshot left untouched")
        return 0

    snapshot = {
        "tag_name": rel.get("tag_name"),
        "name": rel.get("name"),
        "published_at": rel.get("published_at"),
        "html_url": rel.get("html_url"),
        "assets": [
            {
                "name": a.get("name"),
                "size": a.get("size"),
                "browser_download_url": a.get("browser_download_url"),
            }
            for a in (rel.get("assets") or [])
            if isinstance(a, dict)
        ],
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(snapshot, indent=1) + "\n")
    print(f"✓ {OUT.relative_to(ROOT)} — {snapshot['tag_name']} ({len(snapshot['assets'])} assets)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
