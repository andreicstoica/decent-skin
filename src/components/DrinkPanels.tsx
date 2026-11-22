import { useId, useState } from "react";
import type { SteamPreset, WaterPreset } from "../api/useDrinkPresets";
import { useUpdateWorkflow, useWorkflow } from "../api/useWorkflow";
import { NumberStepper, Stepper } from "./Stepper";
import { useCountdown } from "../api/useCountdown";
import { useFlushPresets } from "../api/useFlushPresets";
import { clamp, round } from "./nudge";
import "./FlushPanel.css";
import "./UtilityReadout.css";
import {
  FLUSH_RANGE,
  matchesSteamPreset,
  STEAM_RANGE,
  presetSummary,
  useSteam,
  useWaterPresets,
  WATER_RANGE,
} from "./drinkControls";

export function OnOff({ labelId, on, onChange }: { labelId: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <div className="seg" role="group" aria-labelledby={labelId}>
      {([false, true] as const).map((v) => (
        <button
          type="button"
          key={String(v)}
          className={`seg__b ${on === v ? "seg__b--on" : ""}`}
          aria-pressed={on === v}
          onClick={() => on !== v && onChange(v)}
        >
          {v ? "On" : "Off"}
        </button>
      ))}
    </div>
  );
}

function PresetCard({ label, summary, pressed, disabled, onClick }: {
  label: string; summary?: string; pressed: boolean; disabled?: boolean; onClick: () => void;
}) {
  return (
    <button type="button" className={`preset ${pressed ? "preset--on" : ""}`} aria-pressed={pressed} disabled={disabled} onClick={onClick}>
      <span className="preset__l">{label}</span>
      {summary && <span className="preset__s num">{summary}</span>}
    </button>
  );
}

const Failed = () => (
  <p className="err" role="alert">Decaid did not take that change. Check the gateway and try again.</p>
);

export function SteamPanel() {
  const { presets, active, applied, heaterOn, setHeater, select, update, failed } = useSteam();
  const heaterId = useId();
  const activeId = matchesSteamPreset(active, applied) ? active.id : undefined;
  const save = (patch: Partial<Omit<SteamPreset, "id">>, settled: () => void) =>
    update.mutate({ id: active.id, patch }, { onSettled: settled });

  return (
    <div className="drink">
      <div className="presets" role="group" aria-label="Steam size">
        {presets.map((preset) => (
          <PresetCard key={preset.id} label={preset.label} summary={presetSummary(preset)}
            pressed={preset.id === activeId} disabled={!heaterOn || select.isPending || update.isPending}
            onClick={() => preset.id !== activeId && select.mutate(preset.id)} />
        ))}
      </div>
      <div className="dials drink__dials" key={active.id}>
        <NumberStepper
          label="Flow mL/s"
          value={applied?.flow ?? active.flow}
          range={STEAM_RANGE.flow}
          disabled={!heaterOn}
          onCommit={(flow, settled) => save({ flow }, settled)}
        />
        <NumberStepper
          ruled
          label="Temp °C"
          value={heaterOn ? applied?.targetTemperature : active.targetTemperature}
          range={STEAM_RANGE.temp}
          disabled={!heaterOn}
          onCommit={(targetTemperature, settled) => save({ targetTemperature }, settled)}
        />
        <NumberStepper
          ruled
          label="Duration s"
          value={applied?.duration ?? active.duration}
          range={STEAM_RANGE.duration}
          disabled={!heaterOn}
          onCommit={(duration, settled) => save({ duration }, settled)}
        />
        <div className="dial dial--ruled">
          <span className="lbl" id={heaterId}>Heater</span>
          <OnOff labelId={heaterId} on={heaterOn} onChange={setHeater} />
        </div>
      </div>
      {failed && <Failed />}
    </div>
  );
}

export function WaterPanel() {
  const { presets, active, select, update, failed } = useWaterPresets();
  const { data: workflow } = useWorkflow();
  const updateWorkflow = useUpdateWorkflow();
  const [editingCustom, setEditingCustom] = useState(false);

  const hot = workflow?.hotWaterData;
  const custom = editingCustom || !matchesSteamPreset(active, hot) || active.volume !== hot?.volume;
  const volume = hot?.volume ?? active.volume;
  const temp = hot?.targetTemperature ?? active.targetTemperature;
  const flow = hot?.flow ?? active.flow;
  const duration = hot?.duration ?? active.duration;

  const save = (patch: Partial<Omit<WaterPreset, "id">>, settled: () => void) => {
    if (custom) {
      updateWorkflow.mutate({ hotWaterData: patch }, { onSettled: settled });
      return;
    }
    update.mutate({ id: active.id, patch }, { onSettled: settled });
  };

  return (
    <div className="drink">
      <div className="presets presets--4" role="group" aria-label="Cup size">
        {presets.map((preset) => {
          const on = !custom && preset.id === active.id;
          return (
            <PresetCard
              key={preset.id}
              label={preset.label}
              summary={presetSummary(preset)}
              pressed={on}
              disabled={select.isPending || update.isPending || updateWorkflow.isPending}
              onClick={() => {
                setEditingCustom(false);
                if (!on) select.mutate(preset.id);
              }}
            />
          );
        })}
        <PresetCard label="Custom" pressed={custom} onClick={() => setEditingCustom(true)} />
      </div>
      <div className="dials drink__dials" key={custom ? "custom" : active.id}>
        <NumberStepper
          label="Volume mL"
          value={volume}
          range={WATER_RANGE.volume}
          onCommit={(v, settled) => save({ volume: v }, settled)}
        />
        <NumberStepper
          ruled
          label="Temp °C"
          value={temp}
          range={WATER_RANGE.temp}
          onCommit={(targetTemperature, settled) => save({ targetTemperature }, settled)}
        />
        <NumberStepper
          ruled
          label="Flow mL/s"
          value={flow}
          range={WATER_RANGE.flow}
          onCommit={(f, settled) => save({ flow: f }, settled)}
        />
        <NumberStepper
          ruled
          label="Duration s"
          value={duration}
          range={WATER_RANGE.duration}
          onCommit={(d, settled) => save({ duration: d }, settled)}
        />
      </div>
      {(failed || updateWorkflow.isError) && <Failed />}
    </div>
  );
}

export function FlushPanel({ flushing }: { flushing: boolean }) {
  const { presets, applied, activeId, mutation, failed } = useFlushPresets();
  const busy = mutation.isPending || !presets;
  const fields = [
    { field: "targetTemperature", label: "Temp °C", range: FLUSH_RANGE.temp },
    { field: "duration", label: "Duration s", range: FLUSH_RANGE.duration },
    { field: "flow", label: "Flow mL/s", range: FLUSH_RANGE.flow },
  ] as const;

  return (
    <div className="drink drink--flush">
      <div className="presets" role="group" aria-label="Flush preset">
        {(["quick", "standard", "custom"] as const).map((id) => (
          <PresetCard
            key={id}
            label={id === "quick" ? "Quick" : id === "standard" ? "Standard" : "Custom"}
            summary={presets?.[id] ? presetSummary(presets[id]) : undefined}
            pressed={activeId === id}
            disabled={flushing || busy}
            onClick={() => mutation.mutate({ id })}
          />
        ))}
      </div>
      <div className="dials drink__dials flush__dials" aria-busy={busy}>
        {fields.map(({ field, label, range }) => {
          const value = applied?.[field];
          // Use applied values without a deferred draft: starting a flush always
          // uses the same duration displayed here and by BrewView's countdown.
          const editable = !busy && value !== undefined && !(flushing && field === "duration");
          const change = (dir: number) => value !== undefined && mutation.mutate({
            id: activeId,
            patch: { [field]: clamp(round(value + dir * range.step, range.places), range.min, range.max) },
          });
          return (
            <Stepper key={field} label={label}
              value={value === undefined ? "—" : value.toFixed(range.places)}
              less={`Lower ${label}`} more={`Raise ${label}`}
              onLess={editable && value > range.min ? () => change(-1) : undefined}
              onMore={editable && value < range.max ? () => change(1) : undefined}
            />
          );
        })}
      </div>
      {failed && <p className="err" role="alert">Could not apply or save the flush settings. The controls show the current workflow values; try again.</p>}
    </div>
  );
}

const utilityNames = { steam: "Steam", hotWater: "Water", flush: "Flush" } as const;

export function UtilityReadout({ mode, running, duration, flushLeft, weight, onStop, stopping, stopError }: {
  mode: keyof typeof utilityNames;
  running: boolean;
  duration?: number;
  flushLeft: number;
  weight: number | null;
  onStop: () => void;
  stopping?: boolean;
  stopError?: string | null;
}) {
  const flush = mode === "flush";
  const estimate = useCountdown(!flush && running, duration ?? 0);
  const secondsLeft = flush ? flushLeft : estimate;
  const hasTimer = running && (flush || (Number.isFinite(duration) && (duration ?? 0) > 0));
  const timerLabel = flush ? "Time left" : "Est. time left";
  // Decaid programs these timeouts on the DE1. An on-screen zero is not
  // confirmation that the machine has stopped; keep Stop available until idle.
  const finishing = hasTimer && secondsLeft <= 0;

  return (
    <section className="utility-readout" aria-label={`${utilityNames[mode]} readout`}>
      <div className="utility-readout__metrics">
        {mode === "hotWater" && (
          <div className="utility-readout__metric">
            <span className="lbl">In cup</span>
            <span className="num utility-readout__number">{weight?.toFixed(1) ?? "—"}<span className="utility-readout__unit">g</span></span>
          </div>
        )}
        <div className="utility-readout__metric utility-readout__timer" role="timer" aria-label={timerLabel}>
          <span className="lbl">{timerLabel}</span>
          <span className="num utility-readout__number">{hasTimer ? Math.max(0, Math.ceil(secondsLeft)) : "—"}<span className="utility-readout__unit">s</span></span>
          {finishing && <span className="row__sub" role="status">Waiting for machine to stop…</span>}
        </div>
      </div>
      {(running || stopError) && (
        <div className="utility-readout__actions">
          {stopError && <p className="err" role="alert">{stopError}</p>}
          {running && (
            <button type="button" className="utility-readout__stop" disabled={stopping}
              onClick={onStop}>
              {stopping ? "Stopping…" : `Stop ${utilityNames[mode]}`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
