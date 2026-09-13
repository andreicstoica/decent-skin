export type MachineState =
  | "booting" | "busy" | "idle" | "schedIdle" | "sleeping" | "heating"
  | "preheating" | "espresso" | "hotWater" | "flush" | "steam"
  | "steamRinse" | "skipStep" | "cleaning";

export type MachineSubstate =
  | "idle" | "preparingForShot" | "preinfusion" | "pouring" | "pouringDone"
  | "cleaningStart" | "cleaningGroup" | "cleanSoaking" | "cleaningSteam"
  | "pausedSteam" | "puffing";

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

export type ScaleFrame =
  | { status: "connected" | "disconnected" }
  | {
      timestamp: string;
      weight: number;
      weightFlow: number;
      battery: number;
      timerValue: number | null;
    };

export const isScaleStatus = (f: ScaleFrame): f is { status: "connected" | "disconnected" } =>
  "status" in f;

export const EXTRACTING: ReadonlySet<MachineSubstate> = new Set([
  "preinfusion",
  "pouring",
]);

export const STATE_LABEL: Record<MachineState, string> = {
  booting: "Starting",
  busy: "Busy",
  idle: "Ready",
  schedIdle: "Standby",
  sleeping: "Asleep",
  heating: "Heating",
  preheating: "Preheating",
  espresso: "Espresso",
  hotWater: "Hot water",
  flush: "Flush",
  steam: "Steam",
  steamRinse: "Steam rinse",
  skipStep: "Skipping",
  cleaning: "Cleaning",
};

/** States where the machine is working toward readiness rather than waiting. */
export const WORKING: ReadonlySet<MachineState> = new Set([
  "heating",
  "preheating",
  "booting",
  "busy",
]);
