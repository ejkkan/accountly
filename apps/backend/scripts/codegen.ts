/**
 * Introspects the Neon database via the direct (non-pooled) endpoint and
 * writes Kysely types to src/db.types.ts.
 *
 * Run after every successful `pnpm db:migrate` so the runtime types stay in
 * lockstep with the actual schema. Driving the CLI from a script (instead of
 * calling the binary) lets us share `.dev.vars` loading with the migrator and
 * keep camelCase identifiers as-is.
 */

import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { config as loadDotenv } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.join(__dirname, "..", ".dev.vars") });

const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL_DIRECT (or DATABASE_URL) missing — fill in .dev.vars");
}

const outFile = path.join(__dirname, "..", "src", "db.types.ts");

const result = spawnSync(
  "pnpm",
  [
    "exec",
    "kysely-codegen",
    "--url",
    url,
    "--dialect",
    "postgres",
    "--camel-case",
    // Keep DATE columns as `YYYY-MM-DD` strings — pg's default Date object
    // serialises with a UTC offset that mangles calendar dates (an invoice
    // dated 2026-03-10 surfaces as "...T23:00:00.000Z" depending on tz).
    // Pair with `types.setTypeParser(1082, v => v)` in src/db.ts so the
    // runtime value matches.
    "--date-parser",
    "string",
    "--out-file",
    outFile,
    "--exclude-pattern",
    "kysely_*",
  ],
  { stdio: "inherit" }
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`[codegen] wrote ${path.relative(process.cwd(), outFile)}`);
