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
