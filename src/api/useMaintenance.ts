import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { restUrl } from "./gateway";
import type { MachineState } from "./types";
import { useShots } from "./useShots";

interface MaintenanceSettings {
  lastCleanedAt: string | null;
  cleanIntervalShots: number;
}

export type MachineCommand = Extract<MachineState,
  "cleaning" | "descaling" | "steamRinse" | "idle" | "flush" | "steam" | "hotWater" | "espresso" | "sleeping"
>;

const DEFAULT_MAINTENANCE: MaintenanceSettings = { lastCleanedAt: null, cleanIntervalShots: 50 };
const MIN_CLEAN_INTERVAL = 10;
const MAX_CLEAN_INTERVAL = 500;
const SHOT_HISTORY_LIMIT = 100;
const maintenanceUrl = restUrl("/store/decent-skin/maintenance");
const maintenanceKey = ["maintenance"] as const;
const maintenanceScope = { id: "maintenance" };

async function readMaintenance(): Promise<MaintenanceSettings> {
  const res = await fetch(maintenanceUrl);
  if (res.status === 404) return DEFAULT_MAINTENANCE;
  if (!res.ok) throw new Error(`Gateway returned ${res.status}`);
  return { ...DEFAULT_MAINTENANCE, ...((await res.json()) as Partial<MaintenanceSettings>) };
}

async function saveMaintenance(settings: MaintenanceSettings) {
  const res = await fetch(maintenanceUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error(`Gateway returned ${res.status}`);
}

export function useMaintenance() {
  const settings = useQuery({ queryKey: maintenanceKey, queryFn: readMaintenance });
  const shots = useShots(SHOT_HISTORY_LIMIT);
  const { lastCleanedAt, cleanIntervalShots } = settings.data ?? DEFAULT_MAINTENANCE;
  const shotsSinceClean = lastCleanedAt === null
    ? shots.data?.length ?? 0
    : shots.data?.filter(({ timestamp }) => Date.parse(timestamp) > Date.parse(lastCleanedAt)).length ?? 0;

  return {
    lastCleanedAt,
    cleanIntervalShots,
    shotsSinceClean,
    due: shotsSinceClean >= cleanIntervalShots,
    isLoading: settings.isLoading || shots.isLoading,
  };
}

export function useMarkCleaned() {
  const client = useQueryClient();
  return useMutation({
    scope: maintenanceScope,
    mutationFn: async () => {
      const current = await readMaintenance();
      await saveMaintenance({ ...current, lastCleanedAt: new Date().toISOString() });
    },
    onSuccess: () => client.invalidateQueries({ queryKey: maintenanceKey }),
  });
}

export function useSetCleanInterval() {
  const client = useQueryClient();
  return useMutation({
    scope: maintenanceScope,
    mutationFn: async (shots: number) => {
      if (Number.isNaN(shots)) throw new Error("Invalid clean interval");
      const current = await readMaintenance();
      const cleanIntervalShots = Math.max(MIN_CLEAN_INTERVAL, Math.min(MAX_CLEAN_INTERVAL, shots));
      await saveMaintenance({ ...current, cleanIntervalShots });
    },
    onSuccess: () => client.invalidateQueries({ queryKey: maintenanceKey }),
  });
}

export function useMachineCommand() {
  return useMutation({
    mutationFn: async (state: MachineCommand) => {
      const res = await fetch(restUrl(`/machine/state/${state}`), { method: "PUT" });
      if (!res.ok) throw new Error(`Gateway returned ${res.status}`);
    },
  });
}
