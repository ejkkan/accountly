"use client";

import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { useApproveBill, useDeclineBill } from "@/hooks/use-decide-bill";

export interface Posting {
  id: string;
  lineNo: number;
  accountCode: string;
  accountName: string;
  debitMinor: string;
  creditMinor: string;
}

export interface JournalEntry {
  id: string;
  status: string;
  reasoning: string | null;
  decidedAt?: string | null;
  decidedByName?: string | null;
}

/**
 * Card form of the proposed journal entry. Lays out:
 *  - status badge in the header
 *  - postings table (Account | Debit | Credit) sorted by lineNo
 *  - totals row that visibly proves debits === credits
 *  - rationale paragraph at the bottom
 *
 * If approval buttons land in phase 6 they wire into the header — keeping
 * the table read-only here so the live-interview ask ("let the accountant
 * edit a posting") has somewhere obvious to land.
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

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "approved"
      ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/20 dark:text-green-400"
      : status === "declined"
        ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400"
        : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-400";
  return (
    <Badge variant="outline" className={cls}>
      {status}
    </Badge>
  );
}
