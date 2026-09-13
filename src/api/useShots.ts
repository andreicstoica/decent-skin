import { useQuery } from "@tanstack/react-query";
import { restUrl } from "./gateway";

export interface ShotSummary {
  id: string;
  timestamp: string;
  workflow?: { context?: { coffeeName?: string; grinderSetting?: string; targetDoseWeight?: number } };
  annotations?: { actualYield?: number; enjoyment?: number; espressoNotes?: string };
}

export function useShots(limit = 40) {
  return useQuery({
    queryKey: ["shots", limit],
    queryFn: async (): Promise<ShotSummary[]> => {
      const res = await fetch(restUrl(`/shots?limit=${limit}&offset=0`));
      if (!res.ok) return [];
      const body = await res.json();
      return body.items ?? [];
    },
    refetchInterval: 30_000,
  });
}
