import { useState } from "react";
import { restUrl } from "./api/gateway";
import { useMachineSnapshot, useScale } from "./api/useTelemetry";
import { useShotTimer } from "./api/useShotTimer";
import { useShotTrace } from "./api/useShotTrace";
import { useWaterLevel } from "./api/useWaterLevel";
import { useWorkflow } from "./api/useWorkflow";
import { BrewView } from "./views/BrewView";
import { RestingView } from "./views/RestingView";
import type { MachineState } from "./api/types";

const TABS = ["Brew", "Shots", "Beans & grind", "Profiles", "Settings"] as const;

const RESTING: ReadonlySet<MachineState> = new Set(["sleeping", "schedIdle"]);

export default function App() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Brew");
  const { snapshot, socket } = useMachineSnapshot();
  const scale = useScale();
  const water = useWaterLevel();
  const { data: workflow } = useWorkflow();
  const { elapsed } = useShotTimer(snapshot);
  const { trace } = useShotTrace(snapshot, scale.weight);

  const state = snapshot?.state.state;
  const resting = !!state && RESTING.has(state);

  const sleep = () => void fetch(restUrl("/machine/state/sleeping"), { method: "PUT" });

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">Crema</span>
        <span className="topbar__meta">
          {water ? `water ${water.currentLevel} mL` : socket === "open" ? "" : "gateway offline"}
        </span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="topbar__meta">
            {scale.connected ? `scale ${scale.battery ?? "–"}%` : "no scale"}
          </span>
          <button className="btn btn--outline" style={{ minHeight: 32, padding: "0 12px" }} onClick={sleep}>
            Sleep
          </button>
        </div>
      </header>

      {snapshot && !resting && tab === "Brew" ? (
        <BrewView
          snapshot={snapshot}
          workflow={workflow}
          weight={scale.weight}
          elapsed={elapsed}
          trace={trace}
        />
      ) : snapshot && !resting ? (
        <div className="resting">
          <h2 className="resting__headline">{tab}</h2>
          <p className="resting__note">Not built yet. Brew is the only working tab.</p>
        </div>
      ) : (
        <RestingView
          connected={!!snapshot}
          lastShotAt={null}
        />
      )}

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t}
            className={`tab ${t === tab ? "tab--active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
        <span className="tabs__spacer" />
        <span className="tab" style={{ cursor: "default" }}>
          {socket === "open" ? "connected" : "offline"}
        </span>
      </nav>
    </div>
  );
}
