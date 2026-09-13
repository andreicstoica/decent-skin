import { Metric } from "../components/Metric";
import type { MachineSnapshot } from "../api/types";

interface ShotViewProps {
  snapshot: MachineSnapshot;
  weight: number | null;
  elapsed: number;
}

export function ShotView({ snapshot, weight, elapsed }: ShotViewProps) {
  return (
    <div className="shot">
      <div className="primary">
        <div className="primary__cell">
          <span className="num primary__value" style={{ color: "var(--weight)" }}>
            {weight === null ? "––.–" : weight.toFixed(1)}
          </span>
          <span className="label">{weight === null ? "no scale" : "grams out"}</span>
        </div>
        <div className="primary__cell">
          <span className="num primary__value">{elapsed.toFixed(1)}</span>
          <span className="label">seconds</span>
        </div>
      </div>

      <div className="secondary">
        <Metric
          label="Pressure"
          value={snapshot.pressure}
          target={snapshot.targetPressure}
          unit="bar"
          max={12}
          color="var(--pressure)"
        />
        <Metric
          label="Flow"
          value={snapshot.flow}
          target={snapshot.targetFlow}
          unit="ml/s"
          max={8}
          color="var(--flow)"
        />
        <Metric
          label="Mix temp"
          value={snapshot.mixTemperature}
          target={snapshot.targetMixTemperature}
          unit="°C"
          max={100}
          color="var(--temp)"
        />
        <Metric
          label="Group temp"
          value={snapshot.groupTemperature}
          target={snapshot.targetGroupTemperature}
          unit="°C"
          max={100}
          color="var(--temp)"
        />
      </div>
    </div>
  );
}
