import { useEffect, useRef, useState } from "react";
import { EXTRACTING, type MachineSnapshot } from "./types";

/**
 * Elapsed extraction time, derived from state transitions rather than a shot
 * record, so it is correct mid-shot before anything has been stored.
 */
export function useShotTimer(snapshot: MachineSnapshot | null) {
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef<number | null>(null);
  const extracting = !!snapshot && EXTRACTING.has(snapshot.state.substate);

  useEffect(() => {
    if (!extracting) {
      startedAt.current = null;
      return;
    }
    startedAt.current ??= Date.now();
    const tick = window.setInterval(() => {
      if (startedAt.current) setElapsed((Date.now() - startedAt.current) / 1000);
    }, 100);
    return () => window.clearInterval(tick);
  }, [extracting]);

  useEffect(() => {
    if (extracting) setElapsed(0);
  }, [extracting]);

  return { elapsed, extracting };
}
