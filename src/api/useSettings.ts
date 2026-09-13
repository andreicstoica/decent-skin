import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { restUrl } from "./gateway";

export interface SkinSettings {
  /** Water depth in mm that counts as a full tank. The DE1 reports depth, not
   *  volume or percent, and has no idea how tall your tank is. */
  tankFullMm: number;
  flushSeconds: number;
  flushFlow: number;
}

export const DEFAULTS: SkinSettings = { tankFullMm: 70, flushSeconds: 5, flushFlow: 8 };

const KEY = restUrl("/store/decent-skin/settings");

export function useSettings() {
  const { data } = useQuery({
    queryKey: ["skin-settings"],
    queryFn: async (): Promise<SkinSettings> => {
      const res = await fetch(KEY);
      if (!res.ok) return DEFAULTS;
      return { ...DEFAULTS, ...((await res.json()) as Partial<SkinSettings>) };
    },
    staleTime: Infinity,
  });
  return data ?? DEFAULTS;
}

export function useSaveSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (next: SkinSettings) => {
      const res = await fetch(KEY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error(`Gateway returned ${res.status}`);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["skin-settings"] }),
  });
}
