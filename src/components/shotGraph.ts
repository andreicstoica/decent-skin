import type { TracePoint } from "../api/useShotTrace";
import type { Measurement, ShotDetail, ShotSummary } from "../api/useShots";

export const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

/** Decaid v2 profile wire fields, not the sparkline's simplified display model.
 * Verified against decentespresso/decaid@18469d2:
 * lib/src/models/data/profile.dart, shot_record.dart and
 * lib/src/services/webserver/shots_handler.dart. */
export interface GraphStep {
  name?: string;
  pump?: "pressure" | "flow";
  transition?: "fast" | "smooth";
  seconds?: number;
  pressure?: number;
  flow?: number;
  exit?: { type?: string; condition?: string; value?: number } | null;
  weight?: number | null;
  volume?: number;
  limiter?: { value?: number; range?: number } | null;
}
export interface GraphProfile {
  title?: string;
  steps: GraphStep[];
}

export function graphProfile(value: unknown): GraphProfile | undefined {
  if (!object(value) || !Array.isArray(value.steps) || !value.steps.length || !value.steps.every(object)) return undefined;
  return value as unknown as GraphProfile;
}

const canonical = (value: unknown): unknown => Array.isArray(value)
  ? value.map(canonical)
  : object(value)
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
    : value;

/** A title is not an identity: edited profiles can keep the same title. Match
 * execution fields as recorded by Decaid, ignoring descriptive metadata only.
 * Missing step data is insufficient evidence, never a title-only fallback. */
export function profileIdentity(value: unknown): string | null {
  const profile = graphProfile(value);
  if (typeof profile?.title !== "string" || !profile.title.trim()) return null;
  const raw = value as Record<string, unknown>;
  return JSON.stringify(canonical({
    title: profile.title,
    ...Object.fromEntries(["version", "beverage_type", "tank_temperature", "target_weight", "target_volume", "target_volume_count_start"].map((key) => [key, raw[key] ?? null])),
    steps: (raw.steps as Record<string, unknown>[]).map(({ name: _name, ...execution }) => execution),
  }));
}

export interface GhostMatch { profile: string; title: string; beanBatchId: string }
export function ghostMatch(workflow: unknown): GhostMatch | null {
  if (!object(workflow) || !object(workflow.context)) return null;
  const profile = profileIdentity(workflow.profile);
  const title = graphProfile(workflow.profile)?.title;
  const beanBatchId = workflow.context.beanBatchId;
  return profile && title && typeof beanBatchId === "string" && beanBatchId.trim()
    ? { profile, title, beanBatchId } : null;
}

// A manually stopped shot can be a deliberate reference. Exclude unknown
// endings, scale failures, backstops and errors, and require usable telemetry.
const COMPARABLE_END = new Set(["targetWeight", "targetVolume", "profileAdvance", "machineEnded", "apiStop", "appStop"]);
export function matchesGhost(shot: ShotSummary, match: GhostMatch, before: number): boolean {
  const time = Date.parse(shot.timestamp);
  return finite(time) && time < before && COMPARABLE_END.has(shot.stopReason ?? "") &&
    shot.workflow?.context?.beanBatchId === match.beanBatchId &&
    profileIdentity(shot.workflow?.profile) === match.profile;
}

/** Align to extraction, not preheating. No fallback to arbitrary machine data
 * when the record cannot establish which samples were actually extraction. */
export function ghostTrace(measurements?: Measurement[]): TracePoint[] {
  const samples = (Array.isArray(measurements) ? measurements : []).filter(({ machine }) =>
    machine && ["preinfusion", "pouring"].includes(machine.state?.substate ?? "") &&
    finite(Date.parse(machine.timestamp)),
  ).sort((a, b) => Date.parse(a.machine!.timestamp) - Date.parse(b.machine!.timestamp));
  const first = Date.parse(samples[0]?.machine?.timestamp ?? "");
  const points: TracePoint[] = [];
  for (const { machine, scale } of samples) {
    const t = (Date.parse(machine!.timestamp) - first) / 1000;
    if (points.length && t <= points[points.length - 1].t) continue;
    points.push({ t, pressure: machine!.pressure, flow: machine!.flow, weightFlow: scale?.weightFlow });
  }
  // Exclude empty/aborted recordings even when their terminal reason is clean.
  return points.length > 1 && points[points.length - 1].t >= 5 &&
    points.some((p) => (finite(p.pressure) && p.pressure > 0) || (finite(p.flow) && p.flow > 0))
    ? points : [];
}

export interface GhostShot { id: string; timestamp: string; trace: TracePoint[] }
export interface GhostResult { shot: GhostShot | null; incomplete: boolean }
/** Newest-first pages are the documented /shots contract. Check details again
 * because records can be corrected/deleted between the list and detail reads. */
export async function findGhostShot(
  match: GhostMatch,
  before: number,
  page: (offset: number) => Promise<{ items: ShotSummary[]; total: number }>,
  detail: (id: string) => Promise<ShotDetail | null>,
): Promise<GhostResult> {
  let offset = 0;
  const seen = new Set<string>();
  for (let n = 0; n < 50; n++) {
    const response = await page(offset);
    if (!Array.isArray(response.items) || !finite(response.total)) throw new Error("Invalid shot history response");
    if (!response.items.length) return { shot: null, incomplete: offset < response.total };
    const ordered = [...response.items].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    for (const summary of ordered) {
      if (seen.has(summary.id)) continue;
      seen.add(summary.id);
      if (!matchesGhost(summary, match, before)) continue;
      const shot = await detail(summary.id);
      if (!shot || !matchesGhost(shot, match, before)) continue;
      // A shot can finish during the read. Its summary timestamp is the start,
      // so also exclude records whose extraction overlaps the current run.
      if (shot.measurements?.some(({ machine }) =>
        machine && ["preinfusion", "pouring"].includes(machine.state?.substate ?? "") && Date.parse(machine.timestamp) >= before,
      )) continue;
      const trace = ghostTrace(shot.measurements);
      if (trace.length) return { shot: { id: shot.id, timestamp: shot.timestamp, trace }, incomplete: false };
    }
    offset += response.items.length;
    if (offset >= response.total) return { shot: null, incomplete: false };
  }
  // Bound work on very large/legacy histories without claiming no match exists.
  return { shot: null, incomplete: true };
}

export interface PlannedTarget {
  t0: number; t1: number; value: number; channel: "pressure" | "flow";
  name: string; smooth: boolean;
}
export function profilePlan(profile?: GraphProfile) {
  const targets: PlannedTarget[] = [];
  let duration = 0;
  let variable = false;
  for (const [i, step] of (profile?.steps ?? []).entries()) {
    if (!finite(step.seconds) || step.seconds <= 0) { variable = true; break; }
    const t0 = duration;
    duration += step.seconds;
    variable ||= !!step.exit || (finite(step.weight) && step.weight > 0) || (finite(step.volume) && step.volume > 0);
    const channel = step.pump;
    const value = channel ? step[channel] : undefined;
    // Do not turn a limiter/exit threshold into a pump setpoint. An unspecified
    // transition is not assumed fast. Smooth ramps start from measured values,
    // so only the goal marker is drawn, never an invented ramp/flat curve.
    if (channel && finite(value) && value >= 0 && (step.transition === "fast" || step.transition === "smooth")) {
      targets.push({ t0, t1: duration, value, channel, name: step.name || `Step ${i + 1}`, smooth: step.transition === "smooth" });
    }
  }
  return { targets, duration, variable };
}

export function initialTimeSpan(profile?: GraphProfile): number {
  const plan = profilePlan(profile);
  // Conditional phase lengths are maxima, not a predicted extraction duration.
  return plan.variable ? 60 : Math.max(60, Math.ceil(plan.duration / 30) * 30);
}

export function timeSpan(last: number, initial = 60): number {
  return last <= initial ? initial : initial + Math.ceil((last - initial) / 30) * 30;
}

/** Use reported setpoints for the active pump channel. Only fill an absent
 * setpoint for explicit fast steps; smooth transition state is unknowable.
 * This also preserves a real zero-flow pause instead of hiding its target. */
export function targetTrace(trace: TracePoint[], profile?: GraphProfile): TracePoint[] {
  const rawPressure = trace.some((p) => finite(p.targetPressure) && p.targetPressure > 0);
  const rawFlow = trace.some((p) => finite(p.targetFlow) && p.targetFlow > 0);
  return trace.map((point) => {
    const step = point.profileFrame != null ? profile?.steps[point.profileFrame] : undefined;
    if (!step?.pump) return { t: point.t, targetPressure: rawPressure ? point.targetPressure : undefined, targetFlow: rawFlow ? point.targetFlow : undefined };
    const channel = step.pump === "pressure" ? "targetPressure" : "targetFlow";
    const reported = point[channel];
    const goal = step[step.pump];
    const value = finite(reported) && reported >= 0 ? reported : step.transition === "fast" && finite(goal) && goal >= 0 ? goal : undefined;
    return { t: point.t, [channel]: value };
  });
}

export function yDomain(traces: TracePoint[][], goals: number[] = []) {
  let low = 0, high = 12;
  const include = (value: unknown) => { if (finite(value)) { low = Math.min(low, value); high = Math.max(high, value); } };
  for (const value of goals) include(value);
  for (const trace of traces) for (const point of trace) {
    for (const key of ["pressure", "flow", "weightFlow", "targetPressure", "targetFlow"] as const) include(point[key]);
  }
  return { min: Math.floor(low / 2) * 2, max: Math.ceil(high / 4) * 4 };
}
