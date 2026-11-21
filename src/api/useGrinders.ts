import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { restUrl } from "./gateway";

export interface GrinderRecord {
  id: string;
  model: string;
  burrs?: string | null;
  burrSize?: number | null;
  burrType?: string | null;
  settingType?: "numeric" | "preset" | string;
  settingSmallStep?: number | null;
  settingBigStep?: number | null;
  archived?: boolean;
}

export interface NewGrinderInput {
  model: string;
  burrs?: string;
  settingSmallStep?: number;
  settingBigStep?: number;
  selectNow?: boolean;
}

export function useGrinders() {
  return useQuery({
    queryKey: ["grinders"],
    queryFn: async (): Promise<GrinderRecord[]> => {
      const res = await fetch(restUrl("/grinders?includeArchived=false"));
      if (!res.ok) return [];
      return (await res.json()) as GrinderRecord[];
    },
    staleTime: 60_000,
  });
}

export function useAddGrinder() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewGrinderInput) => {
      const res = await fetch(restUrl("/grinders"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: input.model.trim(),
          ...(input.burrs?.trim() ? { burrs: input.burrs.trim() } : {}),
          settingType: "numeric",
          ...(input.settingSmallStep ? { settingSmallStep: input.settingSmallStep } : {}),
          ...(input.settingBigStep ? { settingBigStep: input.settingBigStep } : {}),
        }),
      });
      if (!res.ok) throw new Error(`Create grinder failed (${res.status})`);
      const grinder = (await res.json()) as GrinderRecord;

      if (input.selectNow !== false) {
        await fetch(restUrl("/workflow"), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            context: {
              grinderId: grinder.id,
              grinderModel: grinder.model,
              ...(grinder.burrs ? { grinderBurrs: grinder.burrs } : {}),
            },
          }),
        });
      }
      return grinder;
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["grinders"] });
      client.invalidateQueries({ queryKey: ["workflow"] });
    },
  });
}

export function useSelectGrinder() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (grinder: GrinderRecord) => {
      const res = await fetch(restUrl("/workflow"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: {
            grinderId: grinder.id,
            grinderModel: grinder.model,
            grinderBurrs: grinder.burrs ?? null,
          },
        }),
      });
      if (!res.ok) throw new Error(`Gateway returned ${res.status}`);
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["workflow"] });
      client.invalidateQueries({ queryKey: ["grinder"] });
    },
  });
}
