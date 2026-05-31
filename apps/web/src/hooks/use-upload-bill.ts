import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client";

/**
 * Multipart upload. Hono's RPC client serialises `{ form: { file } }` into a
 * multipart request the backend's parseBody can read; same typed client as
 * every other call, no separate fetch.
 */
export function useUploadBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const res = await api.api.bills.$post({ form: { file } });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          "error" in body && typeof body.error === "string"
            ? body.error
            : "Upload failed"
        );
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bills"] });
    },
  });
}
