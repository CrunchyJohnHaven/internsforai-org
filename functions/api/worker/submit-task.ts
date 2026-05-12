import type { Env } from "../../_lib/types";
import { json, badRequest, notFound, nowSeconds, clampText } from "../../_lib/util";

interface SubmitBody {
  token?: unknown;
  assignment_id?: unknown;
  submission_text?: unknown;
}

// POST /api/worker/submit-task { token, assignment_id, submission_text }
// Worker marks an assignment 'submitted'. Admin reviews and accepts later.
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  let body: SubmitBody;
  try {
    body = (await ctx.request.json()) as SubmitBody;
  } catch {
    return badRequest("Invalid JSON");
  }
  const token = clampText(body.token, 100);
  const assignment_id = clampText(body.assignment_id, 100);
  const submission_text = clampText(body.submission_text, 8000);
  if (!token || !assignment_id || !submission_text) return badRequest("token, assignment_id, submission_text required");

  const now = nowSeconds();
  const applicant = await ctx.env.DB.prepare(
    "SELECT id, magic_expires_at FROM applicants WHERE magic_token = ?1"
  ).bind(token).first<{ id: string; magic_expires_at: number | null }>();
  if (!applicant) return notFound("Magic link not recognized.");
  if (applicant.magic_expires_at && applicant.magic_expires_at < now) return badRequest("Magic link expired.");

  const assignment = await ctx.env.DB.prepare(
    "SELECT id, task_id, applicant_id, status FROM task_assignments WHERE id = ?1"
  ).bind(assignment_id).first<{ id: string; task_id: string; applicant_id: string; status: string }>();
  if (!assignment) return notFound("Assignment not found.");
  if (assignment.applicant_id !== applicant.id) return badRequest("This assignment is not yours.");
  if (assignment.status !== "claimed") return badRequest("Assignment is not in 'claimed' state.");

  await ctx.env.DB.prepare(
    "UPDATE task_assignments SET submission_text=?2, submitted_at=?3, status='submitted' WHERE id=?1"
  ).bind(assignment_id, submission_text, now).run();
  await ctx.env.DB.prepare("UPDATE tasks SET status='submitted', updated_at=?2 WHERE id=?1").bind(assignment.task_id, now).run();

  // Notify admin (best-effort). We avoid importing email here to keep the function small.
  return json({ ok: true });
};
