"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useBills } from "@/hooks/use-bills";
import { formatMinor } from "@/lib/money";

export default function BillsPage() {
  const { data, isLoading, error } = useBills();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Bills</h1>
        <Button asChild>
          <Link href="/bills/new">Upload PDF</Link>
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {data && data.bills.length === 0 && (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">No bills yet.</p>
          <Button asChild className="mt-4">
            <Link href="/bills/new">Upload your first PDF</Link>
          </Button>
        </div>
      )}

      {data && data.bills.length > 0 && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier</TableHead>
                <TableHead>Invoice #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.bills.map((bill) => (
                <TableRow key={bill.id} className="cursor-pointer">
                  <TableCell>
                    <Link href={`/bills/${bill.id}`} className="hover:underline">
                      {bill.supplierName ?? bill.fileName}
                    </Link>
                  </TableCell>
                  <TableCell>{bill.invoiceNumber ?? "—"}</TableCell>
                  <TableCell>
                    {bill.invoiceDate
                      ? new Date(bill.invoiceDate).toLocaleDateString("sv-SE")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {bill.totalMinor != null
                      ? formatMinor(bill.totalMinor, bill.currency)
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={bill.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "approved"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
      : status === "declined"
      ? "bg-destructive/15 text-destructive"
      : "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${tone}`}>
      {status}
    </span>
  );
}
