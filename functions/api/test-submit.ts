import type { Env, Verdict } from "../_lib/types";
import { TRACKS, type Track } from "../_lib/types";
import { json, badRequest, notFound, serverError, newId, nowSeconds, clampText, randomToken } from "../_lib/util";
import { getTestBank } from "../_lib/tests";
import { gradeFreeText, type AiGradeResult } from "../_lib/grader";
import { sendEmail, testResultEmail } from "../_lib/email";

interface SubmissionBody {
  token?: unknown;
  track?: unknown;
  answers?: unknown;
  duration_seconds?: unknown;
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;

  let body: SubmissionBody;
  try {
    body = (await request.json()) as SubmissionBody;
  } catch {
    return badRequest("Invalid JSON");
  }

  const token = clampText(body.token, 100);
  if (!token) return badRequest("Missing session token.");

  const track = clampText(body.track, 30) as Track;
  if (!(TRACKS as readonly string[]).includes(track)) return badRequest("Unknown track.");

  const bank = getTestBank(track);
  if (!bank) return notFound("Test bank not configured.");

  const answers = body.answers && typeof body.answers === "object" ? (body.answers as Record<string, unknown>) : null;
  if (!answers) return badRequest("Answers payload required.");

  const duration_seconds = Number(body.duration_seconds);

  const applicant = await env.DB.prepare(
    "SELECT id, email, display_name, country, session_token, magic_token, magic_expires_at FROM applicants WHERE session_token = ?1"
  ).bind(token).first<{ id: string; email: string; display_name: string; country: string; session_token: string; magic_token: string | null; magic_expires_at: number | null }>();
  if (!applicant) return badRequest("Token not recognized.");

  // ---- Score ----
  let totalPossible = 0;
  let totalEarned = 0;
  const perQuestion: Array<{ id: string; kind: string; earned: number; possible: number; ai_feedback?: string; correct?: number; chosen?: number }> = [];
  const aiFeedback: Array<{ id: string; result: AiGradeResult }> = [];

  for (const q of bank.questions) {
    totalPossible += q.points;
    const raw = answers[q.id];
    if (q.kind === "mcq") {
      const chosen = Number(raw);
      const correct = Number.isInteger(chosen) && chosen === q.correct;
      const earned = correct ? q.points : 0;
      totalEarned += earned;
      perQuestion.push({ id: q.id, kind: q.kind, earned, possible: q.points, correct: q.correct, chosen: Number.isInteger(chosen) ? chosen : -1 });
    } else if (q.kind === "short" || q.kind === "sample") {
      const text = clampText(raw, 4000);
      // Brief sanity: too-short answers get 0 to avoid wasting AI calls on empty submissions.
      if (text.split(/\s+/).filter(Boolean).length < 3) {
        perQuestion.push({ id: q.id, kind: q.kind, earned: 0, possible: q.points, ai_feedback: "Skipped: answer too short." });
        continue;
      }
      const result = await gradeFreeText(env, {
        prompt: q.prompt,
        expectedKeywords: q.expected_keywords,
        rubric: q.rubric,
        candidateAnswer: text,
      });
      const earned = Math.round((result.score / 100) * q.points);
      totalEarned += earned;
      perQuestion.push({ id: q.id, kind: q.kind, earned, possible: q.points, ai_feedback: result.feedback });
      aiFeedback.push({ id: q.id, result });
    }
  }

  const score_total = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0;
  let verdict: Verdict = "fail";
  if (score_total >= bank.pass_score) verdict = "pass";
  else if (score_total >= bank.shortlist_score) verdict = "shortlist";

  const now = nowSeconds();
  const attemptId = newId("att");
  try {
    await env.DB.prepare(
      `INSERT INTO test_attempts
         (id, applicant_id, track, answers, per_question_scores, ai_feedback, score_total, verdict, duration_seconds, created_at)
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)`
    )
      .bind(
        attemptId,
        applicant.id,
        track,
        JSON.stringify(answers),
        JSON.stringify(perQuestion),
        JSON.stringify(aiFeedback),
        score_total,
        verdict,
        Number.isFinite(duration_seconds) ? duration_seconds : null,
        now
      )
      .run();

    // Auto-promote applicant status on PASS, set shortlist on SHORTLIST.
    if (verdict === "pass") {
      await env.DB.prepare("UPDATE applicants SET status = 'shortlist', reputation = ?2, updated_at = ?3 WHERE id = ?1")
        .bind(applicant.id, score_total, now)
        .run();
    } else if (verdict === "shortlist") {
      await env.DB.prepare("UPDATE applicants SET status = 'shortlist', reputation = ?2, updated_at = ?3 WHERE id = ?1")
        .bind(applicant.id, score_total, now)
        .run();
    } else {
      await env.DB.prepare("UPDATE applicants SET reputation = ?2, updated_at = ?3 WHERE id = ?1")
        .bind(applicant.id, score_total, now)
        .run();
    }

    // Issue a magic token for the worker dashboard if PASS or SHORTLIST.
    let dashboardUrl: string | null = null;
    if (verdict === "pass" || verdict === "shortlist") {
      const magic_token = randomToken(24);
      const magic_expires_at = now + 30 * 24 * 60 * 60; // 30 days
      await env.DB.prepare(
        "UPDATE applicants SET magic_token = ?2, magic_expires_at = ?3 WHERE id = ?1"
      ).bind(applicant.id, magic_token, magic_expires_at).run();
      dashboardUrl = `${env.SITE_ORIGIN || "https://internsforai.org"}/worker?token=${encodeURIComponent(magic_token)}`;
    }

    // Email applicant and admin.
    const verdictEmail = testResultEmail(applicant.display_name, verdict, score_total, dashboardUrl);
    await sendEmail(env, { to: applicant.email, subject: verdictEmail.subject, text: verdictEmail.text });
    if (env.ADMIN_EMAIL) {
      const trackLabel = track.replace(/_/g, " ");
      await sendEmail(env, {
        to: env.ADMIN_EMAIL,
        subject: `[InternsForAI] ${applicant.display_name} (${applicant.country}) — ${trackLabel} ${verdict.toUpperCase()} ${score_total}/100`,
        text: `Applicant ${applicant.display_name} <${applicant.email}> finished the ${trackLabel} test.\nVerdict: ${verdict.toUpperCase()}\nScore: ${score_total}/100\n\nReview: ${env.SITE_ORIGIN || "https://internsforai.org"}/admin?applicant=${applicant.id}`,
      });
    }

    return json({
      ok: true,
      attempt_id: attemptId,
      verdict,
      score_total,
      pass_score: bank.pass_score,
      shortlist_score: bank.shortlist_score,
      dashboard_url: dashboardUrl,
    });
  } catch (err) {
    console.error("[test-submit] db error", err);
    return serverError("Database write failed.");
  }
};
