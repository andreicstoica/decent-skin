import { useEffect, useEffectEvent, useRef, useState } from "react";

/**
 * Counts down from when we first observe the machine running. Changes to the
 * configured duration move the deadline without resetting elapsed time.
 * Only modes with an explicit software fallback supply `onDone`.
 */
export function useCountdown(active: boolean, seconds: number, onDone?: () => void) {
  const [remaining, setRemaining] = useState(0);
  const startedAt = useRef<number | null>(null);
  const fired = useRef(false);
  const done = useEffectEvent(() => onDone?.());

  useEffect(() => {
    if (!active) {
      startedAt.current = null;
      fired.current = false;
      return;
    }
    const start = startedAt.current ?? performance.now();
    startedAt.current = start;
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    let interval: number | undefined;

    const tick = () => {
      const left = Math.max(0, seconds - (performance.now() - start) / 1000);
      setRemaining(left);
      if (left === 0) {
        window.clearInterval(interval);
        if (!fired.current) {
          fired.current = true;
          done();
        }
      }
      return left;
    };

    if (tick() > 0) interval = window.setInterval(tick, 100);
    return () => window.clearInterval(interval);
  }, [active, seconds]);

  return active && Number.isFinite(seconds) && seconds > 0 ? remaining : 0;
}
