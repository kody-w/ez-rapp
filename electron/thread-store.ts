/**
 * Single chat thread, persisted at ~/.ez-rapp/thread.json. iMessage shape:
 * one thread, forever, append-only. The brainstem decides the content
 * (it owns memory via its agents); we just store the transcript.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { ChatTurn } from "@shared/ipc-contract";

const FILE = join(homedir(), ".ez-rapp", "thread.json");

export class ThreadStore {
  list(): ChatTurn[] {
    if (!existsSync(FILE)) return [];
    try {
      const raw = JSON.parse(readFileSync(FILE, "utf8")) as { messages?: unknown };
      return Array.isArray(raw.messages) ? (raw.messages as ChatTurn[]) : [];
    } catch { return []; }
  }

  append(turn: ChatTurn): ChatTurn[] {
    const all = this.list();
    all.push(turn);
    this.write(all);
    return all;
  }

  clear(): void { this.write([]); }

  private write(messages: ChatTurn[]): void {
    mkdirSync(dirname(FILE), { recursive: true });
    writeFileSync(FILE, JSON.stringify({ messages, updatedAt: new Date().toISOString() }, null, 2));
  }
}
