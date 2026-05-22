import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "../lib/api.js";

export function useSuppStats(date) {
  return useQuery({
    queryKey: ["supp-stats", date],
    queryFn: () => fetchJson(`/supplements/stats?days=30&anchor=${date}`),
    staleTime: 30_000,
  });
}

export function useSuppCatalog() {
  return useQuery({
    queryKey: ["supp-catalog"],
    queryFn: async () => {
      const data = await fetchJson("/supplements/catalog");
      return data.items || [];
    },
    staleTime: 300_000,
  });
}

export function useSuppLog(date) {
  return useQuery({
    queryKey: ["supp-log", date],
    queryFn: async () => {
      const data = await fetchJson(`/supplements/log?date=${date}`);
      return data.data;
    },
    staleTime: 30_000,
  });
}
