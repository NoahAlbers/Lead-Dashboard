-- Advanced Lead Inbox Filters + Pinned Views — schema + backfill.
-- Idempotent and non-destructive (safe to re-run). Apply to the lead-console
-- database (the one in your DATABASE_URL, db "neondb") via the Neon SQL Editor,
-- `psql "<DATABASE_URL>" -f prisma/advanced-filters-migration.sql`, or the
-- companion runner prisma/apply-advanced-filters-migration.mjs.

ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "account_volume_num" INTEGER;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "avg_rent_num" INTEGER;
CREATE INDEX IF NOT EXISTS "leads_score_idx" ON "leads"("score");
CREATE INDEX IF NOT EXISTS "leads_account_volume_num_idx" ON "leads"("account_volume_num");
CREATE INDEX IF NOT EXISTS "leads_avg_rent_num_idx" ON "leads"("avg_rent_num");
ALTER TABLE "saved_views" ADD COLUMN IF NOT EXISTS "is_pinned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "saved_views" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;

-- Units: parse the leading integer out of the account_volume text column.
UPDATE "leads"
SET "account_volume_num" = substring(regexp_replace("account_volume", '[^0-9-]', '', 'g') from '^-?[0-9]+')::integer
WHERE "account_volume_num" IS NULL
  AND "account_volume" IS NOT NULL
  AND substring(regexp_replace("account_volume", '[^0-9-]', '', 'g') from '^-?[0-9]+') IS NOT NULL;

-- Avg rent: pull from raw payload JSON (_rawIntakeForm.avgRent, fallback top-level avgRent).
UPDATE "leads"
SET "avg_rent_num" = round((COALESCE("raw_payload_json"->'_rawIntakeForm'->>'avgRent', "raw_payload_json"->>'avgRent'))::numeric)::integer
WHERE "avg_rent_num" IS NULL
  AND COALESCE("raw_payload_json"->'_rawIntakeForm'->>'avgRent', "raw_payload_json"->>'avgRent') ~ '^[0-9]+(\.[0-9]+)?$';

-- Sanity check (real lead count => you hit the right database):
SELECT count(*) AS leads, count("account_volume_num") AS with_units, count("avg_rent_num") AS with_rent FROM "leads";
