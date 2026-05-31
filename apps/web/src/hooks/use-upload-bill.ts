import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client";
import { unwrap } from "@/lib/api";

/**
 * Multipart upload. Hono's RPC client serialises `{ form: { file } }` into a
 * multipart request the backend's parseBody can read; same typed client as
 * every other call.
 *
 * `unwrap` carries the success type through; any failure throws ApiError
 * which the global MutationCache toast picks up.
 */
export function useUploadBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => unwrap(api.api.bills.$post({ form: { file } })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bills"] });
    },
  });
}
