import { useQuery } from "@tanstack/react-query";
import { restUrl } from "./api/gateway";
import { useMachineSnapshot, useScale } from "./api/useTelemetry";
import { useShotTimer } from "./api/useShotTimer";
import { ShotView } from "./views/ShotView";
import { RestingView } from "./views/RestingView";
import type { MachineState } from "./api/types";

const STATE_LABELS: Record<MachineState, string> = {
  booting: "Starting up",
  busy: "Busy",
  idle: "Ready",
  schedIdle: "Scheduled standby",
  sleeping: "Asleep",
  heating: "Heating",
  preheating: "Preheating",
  espresso: "Espresso",
  hotWater: "Hot water",
  flush: "Flushing",
  steam: "Steam",
  steamRinse: "Steam rinse",
  skipStep: "Skipping step",
  cleaning: "Cleaning",
};

const RESTING: ReadonlySet<MachineState> = new Set(["sleeping", "schedIdle"]);

export default function App() {
  const { snapshot, socket } = useMachineSnapshot();
  const scale = useScale();
  const { elapsed } = useShotTimer(snapshot);

  const { data: latestShot } = useQuery({
    queryKey: ["latest-shot"],
    queryFn: async () => {
      const res = await fetch(restUrl("/shots/latest"));
      if (!res.ok) return null;
      return (await res.json()) as { timestamp: string } | null;
    },
    // History is not live data; polling it at telemetry rates is waste.
    refetchInterval: 60_000,
  });

  const state = snapshot?.state.state;
  const resting = !!state && RESTING.has(state);

  return (
    <div className="screen">
      <header className="statusbar">
        <span className="statusbar__state">
          {state ? STATE_LABELS[state] : "Connecting…"}
        </span>
        <div className="chips">
          <span className="chip">
            <span className={`dot ${socket === "open" ? "dot--live" : "dot--warn"}`} />
            {socket === "open" ? "Gateway" : "Gateway offline"}
          </span>
          <span className="chip">
            <span className={`dot ${scale.connected ? "dot--live" : ""}`} />
            {scale.connected
              ? `Scale${scale.battery === null ? "" : ` ${scale.battery}%`}`
              : "No scale"}
          </span>
        </div>
      </header>

      {resting || !snapshot ? (
        <RestingView
          connected={!!snapshot}
          lastShotAt={
            latestShot?.timestamp
              ? new Date(latestShot.timestamp).toLocaleString()
              : null
          }
        />
      ) : (
        <ShotView snapshot={snapshot} weight={scale.weight} elapsed={elapsed} />
      )}
    </div>
  );
}
