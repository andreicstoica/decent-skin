import { clamp, round, useNudge, type Range } from "./nudge";

export function Stepper({
  label,
  value,
  less,
  more,
  onLess,
  onMore,
  onTapValue,
  ruled,
}: {
  label: React.ReactNode;
  value: string;
  less: string;
  more: string;
  onLess?: () => void;
  onMore?: () => void;
  onTapValue?: () => void;
  ruled?: boolean;
}) {
  return (
    <div className={`dial ${ruled ? "dial--ruled" : ""}`}>
      <span className="lbl">{label}</span>
      <div className="stepper">
        <button type="button" className="step stepper__less" onClick={onLess} disabled={!onLess} aria-label={less}>
          −
        </button>
        {onTapValue ? (
          <button type="button" className="dial__v num stepper__v stepper__v--tap" onClick={onTapValue}>
            {value}
          </button>
        ) : (
          <span className="dial__v num stepper__v">{value}</span>
        )}
        <button type="button" className="step stepper__more" onClick={onMore} disabled={!onMore} aria-label={more}>
          +
        </button>
      </div>
    </div>
  );
}

/** A stepper bound to one stored number, with the nudge debounce built in. */
export function NumberStepper({
  label,
  value,
  range,
  disabled,
  ruled,
  onCommit,
}: {
  label: string;
  value: number | undefined;
  range: Range;
  disabled?: boolean;
  ruled?: boolean;
  onCommit: (n: number, settled: () => void) => void;
}) {
  const [v, nudge] = useNudge(value, onCommit);
  const step = (dir: number) =>
    v !== undefined && nudge(clamp(round(v + dir * range.step, range.places), range.min, range.max));
  const live = !disabled && v !== undefined;

  return (
    <Stepper
      ruled={ruled}
      label={label}
      value={v === undefined ? "—" : v.toFixed(range.places)}
      less={`Lower ${label}`}
      more={`Raise ${label}`}
      onLess={live && v > range.min ? () => step(-1) : undefined}
      onMore={live && v < range.max ? () => step(1) : undefined}
    />
  );
}
