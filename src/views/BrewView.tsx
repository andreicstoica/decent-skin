import { restUrl } from "../api/gateway";
import { ShotChart } from "../components/ShotChart";
import { useBeanBatch, useGrinder, useSetGrindSetting, type Workflow } from "../api/useWorkflow";
import type { TracePoint } from "../api/useShotTrace";
import { STATE_LABEL, WORKING, type MachineSnapshot, type MachineState, type MachineSubstate } from "../api/types";
import { useMachineSettings } from "../api/useDecaidSettings";
import { useCountdown } from "../api/useCountdown";

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

const MODES: { label: string; state: MachineState; power?: true }[] = [
  { label: "Espresso", state: "espresso" },
  { label: "Steam", state: "steam" },
  { label: "Water", state: "hotWater" },
  { label: "Flush", state: "flush" },
  { label: "Sleep", state: "sleeping", power: true },
];

function daysAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (!Number.isFinite(days) || days < 0) return null;
  return days === 0 ? "today" : `${days} days`;
}

function Read({
  label,
  value,
  color,
  minor,
}: {
  label: string;
  value: string;
  color?: string;
  minor?: boolean;
}) {
  return (
    <div className={`read__cell ${minor ? "read__cell--minor" : ""}`}>
      <span className="lbl">{label}</span>
      <span className="read__v num" style={color ? { color } : undefined}>{value}</span>
    </div>
  );
}

function Ratio({ dose, yieldTarget }: { dose?: number; yieldTarget?: number }) {
  const ratio = dose && yieldTarget ? (yieldTarget / dose).toFixed(1) : null;
  return (
    <div className="dial">
      <span className="lbl">In → out</span>
      <div className="dial__row">
        <span className="dial__v num">
          {dose ? dose.toFixed(1) : "—"} → {yieldTarget ? yieldTarget.toFixed(0) : "—"}
        </span>
        {ratio && <span className="dial__sub num">1:{ratio}</span>}
      </div>
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
    <div className="dial dial--ruled">
      <span className="lbl">Grind</span>
      <div className="dial__row">
        <span className="dial__v num">{setting ?? "—"}</span>
        <div className="grind__pair">
          <button className="step" onClick={() => step(1)} disabled={!steppable} aria-label="Coarser">+</button>
          <button className="step" onClick={() => step(-1)} disabled={!steppable} aria-label="Finer">−</button>
        </div>
      </div>
    </div>
  );
}

interface BrewViewProps {
  snapshot: MachineSnapshot;
  workflow: Workflow | null | undefined;
  weight: number | null;
  weightFlow: number | null;
  elapsed: number;
  trace: TracePoint[];
}

export function BrewView({ snapshot, workflow, weight, weightFlow, elapsed, trace }: BrewViewProps) {
  const ctx = workflow?.context;
  const { data: batch } = useBeanBatch(ctx?.beanBatchId);
  const roast = batch?.roastDate ? daysAgo(batch.roastDate) : null;
  const busy = snapshot.state.state !== "idle";
  const { data: machine } = useMachineSettings();
  const flushing = snapshot.state.state === "flush";

  const run = (mode: MachineState) =>
    void fetch(restUrl(`/machine/state/${mode}`), { method: "PUT" });

  const flushLeft = useCountdown(flushing, machine?.flushTimeout ?? 0, () => run("idle"));

  return (
    <div className="body">
      <div className="main">
        <div className="ident">
          <div className="ident__line">
            <span
              className={`state ${WORKING.has(snapshot.state.state) ? "state--busy" : ""}`}
            >
              {STATE_LABEL[snapshot.state.state]}
            </span>
            <h1 className="ident__name">{ctx?.coffeeName ?? "No bean selected"}</h1>
            {[ctx?.coffeeRoaster, roast, workflow?.profile?.title]
              .filter(Boolean)
              .map((bit) => (
                <span key={bit as string} className="ident__meta">
                  <span className="ident__sep">/ </span>
                  {bit}
                </span>
              ))}
          </div>
          <div className="dials">
            <Ratio dose={ctx?.targetDoseWeight} yieldTarget={ctx?.targetYield} />
            <Grind setting={ctx?.grinderSetting} grinderId={ctx?.grinderId} />
          </div>
        </div>

        <div className="read">
          <Read label={PHASE[snapshot.state.substate] ?? "Time"} value={elapsed.toFixed(1)} />
          <Read
            label="In cup"
            value={weight === null ? "—" : weight.toFixed(1)}
            color="hsl(var(--ch-weight))"
          />
        </div>

        <ShotChart
          trace={trace}
          pressure={snapshot.pressure}
          flow={snapshot.flow}
          weightFlow={weightFlow}
        />
      </div>

      <div className="rail">
        {MODES.map((mode) => {
          const on = snapshot.state.state === mode.state;
          return (
            <button
              key={mode.state}
              className={`mode ${on ? "mode--on" : ""} ${mode.power ? "mode--power" : ""}`}
              onClick={() => (on ? run("idle") : run(mode.state))}
              // You must be able to send a heating machine to sleep.
              disabled={!mode.power && busy && !on}
            >
              {on && mode.state === "flush" && flushLeft > 0 ? (
                <span className="mode__count">{Math.ceil(flushLeft)}</span>
              ) : on ? (
                "Stop"
              ) : (
                mode.label
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
