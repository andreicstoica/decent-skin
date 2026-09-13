import { useShots } from "../api/useShots";

export function ShotsView() {
  const { data: shots, isLoading } = useShots();

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
        {shots.map((shot) => {
          const ctx = shot.workflow?.context;
          const yieldOut = shot.annotations?.actualYield;
          return (
            <div className="row" key={shot.id}>
              <span className="lbl" style={{ width: 108, flex: "none" }}>
                {new Date(shot.timestamp).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <div className="row__main">
                <div className="row__title">{ctx?.coffeeName ?? "Unlabelled shot"}</div>
                {shot.annotations?.espressoNotes && (
                  <div className="row__sub">{shot.annotations.espressoNotes}</div>
                )}
              </div>
              <span className="num row__sub">
                {ctx?.targetDoseWeight ? `${ctx.targetDoseWeight.toFixed(1)} g` : "—"}
                {yieldOut ? ` → ${yieldOut.toFixed(1)} g` : ""}
              </span>
              <span className="num row__sub" style={{ width: 46, textAlign: "right" }}>
                {ctx?.grinderSetting ?? "—"}
              </span>
              <span className="num row__sub" style={{ width: 34, textAlign: "right" }}>
                {shot.annotations?.enjoyment ? shot.annotations.enjoyment.toFixed(1) : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
