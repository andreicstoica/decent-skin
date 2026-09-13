import { useEffect, useRef, useState } from "react";
import type { TracePoint } from "../api/useShotTrace";

const Y_MAX = 12;
// Grows with the shot; a fixed 30s floor leaves a short shot stranded at the left.
const MIN_WINDOW = 10;
const PAD = { top: 8, right: 8, bottom: 18, left: 24 };

const SERIES = [
  { key: "pressure", label: "pressure bar", color: "hsl(var(--ch-pressure))", dash: false },
  { key: "flow", label: "flow mL/s", color: "hsl(var(--ch-flow))", dash: false },
  { key: "weightFlow", label: "weight g/s", color: "hsl(var(--ch-weight))", dash: false },
  { key: "targetPressure", label: "target", color: "hsl(var(--ch-target))", dash: true },
] as const;

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

function ticks(span: number) {
  const raw = span / 6;
  const decade = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].find((m) => m * decade >= raw)! * decade;
  const out: number[] = [];
  for (let t = 0; t <= span + 1e-9; t += step) out.push(Math.round(t * 100) / 100);
  return out;
}

export function ShotChart({
  trace,
  pressure,
  flow,
  weightFlow,
}: {
  trace: TracePoint[];
  pressure: number;
  flow: number;
  weightFlow: number | null;
}) {
  const [ref, { width, height }] = useElementSize<HTMLDivElement>();

  const last = trace.length ? trace[trace.length - 1].t : 0;
  const span = Math.max(MIN_WINDOW, Math.ceil(last / 10) * 10);
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = Math.max(0, height - PAD.top - PAD.bottom);

  const x = (t: number) => PAD.left + (t / span) * plotW;
  const y = (v: number) => PAD.top + plotH - (Math.min(v, Y_MAX) / Y_MAX) * plotH;

  const path = (key: (typeof SERIES)[number]["key"]) =>
    trace.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t).toFixed(1)},${y(p[key]).toFixed(1)}`).join("");

  return (
    <div className="chartwrap">
      <div className="live">
        {SERIES.filter((x) => !x.dash).map((x) => (
          <span className="live__i" key={x.key}>
            <span className="lbl">{x.label}</span>
            <span className="num live__v" style={{ color: x.color }}>
              {(x.key === "pressure" ? pressure : x.key === "flow" ? flow : (weightFlow ?? 0)).toFixed(1)}
            </span>
          </span>
        ))}
      </div>
      <div ref={ref} style={{ flex: 1, minHeight: 0 }}>
        {width > 0 && (
          <svg className="chart__svg" width={width} height={height} role="img" aria-label="Live shot trace">
            {[0, 2, 4, 6, 8, 10, 12].map((v) => (
              <g key={v}>
                <line
                  x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)}
                  stroke="hsl(var(--rule))" strokeWidth={1}
                />
                <text
                  x={PAD.left - 5} y={y(v) + 3} textAnchor="end"
                  fontSize={9} fill="hsl(var(--muted))"
                >
                  {v}
                </text>
              </g>
            ))}
            {ticks(span).map((t) => (
              <text
                key={t} x={x(t)} y={height - 4} textAnchor="middle"
                fontSize={9} fill="hsl(var(--muted))"
              >
                {t}
              </text>
            ))}
            {trace.length > 1 &&
              SERIES.map((s) => (
                <path
                  key={s.key} d={path(s.key)} fill="none" stroke={s.color}
                  strokeWidth={s.dash ? 1.5 : 2}
                  strokeDasharray={s.dash ? "4 4" : undefined}
                  strokeLinejoin="round" strokeLinecap="round"
                />
              ))}
          </svg>
        )}
      </div>
    </div>
  );
}
