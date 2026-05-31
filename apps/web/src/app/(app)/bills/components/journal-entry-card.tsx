"use client";

import { Check, X } from "lucide-react";
import type { InferResponseType } from "hono/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMinor } from "@/lib/money";
import { api } from "@/lib/client";
import { useApproveBill, useDeclineBill } from "@/hooks/use-decide-bill";

/**
 * Props are derived from the GET /api/bills/:id response — single source of
 * truth flows DB → Kysely → c.json → AppType → hc client → these types.
 * Rename a column on the backend, regenerate, this component re-types
 * itself; no hand-written interfaces to drift.
 */
type BillDetail = InferResponseType<(typeof api.api.bills)[":id"]["$get"]>;
export type Posting = BillDetail["postings"][number];
export type JournalEntry = NonNullable<BillDetail["journalEntry"]>;

/**
 * Card form of the proposed journal entry. Lays out:
 *  - Approve / Decline buttons OR a status badge in the header (depending
 *    on whether `journalEntry.status === "proposed"`)
 *  - postings table (Account | Debit | Credit) sorted by lineNo
 *  - totals row that visibly proves debits === credits
 *  - rationale paragraph at the bottom
 *
 * The table is intentionally read-only — inline posting editing is the
 * obvious live-interview extension and would mount in place of the
 * static cells without disturbing the rest of the card.
 */
export function JournalEntryCard({
  billId,
  journalEntry,
  postings,
  currency,
}: {
  billId: string;
  journalEntry: JournalEntry;
  postings: Posting[];
  currency: string;
}) {
  const totalDebit = postings.reduce((sum, p) => sum + BigInt(p.debitMinor), 0n);
  const totalCredit = postings.reduce((sum, p) => sum + BigInt(p.creditMinor), 0n);
  const balanced = totalDebit === totalCredit;

  const approve = useApproveBill();
  const decline = useDeclineBill();
  const isPending = approve.isPending || decline.isPending;
  const showButtons = journalEntry.status === "proposed";
  const decisionError = approve.error?.message ?? decline.error?.message;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle>Proposed journal entry</CardTitle>
          <CardDescription>
            {showButtons
              ? "LLM-generated postings against the BAS chart of accounts."
              : decidedLine(journalEntry)}
          </CardDescription>
        </div>
        {showButtons ? (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={isPending || !balanced}
              onClick={() => decline.mutate(billId)}
            >
              <X className="size-4" />
              Decline
            </Button>
            <Button
              size="sm"
              disabled={isPending || !balanced}
              onClick={() => approve.mutate(billId)}
            >
              <Check className="size-4" />
              Approve
            </Button>
          </div>
        ) : (
          <StatusBadge status={journalEntry.status} />
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Code</TableHead>
              <TableHead>Account</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {postings.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-sm">{p.accountCode}</TableCell>
                <TableCell>{p.accountName}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {BigInt(p.debitMinor) > 0n ? formatMinor(p.debitMinor, currency) : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {BigInt(p.creditMinor) > 0n ? formatMinor(p.creditMinor, currency) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2} className="font-medium">
                Totals
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {formatMinor(totalDebit, currency)}
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {formatMinor(totalCredit, currency)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>

        {!balanced && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400">
            Debits and credits don&apos;t balance — refusing to post.
          </p>
        )}

        {decisionError && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400">
            {decisionError}
          </p>
        )}

        {journalEntry.reasoning && (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Reasoning
            </p>
            <p className="mt-1 text-foreground">{journalEntry.reasoning}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Compose the audit-trail line shown once a decision is recorded:
 *   "Approved by Erik on 2026-05-31"
 *   "Declined by Anna" (if the date is missing for some reason)
 *   "Approved" (if neither is set — should never happen in practice)
 */
function decidedLine(je: JournalEntry): string {
  const verb = je.status === "approved" ? "Approved" : "Declined";
  const by = je.decidedByName ? ` by ${je.decidedByName}` : "";
  const on = je.decidedAt ? ` on ${new Date(je.decidedAt).toLocaleDateString("sv-SE")}` : "";
  return `${verb}${by}${on}`;
}
