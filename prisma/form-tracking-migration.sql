-- Form flow tracking + experiments (run on production at release, after the
-- earlier migration files). Safe to re-run.

CREATE TABLE IF NOT EXISTS form_sessions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  started_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  form_version TEXT,
  variants_json JSONB,
  utm_source TEXT, utm_medium TEXT, utm_campaign TEXT,
  referrer TEXT, source_page TEXT, device TEXT, timezone TEXT,
  geo_city TEXT, geo_region TEXT, geo_country TEXT, ip TEXT,
  furthest_step TEXT, furthest_index INTEGER NOT NULL DEFAULT 0,
  reached_contact BOOLEAN NOT NULL DEFAULT false,
  outcome TEXT NOT NULL DEFAULT 'open',
  lead_id TEXT,
  event_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS form_sessions_started_at_idx ON form_sessions(started_at);
CREATE INDEX IF NOT EXISTS form_sessions_outcome_idx ON form_sessions(outcome);
CREATE INDEX IF NOT EXISTS form_sessions_lead_id_idx ON form_sessions(lead_id);

CREATE TABLE IF NOT EXISTS form_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  at TIMESTAMP(3) NOT NULL,
  type TEXT NOT NULL,
  step TEXT,
  elapsed_ms INTEGER,
  meta_json JSONB
);
CREATE INDEX IF NOT EXISTS form_events_session_id_at_idx ON form_events(session_id, at);
CREATE INDEX IF NOT EXISTS form_events_type_at_idx ON form_events(type, at);

CREATE TABLE IF NOT EXISTS experiments (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  hypothesis TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  primary_goal TEXT NOT NULL DEFAULT 'completed',
  variants_json JSONB NOT NULL,
  started_at TIMESTAMP(3),
  ended_at TIMESTAMP(3),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE leads ADD COLUMN IF NOT EXISTS form_variants JSONB;
