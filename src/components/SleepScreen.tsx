import { useEffect, useState } from "react";

/**
 * Quiet, dimmed full-screen sleep clock. Tapping anywhere wakes the machine.
 */
export function SleepScreen({ onWake, waking, error }: { onWake: () => void; waking: boolean; error: string | null }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const date = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="sleep">
      <button type="button" className="sleep__wake" onClick={onWake} disabled={waking} aria-label="Wake machine">
        <time className="sleep__time num" dateTime={now.toISOString()}>
          {hours}
          <span className="sleep__colon">:</span>
          {minutes}
        </time>
        <span className="sleep__meta">{date}</span>
      </button>
      {error && <span className="sleep__error" role="alert">{error}</span>}
    </div>
  );
}
