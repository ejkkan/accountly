/**
 * Kysely migration runner. Reads .dev.vars for DATABASE_URL_DIRECT (Neon's
 * non-pooled endpoint — required for DDL + transactional safety; Workers can
 * never reach this script, it only runs from Node).
 *
 *   pnpm db:migrate            # up to latest
 *   pnpm db:rollback           # one step down
 *   pnpm db:migrate reset      # all the way down then back up (dev only)
 */

import * as path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { FileMigrationProvider, Kysely, Migrator, NO_MIGRATIONS, PostgresDialect } from "kysely";
import { Pool } from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// `.dev.vars` is a flat KEY=value file the same shape as `.env`. dotenv parses
// it without complaint.
loadDotenv({ path: path.join(__dirname, "..", ".dev.vars") });

const connectionString = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL_DIRECT (or DATABASE_URL) missing — copy .dev.vars.example to .dev.vars"
  );
}

const db = new Kysely<unknown>({
  dialect: new PostgresDialect({
    pool: new Pool({ connectionString, max: 1 }),
  }),
});

const migrator = new Migrator({
  db,
  provider: new FileMigrationProvider({
    fs,
    path,
    migrationFolder: path.join(__dirname, "..", "migrations"),
  }),
});

async function main(): Promise<void> {
  const cmd = process.argv[2] ?? "up";

  if (cmd === "down") {
    const { error, results } = await migrator.migrateDown();
    report("down", results, error);
    return;
  }

  if (cmd === "reset") {
    const { error: dErr, results: dRes } = await migrator.migrateTo(NO_MIGRATIONS);
    report("down (reset)", dRes, dErr);
    if (dErr) return;
    const { error: uErr, results: uRes } = await migrator.migrateToLatest();
    report("up (reset)", uRes, uErr);
    return;
  }

  const { error, results } = await migrator.migrateToLatest();
  report("up", results, error);
}

function report(
  phase: string,
  results: Array<{ migrationName: string; status: string }> | undefined,
  error: unknown
): void {
  for (const r of results ?? []) {
    console.log(`[${phase}] ${r.status.padEnd(8)} ${r.migrationName}`);
  }
  if (error) {
    console.error(`[${phase}] failed:`, error);
    process.exitCode = 1;
  } else if (!results || results.length === 0) {
    console.log(`[${phase}] nothing to do`);
  }
}

await main();
await db.destroy();
