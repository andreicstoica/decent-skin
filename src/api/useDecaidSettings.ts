import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { restUrl } from "./gateway";

export interface DecaidSettings {
  gatewayMode: "disabled" | "tracking" | "full";
  themeMode: "system" | "light" | "dark";
  keepAwake: boolean;
  blockOnNoScale: boolean;
  stopHotWaterAtWeight: boolean;
  nightModeEnabled: boolean;
  automaticUpdateCheck: boolean;
}

export interface MachineSettings {
  fan: number;
  usb: boolean;
  flushTemp: number;
  flushTimeout: number;
  flushFlow: number;
  hotWaterFlow: number;
  steamFlow: number;
  tankTemp: number;
}

function resource<T>(key: string, path: string) {
  const url = restUrl(path);
  return {
    useRead: () =>
      useQuery({
        queryKey: [key],
        queryFn: async (): Promise<T | null> => {
          const res = await fetch(url);
          return res.ok ? ((await res.json()) as T) : null;
        },
      }),
    useWrite: () => {
      const client = useQueryClient();
      return useMutation({
        mutationFn: async (patch: Partial<T>) => {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          });
          if (!res.ok) throw new Error(`Gateway returned ${res.status}`);
        },
        onSuccess: () => client.invalidateQueries({ queryKey: [key] }),
      });
    },
  };
}

const decaid = resource<DecaidSettings>("decaid-settings", "/settings");
const machine = resource<MachineSettings>("machine-settings", "/machine/settings");

export const useDecaidSettings = decaid.useRead;
export const useSaveDecaidSettings = decaid.useWrite;
export const useMachineSettings = machine.useRead;
export const useSaveMachineSettings = machine.useWrite;
