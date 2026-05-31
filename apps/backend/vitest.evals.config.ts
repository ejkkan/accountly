import { defineConfig } from "vitest/config";

/**
 * Config for the opt-in scenario regression suite (`pnpm test:evals`).
 * Separate from the default `pnpm test` (deterministic unit tests) because
 * these call the real model: only `*.eval.ts` files, and a long per-test
 * timeout to cover the parse round-trip.
 */
export default defineConfig({
  test: {
    include: ["evals/**/*.eval.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
