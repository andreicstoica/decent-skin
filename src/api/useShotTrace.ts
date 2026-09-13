import { useEffect, useRef } from "react";
import { EXTRACTING, type MachineSnapshot } from "./types";

export interface TracePoint {
  t: number;
  pressure: number;
  flow: number;
  weightFlow: number;
  targetPressure: number;
}

/**
 * Samples accumulate in a ref inside an effect, not during render: the snapshot
 * already re-renders the tree at 10Hz, and appending during render duplicates
 * every point under StrictMode's double invocation.
 */
export function useShotTrace(snapshot: MachineSnapshot | null, weight: number | null) {
  const trace = useRef<TracePoint[]>([]);
  const startedAt = useRef<number | null>(null);
  const lastWeight = useRef<{ w: number; t: number } | null>(null);
  const latestWeight = useRef(weight);
  latestWeight.current = weight;

  const extracting = !!snapshot && EXTRACTING.has(snapshot.state.substate);

  useEffect(() => {
    if (!extracting) {
      startedAt.current = null;
      lastWeight.current = null;
      return;
    }
    if (!snapshot) return;

    const now = Date.now();
    if (startedAt.current === null) {
      startedAt.current = now;
      trace.current = [];
    }
    const t = (now - startedAt.current) / 1000;

    let weightFlow = 0;
    const w = latestWeight.current;
    if (w !== null) {
      const prev = lastWeight.current;
      if (prev && now > prev.t) {
        weightFlow = Math.max(0, ((w - prev.w) / (now - prev.t)) * 1000);
      }
      lastWeight.current = { w, t: now };
    }

    const last = trace.current[trace.current.length - 1];
    if (!last || t - last.t >= 0.09) {
      trace.current = [
        ...trace.current,
        {
          t,
          pressure: snapshot.pressure,
          flow: snapshot.flow,
          weightFlow,
          targetPressure: snapshot.targetPressure,
        },
      ];
    }
  }, [snapshot, extracting]);

  return { trace: trace.current, extracting };
}
