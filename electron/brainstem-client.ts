import type { ChatRequest, ChatResponse, LoginPoll, LoginStart } from "@shared/ipc-contract";
import { BRAINSTEM_URL } from "./paths";

const TIMEOUT_MS = 120_000;

async function req(method: "GET" | "POST", path: string, body?: unknown): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${BRAINSTEM_URL}${path}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } finally { clearTimeout(t); }
}

export async function health(): Promise<{ ok: boolean; body?: Record<string, unknown>; error?: string }> {
  try {
    const r = await req("GET", "/health");
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
    return { ok: true, body: (await r.json()) as Record<string, unknown> };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

export async function chat(payload: ChatRequest): Promise<ChatResponse> {
  const r = await req("POST", "/chat", payload);
  if (!r.ok) throw new Error(`/chat ${r.status}`);
  const b = (await r.json()) as Record<string, unknown>;
  return {
    response: typeof b.response === "string" ? b.response : "",
    session_id: typeof b.session_id === "string" ? b.session_id : undefined,
  };
}

export async function loginStart(): Promise<LoginStart> {
  try {
    const r = await req("POST", "/login");
    const b = (await r.json()) as Record<string, unknown>;
    if (!r.ok || typeof b.user_code !== "string" || typeof b.verification_uri !== "string") {
      return { ok: false, error: typeof b.error === "string" ? b.error : `HTTP ${r.status}` };
    }
    return { ok: true, userCode: b.user_code, verificationUri: b.verification_uri };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

export async function loginPoll(): Promise<LoginPoll> {
  try {
    const r = await req("POST", "/login/poll");
    const b = (await r.json()) as Record<string, unknown>;
    const s = typeof b.status === "string" ? b.status : "error";
    if (s === "pending") return { status: "pending" };
    if (s === "ok") return { status: "ok", username: typeof b.username === "string" ? b.username : undefined };
    if (s === "expired") return { status: "expired", error: typeof b.error === "string" ? b.error : "expired" };
    return { status: "error", error: typeof b.error === "string" ? b.error : "unknown" };
  } catch (e) { return { status: "error", error: (e as Error).message }; }
}
