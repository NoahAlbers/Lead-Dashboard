-- Live form sessions: what the visitor has typed so far, and how many times
-- they came back. Additive and safe to re-run.

ALTER TABLE form_sessions ADD COLUMN IF NOT EXISTS answers_json JSONB;
ALTER TABLE form_sessions ADD COLUMN IF NOT EXISTS answers_at TIMESTAMP(3);
ALTER TABLE form_sessions ADD COLUMN IF NOT EXISTS return_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS form_sessions_last_seen_at_idx ON form_sessions(last_seen_at);

-- What kind of connection the visitor is on, looked up once per session.
ALTER TABLE form_sessions ADD COLUMN IF NOT EXISTS ip_type TEXT;
ALTER TABLE form_sessions ADD COLUMN IF NOT EXISTS ip_isp TEXT;
CREATE INDEX IF NOT EXISTS form_sessions_ip_idx ON form_sessions(ip);
