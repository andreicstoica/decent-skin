import { useId, useMemo, useState } from "react";
import { stopLabel, useAnnotate, useShot, useReassignShotBean, type Annotations } from "../api/useShots";
import { useBeans } from "../api/useBeans";
import { ENJOYMENT, TASTE, fromDecaidEnjoyment, toDecaidEnjoyment } from "../api/tasteVocab";
import { ShotChart } from "../components/ShotChart";
import type { TracePoint } from "../api/useShotTrace";
import { EXTRACTING } from "../api/types";

type Shot = NonNullable<ReturnType<typeof useShot>["data"]>;

function toTrace(measurements: Shot["measurements"]): TracePoint[] {
  if (!measurements?.length) return [];
  const available = measurements.filter((m) => Number.isFinite(Date.parse(m.machine?.timestamp ?? "")));
  const extracting = available.filter((m) => EXTRACTING.has(m.machine?.state?.substate ?? ""));
  const samples = extracting.length > 1 ? extracting : available;
  const t0 = Date.parse(samples[0]?.machine?.timestamp ?? "");
  return samples.flatMap(({ machine, scale }) => {
    if (!machine) return [];
    return [
      {
        t: (Date.parse(machine.timestamp) - t0) / 1000,
        pressure: machine.pressure,
        flow: machine.flow,
        weightFlow: scale?.weightFlow,
        targetPressure: machine.targetPressure,
        targetFlow: machine.targetFlow,
        profileFrame: machine.profileFrame,
      },
    ];
  });
}

/** Known taste keys first, in vocabulary order; anything else Decaid stored after. */
function tasteOf(extras: Annotations["extras"]) {
  if (!extras) return [];
  const label = (key: string) => TASTE.find((g) => g.key === key)?.label ?? key;
  const rank = (key: string) => {
    const i = TASTE.findIndex((g) => g.key === key);
    return i === -1 ? TASTE.length : i;
  };
  return Object.entries(extras)
    .filter((entry): entry is [string, string | number] =>
      typeof entry[1] === "string" ? entry[1].trim() !== "" : typeof entry[1] === "number",
    )
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([key, value]) => ({ key, label: label(key), value: String(value) }));
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="fact">
      <span className="lbl">{label}</span>
      <span className="fact__v num">{value}</span>
    </div>
  );
}

const MEASURES = [
  ["actualDoseWeight", "Dose in", "g"],
  ["actualYield", "Yield out", "g"],
  ["drinkTds", "TDS", "%"],
  ["drinkEy", "Extraction yield", "%"],
] as const;

export function ShotDetailView({ id, onBack }: { id: string; onBack: () => void }) {
  const { data: shot, isError, isLoading, refetch } = useShot(id);

  if (!shot) return <div className="panel"><div className="sheet detail">
    <button type="button" className="btn detail__back" onClick={onBack}>‹ All shots</button>
    <p role={isError ? "alert" : "status"}>{isLoading ? "Loading shot…" : "Could not load this shot."}</p>
    {isError && <button type="button" className="btn" onClick={() => void refetch()}>Try again</button>}
  </div></div>;

  // A fresh editor per saved state: the draft starts from what Decaid holds and
  // resets after a save lands. The panel stays outside the key so the scroll
  // position survives the save.
  return (
    <div className="panel">
      <ShotEditor key={`${shot.id}:${JSON.stringify(shot.annotations ?? {})}`} shot={shot} onBack={onBack} />
    </div>
  );
}

function ShotEditor({ shot, onBack }: { shot: Shot; onBack: () => void }) {
  const annotate = useAnnotate(shot.id);
  const { data: beans } = useBeans();
  const [draft, setDraft] = useState<Annotations>(shot.annotations ?? {});
  const uid = useId();

  const ctx = shot.workflow?.context;
  const batchId = ctx?.beanBatchId;
  const liveBean = useMemo(() => {
    if (!batchId || !beans) return undefined;
    return beans.find(({ batches }) => batches.some((b) => b.id === batchId))?.bean;
  }, [batchId, beans]);
  const coffeeName = liveBean?.name ?? ctx?.coffeeName;
  const coffeeRoaster = liveBean?.roaster ?? ctx?.coffeeRoaster;
  const trace = useMemo(() => toTrace(shot.measurements), [shot.measurements]);
  const taste = tasteOf(shot.annotations?.extras);
  const dirty = JSON.stringify(draft) !== JSON.stringify(shot.annotations ?? {});
  const set = (patch: Annotations) => setDraft({ ...draft, ...patch });
  const num = (v?: number | null) => (v === undefined || v === null || Number.isNaN(v) ? "" : String(v));
  const stars = fromDecaidEnjoyment(draft.enjoyment);

  return (
    <div className="sheet detail">
      <header className="detail__head">
        <button type="button" className="btn detail__back" onClick={onBack}>
          <span aria-hidden="true">‹</span> All shots
        </button>
        <h2 className="detail__h">{coffeeName ?? "Unlabelled shot"}</h2>
        <time className="row__sub num" dateTime={shot.timestamp}>
          {new Date(shot.timestamp).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </time>
      </header>
      <ShotBeanEditor shot={shot} />
      <div className="facts">
        <Fact label="Roaster" value={coffeeRoaster ?? "—"} />
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
          <ShotChart trace={trace} label="Shot trace" />
        </div>
      )}

      {taste.length > 0 && (
        <>
          <div className="lbl detail__section">Taste</div>
          <div className="taste">
            {taste.map((t) => (
              <span className="taste__i" key={t.key}>
                <span className="lbl">{t.label}</span>
                <span className="taste__v">{t.value}</span>
              </span>
            ))}
          </div>
        </>
      )}

      <section className="detail__rating" aria-labelledby={`${uid}-rating`}>
        <h3 className="lbl detail__section" id={`${uid}-rating`}>How was it?</h3>

        <div className="detail__rating-grid">
          <div>
            <div className="field field--stack">
              <div className="field__label">
                <span className="row__title" id={`${uid}-enjoy`}>Enjoyment</span>
              </div>
              <div className="seg detail__scale" role="group" aria-labelledby={`${uid}-enjoy`}>
                {ENJOYMENT.map((n) => (
                  <button
                    type="button"
                    key={n}
                    className={`seg__b num ${stars === n ? "seg__b--on" : ""}`}
                    aria-pressed={stars === n}
                    onClick={() => set({ enjoyment: stars === n ? null : toDecaidEnjoyment(n) })}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="field field--stack">
              <div className="field__label">
                <label className="row__title" htmlFor={`${uid}-notes`}>Notes</label>
              </div>
              <textarea
                id={`${uid}-notes`}
                className="notes"
                rows={3}
                value={draft.espressoNotes ?? ""}
                placeholder="What did it taste like?"
                onChange={(e) => set({ espressoNotes: e.target.value || null })}
              />
            </div>
          </div>
          <div className="detail__measurements">
            {MEASURES.map(([key, label, unit]) => (
              <div className="field" key={key}>
                <div className="field__label">
                  <label className="row__title" htmlFor={`${uid}-${key}`}>
                    {label}
                    <span className="field__unit">{unit}</span>
                  </label>
                </div>
                <input
                  id={`${uid}-${key}`}
                  className="field__in num"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={num(draft[key])}
                  onChange={(e) =>
                    set({ [key]: e.target.value === "" ? null : Number.parseFloat(e.target.value) })
                  }
                />
              </div>
            ))}
          </div>
        </div>

        <div className="actions">
          <button
            type="button"
            className="btn"
            onClick={() => annotate.mutate(draft)}
            disabled={!dirty || annotate.isPending}
          >
            {annotate.isPending ? "Saving…" : "Save rating"}
          </button>
          {dirty && (
            <button type="button" className="btn btn--quiet" onClick={() => setDraft(shot.annotations ?? {})}>
              Discard
            </button>
          )}
        </div>
        {annotate.isError && (
          <p className="err" role="alert">Could not save. Check that Decaid is reachable.</p>
        )}
      </section>
    </div>
  );
}

/** Separate draft from the rating editor, so changing coffee never saves or
 * discards an unfinished rating. No active brew workflow or bag stock changes. */
function ShotBeanEditor({ shot }: { shot: Shot }) {
  const { data: beans, isLoading, isError, refetch } = useBeans();
  const save = useReassignShotBean(shot.id);
  const [editing, setEditing] = useState(false);
  const [beanId, setBeanId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [saved, setSaved] = useState(false);
  const uid = useId();
  const selected = beans?.find(({ bean }) => bean.id === beanId);
  const batches = selected?.batches ?? [];
  const start = () => {
    const current = beans?.find(({ batches }) => batches.some(b => b.id === shot.workflow?.context?.beanBatchId));
    setBeanId(current?.bean.id ?? "");
    setBatchId(current ? shot.workflow?.context?.beanBatchId ?? "" : "");
    setSaved(false);
    save.reset();
    setEditing(true);
  };
  return <section className="detail__bean" aria-label="Shot bean">
    {!editing ? <>
      <button type="button" className="btn" onClick={start}>Change bean</button>
      {saved && <p role="status">Bean updated in shot history.</p>}
    </> : <>
      <h3 className="lbl detail__section">Correct this shot’s bean</h3>
      <p className="row__sub">Pick the coffee actually used, even if this shot was labelled testing. This changes only this saved shot, not your next brew or bag stock.</p>
      {isLoading && <p role="status">Loading beans…</p>}
      {isError && <p role="alert">Could not load beans. <button type="button" className="btn" onClick={() => void refetch()}>Retry</button></p>}
      {!isLoading && !isError && !beans?.length && <p>Add a bean in Beans first, then return here.</p>}
      <div className="field">
        <label htmlFor={`${uid}-bean`}>Bean</label>
        <select id={`${uid}-bean`} className="field__in" value={beanId} disabled={save.isPending || isLoading || isError} onChange={e => {
          setBeanId(e.target.value);
          const next = beans?.find(({ bean }) => bean.id === e.target.value);
          setBatchId(next?.batches.length === 1 ? next.batches[0].id : "");
          save.reset();
        }}>
          <option value="">Choose a bean…</option>
          {beans?.map(({ bean }) => <option key={bean.id} value={bean.id}>{bean.roaster} · {bean.name}</option>)}
        </select>
      </div>
      {selected && <div className="field">
        <label htmlFor={`${uid}-batch`}>Bag / roast</label>
        <select id={`${uid}-batch`} className="field__in" value={batchId} disabled={save.isPending || selected.batchesUnavailable} onChange={e => setBatchId(e.target.value)}>
          <option value="">No specific bag</option>
          {batches.map((batch, index) => <option key={batch.id} value={batch.id}>
            Bag {index + 1}{batch.roastDate ? ` · roasted ${batch.roastDate.slice(0, 10)}` : " · roast date unknown"}
          </option>)}
        </select>
      </div>}
      {selected?.batchesUnavailable && <p className="err" role="alert">Bag data is unavailable. Retry loading beans before saving. <button type="button" className="btn" onClick={() => void refetch()}>Retry</button></p>}
      <div className="actions">
        <button type="button" className="btn" disabled={!selected || selected.batchesUnavailable || save.isPending} onClick={() => {
          if (!selected) return;
          save.mutate({ beanBatchId: batchId || null, coffeeName: selected.bean.name, coffeeRoaster: selected.bean.roaster }, {
            onSuccess: () => { setEditing(false); setSaved(true); },
          });
        }}>{save.isPending ? "Saving bean…" : "Save bean"}</button>
        <button type="button" className="btn btn--quiet" disabled={save.isPending} onClick={() => { setEditing(false); save.reset(); }}>Cancel</button>
      </div>
      {save.isError && <p className="err" role="alert">{save.error.message}</p>}
    </>}
  </section>;
}
