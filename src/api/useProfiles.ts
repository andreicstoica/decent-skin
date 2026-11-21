import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { restUrl } from "./gateway";

export interface ProfileRecord {
  id: string;
  isDefault: boolean;
  profile: {
    title: string;
    author?: string;
    notes?: string;
    beverage_type?: string;
    target_weight?: number;
    steps?: import("../components/ProfileSpark").Step[];
  };
}

export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async (): Promise<ProfileRecord[]> => {
      const res = await fetch(restUrl("/profiles?visibility=visible"));
      if (!res.ok) return [];
      const body = await res.json();
      return Array.isArray(body) ? body : (body.items ?? []);
    },
    staleTime: 5 * 60_000,
  });
}

/**
 * Writes through the workflow rather than POST /machine/profile: Decaid uploads
 * it to the machine either way, but only the workflow copy is saved onto the
 * shot record, which is what makes a shot comparable later.
 */
export function useSelectProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (record: ProfileRecord) => {
      const targetWeight = record.profile.target_weight;
      const body: Record<string, unknown> = { profile: record.profile };
      if (typeof targetWeight === "number" && Number.isFinite(targetWeight) && targetWeight > 0) {
        body.context = { targetYield: targetWeight };
      }
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
