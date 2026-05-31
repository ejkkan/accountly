import { Conflict } from "./errors";

/**
 * The bill state machine. Single source of truth for two questions:
 *
 *   1. "What can I do to a bill in state X?"  →  `permissionsFor(state)`
 *   2. "Can a user in state X perform Y?"     →  `assertCan(state, "canY", ...)`
 *
 * Mutation routes call `assertCan` before touching the row. GET /:id
 * surfaces `permissions` derived from `permissionsFor` so the UI can show
 * or hide buttons without re-deriving the rules (and without importing
 * this module client-side).
 *
 * The accounting-correct rules:
 *  - `pending`   — proposal not yet booked into the ledger. Everything's
 *                  allowed; you can re-run the LLM or throw it away.
 *  - `approved`  — booked into the ledger. Locked — to "undo," you'd add
 *                  a reverse-entry workflow (sketched in the README's
 *                  "what's not built" section).
 *  - `declined`  — explicitly refused; never entered the books. Safe to
 *                  delete; re-deciding is meaningless.
 */

export const BILL_STATES = ["pending", "approved", "declined"] as const;
export type BillState = (typeof BILL_STATES)[number];

export const BILL_TRANSITIONS = {
  pending: { canReparse: true, canDelete: true, canDecide: true },
  approved: { canReparse: false, canDelete: false, canDecide: false },
  declined: { canReparse: false, canDelete: true, canDecide: false },
} as const satisfies Record<BillState, Record<string, boolean>>;

export type BillPermissions = (typeof BILL_TRANSITIONS)[BillState];
export type BillAction = keyof BillPermissions;

const LOCKED_PERMISSIONS: BillPermissions = {
  canReparse: false,
  canDelete: false,
  canDecide: false,
};

/**
 * Pure projection of state → allowed actions. Defensive default for
 * unknown states so a future status added at the DB level (or a typo)
 * fails closed rather than open.
 */
export function permissionsFor(state: string): BillPermissions {
  return BILL_TRANSITIONS[state as BillState] ?? LOCKED_PERMISSIONS;
}

/**
 * The backend guard. Routes call this before any state-changing
 * operation; throws `Conflict` with a user-readable reason if the rule
 * says no.
 */
export function assertCan(state: string, action: BillAction, reasonForUser: string): void {
  if (!permissionsFor(state)[action]) {
    throw Conflict("status_locked", reasonForUser);
  }
}
