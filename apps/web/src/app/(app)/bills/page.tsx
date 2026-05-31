"use client";

import { useHealth } from "@/hooks/use-health";

/**
 * Phase 3 placeholder. Exists only to prove the end-to-end typed RPC chain:
 *
 *   Hono handler `c.json({ ok: true, service: "accountly-backend" })`
 *   ──> exported `AppType = typeof app`
 *   ──> `hc<AppType>` client in lib/client.ts
 *   ──> `useHealth()` hook
 *   ──> the `data?.ok` literal `true` rendered below
 *
 * Replaced in phase 4 with the real bills list.
 */
export default function BillsPage() {
  const { data, isLoading, error } = useHealth();

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold">Bills</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Backend round-trip proof — real bills land in phase 4.
      </p>

      <div className="mt-6 rounded-lg border p-4 font-mono text-sm">
        {isLoading && "loading…"}
        {error && <span className="text-destructive">{error.message}</span>}
        {data && (
          <>
            <div>ok: {String(data.ok)}</div>
            <div>service: {data.service}</div>
          </>
        )}
      </div>
    </div>
  );
}
