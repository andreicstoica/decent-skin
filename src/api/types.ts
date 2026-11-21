export type MachineState =
  | "booting" | "busy" | "idle" | "schedIdle" | "sleeping" | "heating"
  | "preheating" | "espresso" | "hotWater" | "flush" | "steam"
  | "steamRinse" | "skipStep" | "cleaning" | "descaling" | "calibration"
  | "selfTest" | "airPurge" | "needsWater" | "error" | "fwUpgrade"
  | "transportMode";

export type MachineSubstate =
  | "idle" | "preparingForShot" | "preinfusion" | "pouring" | "pouringDone"
  | "cleaningStart" | "cleaningGroup" | "cleaingGroup" | "cleanSoaking"
  | "cleaningSteam" | "pausedSteam" | "puffing" | "refillStopped"
  | (string & {});

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
      battery: number | null;
      timerValue: number | null;
    };

export interface ShotStateDecision {
  kind: "advance" | "stop" | "abort" | "terminal" | "finalize";
  reason: string;
  details?: string | null;
  data?: Record<string, unknown> | null;
}

export interface ShotStateEvent {
  event: "state" | "decision" | "terminal";
  timestamp: string;
  shotId?: string | null;
  state: "idle" | "preheating" | "pouring" | "stopping" | "finished";
  machineState?: string | null;
  machineSubstate?: string | null;
  profileFrame?: number | null;
  scaleConnected: boolean;
  scaleLost: boolean;
  machineHasAutonomousSAW: boolean;
  decision?: ShotStateDecision | null;
}

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
  descaling: "Descaling",
  calibration: "Calibrating",
  selfTest: "Self test",
  airPurge: "Air purge",
  needsWater: "Needs water",
  error: "Error",
  fwUpgrade: "Updating",
  transportMode: "Transport",
};

export const stateLabel = (state: MachineState): string => STATE_LABEL[state] ?? state;

/** States where the machine is working toward readiness rather than waiting. */
export const WORKING: ReadonlySet<MachineState> = new Set([
  "heating",
  "preheating",
  "booting",
  "busy",
  "fwUpgrade",
]);
