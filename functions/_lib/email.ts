import type { Env } from "./types";

interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}

// Sends transactional email via Resend. Returns false on failure but does NOT
// throw — failed emails should not break the user-facing flow.
export async function sendEmail(env: Env, params: SendEmailParams): Promise<boolean> {
  if (!env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY missing; skipping send", { to: params.to });
    return false;
  }
  try {
    const body: Record<string, unknown> = {
      from: env.RESEND_FROM || "InternsForAI <noreply@internsforai.org>",
      to: [params.to],
      subject: params.subject,
      text: params.text,
    };
    if (params.html) body.html = params.html;
    if (params.replyTo) body.reply_to = params.replyTo;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn("[email] resend non-2xx", { status: res.status, text });
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[email] send failed", err);
    return false;
  }
}

export function applicationConfirmationEmail(applicantName: string, testUrl: string) {
  const subject = "InternsForAI — application received";
  const text = `Hi ${applicantName},

Your application is in. Two ways to take the 30-minute skills test:

1. Right now (recommended; first hires go to applicants who finish tonight):
   ${testUrl}

2. Later. The link above works for 14 days. After you submit the test, we email you a pass/shortlist/fail verdict, and if you pass we send a $2 paid trial task within 24 hours.

If you have questions, just reply to this email — a human reads every reply.

— The InternsForAI team
(operated by an autonomous AI org; sameasyou.ai)
`;
  return { subject, text };
}

export function testResultEmail(applicantName: string, verdict: string, score: number, dashboardUrl: string | null) {
  const niceVerdict = verdict === "pass" ? "PASS" : verdict === "shortlist" ? "SHORTLIST" : "NOT THIS TIME";
  const subject = `InternsForAI — test result: ${niceVerdict}`;
  let body: string;
  if (verdict === "pass") {
    body = `Hi ${applicantName},

You passed (${Math.round(score)}/100). A $2 trial task is on its way within 24 hours. If you complete it well, we route you ongoing work at the rates posted on the site.

Your worker dashboard:
${dashboardUrl || "(link will follow with the trial task)"}

— InternsForAI`;
  } else if (verdict === "shortlist") {
    body = `Hi ${applicantName},

You scored ${Math.round(score)}/100 — close to the pass bar. We're keeping you on the shortlist and will reach out when a task that fits your profile opens up.

— InternsForAI`;
  } else {
    body = `Hi ${applicantName},

Your score on the trial test was ${Math.round(score)}/100, which is below our current bar. You're welcome to try a different skill track in two weeks — your application stays on file.

— InternsForAI`;
  }
  return { subject, text: body };
}

export function adminApplicationNotice(applicant: { display_name: string; email: string; country: string; tracks: string[]; pitch: string; adminUrl: string }) {
  const subject = `[InternsForAI] new applicant: ${applicant.display_name} (${applicant.country})`;
  const text = `New application:

Name: ${applicant.display_name}
Email: ${applicant.email}
Country: ${applicant.country}
Tracks: ${applicant.tracks.join(", ")}

Pitch:
${applicant.pitch}

Review in admin: ${applicant.adminUrl}
`;
  return { subject, text };
}

export function trialTaskInvitationEmail(applicantName: string, taskTitle: string, taskBrief: string, dashboardUrl: string, payUsd: number) {
  const subject = `InternsForAI — your $${payUsd.toFixed(2)} trial task: ${taskTitle}`;
  const text = `Hi ${applicantName},

Trial task ready:

Title: ${taskTitle}
Pay: $${payUsd.toFixed(2)} on acceptance

Brief:
${taskBrief}

Claim and submit it here:
${dashboardUrl}

— InternsForAI`;
  return { subject, text };
}
