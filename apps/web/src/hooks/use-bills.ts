import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client";
import { unwrap } from "@/lib/api";

export function useBills() {
  return useQuery({
    queryKey: ["bills"] as const,
    queryFn: () => unwrap(api.api.bills.$get()),
  });
}
