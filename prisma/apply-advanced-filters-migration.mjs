// One-off migration runner for the advanced-filters feature.
//
// Runs the schema changes + backfill against your Neon database over HTTPS
// (via @neondatabase/serverless, already a project dependency) — no psql and
// no need to find the project in the Neon console. Run it from a machine that
// can reach Neon (your laptop), NOT from a restricted CI sandbox.
//
// Usage (from the repo root, after `npm install`):
//   Node 20.6+:   node --env-file=.env prisma/apply-advanced-filters-migration.mjs
//   PowerShell:   $env:DATABASE_URL="postgresql://..."; node prisma/apply-advanced-filters-migration.mjs
//   bash/zsh:     DATABASE_URL="postgresql://..." node prisma/apply-advanced-filters-migration.mjs
//
// Idempotent and non-destructive — safe to re-run.

import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Pass it via --env-file=.env or set it in your shell.");
  process.exit(1);
}

const sql = neon(url);

const ddl = [
  `ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "account_volume_num" INTEGER`,
  `ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "avg_rent_num" INTEGER`,
  `CREATE INDEX IF NOT EXISTS "leads_score_idx" ON "leads"("score")`,
  `CREATE INDEX IF NOT EXISTS "leads_account_volume_num_idx" ON "leads"("account_volume_num")`,
  `CREATE INDEX IF NOT EXISTS "leads_avg_rent_num_idx" ON "leads"("avg_rent_num")`,
  `ALTER TABLE "saved_views" ADD COLUMN IF NOT EXISTS "is_pinned" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "saved_views" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0`,
];

try {
  for (const stmt of ddl) {
    await sql.query(stmt);
    console.log("OK:", stmt);
  }

  await sql.query(
    `UPDATE "leads"
     SET "account_volume_num" = substring(regexp_replace("account_volume", '[^0-9-]', '', 'g') from '^-?[0-9]+')::integer
     WHERE "account_volume_num" IS NULL
       AND "account_volume" IS NOT NULL
       AND substring(regexp_replace("account_volume", '[^0-9-]', '', 'g') from '^-?[0-9]+') IS NOT NULL`
  );
  console.log("OK: backfilled account_volume_num");

  await sql.query(
    `UPDATE "leads"
     SET "avg_rent_num" = round((COALESCE("raw_payload_json"->'_rawIntakeForm'->>'avgRent', "raw_payload_json"->>'avgRent'))::numeric)::integer
     WHERE "avg_rent_num" IS NULL
       AND COALESCE("raw_payload_json"->'_rawIntakeForm'->>'avgRent', "raw_payload_json"->>'avgRent') ~ '^[0-9]+(\\.[0-9]+)?$'`
  );
  console.log("OK: backfilled avg_rent_num");

  const rows = await sql.query(
    `SELECT count(*)::int AS leads, count("account_volume_num")::int AS with_units, count("avg_rent_num")::int AS with_rent FROM "leads"`
  );
  console.log("Done. Counts:", rows[0]);
  console.log("If 'leads' matches your real lead count, you hit the right database. ✅");
} catch (err) {
  console.error("Migration failed:", err.message ?? err);
  process.exit(1);
}
