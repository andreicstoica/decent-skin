import { useState } from "react";
import { restUrl } from "./api/gateway";
import { useMachineSnapshot, useScale } from "./api/useTelemetry";
import { useShotTimer } from "./api/useShotTimer";
import { useShotTrace } from "./api/useShotTrace";
import { useWater } from "./api/useWater";
import { useWorkflow } from "./api/useWorkflow";
import { useSettings } from "./api/useSettings";
import { useDecaidSettings } from "./api/useDecaidSettings";
import { useEffect } from "react";
import { BrewView } from "./views/BrewView";
import { ShotsView } from "./views/ShotsView";
import { SettingsView } from "./views/SettingsView";
import type { MachineState } from "./api/types";

const TABS = ["Brew", "Shots", "Beans", "Profiles", "Settings"] as const;
type Tab = (typeof TABS)[number];

const RESTING: ReadonlySet<MachineState> = new Set(["sleeping", "schedIdle"]);



export default function App() {
  const [tab, setTab] = useState<Tab>("Brew");
  const settings = useSettings();
  const { data: app } = useDecaidSettings();

  // Follow Decaid's own theme setting; "system" falls through to themedia query.
  useEffect(() => {
    const root = document.documentElement;
    if (!app || app.themeMode === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", app.themeMode);
  }, [app]);

  const { snapshot, socket } = useMachineSnapshot();
  const scale = useScale();
  const water = useWater(settings.tankFullMm);
  const { data: workflow } = useWorkflow();
  const { elapsed } = useShotTimer(snapshot);
  const { trace } = useShotTrace(snapshot, scale.weightFlow);

  const state = snapshot?.state.state;
  const resting = !!state && RESTING.has(state);
  const setMachine = (s: MachineState) =>
    void fetch(restUrl(`/machine/state/${s}`), { method: "PUT" });

  return (
    <div className="app">

      {!snapshot ? (
        <div className="panel">
          <div className="empty">
            <h2 className="empty__h">Waiting for the machine</h2>
            <p className="empty__p">
              Decaid is not reporting telemetry. Check that it is running and a machine
              is connected, then this fills in on its own.
            </p>
          </div>
        </div>
      ) : resting && tab === "Brew" ? (
        <div className="panel">
          <div className="empty">
            <h2 className="empty__h">Asleep</h2>
            <p className="empty__p">Waking takes about four minutes to reach brew temperature.</p>
            <button className="btn" onClick={() => setMachine("idle")}>Wake the machine</button>
          </div>
        </div>
      ) : tab === "Brew" ? (
        <BrewView
          snapshot={snapshot}
          workflow={workflow}
          weight={scale.weight}
          elapsed={elapsed}
          trace={trace}
        />
      ) : tab === "Shots" ? (
        <ShotsView />
      ) : tab === "Settings" ? (
        <SettingsView />
      ) : (
        <div className="panel">
          <div className="empty">
            <h2 className="empty__h">{tab}</h2>
            <p className="empty__p">Not built yet.</p>
          </div>
        </div>
      )}

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t} className={`tab ${t === tab ? "tab--on" : ""}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
        <span className="tabs__spacer" />
        <div className="alerts">
          {socket !== "open" && <span className="alert alert--urgent">Gateway offline</span>}
          {water?.status === "refill" && <span className="alert alert--urgent">Refill water</span>}
          {water?.status === "low" && <span className="alert">Water low</span>}
          {scale.connected && scale.battery !== null && scale.battery < 25 && (
            <span className="alert">Scale {scale.battery}%</span>
          )}
        </div>
      </nav>
    </div>
  );
}
