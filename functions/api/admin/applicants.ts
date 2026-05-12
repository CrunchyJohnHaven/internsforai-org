import type { Env } from "../../_lib/types";
import { json, requireAdmin, unauthorized, clampText } from "../../_lib/util";

// GET /api/admin/applicants?track=...&country=...&status=...&from=...&to=...&q=...&applicant_id=...
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  if (!requireAdmin(ctx.request, ctx.env)) return unauthorized();
  const url = new URL(ctx.request.url);

  const filters: string[] = [];
  const binds: unknown[] = [];

  const applicantId = clampText(url.searchParams.get("applicant_id"), 80);
  if (applicantId) {
    filters.push(`a.id = ?${binds.length + 1}`);
    binds.push(applicantId);
  }
  const track = clampText(url.searchParams.get("track"), 30);
  if (track) {
    filters.push(`a.tracks LIKE ?${binds.length + 1}`);
    binds.push(`%"${track}"%`);
  }
  const country = clampText(url.searchParams.get("country"), 8);
  if (country) {
    filters.push(`a.country = ?${binds.length + 1}`);
    binds.push(country.toUpperCase());
  }
  const status = clampText(url.searchParams.get("status"), 20);
  if (status) {
    filters.push(`a.status = ?${binds.length + 1}`);
    binds.push(status);
  }
  const from = Number(url.searchParams.get("from"));
  if (Number.isFinite(from) && from > 0) {
    filters.push(`a.created_at >= ?${binds.length + 1}`);
    binds.push(from);
  }
  const to = Number(url.searchParams.get("to"));
  if (Number.isFinite(to) && to > 0) {
    filters.push(`a.created_at <= ?${binds.length + 1}`);
    binds.push(to);
  }
  const q = clampText(url.searchParams.get("q"), 80);
  if (q) {
    filters.push(`(a.email LIKE ?${binds.length + 1} OR a.display_name LIKE ?${binds.length + 1})`);
    binds.push(`%${q}%`);
  }

  const where = filters.length ? "WHERE " + filters.join(" AND ") : "";

  const rowsStmt = ctx.env.DB.prepare(
    `SELECT a.id, a.email, a.display_name, a.country, a.timezone, a.tracks,
            a.availability_hours, a.pay_method, a.status, a.reputation,
            a.created_at, a.updated_at,
            (SELECT ta.score_total FROM test_attempts ta WHERE ta.applicant_id = a.id ORDER BY ta.created_at DESC LIMIT 1) AS latest_score,
            (SELECT ta.track FROM test_attempts ta WHERE ta.applicant_id = a.id ORDER BY ta.created_at DESC LIMIT 1) AS latest_track,
            (SELECT ta.verdict FROM test_attempts ta WHERE ta.applicant_id = a.id ORDER BY ta.created_at DESC LIMIT 1) AS latest_verdict
       FROM applicants a
       ${where}
       ORDER BY a.created_at DESC
       LIMIT 500`
  );
  const rows = await rowsStmt.bind(...binds).all();

  // Per-applicant detail when applicant_id is supplied.
  let detail: unknown = null;
  if (applicantId) {
    const detailRow = await ctx.env.DB.prepare(
      "SELECT * FROM applicants WHERE id = ?1"
    ).bind(applicantId).first();
    if (detailRow) {
      const attempts = await ctx.env.DB.prepare(
        "SELECT id, track, score_total, verdict, duration_seconds, created_at, answers, per_question_scores, ai_feedback FROM test_attempts WHERE applicant_id = ?1 ORDER BY created_at DESC"
      ).bind(applicantId).all();
      const assignments = await ctx.env.DB.prepare(
        `SELECT ta.id, ta.task_id, ta.claimed_at, ta.submitted_at, ta.quality_score, ta.status, t.title, t.pay_amount_usd, t.is_trial
           FROM task_assignments ta JOIN tasks t ON t.id = ta.task_id
          WHERE ta.applicant_id = ?1 ORDER BY ta.claimed_at DESC`
      ).bind(applicantId).all();
      const payments = await ctx.env.DB.prepare(
        "SELECT id, amount_usd, currency, pay_method, status, created_at, paid_at FROM payments WHERE applicant_id = ?1 ORDER BY created_at DESC"
      ).bind(applicantId).all();
      detail = {
        applicant: detailRow,
        attempts: attempts.results || [],
        assignments: assignments.results || [],
        payments: payments.results || [],
      };
    }
  }

  // Aggregate stats (always).
  const totalsStmt = ctx.env.DB.prepare("SELECT COUNT(*) AS total FROM applicants");
  const totals = await totalsStmt.first<{ total: number }>();

  const byTrackStmt = ctx.env.DB.prepare(
    `SELECT
       SUM(CASE WHEN tracks LIKE '%"mechanical"%' THEN 1 ELSE 0 END) AS mechanical,
       SUM(CASE WHEN tracks LIKE '%"light_judgment"%' THEN 1 ELSE 0 END) AS light_judgment,
       SUM(CASE WHEN tracks LIKE '%"heavy_judgment"%' THEN 1 ELSE 0 END) AS heavy_judgment,
       SUM(CASE WHEN tracks LIKE '%"specialized"%' THEN 1 ELSE 0 END) AS specialized,
       SUM(CASE WHEN tracks LIKE '%"domain_expert"%' THEN 1 ELSE 0 END) AS domain_expert
       FROM applicants`
  );
  const byTrack = await byTrackStmt.first();

  const byStatusStmt = ctx.env.DB.prepare(
    "SELECT status, COUNT(*) AS n FROM applicants GROUP BY status"
  );
  const byStatus = await byStatusStmt.all();

  const meanByTrackStmt = ctx.env.DB.prepare(
    "SELECT track, AVG(score_total) AS mean_score, COUNT(*) AS attempts FROM test_attempts GROUP BY track"
  );
  const meanByTrack = await meanByTrackStmt.all();

  const meanByCountryStmt = ctx.env.DB.prepare(
    `SELECT a.country, AVG(ta.score_total) AS mean_score, COUNT(ta.id) AS attempts
       FROM test_attempts ta JOIN applicants a ON a.id = ta.applicant_id
       GROUP BY a.country
       ORDER BY mean_score DESC`
  );
  const meanByCountry = await meanByCountryStmt.all();

  // Conversion to paid: count applicants who have at least one accepted assignment.
  const paidStmt = ctx.env.DB.prepare(
    "SELECT COUNT(DISTINCT applicant_id) AS n FROM task_assignments WHERE status = 'accepted'"
  );
  const paid = await paidStmt.first<{ n: number }>();

  return json({
    ok: true,
    applicants: rows.results || [],
    detail,
    stats: {
      total_applicants: totals?.total ?? 0,
      by_track: byTrack,
      by_status: byStatus.results || [],
      mean_score_by_track: meanByTrack.results || [],
      mean_score_by_country: meanByCountry.results || [],
      converted_to_paid: paid?.n ?? 0,
    },
  });
};
