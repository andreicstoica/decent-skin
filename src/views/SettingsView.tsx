import { useState } from "react";
import { DEFAULTS, useSaveSettings, type SkinSettings } from "../api/useSettings";

function Field({
  label,
  hint,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
}) {
  return (
    <div className="field">
      <div>
        <div className="row__title">{label}</div>
        <div className="row__sub">{hint}</div>
      </div>
      <input
        className="field__in num"
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number.parseFloat(e.target.value))}
      />
    </div>
  );
}

export function SettingsView({ settings }: { settings: SkinSettings }) {
  const [draft, setDraft] = useState<SkinSettings>(settings);
  const save = useSaveSettings();
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);

  return (
    <div className="panel">
      <Field
        label="Full tank depth"
        hint="Millimetres. The DE1 reports depth, not volume — fill the tank, read the Brew screen, put that number here."
        value={draft.tankFullMm}
        onChange={(tankFullMm) => setDraft({ ...draft, tankFullMm })}
      />
      <Field
        label="Flush duration"
        hint="Seconds the Flush button runs for."
        value={draft.flushSeconds}
        onChange={(flushSeconds) => setDraft({ ...draft, flushSeconds })}
      />
      <Field
        label="Flush flow"
        hint="mL/s during flush. 8 is roughly wide open."
        value={draft.flushFlow}
        onChange={(flushFlow) => setDraft({ ...draft, flushFlow })}
        step={0.5}
      />
      <div style={{ display: "flex", gap: 10, paddingTop: 18 }}>
        <button className="btn" onClick={() => save.mutate(draft)} disabled={!dirty || save.isPending}>
          {save.isPending ? "Saving" : "Save"}
        </button>
        <button className="btn btn--quiet" onClick={() => setDraft(DEFAULTS)}>
          Reset
        </button>
      </div>
      {save.isError && (
        <p className="row__sub" style={{ color: "hsl(var(--danger))", paddingTop: 12 }}>
          Could not save. Check that Decaid is reachable.
        </p>
      )}
    </div>
  );
}
