import { useId, useState } from "react";
import type { SteamPreset, WaterPreset } from "../api/useDrinkPresets";
import { useUpdateWorkflow, useWorkflow } from "../api/useWorkflow";
import { NumberStepper } from "./Stepper";
import {
  FLUSH_RANGE,
  STEAM_RANGE,
  steamSummary,
  useSteam,
  useWaterPresets,
  WATER_RANGE,
  waterSummary,
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

export function PresetPicker<P extends SteamPreset>({
  label,
  presets,
  activeId,
  summary,
  disabled,
  onSelect,
}: {
  label: string;
  presets: P[];
  activeId: string;
  summary: (preset: P) => string;
  disabled?: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="presets" role="group" aria-label={label}>
      {presets.map((preset) => {
        const on = preset.id === activeId;
        return (
          <button
            type="button"
            key={preset.id}
            className={`preset ${on ? "preset--on" : ""}`}
            aria-pressed={on}
            disabled={disabled}
            onClick={() => !on && onSelect(preset.id)}
          >
            <span className="preset__l">{preset.label}</span>
            <span className="preset__s num">{summary(preset)}</span>
          </button>
        );
      })}
    </div>
  );
}

const Failed = () => (
  <p className="err" role="alert">Decaid did not take that change. Check the gateway and try again.</p>
);

export function SteamPanel() {
  const { presets, active, heaterOn, setHeater, select, update, failed } = useSteam();
  const heaterId = useId();
  const save = (patch: Partial<Omit<SteamPreset, "id">>, settled: () => void) =>
    update.mutate({ id: active.id, patch }, { onSettled: settled });

  return (
    <div className="drink">
      <PresetPicker
        label="Steam size"
        presets={presets}
        activeId={active.id}
        summary={steamSummary}
        disabled={!heaterOn}
        onSelect={(id) => select.mutate(id)}
      />
      <div className="dials drink__dials" key={active.id}>
        <NumberStepper
          label="Flow mL/s"
          value={active.flow}
          range={STEAM_RANGE.flow}
          disabled={!heaterOn}
          onCommit={(flow, settled) => save({ flow }, settled)}
        />
        <NumberStepper
          ruled
          label="Temp °C"
          value={active.targetTemperature}
          range={STEAM_RANGE.temp}
          disabled={!heaterOn}
          onCommit={(targetTemperature, settled) => save({ targetTemperature }, settled)}
        />
        <NumberStepper
          ruled
          label="Duration s"
          value={active.duration}
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
  const [custom, setCustom] = useState(false);

  const hot = workflow?.hotWaterData;
  const volume = custom ? (hot?.volume ?? active.volume) : active.volume;
  const temp = custom ? (hot?.targetTemperature ?? active.targetTemperature) : active.targetTemperature;
  const flow = custom ? (hot?.flow ?? active.flow) : active.flow;
  const duration = custom ? (hot?.duration ?? active.duration) : active.duration;

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
            <button
              type="button"
              key={preset.id}
              className={`preset ${on ? "preset--on" : ""}`}
              aria-pressed={on}
              onClick={() => {
                setCustom(false);
                if (!on) select.mutate(preset.id);
              }}
            >
              <span className="preset__name">{preset.label}</span>
              <span className="preset__meta num">{waterSummary(preset)}</span>
            </button>
          );
        })}
        <button
          type="button"
          className={`preset ${custom ? "preset--on" : ""}`}
          aria-pressed={custom}
          onClick={() => setCustom(true)}
        >
          <span className="preset__name">Custom</span>
        </button>
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

const FLUSH_PRESETS = [
  { id: "quick", label: "Quick", targetTemperature: 90, duration: 5, flow: 6 },
  { id: "standard", label: "Standard", targetTemperature: 90, duration: 10, flow: 6 },
] as const;

export function FlushPanel({ flushing, left }: { flushing: boolean; left: number }) {
  const { data: workflow } = useWorkflow();
  const update = useUpdateWorkflow();
  const rinse = workflow?.rinseData;
  const [custom, setCustom] = useState(false);

  const activePreset = custom
    ? null
    : FLUSH_PRESETS.find(
        (p) =>
          p.targetTemperature === rinse?.targetTemperature &&
          p.duration === rinse?.duration &&
          p.flow === rinse?.flow,
      ) ?? null;
  const isCustom = custom || !activePreset;

  return (
    <div className="drink">
      <div className="presets" role="group" aria-label="Flush preset">
        {FLUSH_PRESETS.map((p) => {
          const on = !isCustom && activePreset?.id === p.id;
          return (
            <button
              type="button"
              key={p.id}
              className={`preset ${on ? "preset--on" : ""}`}
              aria-pressed={on}
              disabled={flushing}
              onClick={() => {
                setCustom(false);
                update.mutate({
                  rinseData: {
                    targetTemperature: p.targetTemperature,
                    duration: p.duration,
                    flow: p.flow,
                  },
                });
              }}
            >
              <span className="preset__name">{p.label}</span>
              <span className="preset__meta num">{`${p.targetTemperature}° · ${p.duration}s`}</span>
            </button>
          );
        })}
        <button
          type="button"
          className={`preset ${isCustom ? "preset--on" : ""}`}
          aria-pressed={isCustom}
          onClick={() => setCustom(true)}
        >
          <span className="preset__name">Custom</span>
        </button>
      </div>

      <div className="dials drink__dials">
        <NumberStepper
          label="Temp °C"
          value={rinse?.targetTemperature}
          range={FLUSH_RANGE.temp}
          onCommit={(targetTemperature, settled) =>
            update.mutate({ rinseData: { targetTemperature } }, { onSettled: settled })
          }
        />
        {/* The countdown restarts when its length changes, so it is fixed mid-flush. */}
        <NumberStepper
          ruled
          label="Duration s"
          value={rinse?.duration}
          range={FLUSH_RANGE.duration}
          disabled={flushing}
          onCommit={(duration, settled) => update.mutate({ rinseData: { duration } }, { onSettled: settled })}
        />
        <NumberStepper
          ruled
          label="Flow mL/s"
          value={rinse?.flow}
          range={FLUSH_RANGE.flow}
          onCommit={(flow, settled) => update.mutate({ rinseData: { flow } }, { onSettled: settled })}
        />
      </div>
      <div className="drink__live">
        <span className="lbl">Time left s</span>
        <span className="read__v num">{flushing && left > 0 ? Math.ceil(left) : "—"}</span>
      </div>
      {update.isError && <Failed />}
    </div>
  );
}
