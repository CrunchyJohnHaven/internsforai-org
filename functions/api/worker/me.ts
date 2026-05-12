import type { Env } from "../../_lib/types";
import { json, badRequest, notFound, nowSeconds } from "../../_lib/util";

// GET /api/worker/me?token=...
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url);
  const token = url.searchParams.get("token") || "";
  if (!token) return badRequest("Missing token");

  const now = nowSeconds();
  const applicant = await ctx.env.DB.prepare(
    `SELECT id, email, display_name, country, timezone, tracks, status, reputation,
            availability_hours, pay_method, pay_address,
            magic_token, magic_expires_at, created_at
       FROM applicants WHERE magic_token = ?1`
  ).bind(token).first();
  if (!applicant) return notFound("Magic link not recognized.");
  if (applicant.magic_expires_at && Number(applicant.magic_expires_at) < now) {
    return badRequest("Magic link expired. Apply again or request a new link.");
  }

  const attempts = await ctx.env.DB.prepare(
    "SELECT id, track, score_total, verdict, created_at FROM test_attempts WHERE applicant_id = ?1 ORDER BY created_at DESC"
  ).bind(applicant.id).all();

  // Tasks claimed by this worker (in progress + completed) AND open tasks they could claim.
  const myAssignments = await ctx.env.DB.prepare(
    `SELECT ta.id AS assignment_id, ta.status, ta.claimed_at, ta.submitted_at,
            ta.submission_text, ta.quality_score, ta.admin_review,
            t.id AS task_id, t.title, t.brief, t.track, t.pay_amount_usd, t.deadline_at, t.is_trial
       FROM task_assignments ta JOIN tasks t ON t.id = ta.task_id
       WHERE ta.applicant_id = ?1 ORDER BY ta.claimed_at DESC`
  ).bind(applicant.id).all();

  let tracks: string[] = [];
  try { tracks = JSON.parse(String(applicant.tracks ?? "[]")); } catch { tracks = []; }

  // Open tasks matching their tracks. v0: only show tasks NOT yet claimed.
  let openTasks: unknown[] = [];
  if (tracks.length > 0) {
    const placeholders = tracks.map((_, i) => `?${i + 1}`).join(",");
    const openStmt = ctx.env.DB.prepare(
      `SELECT id, title, brief, track, pay_amount_usd, deadline_at, created_at, is_trial
         FROM tasks WHERE status='open' AND is_trial=0 AND track IN (${placeholders})
         ORDER BY created_at DESC LIMIT 50`
    );
    const res = await openStmt.bind(...tracks).all();
    openTasks = res.results || [];
  }

  // Payment summary
  const paymentsStmt = await ctx.env.DB.prepare(
    "SELECT id, amount_usd, currency, pay_method, status, created_at, paid_at FROM payments WHERE applicant_id = ?1 ORDER BY created_at DESC"
  ).bind(applicant.id).all();
  const payments = paymentsStmt.results || [];
  let total_earned = 0;
  let last_paid_at: number | null = null;
  for (const p of payments) {
    const status = String((p as { status: string }).status);
    const amount = Number((p as { amount_usd: number }).amount_usd);
    if (status === "confirmed" || status === "sent") total_earned += amount;
    const paid_at_raw = (p as { paid_at: number | null }).paid_at;
    if (status === "confirmed" && paid_at_raw && (!last_paid_at || Number(paid_at_raw) > last_paid_at)) {
      last_paid_at = Number(paid_at_raw);
    }
  }

  return json({
    ok: true,
    me: {
      id: applicant.id,
      email: applicant.email,
      display_name: applicant.display_name,
      country: applicant.country,
      timezone: applicant.timezone,
      tracks,
      status: applicant.status,
      reputation: applicant.reputation,
      availability_hours: applicant.availability_hours,
      pay_method: applicant.pay_method,
      pay_address: applicant.pay_address,
      magic_expires_at: applicant.magic_expires_at,
    },
    attempts: attempts.results || [],
    my_assignments: myAssignments.results || [],
    open_tasks: openTasks,
    payments: {
      list: payments,
      total_earned,
      last_paid_at,
    },
  });
};
