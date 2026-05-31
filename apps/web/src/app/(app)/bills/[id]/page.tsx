"use client";

import { use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useBill } from "@/hooks/use-bill";
import { formatMinor } from "@/lib/money";

export default function BillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, isLoading, error } = useBill(id);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/bills">← Back</Link>
        </Button>
        <h1 className="text-2xl font-semibold">
          {data?.bill.supplierName ?? data?.bill.fileName ?? "Bill"}
        </h1>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {data && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* PDF viewer — same-origin /api/bills/:id/file streams from R2. */}
          <div className="rounded-lg border bg-muted/30">
            <iframe
              src={`/api/bills/${id}/file`}
              className="aspect-[1/1.4] w-full rounded-lg"
              title="Invoice PDF"
            />
          </div>

          <div className="space-y-4">
            <BillMeta data={data} />

            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              Journal entry generation lands in phase 5.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BillMeta({
  data,
}: {
  data: {
    bill: {
      supplierName: string | null;
      invoiceNumber: string | null;
      invoiceDate: string | null;
      dueDate: string | null;
      currency: string;
      subtotalMinor: string | null;
      vatMinor: string | null;
      totalMinor: string | null;
      status: string;
      fileName: string;
    };
  };
}) {
  const { bill } = data;
  return (
    <dl className="grid grid-cols-2 gap-3 rounded-lg border p-4 text-sm">
      <Row label="Supplier" value={bill.supplierName} />
      <Row label="Invoice #" value={bill.invoiceNumber} />
      <Row label="Date" value={bill.invoiceDate} />
      <Row label="Due" value={bill.dueDate} />
      <Row
        label="Subtotal"
        value={
          bill.subtotalMinor != null
            ? formatMinor(bill.subtotalMinor, bill.currency)
            : null
        }
      />
      <Row
        label="VAT"
        value={
          bill.vatMinor != null
            ? formatMinor(bill.vatMinor, bill.currency)
            : null
        }
      />
      <Row
        label="Total"
        value={
          bill.totalMinor != null
            ? formatMinor(bill.totalMinor, bill.currency)
            : null
        }
      />
      <Row label="Status" value={bill.status} />
    </dl>
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
