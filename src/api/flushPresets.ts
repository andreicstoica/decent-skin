export type FlushPresetId = "quick" | "standard" | "custom";
export interface FlushValues { targetTemperature: number; duration: number; flow: number }
export interface FlushPresets {
  activeId: FlushPresetId | null;
  quick: FlushValues;
  standard: FlushValues;
  custom: FlushValues | null;
}
export const DEFAULT_FLUSH_PRESETS: FlushPresets = {
  activeId: null,
  quick: { targetTemperature: 90, duration: 5, flow: 6 },
  standard: { targetTemperature: 90, duration: 10, flow: 6 },
  custom: null,
};
const limits = { targetTemperature: [20, 100], duration: [1, 60], flow: [1, 10] } as const;
export function isFlushValues(value: unknown): value is FlushValues {
  if (!value || typeof value !== "object") return false;
  return Object.entries(limits).every(([key, [min, max]]) => {
    const n = (value as Record<string, unknown>)[key];
    return typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
  });
}
export function parseFlushPresets(value: unknown): FlushPresets {
  const saved = value && typeof value === "object" ? value as Partial<FlushPresets> : {};
  return {
    activeId: ["quick", "standard", "custom"].includes(saved.activeId ?? "") ? saved.activeId! : null,
    quick: isFlushValues(saved.quick) ? saved.quick : DEFAULT_FLUSH_PRESETS.quick,
    standard: isFlushValues(saved.standard) ? saved.standard : DEFAULT_FLUSH_PRESETS.standard,
    custom: isFlushValues(saved.custom) ? saved.custom : null,
  };
}
export function matchesFlush(a: FlushValues | null, b: Partial<FlushValues> | undefined) {
  return !!a && !!b && a.targetTemperature === b.targetTemperature && a.duration === b.duration && a.flow === b.flow;
}
export function activeFlushId(saved: FlushPresets, applied: Partial<FlushValues> | undefined): FlushPresetId {
  // Explicit Custom stays Custom even when its numbers happen to match Quick.
  if (saved.activeId === "custom") return "custom";
  if (saved.activeId && matchesFlush(saved[saved.activeId], applied)) return saved.activeId;
  if (!saved.activeId) {
    if (matchesFlush(saved.quick, applied)) return "quick";
    if (matchesFlush(saved.standard, applied)) return "standard";
  }
  return "custom";
}
export function editFlushPreset(saved: FlushPresets, id: FlushPresetId, applied: FlushValues, patch: Partial<FlushValues>): FlushPresets {
  const next = { ...applied, ...patch };
  if (!isFlushValues(next)) throw new Error("Invalid flush settings");
  return { ...saved, activeId: id, [id]: next };
}
