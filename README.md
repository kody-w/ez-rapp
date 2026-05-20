# ez-rapp

> **Plain-English AI on your laptop. No terminal. No API keys. Just download and chat.**

ez-rapp is the friendliest way to run a local AI on your computer. You don't need to know Python, you don't need to copy-paste commands, you don't need an OpenAI key. If you already have **GitHub Copilot** ([sign up — $10/mo or free for students/OSS](https://github.com/github-copilot/signup)), you're done.

```
1. Download ez-rapp
2. Open it
3. Sign in with GitHub once
4. Start talking
```

That's the whole product.

---

## What runs on your machine

Behind the friendly window, ez-rapp installs and supervises the **[RAPP brainstem](https://github.com/kody-w/rapp-installer)** — a small Python server that talks to GitHub Copilot for you. The brainstem lives at `~/.brainstem/` once installed (same folder the official one-line installer uses, so if you ever outgrow ez-rapp you keep your data and your setup).

What ez-rapp does for you, automatically:

- 🐍 Installs Python 3.11 if you don't have it
- 📥 Downloads the brainstem
- 🔐 Walks you through GitHub sign-in with a one-click flow (no copy-paste codes into a terminal)
- 💬 Opens a clean chat window — no browser tab, no localhost URL, no port numbers

If you already have the brainstem installed from the [rapp-installer](https://github.com/kody-w/rapp-installer) one-liner, ez-rapp finds it and skips straight to the chat.

---

## What you can ask it

The brainstem ships with a few built-in skills — but anything you ask just works through chat:

- 💭 **Remember things** about you across conversations
- 📰 Pull **the latest tech news**
- 🧠 **Talk to a local AI** that runs entirely on your machine

Want it to do more? You don't install plugins or tweak config files. You [drop one Python file](https://github.com/kody-w/RAR) into a folder and the brainstem hot-loads it. Or you ask it directly: *"find me an agent that can do X."* The brainstem has a built-in marketplace client; new skills land in seconds.

---

## What ez-rapp is **not**

- ❌ Not a cloud service — your conversations stay on your laptop
- ❌ Not a separate AI — it's GitHub Copilot's brain, with a friendly face
- ❌ Not a replacement for [rapp-installer](https://github.com/kody-w/rapp-installer) — it's a *wrapper* over it. The installer is sacred; we just press the buttons for you.
- ❌ Not bloated — the whole download is under 100 MB

If you're a developer comfortable in the terminal, use the [rapp-installer one-liner](https://github.com/kody-w/rapp-installer). ez-rapp is the same thing, for everyone else.

---

## Install

> Once the first signed builds land, downloads will be at [Releases](https://github.com/kody-w/ez-rapp/releases). For now you can build from source:

```bash
git clone https://github.com/kody-w/ez-rapp.git
cd ez-rapp
pnpm install
pnpm dev          # development mode
pnpm dist:mac     # build a .zip you can ship
```

---

## How it relates to the rest of the RAPP universe

| Project | What it is |
|---|---|
| **[rapp-installer](https://github.com/kody-w/rapp-installer)** | The canonical one-liner that lays the brainstem down at `~/.brainstem/`. Sacred — every other tool reads from here. |
| **[ez-rapp](https://github.com/kody-w/ez-rapp)** ← you are here | A friendly Electron window over the installer's output. Press a button instead of typing a curl-pipe-bash. |
| **[openrapp-desktop](https://github.com/kody-w/openrapp-desktop)** | The power-user desktop client (sidebar with twins, neighborhood snapshots, agent browser, RAR marketplace). Bundles its own brainstem; targets advanced users. |
| **[RAR](https://github.com/kody-w/RAR)** | The public agent marketplace. Drop one `.py` file in and your brainstem learns a new skill. |
| **[CommunityRAPP](https://github.com/kody-w/CommunityRAPP)** | The cloud / Azure-Functions deploy story for graduating from local to multi-machine. |

---

## License

MIT. Same as the rest of the RAPP ecosystem.
