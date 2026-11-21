import { useId, useMemo, useState } from "react";
import { endedEarly, stopLabel, useShots } from "../api/useShots";
import { useBeans, type Bean } from "../api/useBeans";
import { fromDecaidEnjoyment } from "../api/tasteVocab";
import { shortName } from "../api/profileStyle";
import { ShotDetailView } from "./ShotDetailView";

const DATE: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
const TIME: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };

export function ShotsView() {
  const { data: shots, isLoading } = useShots(100);
  const { data: beans } = useBeans();
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState({ roaster: "", bean: "", active: false, instant: false });
  const beanFiltersId = useId();

  // Resolve current bean name/roaster by beanBatchId so renaming a bag updates
  // past shots and filter pills immediately without mutating Decaid's snapshot.
  const beanByBatch = useMemo(() => {
    const map = new Map<string, Bean>();
    for (const { bean, batches } of beans ?? []) {
      for (const b of batches) map.set(b.id, bean);
    }
    return map;
  }, [beans]);

  const { entries, byRoaster } = useMemo(() => {
    const byRoaster = new Map<string, Set<string>>();
    const entries = (shots ?? []).map((shot) => {
      const ctx = shot.workflow?.context;
      const live = ctx?.beanBatchId ? beanByBatch.get(ctx.beanBatchId) : undefined;
      const name = (live?.name ?? ctx?.coffeeName)?.trim() ?? "";
      const roaster = (live?.roaster ?? ctx?.coffeeRoaster)?.trim() ?? "";
      if (roaster) {
        let names = byRoaster.get(roaster);
        if (!names) byRoaster.set(roaster, names = new Set<string>());
        if (name) names.add(name);
      }
      return { shot, name, roaster };
    });
    return { entries, byRoaster };
  }, [shots, beanByBatch]);

  const roaster = filter.active && byRoaster.has(filter.roaster) ? filter.roaster : "";
  const names = byRoaster.get(filter.roaster);
  const bean = roaster && names?.has(filter.bean) ? filter.bean : "";
  const showBeans = !!roaster && !!names?.size;
  const filtered = roaster
    ? entries.filter((entry) => entry.roaster === roaster && (!bean || entry.name === bean))
    : entries;
  const selectRoaster = (next: string, instant: boolean) => {
    if (next !== roaster) {
      setFilter({ roaster: next || filter.roaster, bean: "", active: !!next, instant });
    }
  };

  if (open) return <ShotDetailView id={open} onBack={() => setOpen(null)} />;
  if (isLoading) return <div className="panel" />;

  if (!shots?.length) {
    return (
      <div className="panel">
        <div className="empty">
          <h2 className="empty__h">No shots yet</h2>
          <p className="empty__p">Pull a shot and it shows up here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="shots__filters">
        <div className="shots__filter" role="group" aria-label="Filter by roaster">
          <button
            type="button"
            className={`pill ${!roaster ? "pill--on" : ""}`}
            aria-pressed={!roaster}
            onClick={(e) => selectRoaster("", e.detail === 0)}
          >
            All
          </button>
          {Array.from(byRoaster, ([name, coffees]) => (
            <button
              type="button"
              key={name}
              className={`pill ${roaster === name ? "pill--on" : ""}`}
              aria-pressed={roaster === name}
              aria-expanded={coffees.size ? roaster === name : undefined}
              aria-controls={coffees.size ? beanFiltersId : undefined}
              onClick={(e) => selectRoaster(name, e.detail === 0)}
            >
              {name}
            </button>
          ))}
        </div>
        <div
          id={beanFiltersId}
          className={`shots__subfilter ${showBeans ? "shots__subfilter--open" : ""}`}
          data-instant={filter.instant || undefined}
          aria-hidden={!showBeans}
          inert={!showBeans}
        >
          <div className="shots__subfilter-clip">
            <div className="shots__filter shots__beans" key={filter.roaster} role="group" aria-label="Filter by bean">
              {["", ...(names ?? [])].map((coffee) => (
                <button
                  type="button"
                  key={coffee}
                  className={`pill ${bean === coffee ? "pill--on" : ""}`}
                  aria-pressed={bean === coffee}
                  disabled={!showBeans}
                  onClick={() => setFilter({ ...filter, bean: coffee })}
                >
                  {coffee || "All beans"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rows">
        <div className="shot shot--head">
          <span className="lbl shot__when">When</span>
          <span className="lbl shot__main">Coffee · Recipe</span>
          <span className="lbl shot__n shot__n--dose">Dose</span>
          <span className="lbl shot__n">Yield</span>
          <span className="lbl shot__n shot__n--grind">Grind</span>
          <span className="lbl shot__n">Rating</span>
        </div>
        {filtered.map(({ shot, name: coffeeName, roaster: coffeeRoaster }) => {
          const ctx = shot.workflow?.context;
          const a = shot.annotations;
          const when = new Date(shot.timestamp);
          const profile = shot.workflow?.profile?.title;
          return (
            <button type="button" className="shot" key={shot.id} onClick={() => setOpen(shot.id)}>
              <span className="shot__when">
                <span className="shot__date">{when.toLocaleDateString(undefined, DATE)}</span>
                <span className="row__sub num">{when.toLocaleTimeString(undefined, TIME)}</span>
              </span>
              <span className="shot__main">
                <span className="row__title truncate">
                  {coffeeName || "Unlabelled"}
                  {coffeeRoaster && (
                    <span className="shot__roaster"> · {coffeeRoaster}</span>
                  )}
                </span>
                <span className="row__sub shot__profile">
                  {profile && <span className="truncate">{shortName(profile)}</span>}
                  {endedEarly(shot.stopReason) && (
                    <span className="tag">{stopLabel(shot.stopReason)}</span>
                  )}
                </span>
              </span>
              <span className="num shot__n shot__n--dose">
                {(a?.actualDoseWeight ?? ctx?.targetDoseWeight)?.toFixed(1) ?? "—"}
              </span>
              <span className="num shot__n">
                {(a?.actualYield ?? ctx?.targetYield)?.toFixed(1) ?? "—"}
              </span>
              <span className="num shot__n shot__n--grind">{ctx?.grinderSetting ?? "—"}</span>
              <span className="num shot__n shot__rating">
                {a?.enjoyment != null ? `${fromDecaidEnjoyment(a.enjoyment)}/10` : "—"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
