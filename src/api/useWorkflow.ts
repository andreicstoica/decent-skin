import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { restUrl } from "./gateway";

export interface WorkflowContext {
  targetDoseWeight?: number;
  targetYield?: number;
  targetWaterVolume?: number | null;
  grinderModel?: string;
  grinderBurrs?: string | null;
  grinderSetting?: string;
  grinderRpm?: number | null;
  coffeeName?: string;
  coffeeRoaster?: string;
  grinderId?: string;
  beanBatchId?: string;
  finalBeverageType?: string;
  baristaName?: string;
  drinkerName?: string;
  extras?: Record<string, unknown>;
}

export interface SteamSettings {
  targetTemperature?: number;
  duration?: number;
  flow?: number;
}

export interface HotWaterData {
  targetTemperature?: number;
  duration?: number;
  volume?: number;
  flow?: number;
}

export interface RinseData {
  targetTemperature?: number;
  duration?: number;
  flow?: number;
}

export interface Workflow {
  id?: string;
  name?: string;
  description?: string;
  profile?: { title?: string };
  context?: WorkflowContext;
  steamSettings?: SteamSettings;
  hotWaterData?: HotWaterData;
  rinseData?: RinseData;
}

export interface WorkflowPatch {
  context?: Partial<Omit<WorkflowContext, "targetYield">> & { targetYield?: number | null };
  steamSettings?: Partial<SteamSettings>;
  hotWaterData?: Partial<HotWaterData>;
  rinseData?: Partial<RinseData>;
}

export function useWorkflow() {
  return useQuery({
    queryKey: ["workflow"],
    queryFn: async (): Promise<Workflow | null> => {
      const res = await fetch(restUrl("/workflow"));
      return res.ok ? ((await res.json()) as Workflow) : null;
    },
    refetchInterval: 15_000,
  });
}

/**
 * Partial update: Decaid merges what you send and re-uploads to the machine.
 * Note: Decaid rejects `targetYield: null` on PUT (use `0` to disable SAW).
 */
export function useUpdateWorkflow() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (patch: WorkflowPatch) => {
      const body = patch.context?.targetYield === null
        ? { ...patch, context: { ...patch.context, targetYield: 0 } }
        : patch;
      const res = await fetch(restUrl("/workflow"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Gateway returned ${res.status}`);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["workflow"] }),
  });
}

export function useSetGrindSetting() {
  const update = useUpdateWorkflow();
  return {
    ...update,
    mutate: (grinderSetting: string) => update.mutate({ context: { grinderSetting } }),
  };
}

export interface Grinder {
  model: string;
  settingType?: string;
  settingSmallStep?: number;
  settingBigStep?: number;
}

export interface BeanBatch {
  roastDate?: string;
  weightRemaining?: number;
  frozen?: boolean;
}

function entity<T>(key: string, path: string, id: string | undefined) {
  return {
    queryKey: [key, id],
    queryFn: async (): Promise<T | null> => {
      const res = await fetch(restUrl(`${path}/${id}`));
      return res.ok ? ((await res.json()) as T) : null;
    },
    enabled: !!id,
    staleTime: 60_000,
  };
}

export function useGrinder(id: string | undefined) {
  return useQuery(entity<Grinder>("grinder", "/grinders", id));
}

export function useBeanBatch(id: string | undefined) {
  return useQuery(entity<BeanBatch>("bean-batch", "/bean-batches", id));
}
