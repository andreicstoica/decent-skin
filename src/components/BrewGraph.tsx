import { useId, useState, type ReactNode } from "react";
import type { Workflow } from "../api/useWorkflow";
import type { TracePoint } from "../api/useShotTrace";
import { ShotChart } from "./ShotChart";
import { ghostMatch, graphProfile } from "./shotGraph";
import { useGhostShot } from "./useGhostShot";

const EMPTY: TracePoint[] = [];

export function BrewGraph({ workflow, trace, live, elapsed, timestamp, children }: {
  workflow: Workflow | null | undefined; trace: TracePoint[]; live: boolean; elapsed: number; timestamp: string;
  children?: (ghostToggle: ReactNode) => ReactNode;
}) {
  const [ghostOn, setGhostOn] = useState(false);
  const ghostStatusId = useId();
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
  const comparing = live && ghostOn;
  const ghost = useGhostShot(match, comparing, session.before);
  const previous = ghost.data?.shot;
  const noMatch = "Select a profile and bean batch to compare.";
  const unavailable = !match ? { short: "No bean/profile", detail: noMatch } :
    ghost.isError ? { short: "History unavailable", detail: "History unavailable. Toggle Ghost off and back on to retry." } :
    ghost.isFetching ? { short: "Finding shot…", detail: "Finding the latest matching shot…" } :
    ghost.data?.incomplete ? { short: "No match in range", detail: "No match in checked history." } :
    !previous ? { short: "No match", detail: "No matching completed shot with a usable trace." } : null;
  const date = previous && new Date(previous.timestamp);
  const source = date?.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const status = comparing ? unavailable?.detail ?? `Ghost from ${source}, ${date?.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}. Same profile and bean batch.` :
    match ? "Compare the last completed shot for this profile and bean batch. Failed or incomplete shots are excluded." : noMatch;

  const toggle = live ? (
    <button type="button" className="read__ghost" aria-label="Ghost comparison" aria-pressed={ghostOn}
      aria-describedby={ghostStatusId} onClick={() => setGhostOn((on) => !on)}
      disabled={!match && !ghostOn} title={`Ghost comparison: ${status}`}>
      <span className="chart__ghost-icon">
        <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M3.5 10a6.5 6.5 0 0 1 13 0v5.7a.8.8 0 0 1-1.3.6l-2-1.7-2 1.7a1.8 1.8 0 0 1-2.4 0l-2-1.7-2 1.7a.8.8 0 0 1-1.3-.6Z" fill={ghostOn ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M7.65 9.4h.05m4.6 0h.05" stroke={ghostOn ? "hsl(var(--accent-fg))" : "currentColor"} strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
      <span className="sr-only" id={ghostStatusId} role="status">{status}</span>
    </button>
  ) : null;

  return (
    <>
      {children?.(toggle)}
      <ShotChart
        trace={live ? trace : EMPTY}
        ghost={comparing && !unavailable ? previous?.trace : undefined}
        profile={profile}
        live={live}
        fixedTime
        showLegend={live}
        label={live ? "Live espresso trace and pump targets" : "Planned profile targets"}
      />
    </>
  );
}
