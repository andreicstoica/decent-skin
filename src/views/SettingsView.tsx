import { useId, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { restUrl } from "../api/gateway";
import { useSaveSettings, useSettings } from "../api/useSettings";
import {
  useDecaidSettings,
  useMachineSettings,
  useSaveDecaidSettings,
  useSaveMachineSettings,
} from "../api/useDecaidSettings";
import type { MachineState } from "../api/types";
import type { useWater } from "../api/useWater";
import { useWorkflow } from "../api/useWorkflow";
import { useAddGrinder, useGrinders, useSelectGrinder, type GrinderRecord } from "../api/useGrinders";
import { Cleaning, Tank } from "./WaterView";
import { DeviceSettings } from "../components/DeviceSettings";
import { WakeSchedules } from "../components/WakeSchedules";

declare global {
  interface Window {
    decentApp?: {
      switchSkin?: (skinId: string) => boolean;
    };
  }
}

interface InstalledSkin {
  id: string;
  name: string;
  version?: string;
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="group">
      <div className="group__h">
        <h2 className="lbl">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Row({
  label,
  unit,
  control,
}: {
  label: string;
  unit?: string;
  control: (ids: { id: string; labelId: string }) => React.ReactNode;
}) {
  const id = useId();
  const labelId = `${id}-label`;
  return (
    <div className="field">
      <div className="field__label">
        <label className="row__title" id={labelId} htmlFor={id}>
          {label}
          {unit && <span className="field__unit">{unit}</span>}
        </label>
      </div>
      {control({ id, labelId })}
    </div>
  );
}

function Num({
  id,
  value,
  step = 1,
  onCommit,
}: {
  id: string;
  value: number;
  step?: number;
  onCommit: (n: number) => void;
}) {
  return (
    <input
      id={id}
      className="field__in num"
      type="number"
      inputMode="decimal"
      enterKeyHint="done"
      step={step}
      defaultValue={value}
      key={value}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      onBlur={(e) => {
        const n = Number.parseFloat(e.target.value);
        if (!Number.isFinite(n)) {
          e.target.value = String(value);
          return;
        }
        if (n !== value) onCommit(n);
      }}
    />
  );
}

function Toggle({ labelId, on, onChange, disabled }: { labelId: string; on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="seg" role="group" aria-labelledby={labelId}>
      {([false, true] as const).map((v) => (
        <button
          type="button"
          key={String(v)}
          className={`seg__b ${on === v ? "seg__b--on" : ""}`}
          aria-pressed={on === v}
          disabled={disabled}
          onClick={() => on !== v && onChange(v)}
        >
          {v ? "On" : "Off"}
        </button>
      ))}
    </div>
  );
}

function Choice<T extends string>({
  labelId,
  value,
  options,
  onChange,
}: {
  labelId: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg" role="group" aria-labelledby={labelId}>
      {options.map(([v, label]) => (
        <button
          type="button"
          key={v}
          className={`seg__b ${v === value ? "seg__b--on" : ""}`}
          aria-pressed={v === value}
          onClick={() => v !== value && onChange(v)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

interface SkinUpdateResult {
  item: string;
  status: "updated" | "alreadyCurrent" | "failed";
  error?: string;
}

function CubbyUpdates() {
  const client = useQueryClient();
  const { data: app } = useDecaidSettings();
  const save = useSaveDecaidSettings();
  const check = useMutation({
    mutationFn: async (): Promise<SkinUpdateResult[] | null> => {
      const response = await fetch(restUrl("/webui/skins/update"), { method: "POST" });
      if (response.status === 401 || response.status === 403) {
        throw new Error("Decaid blocked this check. Use Skins → Check for updates in the Decaid launcher.");
      }
      if (!response.ok) throw new Error("Could not check for updates. Try again from the Decaid launcher.");
      const body = (await response.json()) as { results?: SkinUpdateResult[] };
      return body.results ?? null;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["decaid-skins"] }),
  });
  const updated = check.data?.filter(({ status }) => status === "updated").length ?? 0;
  const failures = check.data?.filter(({ status }) => status === "failed") ?? [];
  const summary = updated > 0
    ? `${updated} ${updated === 1 ? "skin updated" : "skins updated"}.`
    : check.data?.length && !failures.length
      ? "No new skin updates."
      : !failures.length ? "Check complete. Only skins installed from an update source can be checked." : null;

  return (
    <Group title="Cubby">
      {typeof app?.automaticUpdateCheck === "boolean" && (
        <Row
          label="Automatic updates"
          control={({ labelId }) => (
            <Toggle labelId={labelId} on={app.automaticUpdateCheck} disabled={save.isPending}
              onChange={(automaticUpdateCheck) => save.mutate({ automaticUpdateCheck })} />
          )}
        />
      )}
      <div className="field">
        <div className="field__label">
          <span className="row__title">Skin updates</span>
          <span className="row__sub">Decaid checks and installs updates for all skins with an update source.</span>
        </div>
        <button type="button" className="btn btn--quiet btn--compact" disabled={check.isPending} onClick={() => check.mutate()}>
          {check.isPending ? "Checking…" : "Check for updates"}
        </button>
      </div>
      {save.isError && <p className="err" role="alert">Could not change automatic updates. Try in the Decaid launcher.</p>}
      {check.isError && (
        <p className="err" role="alert">
          {check.error instanceof TypeError
            ? "Could not reach the update service from Cubby. Try in the Decaid launcher."
            : check.error.message}
        </p>
      )}
      {check.isSuccess && (
        <div role="status">
          {summary && <p className="row__sub">{summary}</p>}
          {failures.map(({ item, error }) => <p className="err" key={item}>{item}: {error ?? "Update failed."}</p>)}
        </div>
      )}
    </Group>
  );
}

function SkinSwitcher() {
  const { data: skins } = useQuery({
    queryKey: ["decaid-skins"],
    queryFn: async (): Promise<InstalledSkin[]> => {
      const res = await fetch(restUrl("/webui/skins"));
      return res.ok ? ((await res.json()) as InstalledSkin[]) : [];
    },
    staleTime: 60_000,
  });

  const embedded = typeof window.decentApp?.switchSkin === "function";
  const others = (skins ?? []).filter((s) => s.id !== "decent-skin");

  const openSkin = async (skinId: string) => {
    if (window.decentApp?.switchSkin?.(skinId)) return;
    // External browser fallback: ask Decaid to switch default skin & redirect to :3000.
    try {
      await fetch(restUrl("/webui/skins/default"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skinId }),
      });
      await fetch(restUrl("/webui/server/stop"), { method: "POST" });
      await fetch(restUrl("/webui/server/start"), { method: "POST" });
      window.location.assign(`${window.location.protocol}//${window.location.hostname}:3000`);
    } catch {
      window.open(`${window.location.protocol}//${window.location.hostname}:3000`, "_blank");
    }
  };

  if (!others.length) return null;

  return (
    <Group title="Switch skin">
      <div className="skins__row">
        {others.map((s) => (
          <button
            type="button"
            key={s.id}
            className="btn btn--quiet"
            onClick={() => void openSkin(s.id)}
          >
            {s.name}
          </button>
        ))}
        {!embedded && (
          <a
            className="btn btn--quiet"
            href={`${window.location.protocol}//${window.location.hostname}:8080/api/v1/plugins/settings.reaplugin/ui`}
            target="_blank"
            rel="noreferrer"
          >
            Decaid settings
          </a>
        )}
      </div>
    </Group>
  );
}

function grinderDetail(g: GrinderRecord) {
  const step = g.settingSmallStep ? `${g.settingSmallStep} step` : null;
  return [g.burrs, step].filter(Boolean).join(" · ");
}

function AddGrinderForm({ onDone }: { onDone: () => void }) {
  const add = useAddGrinder();
  const [model, setModel] = useState("");
  const [burrs, setBurrs] = useState("");
  const [step, setStep] = useState("");
  const modelId = useId();
  const burrsId = useId();
  const stepId = useId();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!model.trim() || add.isPending) return;
    const smallStep = Number.parseFloat(step);
    add.mutate(
      {
        model,
        burrs,
        settingSmallStep: Number.isFinite(smallStep) && smallStep > 0 ? smallStep : undefined,
      },
      { onSuccess: onDone },
    );
  };

  return (
    <form className="grinderform" onSubmit={submit}>
      <div className="field field--text">
        <label className="field__label row__title" htmlFor={modelId}>Model</label>
        <input
          id={modelId}
          className="field__in field__in--text"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="Niche Zero"
          autoComplete="off"
          required
        />
      </div>
      <div className="field field--text">
        <label className="field__label row__title" htmlFor={burrsId}>
          Burrs <span className="field__unit">optional</span>
        </label>
        <input
          id={burrsId}
          className="field__in field__in--text"
          value={burrs}
          onChange={(e) => setBurrs(e.target.value)}
          placeholder="SSP 64mm"
          autoComplete="off"
        />
      </div>
      <div className="field">
        <label className="field__label row__title" htmlFor={stepId}>
          Small step <span className="field__unit">optional</span>
        </label>
        <input
          id={stepId}
          className="field__in num"
          type="number"
          inputMode="decimal"
          step="any"
          min={0}
          value={step}
          onChange={(e) => setStep(e.target.value)}
          placeholder="0.1"
        />
      </div>
      <div className="actions">
        <button type="button" className="btn btn--quiet" onClick={onDone}>Cancel</button>
        <button type="submit" className="btn actions__end" disabled={!model.trim() || add.isPending}>
          {add.isPending ? "Saving…" : "Save and use"}
        </button>
      </div>
      {add.isError && <p className="err" role="alert">Could not save the grinder.</p>}
    </form>
  );
}

function GrinderSetup() {
  const { data: grinders } = useGrinders();
  const { data: workflow } = useWorkflow();
  const select = useSelectGrinder();
  const [adding, setAdding] = useState(false);
  const ctx = workflow?.context;
  const isActive = (g: GrinderRecord) =>
    ctx?.grinderId ? g.id === ctx.grinderId : !!ctx?.grinderModel && g.model === ctx.grinderModel;

  return (
    <section className="group">
      <div className="group__h group__h--row">
        <h2 className="lbl">Grinder</h2>
        {!adding && (
          <button type="button" className="btn btn--quiet btn--compact" onClick={() => setAdding(true)}>
            Add grinder
          </button>
        )}
      </div>

      {grinders && grinders.length > 0 && (
        <div className="grinders" role="group" aria-label="Saved grinders">
          {grinders.map((g) => {
            const on = isActive(g);
            const detail = grinderDetail(g);
            return (
              <button
                type="button"
                key={g.id}
                className={`grinder ${on ? "grinder--on" : ""}`}
                aria-pressed={on}
                disabled={select.isPending}
                onClick={() => !on && select.mutate(g)}
              >
                <span className="grinder__text">
                  <span className="grinder__model truncate">{g.model}</span>
                  {detail && <span className="grinder__detail truncate">{detail}</span>}
                </span>
                {on && <span className="grinder__on">In use</span>}
              </button>
            );
          })}
        </div>
      )}

      {grinders && grinders.length === 0 && !adding && (
        <p className="row__sub section__empty">Add the grinder you use so each shot records it.</p>
      )}

      {adding && <AddGrinderForm onDone={() => setAdding(false)} />}
      {select.isError && <p className="err" role="alert">Could not switch grinder.</p>}
    </section>
  );
}

export function SettingsView({
  state,
  water,
  tankFullMm,
}: {
  state?: MachineState;
  water: ReturnType<typeof useWater>;
  tankFullMm: number;
}) {
  const skin = useSettings();
  const saveSkin = useSaveSettings();
  const { data: app } = useDecaidSettings();
  const saveApp = useSaveDecaidSettings();
  const { data: machine } = useMachineSettings();
  const saveMachine = useSaveMachineSettings();

  return (
    <div className="panel">
      <div className="settings">
        <div className="settings__col">
          <DeviceSettings />
          <Tank water={water} tankFullMm={tankFullMm} />
          {state && <Cleaning state={state} />}
          <GrinderSetup />
        </div>

        <div className="settings__col">
          {app && (
            <Group title="Decaid">
              <Row
                label="Theme"
                control={({ labelId }) => (
                  <Choice
                    labelId={labelId}
                    value={app.themeMode}
                    options={[
                      ["system", "System"],
                      ["light", "Light"],
                      ["dark", "Dark"],
                    ] as const}
                    onChange={(themeMode) => saveApp.mutate({ themeMode })}
                  />
                )}
              />
              <Row
                label="Gateway mode"
                control={({ labelId }) => (
                  <Choice
                    labelId={labelId}
                    value={app.gatewayMode}
                    options={[
                      ["disabled", "Off"],
                      ["tracking", "Tracking"],
                      ["full", "Full"],
                    ] as const}
                    onChange={(gatewayMode) => saveApp.mutate({ gatewayMode })}
                  />
                )}
              />
              <Row
                label="Keep screen awake"
                control={({ labelId }) => (
                  <Toggle labelId={labelId} on={app.keepAwake} onChange={(keepAwake) => saveApp.mutate({ keepAwake })} />
                )}
              />
              {app.scalePowerMode && (
                <Row
                  label="Scale when machine sleeps"
                  control={({ labelId }) => (
                    <Choice
                      labelId={labelId}
                      value={app.scalePowerMode ?? "disabled"}
                      options={[
                        ["disabled", "Leave on"],
                        ["displayOff", "Display off"],
                        ["disconnect", "Disconnect"],
                      ] as const}
                      onChange={(scalePowerMode) => saveApp.mutate({ scalePowerMode })}
                    />
                  )}
                />
              )}
              <Row
                label="Require scale to brew"
                control={({ labelId }) => (
                  <Toggle
                    labelId={labelId}
                    on={app.blockOnNoScale}
                    onChange={(blockOnNoScale) => saveApp.mutate({ blockOnNoScale })}
                  />
                )}
              />
              {app.blockTareDuringShot !== undefined && (
                <Row
                  label="Block tare during shot"
                  control={({ labelId }) => (
                    <Toggle
                      labelId={labelId}
                      on={Boolean(app.blockTareDuringShot)}
                      onChange={(blockTareDuringShot) => saveApp.mutate({ blockTareDuringShot })}
                    />
                  )}
                />
              )}
              <Row
                label="Stop hot water at weight"
                control={({ labelId }) => (
                  <Toggle
                    labelId={labelId}
                    on={app.stopHotWaterAtWeight}
                    onChange={(stopHotWaterAtWeight) => saveApp.mutate({ stopHotWaterAtWeight })}
                  />
                )}
              />
              {saveApp.isError && <p className="err" role="alert">Could not save Decaid settings.</p>}
            </Group>
          )}

          {machine && (
            <Group title="Machine">
              <Row
                label="Fan threshold"
                unit="°C"
                control={({ id }) => <Num id={id} value={machine.fan} onCommit={(fan) => saveMachine.mutate({ fan })} />}
              />
              <Row
                label="Full tank depth"
                unit="mm"
                control={({ id }) => (
                  <Num id={id} value={skin.tankFullMm} onCommit={(tankFullMm) => saveSkin.mutate({ tankFullMm })} />
                )}
              />
            </Group>
          )}

          <WakeSchedules />
          <CubbyUpdates />
          <SkinSwitcher />
        </div>
      </div>
    </div>
  );
}
