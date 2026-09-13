import { restUrl } from "../api/gateway";
import { ShotChart } from "../components/ShotChart";
import { useBeanBatch, useGrinder, useSetGrindSetting, type Workflow } from "../api/useWorkflow";
import type { TracePoint } from "../api/useShotTrace";
import type { MachineSnapshot, MachineState, MachineSubstate } from "../api/types";

const PHASE: Partial<Record<MachineSubstate, string>> = {
  preparingForShot: "Preparing",
  preinfusion: "Preinfusion",
  pouring: "Pouring",
  pouringDone: "Finished",
  pausedSteam: "Paused",
  puffing: "Purging",
  cleaningStart: "Cleaning",
  cleaningGroup: "Cleaning",
  cleanSoaking: "Soaking",
  cleaningSteam: "Cleaning",
};

const MODES: { label: string; state: MachineState }[] = [
  { label: "Espresso", state: "espresso" },
  { label: "Steam", state: "steam" },
  { label: "Water", state: "hotWater" },
  { label: "Flush", state: "flush" },
];

function daysAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (!Number.isFinite(days) || days < 0) return null;
  return days === 0 ? "today" : `${days} days`;
}

function Read({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="read__cell">
      <span className="lbl">{label}</span>
      <span className="read__v num" style={color ? { color } : undefined}>{value}</span>
    </div>
  );
}

function Grind({ setting, grinderId }: { setting?: string; grinderId?: string }) {
  const setGrind = useSetGrindSetting();
  const { data: grinder } = useGrinder(grinderId);
  const numeric = setting === undefined ? NaN : Number.parseFloat(setting);
  const steppable = Number.isFinite(numeric);
  const increment = grinder?.settingSmallStep ?? 0.1;
  const step = (direction: number) =>
    setGrind.mutate((numeric + direction * increment).toFixed(increment < 1 ? 1 : 0));

  return (
    <div className="grind">
      <span className="lbl">Grind</span>
      <span className="grind__v num">{setting ?? "—"}</span>
      <div className="grind__pair">
        <button className="step" onClick={() => step(1)} disabled={!steppable} aria-label="Coarser">+</button>
        <button className="step" onClick={() => step(-1)} disabled={!steppable} aria-label="Finer">−</button>
      </div>
    </div>
  );
}

interface BrewViewProps {
  snapshot: MachineSnapshot;
  workflow: Workflow | null | undefined;
  weight: number | null;
  elapsed: number;
  trace: TracePoint[];
}

export function BrewView({ snapshot, workflow, weight, elapsed, trace }: BrewViewProps) {
  const ctx = workflow?.context;
  const { data: batch } = useBeanBatch(ctx?.beanBatchId);
  const roast = batch?.roastDate ? daysAgo(batch.roastDate) : null;
  const busy = snapshot.state.state !== "idle";

  const run = (mode: MachineState) =>
    void fetch(restUrl(`/machine/state/${mode}`), { method: "PUT" });

  return (
    <div className="body">
      <div className="main">
        <div className="ident">
          <div className="ident__line">
            <h1 className="ident__name">{ctx?.coffeeName ?? "No bean selected"}</h1>
            {[
              ctx?.coffeeRoaster,
              roast,
              ctx?.targetDoseWeight && ctx?.targetYield
                ? `${ctx.targetDoseWeight.toFixed(1)} → ${ctx.targetYield.toFixed(0)} g`
                : null,
              workflow?.profile?.title,
            ]
              .filter(Boolean)
              .map((bit) => (
                <span key={bit as string} className="ident__meta">
                  <span className="ident__sep">/ </span>
                  {bit}
                </span>
              ))}
          </div>
          <Grind setting={ctx?.grinderSetting} grinderId={ctx?.grinderId} />
        </div>

        <div className="read">
          <Read label="Time" value={elapsed.toFixed(1)} />
          <Read label="Pressure" value={snapshot.pressure.toFixed(1)} color="hsl(var(--ch-pressure))" />
          <Read label="Flow" value={snapshot.flow.toFixed(1)} color="hsl(var(--ch-flow))" />
          <Read label="In cup" value={weight === null ? "—" : weight.toFixed(1)} color="hsl(var(--ch-weight))" />
          <span className="read__spacer" />
          {PHASE[snapshot.state.substate] && (
            <Read label="Phase" value={PHASE[snapshot.state.substate]!} />
          )}
        </div>

        <ShotChart trace={trace} />
      </div>

      <div className="rail">
        {MODES.map((mode) => {
          const on = snapshot.state.state === mode.state;
          return (
            <button
              key={mode.state}
              className={`mode ${on ? "mode--on" : ""}`}
              onClick={() => (on ? run("idle") : run(mode.state))}
              disabled={busy && !on}
            >
              {on ? "Stop" : mode.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
