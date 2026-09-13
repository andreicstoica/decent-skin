import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { restUrl } from "./gateway";

export interface ShotContext {
  coffeeName?: string;
  coffeeRoaster?: string;
  grinderModel?: string;
  grinderSetting?: string;
  targetDoseWeight?: number;
  targetYield?: number;
}

export interface ShotSummary {
  id: string;
  timestamp: string;
  stopReason?: string;
  workflow?: { profile?: { title?: string }; context?: ShotContext };
  annotations?: {
    actualDoseWeight?: number;
    actualYield?: number;
    drinkTds?: number;
    drinkEy?: number;
    enjoyment?: number;
    espressoNotes?: string;
  };
}

export function useShots(limit = 40) {
  return useQuery({
    queryKey: ["shots", limit],
    queryFn: async (): Promise<ShotSummary[]> => {
      const res = await fetch(restUrl(`/shots?limit=${limit}&offset=0`));
      if (!res.ok) return [];
      const body = await res.json();
      return body.items ?? [];
    },
    refetchInterval: 30_000,
  });
}

export interface Measurement {
  machine?: { timestamp: string; flow?: number; pressure?: number; targetPressure?: number; targetFlow?: number };
  scale?: { weight?: number; weightFlow?: number };
}

export interface ShotDetail extends ShotSummary {
  measurements?: Measurement[];
  stopReason?: string;
}

export function useShot(id: string | null) {
  return useQuery({
    queryKey: ["shot", id],
    queryFn: async (): Promise<ShotDetail | null> => {
      const res = await fetch(restUrl(`/shots/${id}`));
      return res.ok ? ((await res.json()) as ShotDetail) : null;
    },
    enabled: !!id,
  });
}

export interface Annotations {
  actualDoseWeight?: number;
  actualYield?: number;
  drinkTds?: number;
  drinkEy?: number;
  enjoyment?: number;
  espressoNotes?: string;
}

export function useAnnotate(id: string | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (annotations: Annotations) => {
      const res = await fetch(restUrl(`/shots/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annotations }),
      });
      if (!res.ok) throw new Error(`Gateway returned ${res.status}`);
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["shot", id] });
      client.invalidateQueries({ queryKey: ["shots"] });
    },
  });
}

/**
 * Decaid documents stopReason as an open set, so unknown values fall through to
 * the raw string rather than being dropped. `apiStop` means a REST client sent
 * the stop; in this skin that client is the Stop button, i.e. a person.
 */
const STOP_REASON: Record<string, string> = {
  targetWeight: "Hit target weight",
  targetVolume: "Hit target volume",
  apiStop: "Stopped by hand",
  appStop: "Stopped in Decaid",
  machineEnded: "Profile ended or group control",
  profileAdvance: "Profile ran to the end",
  profileSkip: "Step skipped",
  noScale: "Blocked, no scale",
  error: "Ended on an error",
  disconnected: "Machine disconnected",
};

/** Reasons that mean the shot ran as intended. */
const CLEAN = new Set(["targetWeight", "targetVolume", "profileAdvance", "machineEnded"]);

export const stopLabel = (reason?: string) =>
  reason ? (STOP_REASON[reason] ?? reason) : null;

export const endedEarly = (reason?: string) => !!reason && !CLEAN.has(reason);
