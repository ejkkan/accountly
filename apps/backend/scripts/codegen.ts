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
    "--out-file",
    outFile,
    // Skip migrator bookkeeping tables — they're not part of the app schema.
    "--exclude-pattern",
    "kysely_*",
  ],
  { stdio: "inherit" }
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`[codegen] wrote ${path.relative(process.cwd(), outFile)}`);
