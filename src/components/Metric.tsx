interface MetricProps {
  label: string;
  value: number;
  unit: string;
  target?: number;
  /** Full-scale value for the bar, in the metric's own unit. */
  max: number;
  color: string;
  decimals?: number;
}

export function Metric({ label, value, unit, target, max, color, decimals = 1 }: MetricProps) {
  const fill = Math.max(0, Math.min(1, value / max));

  return (
    <div className="metric">
      <span className="label">{label}</span>
      <span className="num metric__value" style={{ color }}>
        {value.toFixed(decimals)}
        <span style={{ fontSize: "0.4em", color: "var(--text-faint)", marginLeft: 4 }}>{unit}</span>
      </span>
      <div className="bar">
        <div className="bar__fill" style={{ width: `${fill * 100}%`, background: color }} />
      </div>
      <span className="num metric__target">
        {target === undefined ? "" : `target ${target.toFixed(decimals)}`}
      </span>
    </div>
  );
}
