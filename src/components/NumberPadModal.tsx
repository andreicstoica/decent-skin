import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface QuickPreset {
  label: string;
  value: number;
}

interface NumberPadModalProps {
  title: string;
  unit?: string;
  initial: number;
  min: number;
  max: number;
  allowDecimal?: boolean;
  presets?: QuickPreset[];
  onApply: (value: number) => void;
  onClose: () => void;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"] as const;

export function NumberPadModal({
  title,
  unit,
  initial,
  min,
  max,
  allowDecimal = true,
  presets,
  onApply,
  onClose,
}: NumberPadModalProps) {
  const titleId = useId();
  const box = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

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

  const [raw, setRaw] = useState(String(initial));
  const [fresh, setFresh] = useState(true);

  const press = (key: (typeof KEYS)[number]) => {
    if (key === "⌫") {
      setFresh(false);
      setRaw((prev) => (prev.length <= 1 ? "" : prev.slice(0, -1)));
      return;
    }
    if (key === ".") {
      if (!allowDecimal) return;
      if (fresh) {
        setFresh(false);
        setRaw("0.");
        return;
      }
      if (raw.includes(".")) return;
      setRaw((prev) => (prev ? `${prev}.` : "0."));
      return;
    }
    if (fresh) {
      setFresh(false);
      setRaw(key);
      return;
    }
    if (raw.length >= 6) return;
    setRaw((prev) => (prev === "0" ? key : `${prev}${key}`));
  };

  const parsed = Number.parseFloat(raw);
  const valid = Number.isFinite(parsed) && parsed >= min && parsed <= max;

  const commit = (val: number) => {
    const clamped = Math.min(max, Math.max(min, val));
    onApply(clamped);
    onClose();
  };

  return createPortal(
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={box}
        className="modal modal--pad"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="modal__body">
          <header className="modal__head modal__head--close">
            <div className="modal__titles">
              <h2 className="modal__h" id={titleId}>{title}</h2>
            </div>
            <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
              ×
            </button>
          </header>

          <div className="pad__screen">
            <span className="pad__val num">{raw || "0"}</span>
            {unit && <span className="pad__unit">{unit}</span>}
          </div>

          {presets && presets.length > 0 && (
            <div className="pad__presets">
              {presets.map((p) => (
                <button
                  type="button"
                  key={p.label}
                  className="btn btn--quiet btn--compact num"
                  onClick={() => commit(p.value)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          <div className="pad__grid">
            {KEYS.map((k) => {
              const disabled = k === "." && !allowDecimal;
              return (
                <button
                  type="button"
                  key={k}
                  className="pad__key num"
                  disabled={disabled}
                  onClick={() => press(k)}
                >
                  {k}
                </button>
              );
            })}
          </div>
        </div>

        <footer className="modal__foot">
          <button
            type="button"
            className="btn btn--quiet"
            onClick={() => {
              setFresh(false);
              setRaw("");
            }}
          >
            Clear
          </button>
          <span className="actions__end" />
          <button
            type="button"
            className="btn"
            disabled={!valid}
            onClick={() => valid && commit(parsed)}
          >
            Set {title.toLowerCase()}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
