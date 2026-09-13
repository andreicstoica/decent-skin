import { useState } from "react";
import { endedEarly, stopLabel, useShots } from "../api/useShots";
import { ShotDetailView } from "./ShotDetailView";

const WHEN: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

export function ShotsView() {
  const { data: shots, isLoading } = useShots();
  const [open, setOpen] = useState<string | null>(null);

  if (open) return <ShotDetailView id={open} onBack={() => setOpen(null)} />;
  if (isLoading) return <div className="panel" />;

  if (!shots?.length) {
    return (
      <div className="panel">
        <div className="empty">
          <h2 className="empty__h">No shots yet</h2>
          <p className="empty__p">
            Pull one and it lands here. Decaid saves the bean, grinder and dose from
            the current workflow onto every shot automatically.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="rows">
        <div className="shot shot--head">
          <span className="lbl shot__when">When</span>
          <span className="lbl shot__main">Coffee</span>
          <span className="lbl shot__n">Dose</span>
          <span className="lbl shot__n">Yield</span>
          <span className="lbl shot__n">Grind</span>
          <span className="lbl shot__n">Rating</span>
        </div>
        {shots.map((shot) => {
          const ctx = shot.workflow?.context;
          const a = shot.annotations;
          return (
            <button className="shot" key={shot.id} onClick={() => setOpen(shot.id)}>
              <span className="row__sub shot__when">
                {new Date(shot.timestamp).toLocaleString(undefined, WHEN)}
              </span>
              <span className="shot__main">
                <span className="row__title">{ctx?.coffeeName ?? "Unlabelled"}</span>
                <span className="row__sub shot__profile">
                  {shot.workflow?.profile?.title}
                  {endedEarly(shot.stopReason) && (
                    <span className="shot__flag">{stopLabel(shot.stopReason)}</span>
                  )}
                </span>
              </span>
              <span className="num shot__n">
                {(a?.actualDoseWeight ?? ctx?.targetDoseWeight)?.toFixed(1) ?? "—"}
              </span>
              <span className="num shot__n">
                {(a?.actualYield ?? ctx?.targetYield)?.toFixed(1) ?? "—"}
              </span>
              <span className="num shot__n">{ctx?.grinderSetting ?? "—"}</span>
              <span className="num shot__n shot__rating">
                {a?.enjoyment ? a.enjoyment.toFixed(0) : "—"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
