import type { ContentfulStatusCode } from "hono/utils/http-status";

/**
 * The one error class the rest of the backend throws. Carries the HTTP
 * status, a stable machine code, a human-facing message, and optional
 * per-field validation details.
 *
 * The root `app.onError` in index.ts translates this into the standard
 * `{ error: { code, message, fields? } }` body. Any other thrown value
 * becomes an `internal` 500 instead.
 *
 * Stable `code` strings so the frontend can branch on them without
 * fragile message comparisons:
 *
 *   missing_file               — POST /bills with no `file` part
 *   wrong_type                 — non-PDF mime
 *   not_an_invoice             — LLM classifier said it isn't a supplier invoice
 *   parse_unreadable           — LLM couldn't read the PDF (scan/blurry)
 *   parse_wrong_currency       — we only handle SEK for now
 *   parse_missing_data         — critical fields absent (no total, etc.)
 *   parse_other                — LLM hit something we didn't enum
 *   parse_failed               — generateObject threw (network, schema, etc.)
 *   unauth / no_org            — auth middleware rejections
 *   not_found                  — bill / journal entry not found
 *   no_journal_entry           — can't approve/decline a bill without one
 *   internal                   — anything we didn't catch (set by onError)
 */
export class AppError extends Error {
  constructor(
    public readonly status: ContentfulStatusCode,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string[]>
  ) {
    super(message);
    this.name = "AppError";
  }
}

// Tiny factory helpers — keep the call sites readable at a glance.
// More verbose than `new AppError(400, ...)` would save, but it's worth it
// for the route-handler scan factor.
export const BadRequest = (code: string, message: string, fields?: Record<string, string[]>) =>
  new AppError(400, code, message, fields);

export const Unauthorized = (message = "Sign in to continue.") =>
  new AppError(401, "unauth", message);

export const Forbidden = (code: string, message: string) => new AppError(403, code, message);

export const NotFound = (message = "Not found.") => new AppError(404, "not_found", message);

export const Conflict = (code: string, message: string) => new AppError(409, code, message);

/** 422 — PDF parsed fine, but the *content* is unusable. */
export const Unprocessable = (code: string, message: string) => new AppError(422, code, message);

/** 502 — we depend on something upstream (Claude) and it broke. */
export const Upstream = (code: string, message: string) => new AppError(502, code, message);
