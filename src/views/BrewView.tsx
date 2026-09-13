import { restUrl } from "../api/gateway";
import { ShotChart } from "../components/ShotChart";
import type { TracePoint } from "../api/useShotTrace";
import type { MachineSnapshot, MachineState, MachineSubstate } from "../api/types";
import type { Workflow } from "../api/useWorkflow";

const SUBSTATE_LABELS: Partial<Record<MachineSubstate, string>> = {
  idle: "–",
  preparingForShot: "Preparing",
  preinfusion: "Preinfusion",
  pouring: "Pouring",
  pouringDone: "Done",
  pausedSteam: "Paused",
  puffing: "Purging",
};

const MODES: { label: string; state: MachineState }[] = [
  { label: "Espresso", state: "espresso" },
  { label: "Steam", state: "steam" },
  { label: "Water", state: "hotWater" },
  { label: "Flush", state: "flush" },
];

interface BrewViewProps {
  snapshot: MachineSnapshot;
  workflow: Workflow | null | undefined;
  weight: number | null;
  elapsed: number;
  trace: TracePoint[];
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="metric">
      <span className="label">{label}</span>
      <span className="num metric__value" style={color ? { color } : undefined}>{value}</span>
    </div>
  );
}

export function BrewView({ snapshot, workflow, weight, elapsed, trace }: BrewViewProps) {
  const ctx = workflow?.context;
  const busy = snapshot.state.state !== "idle";

  const setState = (state: MachineState) => {
    void fetch(restUrl(`/machine/state/${state}`), { method: "PUT" });
  };

  const dose = ctx?.targetDoseWeight;
  const yieldTarget = ctx?.targetYield;

  return (
    <div className="body">
      <div className="main">
        <div className="headrow">
          <div className="card bean">
            <span className="label">Bean</span>
            <h1 className="bean__name">{ctx?.coffeeName ?? "No bean selected"}</h1>
            <span className="bean__meta">
              {ctx?.coffeeRoaster ?? "Set one under Beans & grind"}
              {dose && yieldTarget ? ` · ${dose.toFixed(1)} g › ${yieldTarget.toFixed(0)} g` : ""}
            </span>
            <span className="bean__meta">{workflow?.profile?.title ?? workflow?.name ?? ""}</span>
          </div>

          <div className="card grind">
            <span className="label">
              Grind{ctx?.grinderModel ? ` · ${ctx.grinderModel}` : ""}
            </span>
            <span className="num grind__value">{ctx?.grinderSetting ?? "–"}</span>
            <span className="bean__meta">finer ‹ › coarser</span>
          </div>
        </div>

        <div className="metrics">
          <Metric label="Time" value={`${elapsed.toFixed(0)}s`} />
          <Metric
            label="Pressure bar"
            value={snapshot.pressure.toFixed(1)}
            color="hsl(var(--chart-pressure))"
          />
          <Metric
            label="Flow mL/s"
            value={snapshot.flow.toFixed(1)}
            color="hsl(var(--chart-flow))"
          />
          <Metric label="In cup" value={weight === null ? "–" : `${weight.toFixed(1)} g`} />
          <span className="metrics__spacer" />
          <Metric label="Phase" value={SUBSTATE_LABELS[snapshot.state.substate] ?? "–"} />
        </div>

        <ShotChart trace={trace} />
      </div>

      <div className="rail">
        {MODES.map((mode) => {
          const active = snapshot.state.state === mode.state;
          return (
            <button
              key={mode.state}
              className={`btn ${active ? "btn--primary" : "btn--secondary"}`}
              onClick={() => setState(active ? "idle" : mode.state)}
              disabled={busy && !active}
            >
              {active ? "Stop" : mode.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
