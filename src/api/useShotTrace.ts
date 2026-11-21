import { useEffect, useEffectEvent, useRef, useState } from "react";
import { EXTRACTING, type MachineSnapshot } from "./types";

export interface TracePoint {
  t: number;
  pressure?: number | null;
  flow?: number | null;
  weightFlow?: number | null;
  targetPressure?: number | null;
  targetFlow?: number | null;
  profileFrame?: number;
}

/**
 * Sample in an effect and publish the latest point without waiting for the
 * next snapshot to trigger a render.
 */
export function useShotTrace(snapshot: MachineSnapshot | null, weightFlow: number | null) {
  const [trace, setTrace] = useState<TracePoint[]>([]);
  const startedAt = useRef<number | null>(null);
  const lastAt = useRef(-Infinity);
  const getWeightFlow = useEffectEvent(() => weightFlow);

  const extracting = snapshot?.state.state === "espresso" && EXTRACTING.has(snapshot.state.substate);

  useEffect(() => {
    if (!extracting) {
      startedAt.current = null;
      return;
    }
    if (!snapshot) return;

    const now = performance.now();
    const first = startedAt.current === null;
    if (!first && now - lastAt.current < 90) return;
    const start = startedAt.current ?? now;
    startedAt.current = start;
    lastAt.current = now;
    const point: TracePoint = {
      t: (now - start) / 1000,
      pressure: snapshot.pressure,
      flow: snapshot.flow,
      weightFlow: getWeightFlow(),
      targetPressure: snapshot.targetPressure,
      targetFlow: snapshot.targetFlow,
      profileFrame: snapshot.profileFrame,
    };
    setTrace((previous) => first ? [point] : [...previous, point]);
  }, [snapshot, extracting]);

  return { trace: snapshot?.state.substate === "preparingForShot" ? [] : trace, extracting };
}
