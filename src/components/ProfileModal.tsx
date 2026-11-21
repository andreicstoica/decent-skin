import { useEffect, useId, useRef } from "react";
import type { ProfileRecord } from "../api/useProfiles";
import { factsOf, shortName, styleOf } from "../api/profileStyle";
import { MAX_FAVORITES } from "../api/useFavorites";
import { ProfileGraph } from "./ProfileSpark";
import { StarIcon } from "./icons";

const fmt = (n: number | undefined, places = 1) => (n === undefined ? "—" : n.toFixed(places));

interface ProfileModalProps {
  record: ProfileRecord;
  loaded: boolean;
  pinned: boolean;
  pinnedCount: number;
  busy: boolean;
  pinning: boolean;
  onClose: () => void;
  onOneOff: () => void;
  onLoad: () => void;
  onTogglePin: () => void;
}

export function ProfileModal({
  record,
  loaded,
  pinned,
  pinnedCount,
  busy,
  pinning,
  onClose,
  onOneOff,
  onLoad,
  onTogglePin,
}: ProfileModalProps) {
  const titleId = useId();
  const box = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  // Focus moves in on open and back to the row that opened it on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, []);

  const p = record.profile;
  const name = shortName(p.title);
  const facts = factsOf(record);
  const steps = (p.steps ?? []).filter((s) => (s.seconds ?? 0) > 0);
  const full = !pinned && pinnedCount >= MAX_FAVORITES;

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={box}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="modal__body">
          <header className="modal__head modal__head--close">
            <div className="modal__titles">
              <span className="lbl">{styleOf(record)}</span>
              <h2 className="modal__h" id={titleId}>{name}</h2>
              {p.author && <span className="row__sub">{p.author}</span>}
            </div>
            <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
              ×
            </button>
          </header>

          {p.notes && <p className="modal__notes">{p.notes}</p>}

          <div className="facts modal__facts">
            <div className="fact">
              <span className="lbl">Peak bar</span>
              <span className="fact__v num">{facts.peakBar === null ? "—" : facts.peakBar.toFixed(1)}</span>
            </div>
            <div className="fact">
              <span className="lbl">Max time</span>
              <span className="fact__v num">{facts.seconds ? `${facts.seconds}s` : "—"}</span>
            </div>
            <div className="fact">
              <span className="lbl">Target out</span>
              <span className="fact__v num">{facts.outGrams === null ? "—" : `${facts.outGrams}g`}</span>
            </div>
          </div>

          <ProfileGraph steps={p.steps ?? []} label={`Pressure and flow targets for ${name}`} />

          {steps.length > 0 && (
            <div className="stepl" role="table" aria-label="Steps">
              <div className="stepl__r stepl__r--head" role="row">
                <span className="lbl" role="columnheader">Step</span>
                <span className="lbl" role="columnheader">Pump</span>
                <span className="lbl stepl__n" role="columnheader">Target</span>
                <span className="lbl stepl__n" role="columnheader">Temp</span>
                <span className="lbl stepl__n" role="columnheader">Up to</span>
              </div>
              {steps.map((s, i) => {
                const pressure = s.pump === "pressure";
                return (
                  <div className="stepl__r" role="row" key={i}>
                    <span className="truncate" role="cell">{s.name || `Step ${i + 1}`}</span>
                    <span role="cell" className="stepl__pump">
                      <i className={`key__sw key__sw--${pressure ? "pressure" : "flow"}`} />
                      {pressure ? "Pressure" : "Flow"}
                    </span>
                    <span role="cell" className="num stepl__n">
                      {pressure ? `${fmt(s.pressure)} bar` : `${fmt(s.flow)} mL/s`}
                    </span>
                    <span role="cell" className="num stepl__n">
                      {s.temperature === undefined ? "—" : `${fmt(s.temperature, 0)}°`}
                    </span>
                    <span role="cell" className="num stepl__n">{fmt(s.seconds, 0)}s</span>
                  </div>
                );
              })}
            </div>
          )}

        </div>

        <footer className="modal__foot">
          <button
            type="button"
            className={`btn btn--quiet modal__pin ${pinned ? "modal__pin--on" : ""}`}
            aria-pressed={pinned}
            onClick={onTogglePin}
            disabled={pinning || full}
            title={full ? `${MAX_FAVORITES} favorites pinned. Unpin one first.` : undefined}
          >
            <StarIcon filled={pinned} />
            {pinned ? "Unpin" : "Pin"}
            <span className="num modal__pin-n">{pinnedCount}/{MAX_FAVORITES}</span>
          </button>
          <span className="actions__end" />
          <button
            type="button"
            className="btn"
            onClick={pinned ? onLoad : onOneOff}
            disabled={busy || loaded}
          >
            {loaded ? "Loaded" : pinned ? "Load" : "Use for 1 shot"}
          </button>
        </footer>
      </div>
    </div>
  );
}
