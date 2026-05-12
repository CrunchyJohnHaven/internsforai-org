import type { Env } from "../../_lib/types";
import { json, badRequest, unauthorized, timingSafeEqual, clampText } from "../../_lib/util";

interface LoginBody { token?: unknown }

// POST /api/admin/login { token } -> sets ifa_admin cookie
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  let body: LoginBody;
  try {
    body = (await ctx.request.json()) as LoginBody;
  } catch {
    return badRequest("Invalid JSON");
  }
  const tok = clampText(body.token, 200);
  if (!tok) return badRequest("token required");
  if (!ctx.env.ADMIN_TOKEN) return unauthorized("Admin token not configured on server.");
  if (!timingSafeEqual(tok, ctx.env.ADMIN_TOKEN)) return unauthorized("Wrong token");

  const cookie = `ifa_admin=${encodeURIComponent(tok)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 12}`;
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": cookie,
    },
  });
};

export const onRequestDelete: PagesFunction<Env> = async () => {
  // Logout: clear cookie
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": "ifa_admin=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
    },
  });
};
