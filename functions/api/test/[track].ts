import type { Env } from "../../_lib/types";
import { TRACKS, type Track } from "../../_lib/types";
import { json, badRequest, notFound } from "../../_lib/util";
import { publicTestBank } from "../../_lib/tests";

// GET /api/test/{track} -> sanitized test bank (no answers / keys)
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const track = ctx.params.track as string;
  if (!(TRACKS as readonly string[]).includes(track)) {
    return notFound("Unknown track.");
  }
  const bank = publicTestBank(track as Track);
  if (!bank) return notFound("Test bank not configured.");

  // The session token is required so this URL isn't a public scraping target.
  const url = new URL(ctx.request.url);
  const token = url.searchParams.get("token") || "";
  if (!token) return badRequest("Missing session token. Apply first at /apply.");

  // Lightweight token check: confirm the token exists for some applicant who
  // listed this track. We do NOT expose the applicant identity here.
  const row = await ctx.env.DB.prepare(
    "SELECT id, tracks FROM applicants WHERE session_token = ?1"
  ).bind(token).first<{ id: string; tracks: string }>();
  if (!row) return badRequest("Token not recognized. Apply first at /apply.");

  let chosen: string[] = [];
  try { chosen = JSON.parse(row.tracks); } catch { chosen = []; }
  if (!chosen.includes(track)) {
    // Allow taking a test for a track they didn't pick (cross-track auditioning),
    // but flag it on the attempt so admin can see.
  }

  return json({ ok: true, bank });
};
