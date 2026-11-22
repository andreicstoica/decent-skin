import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { restUrl } from "./gateway";

export interface DecaidSettings {
  gatewayMode: "disabled" | "tracking" | "full";
  themeMode: "system" | "light" | "dark";
  keepAwake: boolean;
  blockOnNoScale: boolean;
  blockTareDuringShot?: boolean;
  stopHotWaterAtWeight: boolean;
  scalePowerMode?: "disabled" | "displayOff" | "disconnect";
  preferredMachineId?: string | null;
  preferredScaleId?: string | null;
  weightFlowMultiplier?: number;
  volumeFlowMultiplier?: number;
  hotWaterFlowMultiplier?: number;
  chargingMode?: "disabled" | "longevity" | "balanced" | "highAvailability";
  lowBatteryBrightnessLimit?: boolean;
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
  steamPurgeMode?: number;
}

export interface MachineSettingsPatch {
  fan?: number;
  usb?: "enable" | "disable";
  flushTemp?: number;
  flushTimeout?: number;
  flushFlow?: number;
  hotWaterFlow?: number;
  steamFlow?: number;
  tankTemp?: number;
  steamPurgeMode?: number;
}

function resource<TRead, TWrite = Partial<TRead>>(key: string, path: string) {
  const url = restUrl(path);
  return {
    useRead: () =>
      useQuery({
        queryKey: [key],
        queryFn: async (): Promise<TRead | null> => {
          const res = await fetch(url);
          return res.ok ? ((await res.json()) as TRead) : null;
        },
      }),
    useWrite: () => {
      const client = useQueryClient();
      return useMutation({
        mutationFn: async (patch: TWrite) => {
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
const machine = resource<MachineSettings, MachineSettingsPatch>("machine-settings", "/machine/settings");

export const useDecaidSettings = decaid.useRead;
export const useSaveDecaidSettings = decaid.useWrite;
export const useMachineSettings = machine.useRead;
export const useSaveMachineSettings = machine.useWrite;
