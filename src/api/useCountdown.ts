import { useEffect, useRef, useState } from "react";

/**
 * Counts down while `active` and calls `onDone` once at zero. The DE1 firmware
 * is expected to end a flush on its own, but the simulator does not, so the
 * caller closes the loop; on hardware that stops it the extra call is a no-op.
 */
export function useCountdown(active: boolean, seconds: number, onDone?: () => void) {
  const [remaining, setRemaining] = useState(0);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (!active || !Number.isFinite(seconds) || seconds <= 0) {
      setRemaining(0);
      return;
    }
    const endsAt = Date.now() + seconds * 1000;
    setRemaining(seconds);
    let fired = false;

    const tick = window.setInterval(() => {
      const left = Math.max(0, (endsAt - Date.now()) / 1000);
      setRemaining(left);
      if (left === 0 && !fired) {
        fired = true;
        window.clearInterval(tick);
        done.current?.();
      }
    }, 100);

    return () => window.clearInterval(tick);
  }, [active, seconds]);

  return remaining;
}
