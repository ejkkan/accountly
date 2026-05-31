import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client";
import { unwrap } from "@/lib/api";

/**
 * Detail key shares the `["suppliers"]` root with the list (same convention as
 * useBill / useBills) so a single `invalidateQueries(["suppliers"])` refreshes
 * both. `enabled: !!id` + the `id!` assertion mirror useBill.
 */
export function useSupplier(id: string | undefined) {
  return useQuery({
    queryKey: ["suppliers", id] as const,
    queryFn: () => unwrap(api.api.suppliers[":id"].$get({ param: { id: id! } })),
    enabled: !!id,
  });
}
