import type { Env, Track } from "../../_lib/types";
import { TRACKS } from "../../_lib/types";
import {
  json,
  badRequest,
  requireAdmin,
  unauthorized,
  notFound,
  newId,
  nowSeconds,
  clampText,
  randomToken,
} from "../../_lib/util";
import { sendEmail, trialTaskInvitationEmail } from "../../_lib/email";

interface TrialTaskBody {
  applicant_id?: unknown;
  title?: unknown;
  brief?: unknown;
  track?: unknown;
  pay_amount_usd?: unknown;
  deadline_hours?: unknown;
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!requireAdmin(ctx.request, ctx.env)) return unauthorized();
  let body: TrialTaskBody;
  try {
    body = (await ctx.request.json()) as TrialTaskBody;
  } catch {
    return badRequest("Invalid JSON");
  }

  const applicantId = clampText(body.applicant_id, 80);
  if (!applicantId) return badRequest("applicant_id required");

  const applicant = await ctx.env.DB.prepare(
    "SELECT id, email, display_name, country, magic_token, magic_expires_at FROM applicants WHERE id = ?1"
  ).bind(applicantId).first<{ id: string; email: string; display_name: string; country: string; magic_token: string | null; magic_expires_at: number | null }>();
  if (!applicant) return notFound("Applicant not found");

  const title = clampText(body.title, 120) || "Trial task — light QA on AI-generated copy";
  const brief = clampText(body.brief, 4000) ||
    "Read the attached 600-word paragraph in your dashboard. Mark anything that (a) reads as AI-generated boilerplate, (b) contains a factual or arithmetic inconsistency, (c) would damage a reader's trust. Submit a 50-100 word edit summary plus a corrected version. Pay: $2. Deadline: 24 hours.";
  const trackRaw = clampText(body.track, 30);
  const track: Track = (TRACKS as readonly string[]).includes(trackRaw) ? (trackRaw as Track) : "light_judgment";
  const pay_amount_usd = Number.isFinite(Number(body.pay_amount_usd)) ? Number(body.pay_amount_usd) : 2;
  const deadline_hours = Number.isFinite(Number(body.deadline_hours)) ? Number(body.deadline_hours) : 24;

  const now = nowSeconds();
  const deadline_at = now + Math.floor(deadline_hours * 3600);
  const taskId = newId("task");

  await ctx.env.DB.prepare(
    `INSERT INTO tasks
        (id, title, brief, track, difficulty, pay_amount_usd, pay_currency, status, is_trial,
         deadline_at, created_by, created_at, updated_at)
     VALUES (?1,?2,?3,?4,?5,?6,'USD','open',1,?7,'admin',?8,?8)`
  ).bind(taskId, title, brief, track, track, pay_amount_usd, deadline_at, now).run();

  // Pre-claim the task to this applicant so it shows up immediately on their dashboard.
  const assignmentId = newId("assn");
  await ctx.env.DB.prepare(
    `INSERT INTO task_assignments (id, task_id, applicant_id, claimed_at, status)
     VALUES (?1,?2,?3,?4,'claimed')`
  ).bind(assignmentId, taskId, applicantId, now).run();
  await ctx.env.DB.prepare("UPDATE tasks SET status='claimed', updated_at=?2 WHERE id=?1").bind(taskId, now).run();

  // Ensure applicant has an active magic token.
  let magicToken = applicant.magic_token;
  let magicExpires = applicant.magic_expires_at;
  if (!magicToken || !magicExpires || magicExpires < now) {
    magicToken = randomToken(24);
    magicExpires = now + 30 * 24 * 60 * 60;
    await ctx.env.DB.prepare(
      "UPDATE applicants SET magic_token = ?2, magic_expires_at = ?3, updated_at = ?4 WHERE id = ?1"
    ).bind(applicantId, magicToken, magicExpires, now).run();
  }

  const dashboardUrl = `${ctx.env.SITE_ORIGIN || "https://internsforai.org"}/worker?token=${encodeURIComponent(magicToken)}`;
  const mail = trialTaskInvitationEmail(applicant.display_name, title, brief, dashboardUrl, pay_amount_usd);
  await sendEmail(ctx.env, { to: applicant.email, subject: mail.subject, text: mail.text });

  return json({ ok: true, task_id: taskId, assignment_id: assignmentId, dashboard_url: dashboardUrl });
};
