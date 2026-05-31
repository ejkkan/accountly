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
 *   missing_file / not_pdf / too_large / missing_id  — 400 input validation
 *   unauth                     — 401, missing/invalid session
 *   no_org                     — 403, account isn't attached to a workspace
 *   not_found                  — 404, bill / journal entry / supplier not in workspace
 *   no_journal_entry           — 409, can't approve/decline a bill without one
 *   status_locked              — 409, illegal transition (e.g. already decided)
 *   not_an_invoice             — 422, the LLM said the PDF isn't a supplier invoice
 *   invalid_proposal           — 422, entry failed validateProposal (unbalanced, etc.)
 *   parse_failed               — 502, the parse agent threw (network, schema, etc.)
 *   internal                   — 500, anything we didn't catch (set by onError)
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
