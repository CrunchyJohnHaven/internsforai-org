import type { Env } from "../_lib/types";
import { TRACKS, type Track } from "../_lib/types";
import {
  json,
  badRequest,
  serverError,
  newId,
  randomToken,
  nowSeconds,
  isValidEmail,
  clampText,
} from "../_lib/util";
import { sendEmail, applicationConfirmationEmail, adminApplicationNotice } from "../_lib/email";

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  // ---- Validation ----
  const email = clampText(body.email, 254).toLowerCase();
  if (!isValidEmail(email)) return badRequest("Valid email is required.");

  const display_name = clampText(body.display_name, 80);
  if (display_name.length < 2) return badRequest("Display name is required (2-80 chars).");

  const country = clampText(body.country, 8).toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) return badRequest("Country must be an ISO-3166 2-letter code (e.g. US, PH, IN).");

  const timezone = clampText(body.timezone, 60);
  if (timezone.length < 3) return badRequest("Timezone is required (e.g. America/New_York).");

  const native_language = clampText(body.native_language, 40) || null;
  const other_languages_raw = Array.isArray(body.other_languages) ? body.other_languages : [];
  const other_languages = other_languages_raw
    .filter((l): l is string => typeof l === "string")
    .map((l) => clampText(l, 40))
    .filter(Boolean)
    .slice(0, 12);

  const tracks_raw = Array.isArray(body.tracks) ? body.tracks : [];
  const tracks: Track[] = tracks_raw
    .filter((t): t is string => typeof t === "string")
    .filter((t): t is Track => (TRACKS as readonly string[]).includes(t));
  if (tracks.length === 0) return badRequest("Pick at least one skill track.");

  const pitch = clampText(body.pitch, 4000);
  if (pitch.split(/\s+/).filter(Boolean).length < 30) {
    return badRequest("Pitch must be at least 30 words (aim for 100-300).");
  }

  const thoughtful_catch = clampText(body.thoughtful_catch, 4000);
  if (thoughtful_catch.split(/\s+/).filter(Boolean).length < 15) {
    return badRequest("Editorial-catch answer must be at least 15 words.");
  }

  const sample_url_raw = clampText(body.sample_url, 500);
  let sample_url: string | null = null;
  if (sample_url_raw.length > 0) {
    try {
      const u = new URL(sample_url_raw);
      if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("bad protocol");
      sample_url = u.toString().slice(0, 500);
    } catch {
      return badRequest("Sample work URL must be a valid http(s) URL or empty.");
    }
  }

  const availability_hours = Number(body.availability_hours);
  if (!Number.isFinite(availability_hours) || availability_hours < 1 || availability_hours > 80) {
    return badRequest("Availability must be 1-80 hours/week.");
  }

  const pay_method_raw = clampText(body.pay_method, 16).toLowerCase();
  if (!["usdc", "wise", "paypal"].includes(pay_method_raw)) {
    return badRequest("Payment method must be 'usdc', 'wise', or 'paypal'.");
  }
  const pay_method = pay_method_raw as "usdc" | "wise" | "paypal";

  const pay_address = clampText(body.pay_address, 300);
  if (pay_address.length < 3) return badRequest("Payment address is required.");

  // Soft validation per pay method.
  if (pay_method === "usdc" && !/^0x[a-fA-F0-9]{40}$/.test(pay_address) && !/^[A-Za-z0-9]{32,48}$/.test(pay_address)) {
    return badRequest("USDC wallet looks malformed. Provide an EVM (0x...) or Solana base58 address.");
  }
  if ((pay_method === "wise" || pay_method === "paypal") && !isValidEmail(pay_address)) {
    return badRequest(`${pay_method.toUpperCase()} address should be an email.`);
  }

  const now = nowSeconds();
  const id = newId("app");
  const session_token = randomToken(24);

  // ---- Insert (upsert by email; the latest application overrides) ----
  try {
    // Check for existing applicant by email.
    const existing = await env.DB.prepare(
      "SELECT id FROM applicants WHERE email = ?1"
    ).bind(email).first<{ id: string }>();

    if (existing?.id) {
      await env.DB.prepare(
        `UPDATE applicants SET
            display_name = ?2, country = ?3, timezone = ?4,
            native_language = ?5, other_languages = ?6,
            tracks = ?7, pitch = ?8, thoughtful_catch = ?9,
            sample_url = ?10, availability_hours = ?11,
            pay_method = ?12, pay_address = ?13,
            session_token = ?14, status = 'pending',
            updated_at = ?15
         WHERE id = ?1`
      )
        .bind(
          existing.id,
          display_name,
          country,
          timezone,
          native_language,
          JSON.stringify(other_languages),
          JSON.stringify(tracks),
          pitch,
          thoughtful_catch,
          sample_url,
          availability_hours,
          pay_method,
          pay_address,
          session_token,
          now
        )
        .run();

      await fireSideEffects(env, {
        applicantId: existing.id,
        display_name,
        email,
        country,
        tracks,
        pitch,
        session_token,
      });
      return json({ ok: true, applicant_id: existing.id, session_token, updated: true });
    }

    await env.DB.prepare(
      `INSERT INTO applicants
        (id, email, display_name, country, timezone, native_language, other_languages,
         tracks, pitch, thoughtful_catch, sample_url, availability_hours,
         pay_method, pay_address, status, session_token, reputation,
         created_at, updated_at)
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,'pending',?15,0,?16,?16)`
    )
      .bind(
        id,
        email,
        display_name,
        country,
        timezone,
        native_language,
        JSON.stringify(other_languages),
        JSON.stringify(tracks),
        pitch,
        thoughtful_catch,
        sample_url,
        availability_hours,
        pay_method,
        pay_address,
        session_token,
        now
      )
      .run();

    await fireSideEffects(env, {
      applicantId: id,
      display_name,
      email,
      country,
      tracks,
      pitch,
      session_token,
    });

    return json({ ok: true, applicant_id: id, session_token, updated: false });
  } catch (err) {
    console.error("[apply] db error", err);
    return serverError("Database write failed; please try again.");
  }
};

async function fireSideEffects(
  env: Env,
  data: {
    applicantId: string;
    display_name: string;
    email: string;
    country: string;
    tracks: Track[];
    pitch: string;
    session_token: string;
  }
): Promise<void> {
  const origin = env.SITE_ORIGIN || "https://internsforai.org";
  const testUrl = `${origin}/apply/done?token=${encodeURIComponent(data.session_token)}`;
  const adminUrl = `${origin}/admin?applicant=${encodeURIComponent(data.applicantId)}`;

  // Don't block the response on email; Cloudflare Pages Functions support waitUntil
  // but we still want to await to surface dev-time failures cleanly.
  const confirm = applicationConfirmationEmail(data.display_name, testUrl);
  await sendEmail(env, { to: data.email, subject: confirm.subject, text: confirm.text });

  const notice = adminApplicationNotice({
    display_name: data.display_name,
    email: data.email,
    country: data.country,
    tracks: data.tracks,
    pitch: data.pitch,
    adminUrl,
  });
  if (env.ADMIN_EMAIL) {
    await sendEmail(env, { to: env.ADMIN_EMAIL, subject: notice.subject, text: notice.text });
  }
}
