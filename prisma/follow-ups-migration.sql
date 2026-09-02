-- Follow-up reminders: track when the due notification was sent so the cron
-- fires it exactly once.
ALTER TABLE follow_up_reminders ADD COLUMN IF NOT EXISTS notified_at TIMESTAMP(3);
