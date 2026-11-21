import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { restUrl } from "./gateway";

export interface ShotContext {
  beanBatchId?: string;
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
  createdAt?: string;
  updatedAt?: string;
  stopReason?: string | null;
  workflow?: { profile?: { title?: string }; context?: ShotContext };
  annotations?: {
    actualDoseWeight?: number | null;
    actualYield?: number | null;
    drinkTds?: number | null;
    drinkEy?: number | null;
    enjoyment?: number | null;
    espressoNotes?: string | null;
    extras?: Record<string, unknown> | null;
  } | null;
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
  machine?: { timestamp: string; flow?: number; pressure?: number; targetPressure?: number; targetFlow?: number; profileFrame?: number; state?: { substate?: string } };
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
  /** Fixed-vocabulary taste chips. Kept structured so the values stay
   *  comparable across shots; free text lives in espressoNotes. */
  extras?: Record<string, unknown> | null;
  actualDoseWeight?: number | null;
  actualYield?: number | null;
  drinkTds?: number | null;
  drinkEy?: number | null;
  /** Decaid canonical scale: 0–10. Values outside 0–10 are rejected with 400. */
  enjoyment?: number | null;
  espressoNotes?: string | null;
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
  stoppingBackstop: "Stopped by backstop",
  error: "Ended on an error",
  disconnected: "Machine disconnected",
};

/** Reasons that mean the shot ran as intended. */
const CLEAN = new Set(["targetWeight", "targetVolume", "profileAdvance", "machineEnded"]);

export const stopLabel = (reason?: string | null) =>
  reason ? (STOP_REASON[reason] ?? reason) : null;

export const endedEarly = (reason?: string | null) => !!reason && !CLEAN.has(reason);
