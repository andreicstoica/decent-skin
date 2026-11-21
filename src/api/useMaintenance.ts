import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { restUrl } from "./gateway";
import type { MachineState } from "./types";
import { readShotPage, SHOT_PAGE_LIMIT, useShotPage } from "./useShots";

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
  const shots = useShotPage(SHOT_PAGE_LIMIT);
  const { lastCleanedAt, cleanIntervalShots } = settings.data ?? DEFAULT_MAINTENANCE;
  const cutoff = lastCleanedAt ? Date.parse(lastCleanedAt) : 0;
  const page = shots.data;
  const recent = page?.items.filter(({ timestamp }) => Date.parse(timestamp) > cutoff).length ?? 0;
  const needsOlder = !!lastCleanedAt && !!page && recent === SHOT_PAGE_LIMIT && page.total > recent;
  const older = useQuery({
    queryKey: ["shots", "cleaning", lastCleanedAt, page?.items[recent - 1]?.id],
    enabled: needsOlder,
    queryFn: async ({ signal }) => {
      let count = 0;
      let offset = SHOT_PAGE_LIMIT;
      while (offset < MAX_CLEAN_INTERVAL) {
        const next = await readShotPage(SHOT_PAGE_LIMIT, offset, signal);
        const sinceClean = next.items.filter(({ timestamp }) => Date.parse(timestamp) > cutoff).length;
        count += sinceClean;
        offset += SHOT_PAGE_LIMIT;
        if (sinceClean < SHOT_PAGE_LIMIT || offset >= next.total) return { count, capped: false };
      }
      return { count, capped: true };
    },
    staleTime: 30_000,
  });
  const shotsSinceClean = lastCleanedAt ? recent + (needsOlder ? older.data?.count ?? 0 : 0) : page?.total ?? 0;

  return {
    lastCleanedAt,
    cleanIntervalShots,
    shotsSinceClean,
    capped: needsOlder && older.data?.capped === true,
    due: shotsSinceClean >= cleanIntervalShots,
    countUnavailable: settings.isError || shots.isError || (needsOlder && older.isError),
    isLoading: settings.isLoading || shots.isLoading || (needsOlder && older.isLoading),
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
