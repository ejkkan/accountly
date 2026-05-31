"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, RotateCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ErrorCard } from "@/components/ui/error-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useBill } from "@/hooks/use-bill";
import { useReparseBill } from "@/hooks/use-reparse-bill";
import { useDeleteBill } from "@/hooks/use-delete-bill";
import { formatMinor } from "@/lib/money";
import { JournalEntryCard } from "../components/journal-entry-card";

export default function BillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data, isLoading, error, refetch } = useBill(id);
  const reparse = useReparseBill();
  const remove = useDeleteBill();

  const supplierName = data?.bill.supplierName ?? data?.bill.fileName ?? "Bill";
  const busy = reparse.isPending || remove.isPending;

  async function onReparse() {
    if (!data) return;
    if (
      !window.confirm(
        "Re-run the analysis on this PDF? The current proposal will be replaced and the bill returns to pending."
      )
    )
      return;
    try {
      await reparse.mutateAsync(id);
    } catch {
      // Global toast already surfaced it; stay on the page.
    }
  }

  async function onDelete() {
    if (!data) return;
    if (
      !window.confirm(
        `Delete "${supplierName}"? The PDF and all extracted data (line items, journal entry, postings) will be removed. This can't be undone.`
      )
    )
      return;
    try {
      await remove.mutateAsync(id);
      router.push("/bills");
    } catch {
      // Global toast already surfaced it; stay on the page.
    }
  }

  return (
    <>
      <div className="px-4 lg:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/bills">
              <ChevronLeft className="size-4" />
              Back
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">{supplierName}</h1>
          {data && <StatusBadge status={data.bill.status} />}
          {/* Permissions come from the GET /:id response — derived on the
              server from BILL_TRANSITIONS in lib/bill-states.ts. The UI
              doesn't re-implement the rules; if the server says false the
              button stays hidden. */}
          {data?.permissions.canReparse || data?.permissions.canDelete ? (
            <div className="ml-auto flex items-center gap-2">
              {data?.permissions.canReparse && (
                <Button size="sm" variant="outline" onClick={onReparse} disabled={busy}>
                  <RotateCw className="size-4" />
                  {reparse.isPending ? "Re-parsing…" : "Re-parse"}
                </Button>
              )}
              {data?.permissions.canDelete && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={onDelete}
                  disabled={busy}
                >
                  <Trash2 className="size-4" />
                  Delete
                </Button>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="@container/main px-4 lg:px-6">
        {isLoading && <BillDetailSkeleton />}
        {error && <ErrorCard message={error.message} onRetry={() => refetch()} />}

        {data && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>Invoice PDF</CardTitle>
                <CardDescription>{data.bill.fileName}</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <iframe
                  src={`/api/bills/${id}/file`}
                  className="aspect-[1/1.4] w-full"
                  title="Invoice PDF"
                />
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Bill details</CardTitle>
                  <CardDescription>Header fields extracted from the PDF.</CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 gap-y-3 text-sm">
                    <Row label="Supplier" value={data.bill.supplierName} />
                    <Row label="Org. nr" value={data.bill.supplierOrgNumber} />
                    <Row label="VAT nr" value={data.bill.supplierVatNumber} />
                    <Row label="Invoice #" value={data.bill.invoiceNumber} />
                    <Row label="Date" value={data.bill.invoiceDate} />
                    <Row label="Due" value={data.bill.dueDate} />
                    <Row
                      label="Subtotal"
                      value={
                        data.bill.subtotalMinor != null
                          ? formatMinor(data.bill.subtotalMinor, data.bill.currency)
                          : null
                      }
                    />
                    <Row
                      label="VAT"
                      value={
                        data.bill.vatMinor != null
                          ? formatMinor(data.bill.vatMinor, data.bill.currency)
                          : null
                      }
                    />
                    <Row
                      label="Total"
                      value={
                        data.bill.totalMinor != null
                          ? formatMinor(data.bill.totalMinor, data.bill.currency)
                          : null
                      }
                    />
                  </dl>
                </CardContent>
              </Card>

              {data.lineItems.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Line items</CardTitle>
                    <CardDescription>What the supplier billed for, line by line.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Unit</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.lineItems.map((li) => (
                          <TableRow key={li.id}>
                            <TableCell className="text-muted-foreground">{li.lineNo}</TableCell>
                            <TableCell>{li.description}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {li.quantity ?? "—"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {li.unitPriceMinor != null
                                ? formatMinor(li.unitPriceMinor, data.bill.currency)
                                : "—"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatMinor(li.amountMinor, data.bill.currency)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Every persisted bill has a proposal (the synchronous flow only
                  stores on a successful, validated parse), so there's no
                  empty-proposal state to render. */}
              {data.journalEntry && (
                <JournalEntryCard
                  billId={data.bill.id}
                  journalEntry={data.journalEntry}
                  postings={data.postings}
                  currency={data.bill.currency}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right tabular-nums">{value ?? "—"}</dd>
    </>
  );
}

/**
 * Two-column placeholder matching the loaded layout — PDF tile on the left,
 * stacked detail/journal cards on the right — so the page doesn't jump when
 * useBill resolves.
 */
function BillDetailSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2" aria-busy="true" aria-label="Loading bill">
      <Card className="overflow-hidden">
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-2 h-4 w-48" />
        </CardHeader>
        <CardContent className="p-0">
          <Skeleton className="aspect-[1/1.4] w-full rounded-none" />
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-28" />
            <Skeleton className="mt-2 h-4 w-56" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-y-3">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="contents">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24 justify-self-end" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-36" />
            <Skeleton className="mt-2 h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
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
