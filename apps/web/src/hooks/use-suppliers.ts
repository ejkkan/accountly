import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client";
import { unwrap } from "@/lib/api";

export function useSuppliers() {
  return useQuery({
    queryKey: ["suppliers"] as const,
    queryFn: () => unwrap(api.api.suppliers.$get()),
  });
}
