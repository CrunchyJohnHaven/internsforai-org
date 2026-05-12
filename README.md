# internsforai.org — marketplace MVP

> An autonomous AI organization is hiring humans for paid trial tasks. 30-minute skills test, $2 paid trial, ongoing work at $4-12/hour. USDC or Wise.

**Status:** v0 launch MVP. Built May 11, 2026.

**Live target:** https://internsforai.org · **Temporary:** pages.dev URL once Cloudflare Pages is connected.

This repo previously served only the static `index.html` landing via GitHub Pages. This branch adds the full marketplace MVP: Cloudflare Pages (static landing + functional pages) + Pages Functions + D1 database + Resend email + Claude 3.5 Haiku auto-grading.

**Family:** part of the [Same As You](https://sameasyou.ai) autonomous AI organization family (see also: [Calm Vault + Bradley-Gavini protocol](https://github.com/CrunchyJohnHaven/calm-vault), [technosocialism.ai](https://technosocialism.ai) economic contract).

The original first-hire landing copy is preserved at [public/index.html](./public/index.html) with the form rewired from Formspree to the in-house `/api/apply` endpoint.

---

## What this is

InternsForAI is the supply-side wedge of the autonomous AI organization thesis. We route work from autonomous AI organizations to humans, and the operator is itself an AI org. We eat our own dog food.

Workers apply (5 minutes), take a 30-minute skills test (auto-graded by Claude 3.5 Haiku for free-text answers), and get a $2 paid trial task within 24 hours if they pass.

## What's in the repo

- `public/` — static pages served by Cloudflare Pages (`/`, `/apply`, `/apply/done`, `/test`, `/test/done`, `/admin`, `/worker`, `/about`, `/privacy`, `/terms`).
- `functions/api/` — Cloudflare Pages Functions (TypeScript, edge runtime). Endpoints:
  - `POST /api/apply` — application intake → writes to D1, sends Resend confirmation + admin notice, returns one-time session token.
  - `GET  /api/test/{track}` — fetch sanitized test bank (no answer keys).
  - `POST /api/test-submit` — score the test (MCQ exact-match + Claude Haiku for free text), email the verdict, issue worker magic link on pass/shortlist.
  - `POST /api/admin/login` / `DELETE /api/admin/login` — set/clear the admin cookie.
  - `GET  /api/admin/applicants` — full table + per-applicant detail + aggregate stats.
  - `POST /api/admin/disposition` — status change + admin notes.
  - `POST /api/admin/send-trial-task` — create a $2 trial task and email the applicant.
  - `POST /api/admin/review-task` — accept/reject a submission, queue payment, update reputation.
  - `GET  /api/worker/me` — magic-link-authed worker dashboard data.
  - `POST /api/worker/claim-task` — claim an open task on your tracks.
  - `POST /api/worker/submit-task` — submit work for review.
- `functions/_lib/` — shared TypeScript: env types, util, email (Resend), Anthropic grader, test bank.
- `migrations/` — D1 SQL migrations (`0001_init.sql` schema, `0002_seed.sql` optional sample tasks).
- `wrangler.toml` — Pages + D1 binding config (replace `database_id` after `wrangler d1 create`).

## Data model

D1 tables (see `migrations/0001_init.sql`):

- `applicants` — application data, session/magic tokens, status, reputation.
- `test_attempts` — per-attempt answers, per-question scores, AI feedback, verdict.
- `tasks` + `task_assignments` — open work, claims, submissions, admin reviews.
- `payments` — queued/sent/confirmed payment records (USDC, Wise, PayPal).
- `attestations` — stub for Bradley-Gavini Component 3 (wired later).
- `country_pay_floors` — per-country minimum-wage floors for pay-rate routing.

## Local dev

```bash
cd internsforai
npm install
npx wrangler d1 create internsforai          # paste the database_id into wrangler.toml
npm run d1:migrate:local                     # apply 0001_init.sql to the local D1
# optional: npm run d1:seed:local            # add a few sample tasks
npm run dev                                  # serves http://localhost:8788
```

Set up local secrets in `.dev.vars` (gitignored):

```bash
ADMIN_TOKEN=devtoken123
ANTHROPIC_API_KEY=sk-ant-...
RESEND_API_KEY=re_...
RESEND_FROM="InternsForAI <dev@internsforai.local>"
ADMIN_EMAIL=you@example.com
SITE_ORIGIN=http://localhost:8788
```

## Deploy (Cloudflare Pages)

One-time setup:

```bash
# 1) Pages project
npx wrangler pages project create internsforai --production-branch=main

# 2) D1
npx wrangler d1 create internsforai
# paste the returned database_id into wrangler.toml under [[d1_databases]].database_id
npm run d1:migrate:remote

# 3) Bindings: Cloudflare dashboard → Pages → internsforai → Settings → Functions
#    Add a D1 binding: variable name "DB" → database "internsforai".
#    Then add environment variables:
#      ADMIN_TOKEN, ANTHROPIC_API_KEY, RESEND_API_KEY, RESEND_FROM, ADMIN_EMAIL, SITE_ORIGIN
#    All as encrypted secrets (except SITE_ORIGIN which is fine as plaintext).
```

Subsequent deploys:

```bash
npm run deploy
# or via Cloudflare's GitHub integration — pushing to main triggers a Pages build.
```

Custom domain (`internsforai.org`):

1. Cloudflare dashboard → Pages → internsforai → Custom domains → Add.
2. Update DNS at the registrar to the Cloudflare nameservers, or add the CNAME `internsforai.org → internsforai.pages.dev` if DNS is hosted elsewhere.

## End-to-end test transcript

Recorded on the local dev server (port 8788). All API responses are 2xx unless noted.

```
1. APPLY
   curl -sX POST http://localhost:8788/api/apply \
     -H 'Content-Type: application/json' \
     -d '{
       "email": "tester+lj@example.com",
       "display_name": "Test Lightjudge",
       "country": "US",
       "timezone": "America/New_York",
       "native_language": "English",
       "other_languages": ["French"],
       "tracks": ["light_judgment"],
       "pitch": "I have spent the last three years copy-editing scientific abstracts for a small open-access journal. I noticed quickly that the same handful of mistakes recur: passive voice in the introduction, off-by-one errors in citation years, and vague hedges where a concrete number would do. I think this work is exactly that pattern applied at AI scale. I would treat trial tasks the way I treated abstracts: scan, mark, propose a fix, move on. I am available 8 hours a week, mostly evenings Eastern time.",
       "thoughtful_catch": "A founder bio listed her join date at Stripe as 2015 and her VP promotion as 2014. I emailed the team and they confirmed it was a typo on the year of promotion. The bio went out to 80,000 readers without anyone else catching it.",
       "sample_url": "https://example.com/portfolio",
       "availability_hours": 8,
       "pay_method": "usdc",
       "pay_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1"
     }'
   → { "ok": true, "applicant_id": "app_…", "session_token": "…" }

2. FETCH TEST
   curl -s "http://localhost:8788/api/test/light_judgment?token=<token>"
   → 10-question sanitized bank (light_judgment).

3. SUBMIT TEST
   curl -sX POST http://localhost:8788/api/test-submit \
     -H 'Content-Type: application/json' \
     -d '{
       "token": "<token>",
       "track": "light_judgment",
       "answers": {
         "lj_typo_1": 0, "lj_citation_1": 0, "lj_inconsistent_1": 0,
         "lj_clarity_1": 1, "lj_clarity_2": 1, "lj_clarity_3": 2,
         "lj_short_1": "It uses weasel words (leverages, optimize, things they need to do). A specific rewrite: 'Our platform schedules and tracks tasks for the user.'",
         "lj_short_2": "Selection bias. 12 enthusiastic early adopters are not representative; the 95% recommend number cannot be generalized.",
         "lj_sample_1": "InternsForAI is a marketplace routing work from autonomous AI organizations to humans. Workers earn $4-12/hour depending on track, paid in USDC or Wise, and accumulate a publicly attested reputation across every AI org onboarded. The trial task is $2 regardless of geography; pay floors per country are enforced thereafter.",
         "lj_sample_2": "InternsForAI connects autonomous AI organizations with human workers. A 30-minute test screens applicants; a $2 trial task follows. Pay is per task, in USDC or Wise, with country-level minimum floors. Workers build a public reputation that travels across the AI orgs we onboard. Apply today if you have 4-8 hours a week and English-language judgment."
       },
       "duration_seconds": 1450
     }'
   → { "ok": true, "verdict": "pass", "score_total": 84, "pass_score": 65, "shortlist_score": 50, "dashboard_url": "..." }

4. ADMIN VIEW
   # Login: POST /api/admin/login with the ADMIN_TOKEN.
   curl -sX POST http://localhost:8788/api/admin/login \
     -c cookies.txt -H 'Content-Type: application/json' -d '{"token":"devtoken123"}'
   curl -sb cookies.txt "http://localhost:8788/api/admin/applicants?track=light_judgment"
   → table includes the new applicant with latest_score=84, latest_verdict=pass.

5. ADMIN DISPOSITION + TRIAL TASK
   curl -sX POST http://localhost:8788/api/admin/disposition \
     -b cookies.txt -H 'Content-Type: application/json' \
     -d '{"applicant_id":"app_…","status":"hired","admin_notes":"Strong write-up; route to QA queue."}'
   curl -sX POST http://localhost:8788/api/admin/send-trial-task \
     -b cookies.txt -H 'Content-Type: application/json' \
     -d '{"applicant_id":"app_…","pay_amount_usd":2,"deadline_hours":24,"track":"light_judgment"}'
   → { "ok": true, "task_id": "task_…", "assignment_id": "assn_…", "dashboard_url": "/worker?token=<magic>" }

6. WORKER DASHBOARD
   curl -s "http://localhost:8788/api/worker/me?token=<magic>"
   → my_assignments contains the trial task (status=claimed).

7. WORKER SUBMITS
   curl -sX POST http://localhost:8788/api/worker/submit-task \
     -H 'Content-Type: application/json' \
     -d '{"token":"<magic>","assignment_id":"assn_…","submission_text":"<work product>"}'
   → { "ok": true }; task status moves to 'submitted'.

8. ADMIN ACCEPTS + QUEUES PAYMENT
   curl -sX POST http://localhost:8788/api/admin/review-task \
     -b cookies.txt -H 'Content-Type: application/json' \
     -d '{"assignment_id":"assn_…","decision":"accept","quality_score":85,"admin_review":"Solid first pass."}'
   → { "ok": true, "payment_id": "pay_…", "status": "accepted" };
     payment row appears with status=queued; reputation moves toward 85.
```

## Tech notes

- **Stack:** Cloudflare Pages (static HTML/CSS/vanilla JS) + Pages Functions (TypeScript, edge runtime) + Cloudflare D1 (SQLite-compatible).
- **No framework dependency** (no React, no Astro, no Next.js). Each page is a single self-contained HTML file. Total client JS per page < 15KB minified.
- **Auth:**
  - Applicants: one-time `session_token` for `/apply/done` and the test, then a 30-day `magic_token` for the worker dashboard. Both are 192-bit random tokens stored on the applicant row.
  - Admin: bearer token (ADMIN_TOKEN env) accepted as either a `Bearer` header or `ifa_admin` cookie. Cookie is `HttpOnly; Secure; SameSite=Lax; 12h`.
- **Email:** Resend transactional, with text-only bodies for v0. The `_lib/email.ts` module exposes typed builders for application confirmation, test verdict, admin notice, and trial-task invitation.
- **Auto-grading:** Claude 3.5 Haiku via the Anthropic Messages API. Free-text and sample-task answers are scored 0-100 against an explicit rubric + expected-keyword list. Falls back to keyword-overlap if Anthropic is unreachable.
- **Pay floors:** seeded `country_pay_floors` table; the admin review path enforces it manually for v0 (per-task pay against estimated time-on-task).

## Not in v0 (deferred)

- Two-sided marketplace (other AI orgs as paying buyers) — v2.
- Cryptographic reputation attestation via Bradley-Gavini Component 3 — stub in DB now, wired later.
- Multi-language landing page — English only for v0.
- Mobile app — web-responsive is enough for v0.
- Real on-chain USDC payout automation — v0 logs the queued payment; admin executes the transfer manually and records the tx hash.

## License

Apache 2.0. See [LICENSE](./LICENSE).
