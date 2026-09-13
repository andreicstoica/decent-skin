import { useEffect, useRef } from "react";
import { EXTRACTING, type MachineSnapshot } from "./types";

export interface TracePoint {
  t: number;
  pressure: number;
  flow: number;
  weightFlow: number;
  targetPressure: number;
  targetFlow: number;
}

/**
 * Samples accumulate in a ref inside an effect, not during render: the snapshot
 * already re-renders the tree at 10Hz, and appending during render duplicates
 * every point under StrictMode's double invocation.
 */
export function useShotTrace(snapshot: MachineSnapshot | null, weightFlow: number | null) {
  const trace = useRef<TracePoint[]>([]);
  const startedAt = useRef<number | null>(null);
  const latestFlow = useRef(weightFlow);
  latestFlow.current = weightFlow;

  const extracting = !!snapshot && EXTRACTING.has(snapshot.state.substate);

  useEffect(() => {
    if (!extracting) {
      startedAt.current = null;
      return;
    }
    if (!snapshot) return;

    const now = Date.now();
    if (startedAt.current === null) {
      startedAt.current = now;
      trace.current = [];
    }
    const t = (now - startedAt.current) / 1000;

    const last = trace.current[trace.current.length - 1];
    if (!last || t - last.t >= 0.09) {
      trace.current = [
        ...trace.current,
        {
          t,
          pressure: snapshot.pressure,
          flow: snapshot.flow,
          weightFlow: latestFlow.current ?? 0,
          targetPressure: snapshot.targetPressure,
          targetFlow: snapshot.targetFlow,
        },
      ];
    }
  }, [snapshot, extracting]);

  return { trace: trace.current, extracting };
}
