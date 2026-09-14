import { useEffect, useRef, useState } from "react";
import { restUrl } from "./gateway";
import { EXTRACTING, type MachineSnapshot } from "./types";

/**
 * Fires once per completed shot with the stored record's id. Decaid writes the
 * record after the machine leaves the pour, so the latest shot is read a beat
 * later rather than at the transition itself.
 */
export function useShotFinished(snapshot: MachineSnapshot | null, minSeconds = 5) {
  const [finishedId, setFinishedId] = useState<string | null>(null);
  const startedAt = useRef<number | null>(null);

  const extracting = !!snapshot && EXTRACTING.has(snapshot.state.substate);

  useEffect(() => {
    if (extracting) {
      startedAt.current ??= Date.now();
      return;
    }

    const began = startedAt.current;
    startedAt.current = null;
    if (!began || Date.now() - began < minSeconds * 1000) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(restUrl("/shots/latest"));
        if (!res.ok) return;
        const shot = (await res.json()) as { id?: string } | null;
        if (!cancelled && shot?.id) setFinishedId(shot.id);
      } catch {
        // A missed prompt is recoverable from the Shots tab; a thrown error here
        // would take the brew screen down mid-session.
      }
    }, 1200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [extracting, minSeconds]);

  return { finishedId, dismiss: () => setFinishedId(null) };
}
