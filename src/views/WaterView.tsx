import { useEffect, useId, useState } from "react";
import { useSetRefillLevel, type useWater } from "../api/useWater";
import {
  useMachineCommand,
  useMaintenance,
  useMarkCleaned,
  useSetCleanInterval,
  type MachineCommand,
} from "../api/useMaintenance";
import type { MachineState } from "../api/types";

type Water = ReturnType<typeof useWater>;

function Num({
  id,
  value,
  step = 1,
  min,
  max,
  onCommit,
}: {
  id: string;
  value: number | undefined;
  step?: number;
  min?: number;
  max?: number;
  onCommit: (n: number) => void;
}) {
  return (
    <input
      id={id}
      className="field__in num"
      type="number"
      inputMode="decimal"
      enterKeyHint="done"
      step={step}
      min={min}
      max={max}
      defaultValue={value ?? ""}
      key={value ?? "unset"}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      onBlur={(e) => {
        const parsed = Number.parseFloat(e.target.value);
        if (!Number.isFinite(parsed)) {
          e.currentTarget.value = value === undefined ? "" : String(value);
          return;
        }
        const n = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, parsed));
        e.currentTarget.value = String(n);
        if (n !== value) onCommit(n);
      }}
    />
  );
}

function Meter({ fraction, marker, tone }: { fraction: number; marker?: number; tone?: "low" | "urgent" }) {
  return (
    <div className={`meter ${tone ? `meter--${tone}` : ""}`} aria-hidden="true">
      <div className="meter__fill" style={{ transform: `scaleX(${Math.max(0, Math.min(1, fraction))})` }} />
      {marker !== undefined && (
        <div className="meter__mark" style={{ left: `${Math.max(0, Math.min(1, marker)) * 100}%` }} />
      )}
    </div>
  );
}

export function Tank({ water, tankFullMm }: { water: Water; tankFullMm: number }) {
  const setRefill = useSetRefillLevel();
  const refillId = useId();

  if (!water) {
    return (
      <section className="group">
        <div className="group__h"><h2 className="lbl">Tank</h2></div>
        <p className="row__sub section__empty">Waiting for tank level…</p>
      </section>
    );
  }

  const tone = water.status === "refill" ? "urgent" : water.status === "low" ? "low" : undefined;

  return (
    <section className="group">
      <div className="group__h group__h--row">
        <h2 className="lbl">Tank</h2>
        {water.status !== "ok" && (
          <span className={`tag ${water.status === "refill" ? "tag--urgent" : "tag--quiet"}`}>
            {water.status === "refill" ? "Refill" : "Low"}
          </span>
        )}
      </div>

      <div className="gauge">
        <div className="gauge__nums">
          <span className="gauge__v num">
            {Math.round(water.fraction * 100)}
            <small>%</small>
          </span>
          <span className="row__sub num">
            {water.currentLevel.toFixed(0)} / {tankFullMm} mm
          </span>
        </div>
        <Meter fraction={water.fraction} marker={water.refillLevel / tankFullMm} tone={tone} />
      </div>

      <div className="field">
        <label className="row__title" htmlFor={refillId}>
          Refill alert <span className="field__unit">mm</span>
        </label>
        <Num
          id={refillId}
          value={water.refillLevel}
          min={0}
          max={tankFullMm}
          onCommit={(mm) => setRefill.mutate(mm)}
        />
      </div>
      {setRefill.isError && <p className="err" role="alert">Could not save refill level.</p>}
    </section>
  );
}

export function Cleaning({ state }: { state: MachineState }) {
  const { shotsSinceClean, cleanIntervalShots, lastCleanedAt, due, capped, countUnavailable, isLoading } = useMaintenance();
  const markCleaned = useMarkCleaned();
  const setCleanInterval = useSetCleanInterval();
  const command = useMachineCommand();
  const intervalId = useId();
  const [armed, setArmed] = useState<MachineCommand | null>(null);

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(null), 4000);
    return () => clearTimeout(timer);
  }, [armed]);

  const last = lastCleanedAt ? new Date(lastCleanedAt).toLocaleDateString() : null;
  const cycles: { label: string; state: MachineCommand; confirm: boolean }[] = [
    { label: "Clean", state: "cleaning", confirm: true },
    { label: "Steam rinse", state: "steamRinse", confirm: false },
    { label: "Descale", state: "descaling", confirm: true },
  ];

  return (
    <section className="group">
      <div className="group__h group__h--row">
        <h2 className="lbl">Cleaning</h2>
        {due && <span className="tag tag--urgent">Due</span>}
      </div>

      <div className="gauge">
        <div className="gauge__nums">
          <span className="gauge__v num">
            {isLoading || countUnavailable ? "—" : `${shotsSinceClean}${capped ? "+" : ""}`}
            <small>/{cleanIntervalShots}</small>
          </span>
          <span className="row__sub">
            {countUnavailable ? "Shot count unavailable" : last ? `Last ${last}` : "Shots since clean"}
          </span>
          <span className="actions__end" />
          <button
            type="button"
            className="btn btn--quiet btn--compact"
            onClick={() => markCleaned.mutate()}
            disabled={markCleaned.isPending || shotsSinceClean === 0}
          >
            {markCleaned.isPending ? "Saving…" : "Mark cleaned"}
          </button>
        </div>
        <Meter
          fraction={cleanIntervalShots > 0 ? shotsSinceClean / cleanIntervalShots : 0}
          tone={due ? "urgent" : undefined}
        />
      </div>

      <div className="field">
        <label className="row__title" htmlFor={intervalId}>
          Clean interval <span className="field__unit">shots</span>
        </label>
        <Num
          id={intervalId}
          value={cleanIntervalShots}
          step={5}
          min={10}
          max={500}
          onCommit={(n) => setCleanInterval.mutate(n)}
        />
      </div>

      <div className="cycles">
        {cycles.map((cycle) => {
          const running = state === cycle.state;
          const isArmed = armed === cycle.state;
          return (
            <button
              type="button"
              key={cycle.state}
              className={`mode cycle ${running ? "mode--on" : ""} ${isArmed ? "cycle--armed" : ""}`}
              disabled={command.isPending || (!running && state !== "idle")}
              onClick={() => {
                if (running) return command.mutate("idle");
                if (cycle.confirm && !isArmed) return setArmed(cycle.state);
                setArmed(null);
                command.mutate(cycle.state);
              }}
            >
              {running ? "Stop" : isArmed ? `Confirm ${cycle.label.toLowerCase()}` : cycle.label}
            </button>
          );
        })}
      </div>

      {armed && (
        <p className="row__sub section__hint" aria-live="polite">
          Tap again to start.
        </p>
      )}
      {(command.isError || markCleaned.isError || setCleanInterval.isError) && (
        <p className="err" role="alert">Command failed.</p>
      )}
    </section>
  );
}

export function WaterView({
  state,
  water,
  tankFullMm,
}: {
  state: MachineState;
  water: Water;
  tankFullMm: number;
}) {
  return (
    <div className="panel">
      <div className="water">
        <Tank water={water} tankFullMm={tankFullMm} />
        <Cleaning state={state} />
      </div>
    </div>
  );
}
