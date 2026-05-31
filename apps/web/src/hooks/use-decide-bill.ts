import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client";

/**
 * Approve / decline mutations live in the same file because they're the
 * exact same shape — only the endpoint differs. Both invalidate the bill
 * list and the specific bill so the table badge + journal-entry card
 * status both flip immediately after the mutation resolves.
 */
function makeDecider(action: "approve" | "decline") {
  return function useDecider() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async (id: string) => {
        const res =
          action === "approve"
            ? await api.api.bills[":id"].approve.$post({ param: { id } })
            : await api.api.bills[":id"].decline.$post({ param: { id } });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? `${action} failed`);
        }
        return res.json();
      },
      onSuccess: (_, id) => {
        qc.invalidateQueries({ queryKey: ["bills"] });
        qc.invalidateQueries({ queryKey: ["bills", id] });
      },
    });
  };
}

export const useApproveBill = makeDecider("approve");
export const useDeclineBill = makeDecider("decline");
