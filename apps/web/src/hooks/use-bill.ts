import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client";

export function useBill(id: string | undefined) {
  return useQuery({
    queryKey: ["bills", id] as const,
    queryFn: async () => {
      if (!id) throw new Error("missing id");
      const res = await api.api.bills[":id"].$get({ param: { id } });
      if (!res.ok) throw new Error("Failed to load bill");
      return res.json();
    },
    enabled: !!id,
  });
}
