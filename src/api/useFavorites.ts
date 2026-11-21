import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { restUrl } from "./gateway";
import type { ProfileRecord } from "./useProfiles";
import { writeWorkflow } from "./useWorkflow";

export const MAX_FAVORITES = 5;

export interface Favorites {
  favoriteIds: string[];
  oneOffReturnId: string | null;
}

interface SelectProfileInput {
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

export function useSelectProfile() {
  const client = useQueryClient();
  return useMutation({
    scope: favoritesScope,
    mutationFn: async ({ record, returnToId = null }: SelectProfileInput) => {
      const current = await readFavorites();
      const targetWeight = record.profile.target_weight;
      // The workflow profile is also the copy Decaid attaches to the shot.
      await writeWorkflow({
        profile: record.profile,
        context: targetWeight != null && Number.isFinite(targetWeight) && targetWeight > 0
          ? { targetYield: targetWeight }
          : undefined,
      });
      if (current.oneOffReturnId !== returnToId) {
        await saveFavorites({ ...current, oneOffReturnId: returnToId });
      }
    },
    onSettled: () => Promise.all([
      client.invalidateQueries({ queryKey: ["workflow"] }),
      client.invalidateQueries({ queryKey: favoritesKey }),
    ]),
  });
}
