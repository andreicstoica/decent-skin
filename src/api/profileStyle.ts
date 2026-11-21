import type { ProfileRecord } from "./useProfiles";

/**
 * Decaid stores beverage_type but nothing finer, so espresso styles are derived
 * from the frames themselves: a declining pressure tail is a lever, an absent
 * pressure frame is flow control, a near-zero middle frame is a bloom.
 */
export function styleOf(record: ProfileRecord): string {
  const p = record.profile;
  if (p.beverage_type === "pourover") return "Pour over";
  if (p.beverage_type === "cleaning") return "Cleaning";
  if (p.beverage_type === "manual") return "Manual control";

  const steps = (p.steps ?? []).filter((s) => (s.seconds ?? 0) > 0);
  const pressures = steps.filter((s) => s.pump === "pressure").map((s) => s.pressure ?? 0);
  const flows = steps.filter((s) => s.pump === "flow");

  if ((p.target_weight ?? 0) >= 80) return "Espresso, long";
  if (pressures.length === 0) return "Espresso, flow profiled";

  const peak = Math.max(...pressures);
  const tail = pressures.slice(pressures.indexOf(peak));
  const declining = tail.length >= 2 && tail[tail.length - 1] < peak - 1.5;
  if (declining && pressures.length >= flows.length) return "Espresso, lever emulation";

  const middle = steps.slice(1, -1);
  const blooms = middle.some((s) =>
    s.pump === "pressure" ? (s.pressure ?? 0) <= 1.2 : (s.flow ?? 0) <= 0.6,
  );
  return blooms ? "Espresso, blooming" : "Espresso, traditional";
}

/** Espresso first, utility last; everything else alphabetical between them. */
const ORDER = [
  "Espresso, traditional",
  "Espresso, lever emulation",
  "Espresso, blooming",
  "Espresso, flow profiled",
  "Espresso, long",
  "Pour over",
  "Manual control",
  "Cleaning",
];

export const styleRank = (name: string) => {
  const at = ORDER.indexOf(name);
  return at === -1 ? ORDER.length : at;
};

export interface ProfileFacts {
  peakBar: number | null;
  seconds: number;
  outGrams: number | null;
}

/** Step count is an implementation detail; peak pressure, duration and target
 *  weight are what a person compares on. `seconds` is a ceiling, not a typical
 *  shot length: steps exit early on their pressure, flow or weight conditions. */
export function factsOf(record: ProfileRecord): ProfileFacts {
  const p = record.profile;
  const steps = (p.steps ?? []).filter((s) => (s.seconds ?? 0) > 0);
  const pressures = steps.filter((s) => s.pump === "pressure").map((s) => s.pressure ?? 0);
  return {
    peakBar: pressures.length ? Math.max(...pressures) : null,
    seconds: steps.reduce((sum, s) => sum + (s.seconds ?? 0), 0),
    outGrams: p.target_weight || null,
  };
}

/** Bundled titles namespace themselves with a slash: "Tea portafilter/oolong". */
export const shortName = (title: string) => title.slice(title.indexOf("/") + 1);
