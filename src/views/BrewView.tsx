import { useEffect, useState } from "react";
import { restUrl } from "../api/gateway";
import { ShotChart } from "../components/ShotChart";
import { NumberPadModal, type QuickPreset } from "../components/NumberPadModal";
import { Stepper } from "../components/Stepper";
import { clamp, round, useNudge } from "../components/nudge";
import { FlushPanel, SteamPanel, WaterPanel } from "../components/DrinkPanels";
import { useBeanBatch, useGrinder, useUpdateWorkflow, type Workflow } from "../api/useWorkflow";
import { useProfiles, useSelectProfile, type ProfileRecord } from "../api/useProfiles";
import { useClearOneOff, useFavorites } from "../api/useFavorites";
import { useConnectScale, useTareScale } from "../api/useScaleActions";
import { shortName } from "../api/profileStyle";
import type { TracePoint } from "../api/useShotTrace";
import type { MachineSnapshot, MachineState, MachineSubstate } from "../api/types";
import { useMachineSettings } from "../api/useDecaidSettings";
import { useCountdown } from "../api/useCountdown";

const PHASE: Partial<Record<MachineSubstate, string>> = {
  preparingForShot: "Preparing",
  preinfusion: "Preinfusion",
  pouring: "Pouring",
  pouringDone: "Finished",
  pausedSteam: "Paused",
  puffing: "Purging",
  cleaningStart: "Cleaning",
  cleaningGroup: "Cleaning",
  cleaingGroup: "Cleaning",
  cleanSoaking: "Soaking",
  cleaningSteam: "Cleaning",
  refillStopped: "Refill stopped",
};

type Mode = "espresso" | "steam" | "hotWater" | "flush";

const MODES: { label: string; state: Mode }[] = [
  { label: "Espresso", state: "espresso" },
  { label: "Steam", state: "steam" },
  { label: "Water", state: "hotWater" },
  { label: "Flush", state: "flush" },
];

const isMode = (state: MachineState): state is Mode => MODES.some((mode) => mode.state === state);

function daysAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (!Number.isFinite(days) || days < 0) return null;
  return days === 0 ? "Roasted today" : `${days}d off roast`;
}

type Channel = "pressure" | "flow" | "weight";
type Slot = "time" | "cup" | "pressure" | "flow" | "weight";

/**
 * Cells are display: contents, so every label sits on one grid row and every
 * number on the next, baseline to baseline, whatever its size.
 */
function Read({
  slot,
  label,
  value,
  channel,
}: {
  slot: Slot;
  label: React.ReactNode;
  value: string;
  channel?: Channel;
}) {
  return (
    <div className={`read__cell read__cell--${slot}`}>
      <span className="read__l">{label}</span>
      <span className={`read__v num ${channel ? `read__v--${channel}` : ""}`}>{value}</span>
    </div>
  );
}

const DOSE = { step: 0.1, min: 5, max: 30, fallback: 18 };
// Yield 0 turns stop-at-weight off, so the stepper never reaches it.
const YIELD = { step: 1, min: 1, max: 200 };

function DoseYield({ dose, yieldTarget }: { dose?: number; yieldTarget?: number }) {
  const update = useUpdateWorkflow();
  const [d, nudgeDose] = useNudge(dose, (targetDoseWeight, settled) =>
    update.mutate({ context: { targetDoseWeight } }, { onSettled: settled }),
  );
  const [y, nudgeYield] = useNudge(yieldTarget || undefined, (targetYield, settled) =>
    update.mutate({ context: { targetYield } }, { onSettled: settled }),
  );
  const [pad, setPad] = useState<"dose" | "yield" | null>(null);

  const doseBase = d ?? DOSE.fallback;
  const yieldBase = y ?? Math.round(doseBase * 2);
  const ratio = d && y ? `1:${(y / d).toFixed(1)}` : null;
  const stepDose = (dir: number) => nudgeDose(clamp(round(doseBase + dir * DOSE.step, 1), DOSE.min, DOSE.max));
  const stepYield = (dir: number) => nudgeYield(clamp(Math.round(yieldBase + dir * YIELD.step), YIELD.min, YIELD.max));

  const dosePresets: QuickPreset[] = [
    { label: "16g", value: 16 },
    { label: "18g", value: 18 },
    { label: "20g", value: 20 },
  ];
  const yieldPresets: QuickPreset[] = [
    { label: `1:2 (${Math.round(doseBase * 2)}g)`, value: Math.round(doseBase * 2) },
    { label: `1:2.5 (${Math.round(doseBase * 2.5)}g)`, value: Math.round(doseBase * 2.5) },
    { label: `1:3 (${Math.round(doseBase * 3)}g)`, value: Math.round(doseBase * 3) },
    { label: `1:5 (${Math.round(doseBase * 5)}g)`, value: Math.round(doseBase * 5) },
  ];

  return (
    <>
      <Stepper
        label="Dose g"
        value={d ? d.toFixed(1) : "—"}
        less="Less coffee"
        more="More coffee"
        onLess={doseBase > DOSE.min ? () => stepDose(-1) : undefined}
        onMore={doseBase < DOSE.max ? () => stepDose(1) : undefined}
        onTapValue={() => setPad("dose")}
      />
      <Stepper
        ruled
        label={
          <>
            Yield g{ratio && <span className="num stepper__ratio"> · {ratio}</span>}
          </>
        }
        value={y ? y.toFixed(0) : "—"}
        less="Less in the cup"
        more="More in the cup"
        onLess={yieldBase > YIELD.min ? () => stepYield(-1) : undefined}
        onMore={yieldBase < YIELD.max ? () => stepYield(1) : undefined}
        onTapValue={() => setPad("yield")}
      />
      {pad === "dose" && (
        <NumberPadModal
          title="Dose"
          unit="g"
          initial={doseBase}
          min={DOSE.min}
          max={DOSE.max}
          allowDecimal
          presets={dosePresets}
          onApply={(v) => nudgeDose(round(v, 1))}
          onClose={() => setPad(null)}
        />
      )}
      {pad === "yield" && (
        <NumberPadModal
          title="Yield"
          unit="g"
          initial={yieldBase}
          min={YIELD.min}
          max={YIELD.max}
          allowDecimal={false}
          presets={yieldPresets}
          onApply={(v) => nudgeYield(round(v, 0))}
          onClose={() => setPad(null)}
        />
      )}
    </>
  );
}

function Grind({ setting, grinderId }: { setting?: string; grinderId?: string }) {
  const update = useUpdateWorkflow();
  const { data: grinder } = useGrinder(grinderId);
  const increment = grinder?.settingSmallStep ?? 0.1;
  const places = increment < 1 ? 1 : 0;
  const parsed = setting === undefined ? NaN : Number.parseFloat(setting);
  const [value, nudge] = useNudge(Number.isFinite(parsed) ? parsed : undefined, (n, settled) =>
    update.mutate({ context: { grinderSetting: n.toFixed(places) } }, { onSettled: settled }),
  );
  const [pad, setPad] = useState(false);
  const base = value ?? 10;
  const step = (direction: number) =>
    nudge(Math.max(0, round(base + direction * increment, places)));

  const grindPresets: QuickPreset[] = [
    { label: "−10", value: Math.max(0, round(base - 10, places)) },
    { label: "−5", value: Math.max(0, round(base - 5, places)) },
    { label: "−1", value: Math.max(0, round(base - 1, places)) },
    { label: "+1", value: round(base + 1, places) },
    { label: "+5", value: round(base + 5, places) },
    { label: "+10", value: round(base + 10, places) },
  ];

  return (
    <>
      <Stepper
        ruled
        label="Grind"
        value={value !== undefined ? value.toFixed(places) : (setting ?? "—")}
        less="Finer"
        more="Coarser"
        onLess={base > 0 ? () => step(-1) : undefined}
        onMore={() => step(1)}
        onTapValue={() => setPad(true)}
      />
      {pad && (
        <NumberPadModal
          title="Grind"
          initial={base}
          min={0}
          max={999}
          allowDecimal={places > 0}
          presets={grindPresets}
          onApply={(v) => nudge(round(v, places))}
          onClose={() => setPad(false)}
        />
      )}
    </>
  );
}

const NOTE_MS = 3000;

/**
 * The scale action sits on the label row beside the number it acts on: Connect
 * until a scale reports in, then Tare. Refusals replace the label briefly.
 */
function InCup({
  weight,
  connected,
  pulling,
  target,
}: {
  weight: number | null;
  connected: boolean;
  pulling: boolean;
  target?: number;
}) {
  const tare = useTareScale();
  const connect = useConnectScale();
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!note) return;
    const timer = setTimeout(() => setNote(null), NOTE_MS);
    return () => clearTimeout(timer);
  }, [note]);

  const onTare = () =>
    tare.mutate(undefined, {
      onSuccess: (result) => setNote(result.ok ? null : result.message),
      onError: () => setNote("Tare failed"),
    });
  const onConnect = () => connect.mutate(undefined, { onError: () => setNote("Scan failed") });

  return (
    <div className="read__cell read__cell--cup">
      <div className="read__l read__l--cup">
        <span className="lbl">In cup g</span>
        {pulling && target != null && target > 0 && (
          <span className="row__sub num">Target {target} g</span>
        )}
        {note && (
          <span className="lbl lbl--note" role="status" aria-live="polite">
            {note}
          </span>
        )}
      </div>
      <div className="read__cup-row">
        <span className="read__v num read__v--weight">
          {weight === null ? "—" : weight.toFixed(1)}
        </span>
        {!pulling &&
          (connected ? (
            <button type="button" className="tare" onClick={onTare} disabled={tare.isPending}>
              Tare
            </button>
          ) : (
            <button type="button" className="tare" onClick={onConnect} disabled={connect.isPending}>
              {connect.isPending ? "Connecting…" : "Connect scale"}
            </button>
          ))}
      </div>
    </div>
  );
}

/**
 * Pinned profiles as a two-column grid, with View all in the last cell. A
 * 1-off shows its badge on the way back; loading any favorite ends the 1-off.
 */
function Favorites({
  currentTitle,
  locked,
  onPickProfiles,
}: {
  currentTitle?: string;
  locked: boolean;
  onPickProfiles: () => void;
}) {
  const { data: profiles } = useProfiles();
  const { favoriteIds, oneOffReturnId } = useFavorites();
  const select = useSelectProfile();
  const clearOneOff = useClearOneOff();

  const byId = new Map((profiles ?? []).map((record) => [record.id, record]));
  const pinned = favoriteIds
    .map((id) => byId.get(id))
    .filter((record): record is ProfileRecord => !!record);
  const returnTo = oneOffReturnId ? byId.get(oneOffReturnId) : undefined;
  const inOneOff = !!oneOffReturnId;
  // The loaded profile is named only when no pinned pill already shows it.
  const unpinned = !!currentTitle && !pinned.some((record) => record.profile.title === currentTitle);

  const load = (record: ProfileRecord) =>
    select.mutate(record, {
      onSuccess: () => {
        if (inOneOff) clearOneOff.mutate();
      },
    });

  return (
    <section className="favs" aria-label="Profile">
      {(inOneOff || unpinned) && (
        <div className="deck__h">
          {unpinned ? (
            <p className="deck__title truncate" title={currentTitle}>{shortName(currentTitle)}</p>
          ) : (
            <span />
          )}
          {inOneOff && (
            <button
              type="button"
              className="oneoff"
              onClick={() => returnTo && load(returnTo)}
              disabled={!returnTo || locked || select.isPending}
              title={returnTo ? `Return to ${shortName(returnTo.profile.title)}` : undefined}
            >
              <span className="oneoff__badge">1-off</span>
              {returnTo && <span className="oneoff__l">Return</span>}
            </button>
          )}
        </div>
      )}
      <div className="favs__grid" role="group" aria-label="Favorite profiles">
        {pinned.map((record) => {
          const on = record.profile.title === currentTitle;
          const loading = select.isPending && select.variables?.id === record.id;
          return (
            <button
              type="button"
              key={record.id}
              className={`fav ${on ? "fav--on" : ""} ${loading ? "fav--loading" : ""}`}
              aria-pressed={on}
              onClick={() => !on && load(record)}
              disabled={locked || select.isPending}
              title={record.profile.title}
            >
              <span className="truncate">{shortName(record.profile.title)}</span>
            </button>
          );
        })}
        <button type="button" className="fav fav--all" onClick={onPickProfiles}>
          {pinned.length === 0 ? "Pin up to 5 favorites" : "View all"}
        </button>
      </div>
    </section>
  );
}

interface BrewViewProps {
  snapshot: MachineSnapshot;
  workflow: Workflow | null | undefined;
  weight: number | null;
  weightFlow: number | null;
  scaleConnected: boolean;
  elapsed: number;
  trace: TracePoint[];
  onPickProfiles: () => void;
  onPickBeans: () => void;
}

/**
 * The group head buttons start every mode, so the mode bar only picks which
 * settings the deck shows. A running mode shows its own pane; tapping its
 * segment stops it.
 */
export function BrewView({
  snapshot,
  workflow,
  weight,
  weightFlow,
  scaleConnected,
  elapsed,
  trace,
  onPickProfiles,
  onPickBeans,
}: BrewViewProps) {
  const ctx = workflow?.context;
  const { data: batch } = useBeanBatch(ctx?.beanBatchId);
  const roast = batch?.roastDate ? daysAgo(batch.roastDate) : null;
  const { data: machine } = useMachineSettings();
  const state = snapshot.state.state;
  const flushing = state === "flush";

  const [pane, setPane] = useState<Mode>("espresso");
  // Follow a mode started at the group head, once, so the bar can still move away.
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    setSeen(state);
    if (isMode(state)) setPane(state);
  }

  const run = (mode: MachineState) =>
    void fetch(restUrl(`/machine/state/${mode}`), { method: "PUT" });

  // The panel's flush length is the one the skin enforces; the machine setting is the fallback.
  const flushSeconds = workflow?.rinseData?.duration ?? machine?.flushTimeout ?? 0;
  const flushLeft = useCountdown(flushing, flushSeconds, () => run("idle"));

  const pulling = state === "espresso";
  const beanMeta = [ctx?.coffeeRoaster, roast].filter(Boolean).join(" · ");

  return (
    <div className={`brew ${pulling ? "brew--pulling" : ""}`}>
      <div className="deck" aria-hidden={pulling || undefined}>
        <div className="deck__top">
          <button
            type="button"
            className="deck__bean"
            onClick={onPickBeans}
            title={[ctx?.coffeeName, beanMeta].filter(Boolean).join(" · ") || undefined}
          >
            <span className="deck__bean-text">
              <span className={`deck__bean-name truncate ${ctx?.coffeeName ? "" : "beanbtn__name--empty"}`}>
                {ctx?.coffeeName ?? "Select coffee"}
              </span>
              {beanMeta && <span className="deck__bean-meta truncate">{beanMeta}</span>}
            </span>
            <svg className="deck__bean-icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden>
              <path d="M5 6.25L8 3.5l3 2.75M5 9.75L8 12.5l3-2.75" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="modebar" role="group" aria-label="Mode">
            {MODES.map((mode) => {
              const running = state === mode.state;
              const shown = pane === mode.state;
              return (
                <button
                  type="button"
                  key={mode.state}
                  className={`modebar__b ${running ? "modebar__b--run" : shown ? "modebar__b--on" : ""}`}
                  aria-pressed={shown}
                  aria-label={running ? `Stop ${mode.label.toLowerCase()}` : undefined}
                  onClick={() => (running ? run("idle") : setPane(mode.state))}
                >
                  {running && mode.state === "flush" && flushLeft > 0 ? (
                    <span className="num">{Math.ceil(flushLeft)}s</span>
                  ) : running ? (
                    "Stop"
                  ) : (
                    mode.label
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="deck__body">
          {pane === "espresso" ? (
            <div className="deck__espresso">
              <Favorites
                currentTitle={workflow?.profile?.title}
                locked={state === "espresso"}
                onPickProfiles={onPickProfiles}
              />
              <section className="deck__dials" aria-label="Recipe">
                <div className="dials">
                  <DoseYield dose={ctx?.targetDoseWeight} yieldTarget={ctx?.targetYield} />
                  <Grind setting={ctx?.grinderSetting} grinderId={ctx?.grinderId} />
                </div>
              </section>
            </div>
          ) : pane === "steam" ? (
            <SteamPanel />
          ) : pane === "hotWater" ? (
            <WaterPanel />
          ) : (
            <FlushPanel flushing={flushing} left={flushLeft} />
          )}
        </div>
      </div>

      <div className="live">
        <div className="read">
          <Read slot="time" label={<span className="lbl">{PHASE[snapshot.state.substate] ?? "Time"} s</span>} value={elapsed.toFixed(1)} />
          <InCup weight={weight} connected={scaleConnected} pulling={pulling} target={ctx?.targetYield} />
          <Read slot="pressure" label={<span className="lbl">Pressure bar</span>} value={snapshot.pressure.toFixed(1)} channel="pressure" />
          <Read slot="flow" label={<span className="lbl">Flow mL/s</span>} value={snapshot.flow.toFixed(1)} channel="flow" />
          <Read slot="weight" label={<span className="lbl">Weight flow g/s</span>} value={weightFlow?.toFixed(1) ?? "—"} channel="weight" />
        </div>
        <ShotChart trace={trace} live={pulling} />
      </div>
    </div>
  );
}
