export type MachineState =
  | "booting" | "busy" | "idle" | "schedIdle" | "sleeping" | "heating"
  | "preheating" | "espresso" | "hotWater" | "flush" | "steam"
  | "steamRinse" | "skipStep" | "cleaning";

export type MachineSubstate =
  | "idle" | "preparingForShot" | "preinfusion" | "pouring" | "pouringDone"
  | "cleaningStart" | "cleaningGroup" | "cleanSoaking" | "cleaningSteam"
  | "pausedSteam" | "puffing";

/** ws/v1/machine/snapshot, ~10 Hz */
export interface MachineSnapshot {
  timestamp: string;
  state: { state: MachineState; substate: MachineSubstate };
  flow: number;
  pressure: number;
  targetFlow: number;
  targetPressure: number;
  mixTemperature: number;
  groupTemperature: number;
  targetMixTemperature: number;
  targetGroupTemperature: number;
  profileFrame: number;
  steamTemperature: number;
}

/**
 * ws/v1/scale/snapshot multiplexes two frame shapes on one socket. Branch on
 * the presence of `status` vs `weight`; there is no discriminator field.
 */
export type ScaleFrame =
  | { status: "connected" | "disconnected" }
  | { timestamp: string; weight: number; batteryLevel: number };

export const isScaleStatus = (f: ScaleFrame): f is { status: "connected" | "disconnected" } =>
  "status" in f;

export const EXTRACTING: ReadonlySet<MachineSubstate> = new Set([
  "preinfusion",
  "pouring",
]);
