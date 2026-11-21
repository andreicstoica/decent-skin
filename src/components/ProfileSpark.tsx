export interface Step {
  name?: string;
  pump?: "flow" | "pressure";
  seconds?: number;
  flow?: number;
  pressure?: number;
  temperature?: number;
}

const Y_MAX = 12;

interface Segment {
  t0: number;
  t1: number;
  value: number;
  pressure: boolean;
}

/** Each step holds its pump target for its time limit. Exits can end it sooner. */
function segmentsOf(steps: Step[]) {
  const usable = steps.filter((s) => (s.seconds ?? 0) > 0);
  const segments: Segment[] = [];
  let t = 0;
  for (const step of usable) {
    const pressure = step.pump === "pressure";
    const t0 = t;
    t += step.seconds ?? 0;
    segments.push({ t0, t1: t, value: pressure ? (step.pressure ?? 0) : (step.flow ?? 0), pressure });
  }
  return { segments, total: t };
}

const channel = (pressure: boolean) => (pressure ? "hsl(var(--ch-pressure))" : "hsl(var(--ch-flow))");

function Steps({
  segments,
  x,
  y,
  width,
}: {
  segments: Segment[];
  x: (t: number) => number;
  y: (v: number) => number;
  width: number;
}) {
  return (
    <>
      {segments.map((s, i) => (
        <g key={i}>
          {i > 0 && (
            <line
              x1={x(s.t0)} x2={x(s.t0)} y1={y(segments[i - 1].value)} y2={y(s.value)}
              stroke="hsl(var(--rule-strong))" strokeWidth={1}
            />
          )}
          <line
            x1={x(s.t0)} x2={x(s.t1)} y1={y(s.value)} y2={y(s.value)}
            stroke={channel(s.pressure)} strokeWidth={width} strokeLinecap="square"
          />
        </g>
      ))}
    </>
  );
}

const W = 132;
const H = 44;

/**
 * A profile is a shape. Names and notes cannot distinguish "Adaptive v3" from
 * "Cremina lever machine"; the pressure and flow targets over time can.
 */
export function ProfileSpark({ steps }: { steps: Step[] }) {
  const { segments, total } = segmentsOf(steps);
  if (!total) return <span className="spark spark--empty" aria-hidden />;

  const x = (t: number) => (t / total) * W;
  const y = (v: number) => H - Math.min(Math.max(v, 0), Y_MAX) / Y_MAX * (H - 2) - 1;

  return (
    <svg className="spark" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden>
      <Steps segments={segments} x={x} y={y} width={2.5} />
    </svg>
  );
}

const GW = 520;
const GH = 168;
const PAD = { top: 16, right: 34, bottom: 22, left: 34 };
const Y_TICKS = [0, 3, 6, 9, 12];

function timeTicks(span: number) {
  const raw = span / 6;
  const decade = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].find((m) => m * decade >= raw)! * decade;
  const out: number[] = [];
  for (let t = 0; t <= span + 1e-9; t += step) out.push(Math.round(t));
  return out;
}

/** Bar and mL/s share one 0-12 scale, as on the machine's own chart. */
export function ProfileGraph({ steps, label }: { steps: Step[]; label: string }) {
  const { segments, total } = segmentsOf(steps);
  if (!total) return null;

  const plotW = GW - PAD.left - PAD.right;
  const plotH = GH - PAD.top - PAD.bottom;
  const x = (t: number) => PAD.left + (t / total) * plotW;
  const y = (v: number) => PAD.top + plotH - (Math.min(Math.max(v, 0), Y_MAX) / Y_MAX) * plotH;

  return (
    <svg className="graph" viewBox={`0 0 ${GW} ${GH}`} role="img" aria-label={label}>
      <text className="chart__tick graph__unit graph__unit--pressure" x={PAD.left - 6} y={PAD.top - 6} textAnchor="end">
        bar
      </text>
      <text className="chart__tick graph__unit graph__unit--flow" x={GW - PAD.right + 6} y={PAD.top - 6} textAnchor="start">
        mL/s
      </text>
      {Y_TICKS.map((v) => (
        <g key={v}>
          <line x1={PAD.left} x2={GW - PAD.right} y1={y(v)} y2={y(v)} stroke="hsl(var(--rule))" strokeWidth={1} />
          <text className="chart__tick" x={PAD.left - 6} y={y(v) + 3.5} textAnchor="end">{v}</text>
          <text className="chart__tick" x={GW - PAD.right + 6} y={y(v) + 3.5} textAnchor="start">{v}</text>
        </g>
      ))}
      {segments.slice(1).map((s, i) => (
        <line
          key={i}
          x1={x(s.t0)} x2={x(s.t0)} y1={PAD.top} y2={PAD.top + plotH}
          stroke="hsl(var(--rule))" strokeWidth={1} strokeDasharray="2 3"
        />
      ))}
      {timeTicks(total).map((t) => (
        <text key={t} className="chart__tick" x={x(t)} y={GH - 6} textAnchor="middle">{t}s</text>
      ))}
      <Steps segments={segments} x={x} y={y} width={2.5} />
    </svg>
  );
}
