import type { Env } from "./types";

export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(init.headers || {}),
    },
  });
}

export function badRequest(message: string, extra?: Record<string, unknown>): Response {
  return json({ ok: false, error: message, ...extra }, { status: 400 });
}

export function unauthorized(message = "Unauthorized"): Response {
  return json({ ok: false, error: message }, { status: 401 });
}

export function notFound(message = "Not found"): Response {
  return json({ ok: false, error: message }, { status: 404 });
}

export function serverError(message: string, extra?: Record<string, unknown>): Response {
  return json({ ok: false, error: message, ...extra }, { status: 500 });
}

// Cryptographically random token suitable for one-time links.
export function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Stable id with a short prefix for human readability in logs.
export function newId(prefix: string): string {
  return `${prefix}_${randomToken(8)}`;
}

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function requireAdmin(request: Request, env: Env): boolean {
  const header = request.headers.get("Authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const cookie = parseCookie(request.headers.get("Cookie") || "")["ifa_admin"] || "";
  const provided = bearer || cookie;
  if (!provided || !env.ADMIN_TOKEN) return false;
  return timingSafeEqual(provided, env.ADMIN_TOKEN);
}

export function parseCookie(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  header.split(/;\s*/).forEach((kv) => {
    if (!kv) return;
    const eq = kv.indexOf("=");
    if (eq < 0) return;
    const k = kv.slice(0, eq).trim();
    const v = decodeURIComponent(kv.slice(eq + 1).trim());
    if (k) out[k] = v;
  });
  return out;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

// Trim + clamp free text for safety (prevent DB bloat).
export function clampText(s: unknown, maxLen: number): string {
  if (typeof s !== "string") return "";
  const trimmed = s.trim();
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

export function parseJsonArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}
