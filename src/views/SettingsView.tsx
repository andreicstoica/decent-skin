import { useSaveSettings, useSettings } from "../api/useSettings";
import {
  useDecaidSettings,
  useMachineSettings,
  useSaveDecaidSettings,
  useSaveMachineSettings,
} from "../api/useDecaidSettings";

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ paddingBottom: 26 }}>
      <div className="lbl" style={{ paddingBottom: 10 }}>{title}</div>
      {children}
    </section>
  );
}

function Row({ label, hint, control }: { label: string; hint?: string; control: React.ReactNode }) {
  return (
    <div className="field">
      <div>
        <div className="row__title">{label}</div>
        {hint && <div className="row__sub">{hint}</div>}
      </div>
      {control}
    </div>
  );
}

function Num({
  value,
  step = 1,
  onCommit,
}: {
  value: number;
  step?: number;
  onCommit: (n: number) => void;
}) {
  return (
    <input
      className="field__in num"
      type="number"
      step={step}
      defaultValue={value}
      key={value}
      onBlur={(e) => {
        const n = Number.parseFloat(e.target.value);
        if (Number.isFinite(n) && n !== value) onCommit(n);
      }}
    />
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className={`btn ${on ? "" : "btn--quiet"}`} style={{ minHeight: 36 }} onClick={() => onChange(!on)}>
      {on ? "On" : "Off"}
    </button>
  );
}

function Choice<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "flex" }}>
      {options.map((o) => (
        <button
          key={o}
          className={`btn ${o === value ? "" : "btn--quiet"}`}
          style={{ minHeight: 36, padding: "0 14px" }}
          onClick={() => onChange(o)}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export function SettingsView() {
  const skin = useSettings();
  const saveSkin = useSaveSettings();
  const { data: app } = useDecaidSettings();
  const saveApp = useSaveDecaidSettings();
  const { data: machine } = useMachineSettings();
  const saveMachine = useSaveMachineSettings();

  return (
    <div className="panel">
      {machine && (
        <Group title="Machine">
          <Row
            label="Flush duration"
            hint="Seconds. Decaid calls this flushTimeout."
            control={<Num value={machine.flushTimeout} onCommit={(flushTimeout) => saveMachine.mutate({ flushTimeout })} />}
          />
          <Row
            label="Flush flow"
            hint="mL/s. 6 is the machine default; 8 is close to wide open."
            control={<Num value={machine.flushFlow} step={0.5} onCommit={(flushFlow) => saveMachine.mutate({ flushFlow })} />}
          />
          <Row
            label="Steam flow"
            control={<Num value={machine.steamFlow} step={0.1} onCommit={(steamFlow) => saveMachine.mutate({ steamFlow })} />}
          />
          <Row
            label="Hot water flow"
            control={<Num value={machine.hotWaterFlow} step={0.5} onCommit={(hotWaterFlow) => saveMachine.mutate({ hotWaterFlow })} />}
          />
          <Row
            label="Fan threshold"
            control={<Num value={machine.fan} onCommit={(fan) => saveMachine.mutate({ fan })} />}
          />
        </Group>
      )}

      {app && (
        <Group title="Decaid">
          <Row
            label="Gateway mode"
            hint="Full hands shot control to the skin. Tracking only observes."
            control={
              <Choice
                value={app.gatewayMode}
                options={["disabled", "tracking", "full"] as const}
                onChange={(gatewayMode) => saveApp.mutate({ gatewayMode })}
              />
            }
          />
          <Row
            label="Theme"
            hint="This screen follows it."
            control={
              <Choice
                value={app.themeMode}
                options={["system", "light", "dark"] as const}
                onChange={(themeMode) => saveApp.mutate({ themeMode })}
              />
            }
          />
          <Row
            label="Keep screen awake"
            control={<Toggle on={app.keepAwake} onChange={(keepAwake) => saveApp.mutate({ keepAwake })} />}
          />
          <Row
            label="Block brewing without a scale"
            control={<Toggle on={app.blockOnNoScale} onChange={(blockOnNoScale) => saveApp.mutate({ blockOnNoScale })} />}
          />
          <Row
            label="Stop hot water at weight"
            control={
              <Toggle
                on={app.stopHotWaterAtWeight}
                onChange={(stopHotWaterAtWeight) => saveApp.mutate({ stopHotWaterAtWeight })}
              />
            }
          />
        </Group>
      )}

      <Group title="This skin">
        <Row
          label="Full tank depth"
          hint="Millimetres. The DE1 reports depth, not volume — fill the tank, read the Brew screen, put that number here."
          control={<Num value={skin.tankFullMm} onCommit={(tankFullMm) => saveSkin.mutate({ tankFullMm })} />}
        />
      </Group>
    </div>
  );
}
