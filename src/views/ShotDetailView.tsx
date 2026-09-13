import { useEffect, useState } from "react";
import { stopLabel, useAnnotate, useShot, type Annotations } from "../api/useShots";
import { ShotChart } from "../components/ShotChart";
import type { TracePoint } from "../api/useShotTrace";

const SCORES = [1, 2, 3, 4, 5];

function toTrace(measurements: NonNullable<ReturnType<typeof useShot>["data"]>["measurements"]): TracePoint[] {
  if (!measurements?.length) return [];
  const t0 = new Date(measurements[0].machine?.timestamp ?? 0).getTime();
  return measurements.flatMap((m) => {
    if (!m.machine?.timestamp) return [];
    return [
      {
        t: (new Date(m.machine.timestamp).getTime() - t0) / 1000,
        pressure: m.machine.pressure ?? 0,
        flow: m.machine.flow ?? 0,
        weightFlow: m.scale?.weightFlow ?? 0,
        targetPressure: m.machine.targetPressure ?? 0,
        targetFlow: m.machine.targetFlow ?? 0,
      },
    ];
  });
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="fact">
      <span className="lbl">{label}</span>
      <span className="fact__v num">{value}</span>
    </div>
  );
}

export function ShotDetailView({ id, onBack }: { id: string; onBack: () => void }) {
  const { data: shot } = useShot(id);
  const annotate = useAnnotate(id);
  const [draft, setDraft] = useState<Annotations>({});

  useEffect(() => setDraft(shot?.annotations ?? {}), [shot?.id, shot?.annotations]);

  if (!shot) return <div className="panel" />;

  const ctx = shot.workflow?.context;
  const trace = toTrace(shot.measurements);
  const dirty = JSON.stringify(draft) !== JSON.stringify(shot.annotations ?? {});
  const set = (patch: Annotations) => setDraft({ ...draft, ...patch });
  const num = (v?: number) => (v === undefined || Number.isNaN(v) ? "" : String(v));

  return (
    <div className="panel detail">
      <div className="detail__top">
        <button className="btn btn--quiet" onClick={onBack}>Back</button>
        <span className="row__sub">{new Date(shot.timestamp).toLocaleString()}</span>
      </div>

      <h2 className="detail__h">{ctx?.coffeeName ?? "Unlabelled shot"}</h2>
      <div className="facts">
        <Fact label="Roaster" value={ctx?.coffeeRoaster ?? "—"} />
        <Fact label="Profile" value={shot.workflow?.profile?.title ?? "—"} />
        <Fact label="Grind" value={ctx?.grinderSetting ?? "—"} />
        <Fact label="Grinder" value={ctx?.grinderModel ?? "—"} />
        <Fact
          label="Target"
          value={
            ctx?.targetDoseWeight && ctx?.targetYield
              ? `${ctx.targetDoseWeight.toFixed(1)} → ${ctx.targetYield.toFixed(0)} g`
              : "—"
          }
        />
        {shot.stopReason && <Fact label="Ended" value={stopLabel(shot.stopReason)!} />}
      </div>

      {trace.length > 1 && (
        <div className="detail__chart">
          <ShotChart trace={trace} />
        </div>
      )}

      <div className="lbl detail__section">How was it?</div>

      <div className="field">
        <div className="row__title">Enjoyment</div>
        <div style={{ display: "flex" }}>
          {SCORES.map((n) => (
            <button
              key={n}
              className={`btn ${draft.enjoyment === n ? "" : "btn--quiet"}`}
              style={{ minHeight: 40, padding: "0 16px" }}
              onClick={() => set({ enjoyment: draft.enjoyment === n ? undefined : n })}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {(
        [
          ["actualDoseWeight", "Dose in", "g"],
          ["actualYield", "Yield out", "g"],
          ["drinkTds", "TDS", "%"],
          ["drinkEy", "Extraction yield", "%"],
        ] as const
      ).map(([key, label, unit]) => (
        <div className="field" key={key}>
          <div className="row__title">
            {label} <span className="row__sub">{unit}</span>
          </div>
          <input
            className="field__in num"
            type="number"
            step="0.1"
            value={num(draft[key])}
            onChange={(e) =>
              set({ [key]: e.target.value === "" ? undefined : Number.parseFloat(e.target.value) })
            }
          />
        </div>
      ))}

      <div className="field field--stack">
        <div className="row__title">Notes</div>
        <textarea
          className="notes"
          rows={3}
          value={draft.espressoNotes ?? ""}
          placeholder="What did it taste like?"
          onChange={(e) => set({ espressoNotes: e.target.value || undefined })}
        />
      </div>

      <div style={{ display: "flex", gap: 12, paddingTop: 20 }}>
        <button className="btn" onClick={() => annotate.mutate(draft)} disabled={!dirty || annotate.isPending}>
          {annotate.isPending ? "Saving" : "Save rating"}
        </button>
        {dirty && (
          <button className="btn btn--quiet" onClick={() => setDraft(shot.annotations ?? {})}>
            Discard
          </button>
        )}
      </div>
      {annotate.isError && (
        <p className="row__sub" style={{ color: "hsl(var(--danger))", paddingTop: 12 }}>
          Could not save. Check that Decaid is reachable.
        </p>
      )}
    </div>
  );
}
