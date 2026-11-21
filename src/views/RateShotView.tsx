import { useState } from "react";
import { ENJOYMENT, TASTE, toDecaidEnjoyment } from "../api/tasteVocab";
import { useAnnotate, useShot } from "../api/useShots";

/**
 * Tap-only by design. Typing on the machine tablet is the worst part of logging,
 * so every field here is a chip; free text belongs on the phone afterwards.
 */
export function RateShotView({ id, onDone }: { id: string; onDone: () => void }) {
  const { data: shot } = useShot(id);
  const annotate = useAnnotate(id);
  const [enjoyment, setEnjoyment] = useState<number | undefined>();
  const [taste, setTaste] = useState<Record<string, string>>({});

  const ctx = shot?.workflow?.context;
  const anything = enjoyment !== undefined || Object.keys(taste).length > 0;

  const save = () =>
    annotate.mutate(
      {
        ...(enjoyment !== undefined ? { enjoyment: toDecaidEnjoyment(enjoyment) } : {}),
        ...(Object.keys(taste).length > 0 ? { extras: taste } : {}),
      },
      { onSuccess: onDone },
    );

  return (
    <div className="panel">
      <div className="sheet rate">
        <div className="rate__head">
          <h2 className="rate__h">How was that shot?</h2>
          <span className="row__sub">
            {[ctx?.coffeeName, ctx?.grinderSetting && `grind ${ctx.grinderSetting}`]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </div>

        {TASTE.map((group) => (
          <div className="rate__row" key={group.key}>
            <span className="lbl rate__label">{group.label}</span>
            <div className="chips">
              {group.options.map((option) => {
                const on = taste[group.key] === option;
                return (
                  <button
                    type="button"
                    key={option}
                    className={`chip ${on ? "chip--on" : ""}`}
                    aria-pressed={on}
                    onClick={() =>
                      setTaste((prev) => {
                        const next = { ...prev };
                        if (on) delete next[group.key];
                        else next[group.key] = option;
                        return next;
                      })
                    }
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div className="rate__row">
          <span className="lbl rate__label">Enjoyment</span>
          <div className="chips">
            {ENJOYMENT.map((n) => (
              <button
                type="button"
                key={n}
                className={`chip num ${enjoyment === n ? "chip--on" : ""}`}
                aria-pressed={enjoyment === n}
                onClick={() => setEnjoyment(enjoyment === n ? undefined : n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="rate__actions">
          <button type="button" className="btn btn--quiet rate__btn" onClick={onDone}>Skip</button>
          <button
            type="button"
            className="btn rate__btn"
            onClick={save}
            disabled={!anything || annotate.isPending}
          >
            {annotate.isPending ? "Saving…" : "Save"}
          </button>
        </div>
        {annotate.isError && (
          <p className="err" role="alert">Could not save. It is still in Shots if you want to try again.</p>
        )}
      </div>
    </div>
  );
}
