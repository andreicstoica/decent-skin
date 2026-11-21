import { useCallback, useEffect, useRef, useState } from "react";

/** One PUT per settled burst of taps: each PUT re-uploads the workflow to the machine. */
const NUDGE_SETTLE_MS = 450;

/**
 * Shows the tapped value at once and sends only the last one. Taps compute
 * from the draft, not the server copy, so a fast run of taps is never lost.
 * A pending value is sent on unmount instead of being dropped.
 */
export function useNudge(server: number | undefined, commit: (n: number, settled: () => void) => void) {
  const [draft, setDraft] = useState<number | null>(null);
  const pending = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  });

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const n = pending.current;
    if (n === null) return;
    pending.current = null;
    commitRef.current(n, () => setDraft((d) => (d === n ? null : d)));
  }, []);

  useEffect(() => flush, [flush]);

  const nudge = (n: number) => {
    setDraft(n);
    pending.current = n;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, NUDGE_SETTLE_MS);
  };

  return [draft ?? server, nudge] as const;
}

export const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;
export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export interface Range {
  step: number;
  min: number;
  max: number;
  places: number;
}
