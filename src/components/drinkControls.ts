import {
  useDrinkPresets,
  useSelectSteamPreset,
  useSelectWaterPreset,
  useUpdateSteamPreset,
  useUpdateWaterPreset,
  type SteamPreset,
  type WaterPreset,
} from "../api/useDrinkPresets";
import { useUpdateWorkflow, useWorkflow } from "../api/useWorkflow";
import type { Range } from "./nudge";

export const STEAM_RANGE = {
  flow: { step: 0.1, min: 0.4, max: 2.5, places: 1 },
  temp: { step: 1, min: 135, max: 160, places: 0 },
  duration: { step: 5, min: 5, max: 255, places: 0 },
} satisfies Record<string, Range>;

export const WATER_RANGE = {
  volume: { step: 10, min: 10, max: 500, places: 0 },
  temp: { step: 1, min: 20, max: 100, places: 0 },
  flow: { step: 0.5, min: 1, max: 10, places: 1 },
  duration: { step: 5, min: 5, max: 255, places: 0 },
} satisfies Record<string, Range>;

export const FLUSH_RANGE = {
  temp: { step: 1, min: 20, max: 100, places: 0 },
  duration: { step: 1, min: 1, max: 60, places: 0 },
  flow: { step: 0.5, min: 1, max: 10, places: 1 },
} satisfies Record<string, Range>;

export const steamSummary = (p: SteamPreset) => `${p.targetTemperature}° · ${p.flow.toFixed(1)} mL/s · ${p.duration}s`;
export const waterSummary = (p: WaterPreset) => `${p.volume} mL · ${p.targetTemperature}° · ${p.duration}s`;

/** The active size, following a selection the moment it is tapped. */
function useActive<P extends SteamPreset>(presets: P[], savedId: string, pendingId: string | undefined) {
  return presets.find((p) => p.id === (pendingId ?? savedId)) ?? presets[0];
}

/**
 * Every steam preset write carries its temperature, which would switch a
 * heater that is off back on. So with the heater off, only the toggle acts.
 */
export function useSteam() {
  const { data: workflow } = useWorkflow();
  const presets = useDrinkPresets();
  const select = useSelectSteamPreset();
  const update = useUpdateSteamPreset();
  const heater = useUpdateWorkflow();
  const active = useActive(presets.steam, presets.activeSteamId, select.isPending ? select.variables : undefined);
  const heaterOn = (workflow?.steamSettings?.targetTemperature ?? 0) > 0;
  const setHeater = (on: boolean) =>
    heater.mutate({ steamSettings: { targetTemperature: on ? active.targetTemperature : 0 } });
  const failed = select.isError || update.isError || heater.isError;
  return { presets: presets.steam, active, heaterOn, setHeater, select, update, failed };
}

export function useWaterPresets() {
  const presets = useDrinkPresets();
  const select = useSelectWaterPreset();
  const update = useUpdateWaterPreset();
  const active = useActive(presets.water, presets.activeWaterId, select.isPending ? select.variables : undefined);
  return { presets: presets.water, active, select, update, failed: select.isError || update.isError };
}
