import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { restUrl } from "./gateway";

export interface WorkflowContext {
  targetDoseWeight?: number;
  targetYield?: number;
  grinderModel?: string;
  grinderSetting?: string;
  coffeeName?: string;
  coffeeRoaster?: string;
  grinderId?: string;
  beanBatchId?: string;
}

export interface Workflow {
  name?: string;
  profile?: { title?: string };
  context?: WorkflowContext;
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

/** Partial update: Decaid merges what you send and re-uploads to the machine. */
export function useSetGrindSetting() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (grinderSetting: string) => {
      const res = await fetch(restUrl("/workflow"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: { grinderSetting } }),
      });
      if (!res.ok) throw new Error(`Gateway returned ${res.status}`);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["workflow"] }),
  });
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
