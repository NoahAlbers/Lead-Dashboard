-- Phase 1: lead-facing email foundation.
-- Applied to the Neon `dev` branch on 2026-09-01; run against production when
-- the dev branch merges to main.

CREATE TABLE IF NOT EXISTS email_suppressions (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  reason TEXT NOT NULL,
  source TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT email_suppressions_email_key UNIQUE (email)
);

INSERT INTO system_config (id, key, value) VALUES
 ('cfg-email-sender-default','email_sender_default','"Advanced Collection Bureau <noreply@advancedcb.com>"'::jsonb),
 ('cfg-email-sender-hv','email_sender_high_value','"Noah Albers <nalbers@advancedcb.com>"'::jsonb),
 ('cfg-lead-confirm','lead_confirmation_enabled','true'::jsonb),
 ('cfg-hot-conditions','hot_lead_conditions','{"minUnits":500,"requireAllGoodStates":true,"excludedRentalTypes":["affordable","section 8","section8"],"requiredDebtKeywords":["residential"],"ownershipKeywords":["own"]}'::jsonb)
ON CONFLICT (key) DO NOTHING;
