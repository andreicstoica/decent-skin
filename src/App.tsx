import { useEffect, useState } from "react";
import { restUrl } from "./api/gateway";
import { useMachineSnapshot, useScale } from "./api/useTelemetry";
import { useShotTimer } from "./api/useShotTimer";
import { useShotTrace } from "./api/useShotTrace";
import { useShotFinished } from "./api/useShotFinished";
import { useWater } from "./api/useWater";
import { useWorkflow } from "./api/useWorkflow";
import { useSettings } from "./api/useSettings";
import { useDecaidSettings } from "./api/useDecaidSettings";
import { useMaintenance } from "./api/useMaintenance";
import { BrewView } from "./views/BrewView";
import { ShotsView } from "./views/ShotsView";
import { BeansView } from "./views/BeansView";
import { SettingsView } from "./views/SettingsView";
import { ProfilesView } from "./views/ProfilesView";
import { RateShotView } from "./views/RateShotView";
import { SleepScreen } from "./components/SleepScreen";
import { MoonIcon } from "./components/icons";
import { stateLabel, WORKING, type MachineSnapshot, type MachineState } from "./api/types";

const TABS = ["Brew", "Shots", "Beans", "Profiles", "Settings"] as const;
type Tab = (typeof TABS)[number];

const RESTING: ReadonlySet<MachineState> = new Set(["sleeping", "schedIdle"]);

/**
 * Deep links such as `?tab=beans&add=1` come from the phone QR code. They are
 * read once on load, then dropped from the address so a reload starts clean.
 */
function readLaunch(): { tab: Tab; add: boolean } {
  const params = new URLSearchParams(window.location.search);
  const wanted = params.get("tab")?.toLowerCase();
  const tab = TABS.find((t) => t.toLowerCase() === wanted) ?? "Brew";
  return { tab, add: tab === "Beans" && params.get("add") === "1" };
}

function MachineStatus({ snapshot }: { snapshot: MachineSnapshot | null }) {
  if (!snapshot) {
    return (
      <span className="status status--off">
        <span className="status__dot" aria-hidden />
        Offline
      </span>
    );
  }
  const state = snapshot.state.state;
  if (WORKING.has(state)) {
    return (
      <span className="status status--warm" title={stateLabel(state)}>
        <span className="status__dot" aria-hidden />
        <span className="num">
          {snapshot.mixTemperature.toFixed(0)}° <span className="status__arrow">→</span>{" "}
          {snapshot.targetMixTemperature.toFixed(0)}°
        </span>
        <span className="sr-only"> {stateLabel(state)}</span>
      </span>
    );
  }
  const tone = state === "idle" ? "ready" : RESTING.has(state) ? "off" : state === "error" ? "err" : "busy";
  return (
    <span className={`status status--${tone}`}>
      <span className="status__dot" aria-hidden />
      {stateLabel(state)}
    </span>
  );
}

export default function App() {
  const [launch] = useState(readLaunch);
  const [tab, setTab] = useState<Tab>(launch.tab);
  const [powerRequest, setPowerRequest] = useState<"sleeping" | "idle" | null>(null);
  const [powerError, setPowerError] = useState<string | null>(null);
  // The deep-linked add form opens once; later visits to Beans start closed.
  const [addPending, setAddPending] = useState(launch.add);
  const go = (t: Tab) => {
    setAddPending(false);
    setTab(t);
  };
  const settings = useSettings();
  const { data: app } = useDecaidSettings();

  useEffect(() => {
    if (window.location.search) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  // Follow Decaid's own theme setting; "system" falls through to the media query.
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
  const trace = useShotTrace(snapshot, scale.weightFlow);
  const { finishedId, dismiss } = useShotFinished(snapshot);
  const maintenance = useMaintenance();

  const state = snapshot?.state.state;
  const resting = !!state && RESTING.has(state);
  const changePower = async (next: "sleeping" | "idle") => {
    if (powerRequest) return;
    setPowerRequest(next);
    setPowerError(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(restUrl(`/machine/state/${next}`), {
        method: "PUT",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Gateway returned ${response.status}`);
      if (next === "sleeping") go("Brew");
    } catch {
      setPowerError(next === "sleeping" ? "Could not put machine to sleep" : "Could not wake machine");
    } finally {
      window.clearTimeout(timeout);
      setPowerRequest(null);
    }
  };
  const showClock = resting && tab === "Brew";
  const pulling = state === "espresso" && tab === "Brew" && !finishedId;

  return (
    <div className={`app ${pulling ? "app--pulling" : ""}`}>
      {!showClock && <header className="topbar" aria-hidden={pulling || undefined} inert={pulling}>
        <div className="topbar__id">
          <MachineStatus snapshot={snapshot} />
        </div>

        <nav className="topbar__tabs" aria-label="Sections">
          {TABS.map((t) => (
            <button
              type="button"
              key={t}
              className={`tab ${t === tab ? "tab--on" : ""}`}
              aria-current={t === tab ? "page" : undefined}
              onClick={() => go(t)}
            >
              {t}
            </button>
          ))}
        </nav>

        <div className="topbar__end">
          <div className="alerts">
            {powerError && !pulling && <span className="alert alert--urgent" role="alert">{powerError}</span>}
            {socket !== "open" && <span className="alert alert--urgent">Gateway offline</span>}
            {water?.status === "refill" && <span className="alert alert--urgent">Refill water</span>}
            {water?.status === "low" && <span className="alert">Water low</span>}
            {maintenance.due && (
              <button type="button" className="alert alert--tap" onClick={() => go("Settings")}>
                Clean due
              </button>
            )}
            {scale.connected && scale.battery !== null && scale.battery < 25 && (
              <span className="alert">Scale {scale.battery}%</span>
            )}
          </div>
          {/* Sleep stays reachable while heating: that is when you walk away. */}
          {snapshot && !resting && (
            <button type="button" className="util" onClick={() => void changePower("sleeping")} disabled={powerRequest !== null} title="Sleep" aria-label="Sleep">
              <MoonIcon />
            </button>
          )}
        </div>
      </header>}

      {showClock ? (
        <SleepScreen onWake={() => void changePower("idle")} waking={powerRequest !== null} error={powerError} />
      ) : finishedId ? (
        <RateShotView id={finishedId} onDone={dismiss} />
      ) : tab === "Shots" ? (
        <ShotsView />
      ) : tab === "Beans" ? (
        <BeansView initialAdd={addPending} />
      ) : tab === "Profiles" ? (
        <ProfilesView onOneOffLoaded={() => go("Brew")} />
      ) : tab === "Settings" ? (
        <SettingsView state={snapshot?.state.state} water={water} tankFullMm={settings.tankFullMm} />
      ) : !snapshot ? (
        <div className="panel">
          <div className="empty">
            <h2 className="empty__h">Waiting for the machine</h2>
            <p className="empty__p">
              Decaid is not reporting telemetry. Check that it is running and a machine
              is connected, then this fills in on its own.
            </p>
          </div>
        </div>
      ) : (
        <BrewView
          snapshot={snapshot}
          workflow={workflow}
          weight={scale.weight}
          weightFlow={scale.weightFlow}
          scaleConnected={scale.connected}
          elapsed={elapsed}
          trace={trace}
          onPickProfiles={() => go("Profiles")}
          onPickBeans={() => go("Beans")}
        />
      )}
    </div>
  );
}
