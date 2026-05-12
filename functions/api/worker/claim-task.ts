import type { Env } from "../../_lib/types";
import { json, badRequest, notFound, nowSeconds, clampText, newId } from "../../_lib/util";

interface ClaimBody {
  token?: unknown;
  task_id?: unknown;
}

// POST /api/worker/claim-task { token, task_id }
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  let body: ClaimBody;
  try {
    body = (await ctx.request.json()) as ClaimBody;
  } catch {
    return badRequest("Invalid JSON");
  }
  const token = clampText(body.token, 100);
  const task_id = clampText(body.task_id, 100);
  if (!token || !task_id) return badRequest("token and task_id required");

  const now = nowSeconds();
  const applicant = await ctx.env.DB.prepare(
    "SELECT id, tracks, magic_expires_at FROM applicants WHERE magic_token = ?1"
  ).bind(token).first<{ id: string; tracks: string; magic_expires_at: number | null }>();
  if (!applicant) return notFound("Magic link not recognized.");
  if (applicant.magic_expires_at && applicant.magic_expires_at < now) return badRequest("Magic link expired.");

  const task = await ctx.env.DB.prepare(
    "SELECT id, status, track FROM tasks WHERE id = ?1"
  ).bind(task_id).first<{ id: string; status: string; track: string }>();
  if (!task) return notFound("Task not found.");
  if (task.status !== "open") return badRequest("Task is not available to claim.");

  // Ensure applicant has this track.
  let chosenTracks: string[] = [];
  try { chosenTracks = JSON.parse(applicant.tracks); } catch { chosenTracks = []; }
  if (!chosenTracks.includes(task.track)) return badRequest("This task is outside your selected tracks.");

  const assignmentId = newId("assn");
  await ctx.env.DB.prepare(
    "INSERT INTO task_assignments (id, task_id, applicant_id, claimed_at, status) VALUES (?1,?2,?3,?4,'claimed')"
  ).bind(assignmentId, task.id, applicant.id, now).run();
  await ctx.env.DB.prepare("UPDATE tasks SET status='claimed', updated_at=?2 WHERE id=?1").bind(task.id, now).run();

  return json({ ok: true, assignment_id: assignmentId });
};
