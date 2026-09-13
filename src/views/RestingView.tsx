import { useState } from "react";
import { restUrl } from "../api/gateway";

interface RestingViewProps {
  lastShotAt: string | null;
  /** False while the gateway has not yet delivered a frame. */
  connected: boolean;
}

export function RestingView({ lastShotAt, connected }: RestingViewProps) {
  const [waking, setWaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wake = async () => {
    setWaking(true);
    setError(null);
    try {
      const res = await fetch(restUrl("/machine/state/idle"), { method: "PUT" });
      if (!res.ok) throw new Error(`Gateway returned ${res.status}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reach the gateway");
      setWaking(false);
    }
  };

  if (!connected) {
    return (
      <div className="resting">
        <h1 className="resting__headline">Waiting for the gateway</h1>
        <p className="resting__note">
          No telemetry yet. Check that Decaid is running and the DE1 is connected,
          then this screen fills in on its own.
        </p>
      </div>
    );
  }

  return (
    <div className="resting">
      <h1 className="resting__headline">The machine is asleep</h1>
      <p className="resting__note">
        {lastShotAt
          ? `Last shot ${lastShotAt}. Waking takes about four minutes to reach brew temperature.`
          : "Waking takes about four minutes to reach brew temperature."}
      </p>
      <button className="btn btn--primary" onClick={wake} disabled={waking}>
        {waking ? "Waking…" : "Wake the machine"}
      </button>
      {error && (
        <p className="resting__note" style={{ color: "hsl(var(--destructive))" }}>
          {error}. Check that Decaid is running and the machine is connected.
        </p>
      )}
    </div>
  );
}
