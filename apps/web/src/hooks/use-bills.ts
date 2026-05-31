import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client";

export function useBills() {
  return useQuery({
    queryKey: ["bills"] as const,
    queryFn: async () => {
      const res = await api.api.bills.$get();
      if (!res.ok) throw new Error("Failed to load bills");
      return res.json();
    },
  });
}
