import { useState } from "react";
import { useJsonSocket } from "./useJsonSocket";

interface WaterLevels {
  currentLevel: number;
  refillLevel: number;
}

export type WaterStatus = "ok" | "low" | "refill";

/**
 * The DE1 reports tank depth in mm (raw uint16 / 256), not volume or percent,
 * so a fraction is only meaningful against a calibrated full depth.
 */
export function useWater(tankFullMm: number) {
  const [levels, setLevels] = useState<WaterLevels | null>(null);
  useJsonSocket<WaterLevels>("/machine/waterLevels", setLevels);

  if (!levels) return null;

  const fraction = Math.max(0, Math.min(1, levels.currentLevel / tankFullMm));
  const status: WaterStatus =
    levels.currentLevel <= levels.refillLevel ? "refill" : fraction < 0.2 ? "low" : "ok";

  return { ...levels, fraction, status };
}
