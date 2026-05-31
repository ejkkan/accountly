import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { unwrap } from "@/lib/api";

/**
 * Approve / decline mutations live in the same file because they're the
 * exact same shape — only the endpoint differs. Both invalidate the bill
 * list and the specific bill so the table badge + journal-entry card
 * status both flip immediately after the mutation resolves.
 */
function makeDecider(action: "approve" | "decline") {
  const successText = action === "approve" ? "Approved." : "Declined.";
  return function useDecider() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (id: string) =>
        unwrap(
          action === "approve"
            ? api.api.bills[":id"].approve.$post({ param: { id } })
            : api.api.bills[":id"].decline.$post({ param: { id } })
        ),
      onSuccess: (_, id) => {
        toast.success(successText);
        qc.invalidateQueries({ queryKey: ["bills"] });
        qc.invalidateQueries({ queryKey: ["bills", id] });
      },
    });
  };
}

export const useApproveBill = makeDecider("approve");
export const useDeclineBill = makeDecider("decline");
