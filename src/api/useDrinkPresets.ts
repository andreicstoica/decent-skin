import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { restUrl } from "./gateway";
import { writeWorkflow, type WorkflowPatch } from "./useWorkflow";

export interface SteamPreset {
  id: string;
  label: string;
  targetTemperature: number;
  duration: number;
  flow: number;
}

export interface WaterPreset extends SteamPreset {
  volume: number;
}

export interface DrinkPresets {
  steam: SteamPreset[];
  activeSteamId: string;
  water: WaterPreset[];
  activeWaterId: string;
}

export const DEFAULT_DRINK_PRESETS: DrinkPresets = {
  steam: [
    { id: "small", label: "Small", targetTemperature: 145, duration: 25, flow: 0.7 },
    { id: "medium", label: "Medium", targetTemperature: 150, duration: 40, flow: 0.9 },
    { id: "large", label: "Large", targetTemperature: 155, duration: 55, flow: 1.1 },
  ],
  activeSteamId: "medium",
  water: [
    { id: "small", label: "Small", targetTemperature: 85, volume: 60, duration: 20, flow: 6.0 },
    { id: "medium", label: "Medium", targetTemperature: 90, volume: 120, duration: 35, flow: 8.0 },
    { id: "large", label: "Large", targetTemperature: 95, volume: 220, duration: 50, flow: 10.0 },
  ],
  activeWaterId: "medium",
};

const presetsUrl = restUrl("/store/decent-skin/drink-presets");
const presetsKey = ["drink-presets"] as const;
const presetsScope = { id: "drink-presets" };

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function finiteOrDefault(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function mergeSteam(fallback: SteamPreset, saved: Record<string, unknown>): SteamPreset {
  return {
    id: fallback.id,
    label: typeof saved.label === "string" ? saved.label : fallback.label,
    targetTemperature: finiteOrDefault(saved.targetTemperature, fallback.targetTemperature),
    duration: finiteOrDefault(saved.duration, fallback.duration),
    flow: finiteOrDefault(saved.flow, fallback.flow),
  };
}

function mergeWater(fallback: WaterPreset, saved: Record<string, unknown>): WaterPreset {
  return { ...mergeSteam(fallback, saved), volume: finiteOrDefault(saved.volume, fallback.volume) };
}

function mergePresets<Preset extends SteamPreset>(
  defaults: Preset[],
  saved: unknown,
  merge: (fallback: Preset, value: Record<string, unknown>) => Preset,
): Preset[] {
  const entries = Array.isArray(saved) ? saved.map(asRecord) : [];
  return defaults.map((preset) => merge(preset, entries.find(({ id }) => id === preset.id) ?? {}));
}

function activeId(presets: SteamPreset[], saved: unknown, fallback: string): string {
  return presets.find(({ id }) => id === saved)?.id ?? fallback;
}

async function readDrinkPresets(): Promise<DrinkPresets> {
  const res = await fetch(presetsUrl);
  if (res.status === 404) return DEFAULT_DRINK_PRESETS;
  if (!res.ok) throw new Error(`Gateway returned ${res.status}`);

  const saved = asRecord(await res.json());
  const steam = mergePresets(DEFAULT_DRINK_PRESETS.steam, saved.steam, mergeSteam);
  const water = mergePresets(DEFAULT_DRINK_PRESETS.water, saved.water, mergeWater);
  return {
    steam,
    activeSteamId: activeId(steam, saved.activeSteamId, DEFAULT_DRINK_PRESETS.activeSteamId),
    water,
    activeWaterId: activeId(water, saved.activeWaterId, DEFAULT_DRINK_PRESETS.activeWaterId),
  };
}

function findPreset<Preset extends SteamPreset>(presets: Preset[], id: string): Preset {
  const preset = presets.find((entry) => entry.id === id);
  if (!preset) throw new Error(`Unknown drink preset: ${id}`);
  return preset;
}

function steamWorkflowPatch({ targetTemperature, duration, flow }: SteamPreset): WorkflowPatch {
  return { steamSettings: { targetTemperature, duration, flow } };
}

function waterWorkflowPatch({ targetTemperature, volume, duration, flow }: WaterPreset): WorkflowPatch {
  return { hotWaterData: { targetTemperature, volume, duration, flow } };
}

async function saveDrinkPresets(presets: DrinkPresets) {
  const res = await fetch(presetsUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(presets),
  });
  if (!res.ok) throw new Error(`Gateway returned ${res.status}`);
}

function useDrinkPresetMutation<Input>(
  update: (current: DrinkPresets, input: Input) => {
    presets: DrinkPresets;
    workflow?: WorkflowPatch;
  },
) {
  const client = useQueryClient();
  return useMutation({
    scope: presetsScope,
    mutationFn: async (input: Input) => {
      const { presets, workflow } = update(await readDrinkPresets(), input);
      if (workflow) await writeWorkflow(workflow);
      await saveDrinkPresets(presets);
    },
    onSettled: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: presetsKey }),
        client.invalidateQueries({ queryKey: ["workflow"] }),
      ]);
    },
  });
}

export function useDrinkPresets(): DrinkPresets {
  const { data } = useQuery({ queryKey: presetsKey, queryFn: readDrinkPresets });
  return data ?? DEFAULT_DRINK_PRESETS;
}

export function useSelectSteamPreset() {
  return useDrinkPresetMutation((current, presetId: string) => ({
    presets: { ...current, activeSteamId: presetId },
    workflow: steamWorkflowPatch(findPreset(current.steam, presetId)),
  }));
}

export function useUpdateSteamPreset() {
  return useDrinkPresetMutation((current, { id, patch }: {
    id: string;
    patch: Partial<Omit<SteamPreset, "id">>;
  }) => {
    const updated = mergeSteam(findPreset(current.steam, id), patch);
    return {
      presets: { ...current, steam: current.steam.map((preset) => preset.id === id ? updated : preset) },
      workflow: id === current.activeSteamId ? steamWorkflowPatch(updated) : undefined,
    };
  });
}

export function useSelectWaterPreset() {
  return useDrinkPresetMutation((current, presetId: string) => ({
    presets: { ...current, activeWaterId: presetId },
    workflow: waterWorkflowPatch(findPreset(current.water, presetId)),
  }));
}

export function useUpdateWaterPreset() {
  return useDrinkPresetMutation((current, { id, patch }: {
    id: string;
    patch: Partial<Omit<WaterPreset, "id">>;
  }) => {
    const updated = mergeWater(findPreset(current.water, id), patch);
    return {
      presets: { ...current, water: current.water.map((preset) => preset.id === id ? updated : preset) },
      workflow: id === current.activeWaterId ? waterWorkflowPatch(updated) : undefined,
    };
  });
}
