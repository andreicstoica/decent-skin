import { useState } from "react";
import { useJsonSocket } from "./useJsonSocket";

interface WaterLevels {
  currentLevel: number;
  refillLevel: number;
}

export function useWaterLevel() {
  const [levels, setLevels] = useState<WaterLevels | null>(null);
  useJsonSocket<WaterLevels>("/machine/waterLevels", setLevels);
  return levels;
}
