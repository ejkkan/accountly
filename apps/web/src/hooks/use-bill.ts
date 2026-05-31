import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client";
import { unwrap } from "@/lib/api";

/**
 * `enabled: !!id` guarantees queryFn only runs with a real id at runtime,
 * but TypeScript can't see that relationship — the `!` assertion in the
 * queryFn closes that gap without leaking a "missing id" Error to the
 * MutationCache fallback.
 */
export function useBill(id: string | undefined) {
  return useQuery({
    queryKey: ["bills", id] as const,
    queryFn: () => unwrap(api.api.bills[":id"].$get({ param: { id: id! } })),
    enabled: !!id,
  });
}
