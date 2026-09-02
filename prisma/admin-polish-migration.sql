-- Admin polish: user sign-in tracking + invite flow.
-- Idempotent and non-destructive (safe to re-run). Apply to the lead-console
-- database via the Neon SQL Editor or
-- `psql "<DATABASE_URL>" -f prisma/admin-polish-migration.sql`.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_active_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "invite_token" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "invite_expires_at" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "users_invite_token_key" ON "users"("invite_token");
