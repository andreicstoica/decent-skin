export interface Step {
  pump?: "flow" | "pressure";
  seconds?: number;
  flow?: number;
  pressure?: number;
}

const W = 132;
const H = 44;
const Y_MAX = 12;

/**
 * A profile is a shape. Names and notes cannot distinguish "Adaptive v3" from
 * "Cremina lever machine"; the pressure and flow targets over time can.
 */
export function ProfileSpark({ steps }: { steps: Step[] }) {
  const usable = steps.filter((s) => (s.seconds ?? 0) > 0);
  const total = usable.reduce((sum, s) => sum + (s.seconds ?? 0), 0);
  if (!total) return <span style={{ width: W, flex: "none" }} />;

  const y = (v: number) => H - Math.min(Math.max(v, 0), Y_MAX) / Y_MAX * (H - 2) - 1;

  let t = 0;
  const segments = usable.map((step, i) => {
    const x0 = (t / total) * W;
    t += step.seconds ?? 0;
    const x1 = (t / total) * W;
    const pressure = step.pump === "pressure";
    const value = pressure ? (step.pressure ?? 0) : (step.flow ?? 0);
    return { i, x0, x1, y: y(value), pressure };
  });

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden style={{ flex: "none" }}>
      {segments.map((s, i) => (
        <g key={s.i}>
          {i > 0 && (
            <line
              x1={s.x0} x2={s.x0} y1={segments[i - 1].y} y2={s.y}
              stroke="hsl(var(--rule))" strokeWidth={1}
            />
          )}
          <line
            x1={s.x0} x2={s.x1} y1={s.y} y2={s.y}
            stroke={s.pressure ? "hsl(var(--ch-pressure))" : "hsl(var(--ch-flow))"}
            strokeWidth={2.5} strokeLinecap="square"
          />
        </g>
      ))}
    </svg>
  );
}
