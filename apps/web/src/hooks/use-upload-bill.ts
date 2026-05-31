"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { api } from "@/lib/client";

/**
 * Single-PDF upload. `POST /api/bills` is synchronous — it stores the PDF,
 * runs the parse agent to completion, persists the proposal, and returns the
 * new bill's id. The page redirects to `/bills/[billId]` on success.
 *
 * The multipart `File` body goes through `fetch`/`FormData` rather than the
 * typed `hc` client (a `File` doesn't round-trip cleanly through the RPC
 * client). But the *response* type is still inferred from the route via
 * `InferResponseType`, so it can't silently drift from what the route returns.
 * Errors surface as a thrown `Error` the page toasts.
 */
type UploadResponse = InferResponseType<(typeof api.api.bills)["$post"]>;

export function useUploadBill() {
  const qc = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);

  const upload = useCallback(
    async (file: File): Promise<UploadResponse> => {
      setIsUploading(true);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/bills", {
          method: "POST",
          body: form,
          credentials: "include",
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: { message?: string };
          } | null;
          throw new Error(body?.error?.message ?? `Upload failed (${res.status}).`);
        }
        const data = (await res.json()) as UploadResponse;
        // A successful upload always adds a bill and may have created a new
        // supplier (find-or-create) — refresh both lists so the new rows show
        // without a manual reload.
        qc.invalidateQueries({ queryKey: ["bills"] });
        qc.invalidateQueries({ queryKey: ["suppliers"] });
        return data;
      } finally {
        setIsUploading(false);
      }
    },
    [qc]
  );

  return { upload, isUploading };
}
