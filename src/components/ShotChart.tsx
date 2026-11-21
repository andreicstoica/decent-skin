import { memo, useEffect, useRef, useState } from "react";
import type { TracePoint } from "../api/useShotTrace";

const PAD = { top: 14, right: 16, bottom: 18, left: 30 };

/** Each target is the dashed, dimmed form of its own channel. A shared grey made
 *  the two indistinguishable, which is why one of them was dropped. */
const SERIES = [
  { key: "pressure", target: "targetPressure", color: "hsl(var(--ch-pressure))" },
  { key: "flow", target: "targetFlow", color: "hsl(var(--ch-flow))" },
  { key: "weightFlow", target: null, color: "hsl(var(--ch-weight))" },
] as const;

type SeriesKey = (typeof SERIES)[number]["key" | "target"] & string;
const finite = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** Rendered at true pixel size so strokes and labels are never scaled unevenly. */
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

export const ShotChart = memo(function ShotChart({ trace, label = "Live shot trace", live = false }: { trace: TracePoint[]; label?: string; live?: boolean }) {
  const [ref, { width, height }] = useElementSize<HTMLDivElement>();
  const series = trace.length
    ? SERIES.filter((s) => trace.some((p) => finite(p[s.key]) || (s.target && finite(p[s.target]))))
    : SERIES.slice(0, 2);
  // An all-zero target channel is not an active setpoint. Retain zeros in an
  // otherwise active channel so transitions to/from zero remain visible.
  const targets = series.flatMap(({ target }) =>
    target && trace.some((p) => finite(p[target]) && p[target] > 0) ? [target] : [],
  );
  const channels: SeriesKey[] = [...series.map((s) => s.key), ...targets];
  let min = 0;
  let max = 12;
  for (const p of trace) {
    for (const key of channels) {
      const value = p[key];
      if (finite(value)) {
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
    }
  }

  const yStep = max - min <= 14 ? 2 : tickStep(max - min, 6);
  min = Math.floor(min / yStep) * yStep;
  max = Math.ceil(max / yStep) * yStep;
  const last = trace[trace.length - 1]?.t ?? 0;
  const span = live || !last ? Math.max(10, (Math.floor(last / 10) + 1) * 10) : last;
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = Math.max(0, height - PAD.top - PAD.bottom);
  const xStep = tickStep(span, Math.max(2, Math.min(8, Math.floor(plotW / 45))));

  const x = (t: number) => PAD.left + (t / span) * plotW;
  const y = (v: number) => PAD.top + plotH - ((v - min) / (max - min)) * plotH;

  const path = (key: SeriesKey) => {
    let d = "";
    let connected = false;
    for (const p of trace) {
      const value = p[key];
      if (!finite(value)) {
        connected = false;
        continue;
      }
      d += `${connected ? "L" : "M"}${x(p.t).toFixed(1)},${y(value).toFixed(1)}`;
      connected = true;
    }
    return d;
  };
  const steps = trace.filter((p, i) => i > 0 && p.profileFrame != null &&
    trace[i - 1].profileFrame != null && p.profileFrame !== trace[i - 1].profileFrame);

  return (
    <div className="chartwrap">
      <div ref={ref} className="chart__box">
        {plotW > 0 && plotH > 0 && (
          <svg className="chart__svg" width={width} height={height} role="img" aria-label={label}>
            <desc>Elapsed time in seconds. Pressure in bar, flow in milliliters per second, weight flow in grams per second when recorded. Dashed curves show targets when available.</desc>
            {Array.from({ length: Math.round((max - min) / yStep) + 1 }, (_, i) => min + i * yStep).map((v) => (
              <g key={v}>
                <line
                  x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)}
                  stroke="hsl(var(--rule))" strokeWidth={1}
                />
                <text className="chart__tick" x={PAD.left - 5} y={y(v) + 3.5} textAnchor="end">
                  {v}
                </text>
              </g>
            ))}
            {Array.from({ length: Math.floor(span / xStep + 1e-9) + 1 }, (_, i) => i * xStep).map((t) => (
              <text key={t} className="chart__tick" x={x(t)} y={height - 4} textAnchor={x(t) > width - 34 ? "end" : "middle"}>
                {Number(t.toFixed(2))}s
              </text>
            ))}
            {steps.map((p, i) => (
              <line key={i} x1={x(p.t)} x2={x(p.t)} y1={PAD.top} y2={PAD.top + plotH}
                stroke="hsl(var(--rule-strong))" strokeDasharray="2 4">
                <title>Profile step {p.profileFrame! + 1}</title>
              </line>
            ))}
            {trace.length > 1 && (
              <>
                {series.map(
                  (s) =>
                    s.target && targets.includes(s.target) && (
                      <path
                        key={s.target} d={path(s.target)} fill="none" stroke={s.color}
                        strokeOpacity={0.65} strokeWidth={1.5} strokeDasharray="5 4"
                        strokeLinejoin="round" strokeLinecap="round"
                      />
                    ),
                )}
                {series.map((s) => (
                  <path
                    key={s.key} d={path(s.key)} fill="none" stroke={s.color}
                    strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
                  />
                ))}
              </>
            )}
          </svg>
        )}
      </div>
    </div>
  );
});
