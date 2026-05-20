/**
 * The canonical paths the rapp-installer lays down on disk. ez-rapp is
 * a *consumer* of these — never a writer (CONSTITUTION of ez-rapp: the
 * installer's output is sacred, same way the brainstem kernel itself is).
 *
 * If any of these paths are missing we run the installer to recreate them.
 * We never reach in and edit files under ~/.brainstem/ directly.
 */

import { homedir } from "node:os";
import { join } from "node:path";

export const BRAINSTEM_HOME = join(homedir(), ".brainstem");
export const VENV_DIR = join(BRAINSTEM_HOME, "venv");
export const VENV_PYTHON = process.platform === "win32"
  ? join(VENV_DIR, "Scripts", "python.exe")
  : join(VENV_DIR, "bin", "python");
export const BRAINSTEM_SRC = join(BRAINSTEM_HOME, "src", "rapp_brainstem");
export const BRAINSTEM_PY = join(BRAINSTEM_SRC, "brainstem.py");
export const REQUIREMENTS_FILE = join(BRAINSTEM_SRC, "requirements.txt");

export const BRAINSTEM_PORT = 7071;
export const BRAINSTEM_URL = `http://127.0.0.1:${BRAINSTEM_PORT}`;
