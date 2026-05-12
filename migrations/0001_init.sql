-- InternsForAI v0 schema
-- Cloudflare D1 (SQLite)

CREATE TABLE applicants (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  country TEXT NOT NULL,
  timezone TEXT NOT NULL,
  native_language TEXT,
  other_languages TEXT,            -- JSON array
  tracks TEXT NOT NULL,            -- JSON array of skill tracks
  pitch TEXT NOT NULL,             -- "why a great trial worker" paragraph
  thoughtful_catch TEXT NOT NULL,  -- editorial-catch paragraph
  sample_url TEXT,
  availability_hours INTEGER NOT NULL,
  pay_method TEXT NOT NULL,        -- usdc | wise | paypal
  pay_address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | shortlist | hired | disqualified | inactive
  session_token TEXT NOT NULL,     -- one-time link to /apply/done and /test/{track}
  magic_token TEXT,                -- worker dashboard magic link
  magic_expires_at INTEGER,
  reputation REAL NOT NULL DEFAULT 0, -- 0-100 aggregate
  admin_notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_applicants_status ON applicants (status);
CREATE INDEX idx_applicants_country ON applicants (country);
CREATE INDEX idx_applicants_session ON applicants (session_token);
CREATE INDEX idx_applicants_magic ON applicants (magic_token);

CREATE TABLE test_attempts (
  id TEXT PRIMARY KEY,
  applicant_id TEXT NOT NULL,
  track TEXT NOT NULL,
  answers TEXT NOT NULL,           -- JSON object
  per_question_scores TEXT,        -- JSON array of per-question scores
  ai_feedback TEXT,                -- JSON: free-text/AI scoring details
  score_total REAL NOT NULL,       -- 0-100
  verdict TEXT NOT NULL,           -- pass | shortlist | fail
  duration_seconds INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (applicant_id) REFERENCES applicants(id)
);

CREATE INDEX idx_attempts_applicant ON test_attempts (applicant_id);
CREATE INDEX idx_attempts_track ON test_attempts (track);
CREATE INDEX idx_attempts_verdict ON test_attempts (verdict);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  brief TEXT NOT NULL,
  track TEXT NOT NULL,
  difficulty TEXT NOT NULL,        -- mechanical | light_judgment | heavy_judgment | specialized | domain_expert
  pay_amount_usd REAL NOT NULL,    -- gross pay in USD
  pay_currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'open', -- open | claimed | submitted | accepted | rejected
  is_trial INTEGER NOT NULL DEFAULT 0, -- 1 for $2 trial task
  deadline_at INTEGER,
  created_by TEXT NOT NULL,        -- admin id (env-authed)
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_tasks_track_status ON tasks (track, status);
CREATE INDEX idx_tasks_status ON tasks (status);

CREATE TABLE task_assignments (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  applicant_id TEXT NOT NULL,
  claimed_at INTEGER NOT NULL,
  submitted_at INTEGER,
  submission_text TEXT,
  quality_score REAL,              -- 0-100
  admin_review TEXT,
  status TEXT NOT NULL DEFAULT 'claimed', -- claimed | submitted | accepted | rejected
  FOREIGN KEY (task_id) REFERENCES tasks(id),
  FOREIGN KEY (applicant_id) REFERENCES applicants(id)
);

CREATE INDEX idx_assignments_applicant ON task_assignments (applicant_id);
CREATE INDEX idx_assignments_task ON task_assignments (task_id);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  applicant_id TEXT NOT NULL,
  task_assignment_id TEXT,
  amount_usd REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  pay_method TEXT NOT NULL,
  pay_address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued', -- queued | sent | confirmed | failed
  external_ref TEXT,               -- e.g. tx hash, Wise transfer id
  note TEXT,
  created_at INTEGER NOT NULL,
  paid_at INTEGER,
  FOREIGN KEY (applicant_id) REFERENCES applicants(id),
  FOREIGN KEY (task_assignment_id) REFERENCES task_assignments(id)
);

CREATE INDEX idx_payments_applicant ON payments (applicant_id);
CREATE INDEX idx_payments_status ON payments (status);

-- Stub for AAL Component 3 reputation attestations (wired later)
CREATE TABLE attestations (
  id TEXT PRIMARY KEY,
  applicant_id TEXT NOT NULL,
  kind TEXT NOT NULL,              -- task_quality | test_pass | identity | governance
  ref_id TEXT,                     -- task_assignment_id, test_attempt_id, etc.
  payload TEXT NOT NULL,           -- JSON
  signature TEXT,                  -- placeholder for Bradley-Gavini attestation
  created_at INTEGER NOT NULL,
  FOREIGN KEY (applicant_id) REFERENCES applicants(id)
);

CREATE INDEX idx_attestations_applicant ON attestations (applicant_id);
CREATE INDEX idx_attestations_kind ON attestations (kind);

-- Country minimum-wage floors for pay-rate routing (USD/hour, 2026).
-- Admin can override per-applicant via admin notes; this is the floor.
CREATE TABLE country_pay_floors (
  country TEXT PRIMARY KEY,
  min_hourly_usd REAL NOT NULL,
  notes TEXT
);

INSERT INTO country_pay_floors (country, min_hourly_usd, notes) VALUES
  ('US', 7.25, 'US federal minimum wage. State minimums may be higher; admin must check.'),
  ('CA', 12.00, 'Canada province-dependent; conservative floor.'),
  ('GB', 11.44, 'UK National Living Wage 21+ (2024 figure, conservative).'),
  ('AU', 16.50, 'Australia national minimum (approx USD).'),
  ('DE', 13.00, 'Germany statutory minimum (approx USD).'),
  ('FR', 12.00, 'France SMIC (approx USD).'),
  ('PH', 0.50, 'No federal minimum applicable; trial-task floor.'),
  ('IN', 0.30, 'No federal minimum applicable; trial-task floor.'),
  ('NG', 0.30, 'No federal minimum applicable; trial-task floor.'),
  ('BR', 1.50, 'Brazil minimum (approx USD).'),
  ('MX', 1.20, 'Mexico minimum (approx USD).'),
  ('OTHER', 0.50, 'Default trial-task floor for unlisted countries; admin must confirm before paid work.');
