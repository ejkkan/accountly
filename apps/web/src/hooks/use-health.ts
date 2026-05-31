import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client";

/**
 * Canonical hook pattern. Every data hook in this folder follows the same
 * shape:
 *   1. queryKey is a const array so it's identical across calls
 *   2. queryFn calls `api.api.<route>.$method(...)` — return type flows
 *      from the Hono handler's `c.json(...)` straight into `useQuery`'s
 *      `data` field. No manual types anywhere in the chain.
 *   3. Throw on non-2xx so react-query surfaces the error consistently.
 *
 * Components NEVER call `api` or `fetch` directly — go through a hook.
 */
export function useHealth() {
  return useQuery({
    queryKey: ["health"] as const,
    queryFn: async () => {
      const res = await api.api.health.$get();
      if (!res.ok) throw new Error("Health check failed");
      return res.json();
    },
  });
}
