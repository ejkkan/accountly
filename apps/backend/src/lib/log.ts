/**
 * One structured log line. JSON-encoded so a `grep` of the dev terminal (or
 * Cloudflare Logpush in prod) lands the fields you'd actually filter on:
 * `billId`, `at`, `ms`.
 *
 * Intentionally minimalist — no levels, no transports, no request-scoped
 * context object. The route handlers carry whatever IDs are interesting and
 * pass them in the `fields` map.
 *
 * Sprinkle these only at debug-significant moments:
 *   - Multi-step flows where you want to see *which* step is slow
 *   - Error paths so 5xx responses have a matching log line
 *   - Decisions that change DB state (approve/decline)
 *
 * Don't add one per route — wrangler already emits an access log per
 * request. We're tracing what's *inside* the request, not duplicating it.
 */
export function log(at: string, fields: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ t: new Date().toISOString(), at, ...fields }));
}

/**
 * Tiny stopwatch — `const stop = startTimer(); doWork(); log("...", { ms: stop() })`.
 * Avoids littering routes with `Date.now()` arithmetic.
 */
export function startTimer(): () => number {
  const start = Date.now();
  return () => Date.now() - start;
}
