import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { unwrap } from "@/lib/api";

/**
 * Re-runs the parse agent on the existing R2 PDF — no re-upload needed.
 * Replaces the line items + journal entry + postings and resets bill.status
 * to "pending". Used when the accountant suspects the first proposal was off.
 */
export function useReparseBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.api.bills[":id"].reparse.$post({ param: { id } })),
    onSuccess: (_, id) => {
      toast.success("Re-parsed.");
      qc.invalidateQueries({ queryKey: ["bills"] });
      qc.invalidateQueries({ queryKey: ["bills", id] });
      // Re-parse can re-resolve the supplier — refresh the directory + any
      // open supplier detail (shared root key).
      qc.invalidateQueries({ queryKey: ["suppliers"] });
    },
  });
}
