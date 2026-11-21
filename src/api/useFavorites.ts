import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { restUrl } from "./gateway";
import type { ProfileRecord } from "./useProfiles";

export const MAX_FAVORITES = 5;

export interface Favorites {
  favoriteIds: string[];
  oneOffReturnId: string | null;
}

export interface SelectOneOffProfileInput {
  record: ProfileRecord;
  returnToId?: string | null;
}

const DEFAULT_FAVORITES: Favorites = { favoriteIds: [], oneOffReturnId: null };
const favoritesUrl = restUrl("/store/decent-skin/favorites");
const favoritesKey = ["favorites"] as const;
const favoritesScope = { id: "favorites" };

async function readFavorites(): Promise<Favorites> {
  const res = await fetch(favoritesUrl);
  if (res.status === 404) return DEFAULT_FAVORITES;
  if (!res.ok) throw new Error(`Gateway returned ${res.status}`);
  return { ...DEFAULT_FAVORITES, ...((await res.json()) as Partial<Favorites>) };
}

async function saveFavorites(favorites: Favorites) {
  const res = await fetch(favoritesUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(favorites),
  });
  if (!res.ok) throw new Error(`Gateway returned ${res.status}`);
}

export function useFavorites(): Favorites {
  const { data } = useQuery({ queryKey: favoritesKey, queryFn: readFavorites });
  return data ?? DEFAULT_FAVORITES;
}

export function useToggleFavorite() {
  const client = useQueryClient();
  return useMutation({
    scope: favoritesScope,
    mutationFn: async (profileId: string) => {
      const current = await readFavorites();
      const { favoriteIds } = current;
      if (favoriteIds.includes(profileId)) {
        await saveFavorites({ ...current, favoriteIds: favoriteIds.filter((id) => id !== profileId) });
        return;
      }
      if (favoriteIds.length >= MAX_FAVORITES) throw new Error("Maximum 5 favorites");
      await saveFavorites({ ...current, favoriteIds: [...favoriteIds, profileId] });
    },
    onSuccess: () => client.invalidateQueries({ queryKey: favoritesKey }),
  });
}

export function useSelectOneOffProfile() {
  const client = useQueryClient();
  return useMutation({
    scope: favoritesScope,
    mutationFn: async ({ record, returnToId }: SelectOneOffProfileInput) => {
      const current = await readFavorites();
      const targetWeight = record.profile.target_weight;
      const workflowBody: Record<string, unknown> = { profile: record.profile };
      if (typeof targetWeight === "number" && Number.isFinite(targetWeight) && targetWeight > 0) {
        workflowBody.context = { targetYield: targetWeight };
      }
      const res = await fetch(restUrl("/workflow"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(workflowBody),
      });
      if (!res.ok) throw new Error(`Gateway returned ${res.status}`);
      try {
        await saveFavorites({ ...current, oneOffReturnId: returnToId ?? null });
      } finally {
        await client.invalidateQueries({ queryKey: ["workflow"] });
      }
    },
    onSuccess: () => client.invalidateQueries({ queryKey: favoritesKey }),
  });
}

export function useClearOneOff() {
  const client = useQueryClient();
  return useMutation({
    scope: favoritesScope,
    mutationFn: async () => {
      const current = await readFavorites();
      await saveFavorites({ ...current, oneOffReturnId: null });
    },
    onSuccess: () => client.invalidateQueries({ queryKey: favoritesKey }),
  });
}
