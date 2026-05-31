import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { unwrap } from "@/lib/api";

/**
 * Hard-deletes the bill — R2 object + bill row (line items, journal
 * entry, postings cascade via FK). Returns the id so the caller can
 * navigate away.
 */
export function useDeleteBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.api.bills[":id"].$delete({ param: { id } })),
    onSuccess: (_, id) => {
      toast.success("Bill deleted.");
      qc.invalidateQueries({ queryKey: ["bills"] });
      qc.removeQueries({ queryKey: ["bills", id] });
    },
  });
}
