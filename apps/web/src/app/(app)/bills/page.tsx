"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  BillsStatCards,
  type BillsStats,
} from "./components/bills-stat-cards";

export default function BillsPage() {
  const { data, isLoading, error } = useBills();

  const stats: BillsStats = data
    ? {
        total: data.bills.length,
        pending: data.bills.filter((b) => b.status === "pending").length,
        approved: data.bills.filter((b) => b.status === "approved").length,
        declined: data.bills.filter((b) => b.status === "declined").length,
      }
    : { total: 0, pending: 0, approved: 0, declined: 0 };

  return (
    <>
      {/* Page title — matches the template's dashboard pages */}
      <div className="px-4 lg:px-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Bills</h1>
          <p className="text-muted-foreground">
            Upload an invoice and approve the proposed journal entry.
          </p>
        </div>
      </div>

      <div className="@container/main space-y-6 px-4 lg:px-6">
        <BillsStatCards stats={stats} />

        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>All bills</CardTitle>
              <CardDescription>
                Every invoice uploaded by your workspace.
              </CardDescription>
            </div>
            <Button asChild>
              <Link href="/bills/new">
                <Plus className="size-4" />
                Upload PDF
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading && (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
            {error && (
              <p className="text-sm text-destructive">{error.message}</p>
            )}

            {data && data.bills.length === 0 && (
              <div className="rounded-lg border border-dashed py-12 text-center">
                <p className="text-sm text-muted-foreground">No bills yet.</p>
                <Button asChild className="mt-4">
                  <Link href="/bills/new">
                    <Plus className="size-4" />
                    Upload your first PDF
                  </Link>
                </Button>
              </div>
            )}

            {data && data.bills.length > 0 && (
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
                    <TableRow key={bill.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/bills/${bill.id}`}
                          className="hover:underline"
                        >
                          {bill.supplierName ?? bill.fileName}
                        </Link>
                      </TableCell>
                      <TableCell>{bill.invoiceNumber ?? "—"}</TableCell>
                      <TableCell>
                        {bill.invoiceDate
                          ? new Date(bill.invoiceDate).toLocaleDateString(
                              "sv-SE"
                            )
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
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  // Same border-tinted style the template uses for status chips.
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
