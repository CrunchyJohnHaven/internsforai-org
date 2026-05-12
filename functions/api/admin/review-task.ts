import type { Env } from "../../_lib/types";
import { json, badRequest, requireAdmin, unauthorized, notFound, newId, nowSeconds, clampText } from "../../_lib/util";

interface ReviewBody {
  assignment_id?: unknown;
  decision?: unknown;       // 'accept' | 'reject'
  quality_score?: unknown;  // 0-100
  admin_review?: unknown;   // text
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!requireAdmin(ctx.request, ctx.env)) return unauthorized();
  let body: ReviewBody;
  try {
    body = (await ctx.request.json()) as ReviewBody;
  } catch {
    return badRequest("Invalid JSON");
  }
  const assignment_id = clampText(body.assignment_id, 100);
  const decision = clampText(body.decision, 20);
  if (!assignment_id) return badRequest("assignment_id required");
  if (decision !== "accept" && decision !== "reject") return badRequest("decision must be 'accept' or 'reject'");

  const quality_score = Math.max(0, Math.min(100, Number(body.quality_score) || 0));
  const admin_review = clampText(body.admin_review, 4000);
  const now = nowSeconds();

  const assignment = await ctx.env.DB.prepare(
    `SELECT ta.id, ta.task_id, ta.applicant_id, ta.status, t.pay_amount_usd, t.pay_currency,
            a.pay_method, a.pay_address, a.reputation
       FROM task_assignments ta
       JOIN tasks t ON t.id = ta.task_id
       JOIN applicants a ON a.id = ta.applicant_id
       WHERE ta.id = ?1`
  ).bind(assignment_id).first<{ id: string; task_id: string; applicant_id: string; status: string; pay_amount_usd: number; pay_currency: string; pay_method: string; pay_address: string; reputation: number }>();
  if (!assignment) return notFound("Assignment not found");
  if (assignment.status !== "submitted" && assignment.status !== "claimed") {
    return badRequest(`Assignment is in status '${assignment.status}' and cannot be reviewed.`);
  }

  const newStatus = decision === "accept" ? "accepted" : "rejected";
  await ctx.env.DB.prepare(
    "UPDATE task_assignments SET status=?2, quality_score=?3, admin_review=?4 WHERE id=?1"
  ).bind(assignment_id, newStatus, quality_score, admin_review || null).run();
  await ctx.env.DB.prepare("UPDATE tasks SET status=?2, updated_at=?3 WHERE id=?1")
    .bind(assignment.task_id, newStatus, now).run();

  let payment_id: string | null = null;
  if (decision === "accept") {
    payment_id = newId("pay");
    await ctx.env.DB.prepare(
      `INSERT INTO payments (id, applicant_id, task_assignment_id, amount_usd, currency, pay_method, pay_address, status, created_at)
       VALUES (?1,?2,?3,?4,?5,?6,?7,'queued',?8)`
    ).bind(payment_id, assignment.applicant_id, assignment_id, assignment.pay_amount_usd, assignment.pay_currency, assignment.pay_method, assignment.pay_address, now).run();

    // Update reputation: simple weighted average of past reputation + new quality_score (50/50).
    const newReputation = Math.round(((assignment.reputation || 0) * 0.5 + quality_score * 0.5) * 100) / 100;
    await ctx.env.DB.prepare("UPDATE applicants SET reputation=?2, updated_at=?3 WHERE id=?1")
      .bind(assignment.applicant_id, newReputation, now).run();

    // Stub attestation record for AAL Component 3 (wired later).
    const attId = newId("att");
    await ctx.env.DB.prepare(
      `INSERT INTO attestations (id, applicant_id, kind, ref_id, payload, created_at)
       VALUES (?1,?2,'task_quality',?3,?4,?5)`
    ).bind(attId, assignment.applicant_id, assignment_id, JSON.stringify({ quality_score, payment_id, decision }), now).run();
  }

  return json({ ok: true, payment_id, status: newStatus });
};
