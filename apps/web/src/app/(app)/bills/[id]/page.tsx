"use client";

import { use } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBill } from "@/hooks/use-bill";
import { formatMinor } from "@/lib/money";
import { JournalEntryCard } from "../components/journal-entry-card";

export default function BillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, isLoading, error } = useBill(id);

  const supplierName =
    data?.bill.supplierName ?? data?.bill.fileName ?? "Bill";

  return (
    <>
      <div className="px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/bills">
              <ChevronLeft className="size-4" />
              Back
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">{supplierName}</h1>
          {data && <StatusBadge status={data.bill.status} />}
        </div>
      </div>

      <div className="@container/main px-4 lg:px-6">
        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
        {error && <p className="text-sm text-destructive">{error.message}</p>}

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
                  <CardDescription>
                    Extracted from the PDF — fills in once parsing lands.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 gap-y-3 text-sm">
                    <Row label="Supplier" value={data.bill.supplierName} />
                    <Row label="Invoice #" value={data.bill.invoiceNumber} />
                    <Row label="Date" value={data.bill.invoiceDate} />
                    <Row label="Due" value={data.bill.dueDate} />
                    <Row
                      label="Subtotal"
                      value={
                        data.bill.subtotalMinor != null
                          ? formatMinor(
                              data.bill.subtotalMinor,
                              data.bill.currency
                            )
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
                          ? formatMinor(
                              data.bill.totalMinor,
                              data.bill.currency
                            )
                          : null
                      }
                    />
                  </dl>
                </CardContent>
              </Card>

              {data.journalEntry ? (
                <JournalEntryCard
                  journalEntry={data.journalEntry}
                  postings={data.postings}
                  currency={data.bill.currency}
                />
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Proposed journal entry</CardTitle>
                    <CardDescription>
                      LLM-generated postings against the BAS chart of accounts.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                      No proposal — parsing may have failed on upload.
                    </div>
                  </CardContent>
                </Card>
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
