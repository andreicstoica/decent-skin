import { useEffect, useRef, useState } from "react";
import type { TracePoint } from "../api/useShotTrace";

const Y_MAX = 12;
const MIN_WINDOW = 30;
const PAD = { top: 8, right: 8, bottom: 18, left: 24 };

const SERIES = [
  { key: "pressure", label: "pressure · bar", color: "hsl(var(--chart-pressure))", dash: false },
  { key: "flow", label: "flow · mL/s", color: "hsl(var(--chart-flow))", dash: false },
  { key: "weightFlow", label: "weight · g/s", color: "hsl(var(--chart-weight))", dash: false },
  { key: "targetPressure", label: "profile target", color: "hsl(var(--chart-target))", dash: true },
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

export function ShotChart({ trace }: { trace: TracePoint[] }) {
  const [ref, { width, height }] = useElementSize<HTMLDivElement>();

  const span = Math.max(MIN_WINDOW, trace.length ? Math.ceil(trace[trace.length - 1].t) : 0);
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = Math.max(0, height - PAD.top - PAD.bottom);

  const x = (t: number) => PAD.left + (t / span) * plotW;
  const y = (v: number) => PAD.top + plotH - (Math.min(v, Y_MAX) / Y_MAX) * plotH;

  const path = (key: (typeof SERIES)[number]["key"]) =>
    trace.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t).toFixed(1)},${y(p[key]).toFixed(1)}`).join("");

  return (
    <div className="card chart">
      <div ref={ref} style={{ flex: 1, minHeight: 0 }}>
        {width > 0 && (
          <svg className="chart__svg" width={width} height={height} role="img" aria-label="Live shot trace">
            {[0, 2, 4, 6, 8, 10, 12].map((v) => (
              <g key={v}>
                <line
                  x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)}
                  stroke="hsl(var(--border))" strokeWidth={1}
                />
                <text
                  x={PAD.left - 5} y={y(v) + 3} textAnchor="end"
                  fontSize={9} fill="hsl(var(--muted-foreground))"
                >
                  {v}
                </text>
              </g>
            ))}
            {Array.from({ length: 7 }, (_, i) => Math.round((span / 6) * i)).map((t, i) => (
              <text
                key={i} x={x(t)} y={height - 4} textAnchor="middle"
                fontSize={9} fill="hsl(var(--muted-foreground))"
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
      <div className="legend">
        {SERIES.map((s) => (
          <span className="legend__item" key={s.key}>
            <span className="legend__swatch" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
