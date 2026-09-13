import { useState } from "react";
import { useJsonSocket } from "./useJsonSocket";
import { isScaleStatus, type MachineSnapshot, type ScaleFrame } from "./types";

export function useMachineSnapshot() {
  const [snapshot, setSnapshot] = useState<MachineSnapshot | null>(null);
  const socket = useJsonSocket<MachineSnapshot>("/machine/snapshot", setSnapshot);
  return { snapshot, socket };
}

// Decaid resumes this socket by itself after a scale reconnect; tearing it down
// on a `disconnected` status permanently stops weight frames.
export function useScale() {
  const [weight, setWeight] = useState<number | null>(null);
  const [battery, setBattery] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);

  const socket = useJsonSocket<ScaleFrame>("/scale/snapshot", (frame) => {
    if (isScaleStatus(frame)) {
      setConnected(frame.status === "connected");
      if (frame.status === "disconnected") setWeight(null);
      return;
    }
    setConnected(true);
    setWeight(frame.weight);
    setBattery(frame.batteryLevel);
  });

  return { weight, battery, connected, socket };
}
