import { useQuery } from "@tanstack/react-query";
import { restUrl } from "./gateway";

export interface WorkflowContext {
  targetDoseWeight?: number;
  targetYield?: number;
  grinderModel?: string;
  grinderSetting?: string;
  coffeeName?: string;
  coffeeRoaster?: string;
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
