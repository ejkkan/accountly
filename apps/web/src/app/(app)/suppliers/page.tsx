"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ErrorCard } from "@/components/ui/error-card";
import { useSuppliers } from "@/hooks/use-suppliers";

export default function SuppliersPage() {
  const { data, isLoading, error, refetch } = useSuppliers();

  return (
    <>
      <div className="px-4 lg:px-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Suppliers</h1>
          <p className="text-muted-foreground">
            Every vendor across your bills, resolved by org.nr / VAT / name.
          </p>
        </div>
      </div>

      <div className="@container/main space-y-6 px-4 lg:px-6">
        {error && <ErrorCard message={error.message} onRetry={() => refetch()} />}

        <Card>
          <CardHeader>
            <CardTitle>All suppliers</CardTitle>
            <CardDescription>Each unique supplier and how many bills reference it.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

            {data && data.suppliers.length === 0 && (
              <div className="rounded-lg border border-dashed py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  No suppliers yet — they appear automatically as you upload bills.
                </p>
              </div>
            )}

            {data && data.suppliers.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Org. nr</TableHead>
                    <TableHead>VAT nr</TableHead>
                    <TableHead className="text-right">Invoices</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.suppliers.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">
                        <Link href={`/suppliers/${s.id}`} className="hover:underline">
                          {s.name}
                        </Link>
                      </TableCell>
                      <TableCell className="tabular-nums">{s.orgNumber ?? "—"}</TableCell>
                      <TableCell className="tabular-nums">{s.vatNumber ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.billCount}</TableCell>
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
