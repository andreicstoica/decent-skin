import { useState } from "react";
import type { Workflow } from "../api/useWorkflow";
import type { TracePoint } from "../api/useShotTrace";
import { ShotChart } from "./ShotChart";
import { ghostMatch, graphProfile } from "./shotGraph";
import { useGhostShot } from "./useGhostShot";

const EMPTY: TracePoint[] = [];

export function BrewGraph({ workflow, trace, live, elapsed, timestamp }: {
  workflow: Workflow | null | undefined; trace: TracePoint[]; live: boolean; elapsed: number; timestamp: string;
}) {
  const [ghostOn, setGhostOn] = useState(false);
  // Freeze profile identity + history cutoff for a run. Workflow polling or
  // a just-saved shot must not quietly swap the comparison under a live trace.
  const machineTime = Date.parse(timestamp);
  const before = Number.isFinite(machineTime) ? machineTime - (live ? Math.max(0, elapsed) * 1000 : 0) : 0;
  const [session, setSession] = useState({ live, workflow, before });
  if (session.live !== live) {
    // On entry elapsed can still be the previous shot's timer until its effect
    // resets. Use this transition's machine time, not that stale elapsed value.
    setSession({ live, workflow, before: Number.isFinite(machineTime) ? machineTime : 0 });
  }
  const current = live ? session.workflow : workflow;
  const profile = graphProfile(current?.profile);
  const match = ghostMatch(current);
  const ghost = useGhostShot(match, ghostOn, session.before);
  const previous = ghost.data?.shot;
  const unavailable = !match ? "Select a profile and bean batch to compare" :
    ghost.isError ? "History unavailable" :
    ghost.isFetching ? "Finding the latest matching shot…" :
    ghost.data?.incomplete ? "No match in checked history" :
    !previous ? "No matching completed shot with a usable trace" : null;
  const status = ghostOn ? unavailable ?? `Same profile + bean batch · ${new Date(previous!.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${new Date(previous!.timestamp).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` :
    match ? "Compare the last completed shot for this profile + bean batch" : "Select a profile and bean batch to compare";

  return (
    <ShotChart
      trace={live ? trace : EMPTY}
      ghost={ghostOn && !unavailable ? previous?.trace : undefined}
      profile={profile}
      live={live}
      fixedTime
      showLegend
      label={live ? "Live espresso trace and pump targets" : "Planned profile targets"}
      controls={(
        <div className="chart__controls">
          <button type="button" className={`chart__ghost-toggle ${ghostOn ? "chart__ghost-toggle--on" : ""}`} aria-pressed={ghostOn} onClick={() => setGhostOn(!ghostOn)} disabled={!match && !ghostOn} title="Overlay the most recent matching shot with a usable recording. Failed or incomplete shots are excluded.">
            Ghost {ghostOn ? "on" : "off"}
          </button>
          <span className="chart__ghost-status" role="status">{status}</span>
          {ghostOn && ghost.isError && <button type="button" className="chart__retry" onClick={() => void ghost.refetch()}>Retry</button>}
        </div>
      )}
    />
  );
}
