import { memo, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import type { TracePoint } from "../api/useShotTrace";
import { finite, initialTimeSpan, profilePlan, targetTrace, timeSpan, yDomain, type GraphProfile } from "./shotGraph";

const PAD = { top: 14, right: 16, bottom: 22, left: 30 };
const SERIES = [
  { key: "pressure", target: "targetPressure", color: "hsl(var(--ch-pressure))", label: "Pressure" },
  { key: "flow", target: "targetFlow", color: "hsl(var(--ch-flow))", label: "Flow" },
  { key: "weightFlow", target: null, color: "hsl(var(--ch-weight))", label: "Weight flow" },
] as const;
type SeriesKey = (typeof SERIES)[number]["key" | "target"] & string;
const EMPTY: TracePoint[] = [];

/** True pixel size: strokes and labels never scale unevenly. */
function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}

function tickStep(span: number, count: number) {
  const raw = span / count;
  const decade = 10 ** Math.floor(Math.log10(raw));
  return ([1, 2, 5, 10].find((m) => m * decade >= raw) ?? 10) * decade;
}

interface ShotChartProps {
  trace: TracePoint[];
  label?: string;
  live?: boolean;
  profile?: GraphProfile;
  ghost?: TracePoint[];
  /** Brew reserves its horizon before the first sample. History can fit its shot. */
  fixedTime?: boolean;
  controls?: ReactNode;
  showLegend?: boolean;
}

export const ShotChart = memo(function ShotChart({ trace, label = "Live shot trace", live = false, profile, ghost = EMPTY, fixedTime = false, controls, showLegend = false }: ShotChartProps) {
  const [ref, { width, height }] = useElementSize<HTMLDivElement>();
  const clipId = useId();
  const plan = useMemo(() => profilePlan(profile), [profile]);
  const targets = useMemo(() => targetTrace(trace, profile), [trace, profile]);
  // Plans are an idle preview, not a prediction superimposed on a live shot.
  // Live targets follow actual frame timing and reported transition setpoints.
  const planned = !live && trace.length === 0 ? plan.targets : [];
  const domain = yDomain([trace.map(({ targetPressure: _p, targetFlow: _f, ...point }) => point), targets, ghost], planned.map((p) => p.value));
  const yStep = domain.max - domain.min <= 16 ? 2 : tickStep(domain.max - domain.min, 6);
  const min = Math.floor(domain.min / yStep) * yStep;
  const max = Math.ceil(domain.max / yStep) * yStep;
  const lastTime = (points: TracePoint[]) => points.reduce((last, p) => finite(p.t) ? Math.max(last, p.t) : last, 0);
  const last = Math.max(lastTime(trace), lastTime(ghost));
  const span = live || fixedTime || !last ? timeSpan(last, initialTimeSpan(profile)) : Math.max(1, last);
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = Math.max(0, height - PAD.top - PAD.bottom);
  const xStep = tickStep(span, Math.max(2, Math.min(8, Math.floor(plotW / 45))));
  const x = (t: number) => PAD.left + (t / span) * plotW;
  const y = (v: number) => PAD.top + plotH - ((v - min) / (max - min)) * plotH;

  const path = (points: TracePoint[], key: SeriesKey) => {
    let d = "", connected = false, previous = -Infinity;
    for (const p of points) {
      const value = p[key];
      if (!finite(p.t) || p.t < 0 || !finite(value) || p.t <= previous) {
        connected = false;
        continue;
      }
      d += `${connected ? "L" : "M"}${x(p.t).toFixed(1)},${y(value).toFixed(1)}`;
      connected = true;
      previous = p.t;
    }
    return d;
  };
  const steps = trace.filter((p, i) => i > 0 && finite(p.t) && p.profileFrame != null &&
    trace[i - 1].profileFrame != null && p.profileFrame !== trace[i - 1].profileFrame);

  return (
    <div className="chartwrap">
      {controls}
      {showLegend && (
        <div className="chart__legend" aria-label="Chart legend">
          <span><i className="chart__sample" />Measured</span>
          <span><i className="chart__sample chart__sample--target" />{live ? "Pump target" : "Planned target"}</span>
          <span><i className="chart__sample chart__sample--ghost" />Ghost</span>
          <span className="chart__legend-note">{live ? "bar · mL/s · g/s" : "Step time limits; exits may shorten"}</span>
        </div>
      )}
      <div ref={ref} className="chart__box">
        {plotW > 0 && plotH > 0 && (
          <svg className="chart__svg" width={width} height={height} role="img" aria-label={label}>
            <desc>Elapsed time in seconds. Pressure in bar, flow in milliliters per second, weight flow in grams per second. Solid lines are measured. Dashed colored lines are pump targets. Faint dotted lines are a previous matching completed shot. Planned smooth transitions show only goal markers, not predicted ramps.</desc>
            <defs><clipPath id={clipId}><rect x={PAD.left} y={PAD.top - 3} width={plotW + 1} height={plotH + 6} /></clipPath></defs>
            {Array.from({ length: Math.round((max - min) / yStep) + 1 }, (_, i) => min + i * yStep).map((v) => (
              <g key={v}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} stroke="hsl(var(--rule))" strokeWidth={1} />
                <text className="chart__tick" x={PAD.left - 5} y={y(v) + 3.5} textAnchor="end">{v}</text>
              </g>
            ))}
            {Array.from({ length: Math.floor(span / xStep + 1e-9) + 1 }, (_, i) => i * xStep).map((t) => (
              <text key={t} className="chart__tick" x={x(t)} y={height - 4} textAnchor={x(t) > width - 34 ? "end" : "middle"}>{Number(t.toFixed(2))}s</text>
            ))}
            <g clipPath={`url(#${clipId})`}>
              {steps.map((p, i) => (
                <line key={i} x1={x(p.t)} x2={x(p.t)} y1={PAD.top} y2={PAD.top + plotH} stroke="hsl(var(--rule-strong))" strokeDasharray="2 4">
                  <title>{profile?.steps[p.profileFrame!]?.name || `Profile step ${p.profileFrame! + 1}`}</title>
                </line>
              ))}
              {planned.map((goal, i) => (
                <g key={i} data-planned-target={goal.channel}>
                  <title>{goal.name}: {goal.value} {goal.channel === "pressure" ? "bar" : "mL/s"}{goal.smooth ? ". Smooth goal only; ramp depends on entry conditions." : ". Planned maximum duration; actual phase can end earlier."}</title>
                  {!goal.smooth && <line x1={x(goal.t0)} x2={x(goal.t1)} y1={y(goal.value)} y2={y(goal.value)} stroke={`hsl(var(--ch-${goal.channel}))`} strokeWidth={1.5} strokeDasharray="6 4" strokeOpacity={0.75} />}
                  <circle cx={x(goal.t1)} cy={y(goal.value)} r={3} fill="hsl(var(--bg))" stroke={`hsl(var(--ch-${goal.channel}))`} strokeWidth={1.5} />
                </g>
              ))}
              {SERIES.map((s) => (
                <path key={`ghost-${s.key}`} data-ghost={s.key} d={path(ghost, s.key)} fill="none" stroke={s.color} strokeOpacity={0.4} strokeWidth={2} strokeDasharray="2 5" strokeLinecap="round" />
              ))}
              {SERIES.map((s) => s.target && (
                <path key={s.target} data-target={s.key} d={path(targets, s.target)} fill="none" stroke={s.color} strokeOpacity={0.8} strokeWidth={1.5} strokeDasharray="6 4" strokeLinejoin="round" strokeLinecap="round" />
              ))}
              {SERIES.map((s) => (
                <path key={s.key} data-measured={s.key} d={path(trace, s.key)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              ))}
            </g>
          </svg>
        )}
      </div>
    </div>
  );
});
