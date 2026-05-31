import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { unwrap } from "@/lib/api";

/**
 * Multipart upload. Hono's RPC client serialises `{ form: { file } }` into a
 * multipart request the backend's parseBody can read; same typed client as
 * every other call.
 *
 * `unwrap` carries the success type through; any failure throws ApiError
 * which the global MutationCache toast picks up. Success toast lives here
 * because the message ("Invoice parsed.") is mutation-specific.
 */
export function useUploadBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => unwrap(api.api.bills.$post({ form: { file } })),
    onSuccess: () => {
      toast.success("Invoice parsed.");
      qc.invalidateQueries({ queryKey: ["bills"] });
    },
  });
}
