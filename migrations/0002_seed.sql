-- Optional seed data. Apply with:
--   wrangler d1 execute internsforai --remote --file=./migrations/0002_seed.sql
-- Idempotent: uses INSERT OR IGNORE.

INSERT OR IGNORE INTO tasks (id, title, brief, track, difficulty, pay_amount_usd, pay_currency, status, is_trial, deadline_at, created_by, created_at, updated_at)
VALUES (
  'task_seed_lj_qa1',
  'QA pass on a 600-word AI-generated post',
  'Read the attached AI-generated post (admin will paste in the dashboard). Flag (a) anything that reads as boilerplate, (b) factual or arithmetic inconsistencies, (c) sentences that would damage reader trust. Submit a 50-100 word edit summary and a corrected version.',
  'light_judgment',
  'light_judgment',
  4.00,
  'USD',
  'open',
  0,
  CAST(strftime('%s','now') AS INTEGER) + 86400 * 3,
  'admin',
  CAST(strftime('%s','now') AS INTEGER),
  CAST(strftime('%s','now') AS INTEGER)
);

INSERT OR IGNORE INTO tasks (id, title, brief, track, difficulty, pay_amount_usd, pay_currency, status, is_trial, deadline_at, created_by, created_at, updated_at)
VALUES (
  'task_seed_lj_qa2',
  'Spot the inconsistency: founder bios',
  'Read 5 founder bios (admin will paste in the dashboard). Identify any internal inconsistencies in dates, titles, employer names, or claims. Submit a numbered list (one bio per line).',
  'light_judgment',
  'light_judgment',
  5.00,
  'USD',
  'open',
  0,
  CAST(strftime('%s','now') AS INTEGER) + 86400 * 3,
  'admin',
  CAST(strftime('%s','now') AS INTEGER),
  CAST(strftime('%s','now') AS INTEGER)
);

INSERT OR IGNORE INTO tasks (id, title, brief, track, difficulty, pay_amount_usd, pay_currency, status, is_trial, deadline_at, created_by, created_at, updated_at)
VALUES (
  'task_seed_mech_dedup',
  'Dedup a 200-row contact list',
  'Open the CSV admin will paste, dedup by canonical email, keep the longest display name. Submit cleaned CSV.',
  'mechanical',
  'mechanical',
  6.00,
  'USD',
  'open',
  0,
  CAST(strftime('%s','now') AS INTEGER) + 86400 * 3,
  'admin',
  CAST(strftime('%s','now') AS INTEGER),
  CAST(strftime('%s','now') AS INTEGER)
);
