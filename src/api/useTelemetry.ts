import { useRef, useState } from "react";
import { useJsonSocket } from "./useJsonSocket";
import { isScaleStatus, type MachineSnapshot, type ScaleFrame } from "./types";

/** Latest machine frame, or null until the first one arrives. */
export function useMachineSnapshot() {
  const [snapshot, setSnapshot] = useState<MachineSnapshot | null>(null);
  const socket = useJsonSocket<MachineSnapshot>("/machine/snapshot", setSnapshot);
  return { snapshot, socket };
}

/**
 * The scale socket survives scale connect/disconnect cycles and resumes on its
 * own, so a `disconnected` status clears the weight but leaves the socket alone.
 */
export function useScale() {
  const [weight, setWeight] = useState<number | null>(null);
  const [battery, setBattery] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const lastFrameAt = useRef(0);

  const socket = useJsonSocket<ScaleFrame>("/scale/snapshot", (frame) => {
    if (isScaleStatus(frame)) {
      setConnected(frame.status === "connected");
      if (frame.status === "disconnected") setWeight(null);
      return;
    }
    lastFrameAt.current = Date.now();
    setConnected(true);
    setWeight(frame.weight);
    setBattery(frame.batteryLevel);
  });

  return { weight, battery, connected, socket };
}
