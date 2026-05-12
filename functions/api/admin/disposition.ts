import type { Env, ApplicantStatus } from "../../_lib/types";
import { json, badRequest, requireAdmin, unauthorized, nowSeconds, clampText, notFound } from "../../_lib/util";

const ALLOWED_STATUSES: ApplicantStatus[] = ["pending", "shortlist", "hired", "disqualified", "inactive"];

interface DispositionBody {
  applicant_id?: unknown;
  status?: unknown;
  admin_notes?: unknown;
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!requireAdmin(ctx.request, ctx.env)) return unauthorized();
  let body: DispositionBody;
  try {
    body = (await ctx.request.json()) as DispositionBody;
  } catch {
    return badRequest("Invalid JSON");
  }
  const applicantId = clampText(body.applicant_id, 80);
  if (!applicantId) return badRequest("applicant_id required");

  const statusRaw = clampText(body.status, 30) as ApplicantStatus;
  if (!ALLOWED_STATUSES.includes(statusRaw)) return badRequest("Invalid status");

  const notes = clampText(body.admin_notes, 4000);

  const existing = await ctx.env.DB.prepare("SELECT id FROM applicants WHERE id = ?1").bind(applicantId).first<{ id: string }>();
  if (!existing) return notFound("Applicant not found");

  await ctx.env.DB.prepare(
    "UPDATE applicants SET status = ?2, admin_notes = ?3, updated_at = ?4 WHERE id = ?1"
  ).bind(applicantId, statusRaw, notes || null, nowSeconds()).run();

  return json({ ok: true });
};
