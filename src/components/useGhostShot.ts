import { useQuery } from "@tanstack/react-query";
import { restUrl } from "../api/gateway";
import type { ShotDetail, ShotSummary } from "../api/useShots";
import { findGhostShot, type GhostMatch } from "./shotGraph";

/** All requests are reads. Server filters reduce traffic, client checks remain
 * authoritative (including when an older gateway ignores a filter). */
export function useGhostShot(match: GhostMatch | null, enabled: boolean, before: number) {
  return useQuery({
    queryKey: ["shots", "ghost", match?.profile, match?.beanBatchId, before],
    enabled: enabled && !!match,
    staleTime: Infinity,
    retry: 1,
    refetchOnWindowFocus: false,
    queryFn: ({ signal }) => findGhostShot(match!, before,
      async (offset) => {
        const query = new URLSearchParams({ limit: "100", offset: String(offset), order: "desc", beanBatchId: match!.beanBatchId, profileTitle: match!.title });
        const response = await fetch(restUrl(`/shots?${query}`), { signal });
        if (!response.ok) throw new Error(`History returned ${response.status}`);
        return await response.json() as { items: ShotSummary[]; total: number };
      },
      async (id) => {
        const response = await fetch(restUrl(`/shots/${encodeURIComponent(id)}`), { signal });
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`Shot returned ${response.status}`);
        return await response.json() as ShotDetail;
      }),
  });
}
