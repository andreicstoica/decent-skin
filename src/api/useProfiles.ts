import { useQuery } from "@tanstack/react-query";
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
