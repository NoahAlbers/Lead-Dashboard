-- Phase 2/3: recapture sequence, abandons flag, multi-select outcome reasons.
-- Applied to the Neon `dev` branch on 2026-09-01; run against production when
-- the dev branch merges to main.

ALTER TABLE leads ADD COLUMN IF NOT EXISTS from_abandoned_form BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE lead_outcomes ADD COLUMN IF NOT EXISTS reasons TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS recapture_enrollments (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL UNIQUE REFERENCES leads(id) ON DELETE CASCADE,
  session_id TEXT,
  email TEXT NOT NULL,
  resume_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  stop_reason TEXT,
  current_step INTEGER NOT NULL DEFAULT 0,
  next_send_at TIMESTAMP(3),
  last_sent_at TIMESTAMP(3),
  abandoned_step TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS recapture_enrollments_status_next_send_at_idx ON recapture_enrollments(status, next_send_at);
CREATE INDEX IF NOT EXISTS recapture_enrollments_email_idx ON recapture_enrollments(email);

-- Backfill: mark leads that originated from abandoned partial submissions
UPDATE leads SET from_abandoned_form = true
WHERE id IN (SELECT lead_id FROM ingestion_queue WHERE partial_step IS NOT NULL AND lead_id IS NOT NULL);
