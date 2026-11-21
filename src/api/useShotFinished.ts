import { useEffect, useRef, useState } from "react";
import { restUrl } from "./gateway";
import { EXTRACTING, type MachineSnapshot, type ShotStateEvent } from "./types";
import { useJsonSocket } from "./useJsonSocket";

/**
 * Fires once per completed shot with the stored record's id.
 *
 * Primary path: Decaid's `/ws/v1/machine/shotState` emits the exact persisted
 * `shotId` when the sequencer finishes/finalizes a shot.
 *
 * Fallback path: In `full` gateway mode Decaid's sequencer stays idle, so we
 * fall back to watching `snapshot.state.substate` and reading `/shots/latest`.
 */
export function useShotFinished(snapshot: MachineSnapshot | null, minSeconds = 5) {
  const [finishedId, setFinishedId] = useState<string | null>(null);
  const startedAt = useRef<number | null>(null);
  const lastHandledId = useRef<string | null>(null);
  const sawSequencerShot = useRef(false);

  useJsonSocket<ShotStateEvent>("/machine/shotState", (ev) => {
    if (ev.state === "pouring" || ev.state === "stopping") {
      sawSequencerShot.current = true;
    }
    const done =
      ev.state === "finished" ||
      ev.decision?.kind === "finalize";
    if (done && ev.shotId && ev.shotId !== lastHandledId.current) {
      lastHandledId.current = ev.shotId;
      sawSequencerShot.current = false;
      setFinishedId(ev.shotId);
    }
  });

  const extracting = !!snapshot && EXTRACTING.has(snapshot.state.substate);

  useEffect(() => {
    if (extracting) {
      startedAt.current ??= Date.now();
      return;
    }

    const began = startedAt.current;
    startedAt.current = null;
    if (!began || Date.now() - began < minSeconds * 1000) return;
    if (sawSequencerShot.current) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(restUrl("/shots/latest"));
        if (!res.ok) return;
        const shot = (await res.json()) as { id?: string } | null;
        if (!cancelled && shot?.id && shot.id !== lastHandledId.current) {
          lastHandledId.current = shot.id;
          setFinishedId(shot.id);
        }
      } catch {
        // Recoverable from the Shots tab.
      }
    }, 1200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [extracting, minSeconds]);

  return { finishedId, dismiss: () => setFinishedId(null) };
}
