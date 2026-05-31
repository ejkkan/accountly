import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client";
import { unwrap } from "@/lib/api";

export function useBill(id: string | undefined) {
  return useQuery({
    queryKey: ["bills", id] as const,
    queryFn: () => {
      if (!id) throw new Error("missing id");
      return unwrap(api.api.bills[":id"].$get({ param: { id } }));
    },
    enabled: !!id,
  });
}
