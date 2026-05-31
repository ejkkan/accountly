"use client";

import { use } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ErrorCard } from "@/components/ui/error-card";
import { useSupplier } from "@/hooks/use-supplier";
import { formatMinor } from "@/lib/money";

export default function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, error, refetch } = useSupplier(id);

  return (
    <>
      <div className="px-4 lg:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/suppliers">
              <ChevronLeft className="size-4" />
              Back
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">{data?.supplier.name ?? "Supplier"}</h1>
        </div>
      </div>

      <div className="@container/main space-y-6 px-4 lg:px-6">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {error && <ErrorCard message={error.message} onRetry={() => refetch()} />}

        {data && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
                <CardDescription>
                  Identifiers resolved from this vendor&apos;s invoices.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-y-3 text-sm sm:max-w-md">
                  <dt className="text-muted-foreground">Org. nr</dt>
                  <dd className="text-right tabular-nums">{data.supplier.orgNumber ?? "—"}</dd>
                  <dt className="text-muted-foreground">VAT nr</dt>
                  <dd className="text-right tabular-nums">{data.supplier.vatNumber ?? "—"}</dd>
                  <dt className="text-muted-foreground">Bills</dt>
                  <dd className="text-right tabular-nums">{data.bills.length}</dd>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Invoices</CardTitle>
                <CardDescription>Every bill from this supplier.</CardDescription>
              </CardHeader>
              <CardContent>
                {data.bills.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No invoices yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
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
                            <Link href={`/bills/${bill.id}`} className="hover:underline">
                              {bill.invoiceNumber ?? bill.fileName}
                            </Link>
                          </TableCell>
                          <TableCell>{bill.invoiceDate ?? "—"}</TableCell>
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
          </>
        )}
      </div>
    </>
  );
}
