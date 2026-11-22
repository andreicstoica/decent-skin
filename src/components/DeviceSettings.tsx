import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { restUrl } from "../api/gateway";
import { useDecaidSettings, useSaveDecaidSettings } from "../api/useDecaidSettings";

interface Device {
  id: string;
  name: string;
  type: "machine" | "scale" | "sensor" | "grinder";
  state: "discovered" | "connecting" | "connected" | "disconnecting" | "disconnected";
  available: boolean;
  connectionRole?: "primary" | "auxiliary";
}

const devicesKey = ["devices"] as const;

export function DeviceSettings() {
  const client = useQueryClient();
  const settings = useDecaidSettings();
  const save = useSaveDecaidSettings();
  const devices = useQuery({
    queryKey: devicesKey,
    queryFn: async ({ signal }): Promise<Device[]> => {
      const response = await fetch(restUrl("/devices"), { signal });
      if (!response.ok) throw new Error(`Gateway returned ${response.status}`);
      return response.json();
    },
    refetchInterval: 5_000,
  });
  const action = useMutation({
    mutationFn: async (deviceId: string | null) => {
      const response = deviceId === null
        ? await fetch(restUrl("/devices/scan?connect=false"))
        : await fetch(restUrl("/devices/connect"), {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deviceId }),
          });
      if (!response.ok) throw new Error(`Gateway returned ${response.status}`);
    },
    onSettled: () => client.invalidateQueries({ queryKey: devicesKey }),
  });
  const inventory = devices.data?.filter(({ type }) => type === "machine" || type === "scale") ?? [];
  const busy = action.isPending || save.isPending;

  return (
    <section className="group">
      <div className="group__h group__h--row">
        <h2 className="lbl">Devices</h2>
        <button type="button" className="btn btn--quiet btn--compact" disabled={busy} onClick={() => action.mutate(null)}>
          {action.isPending && action.variables === null ? "Scanning…" : "Scan"}
        </button>
      </div>
      {devices.isError && <p className="err" role="alert">Could not load devices from Decaid.</p>}
      {action.isError && <p className="err" role="alert">{action.variables === null ? "Device scan failed." : "Could not connect to the device."}</p>}
      {save.isError && <p className="err" role="alert">Could not save the preferred device.</p>}
      {devices.isLoading && <p className="row__sub">Checking devices…</p>}
      {devices.isSuccess && !inventory.length && <p className="row__sub">No machines or scales found. Tap Scan to look nearby.</p>}
      {inventory.map((device) => {
        const preferredKey = device.type === "machine" ? "preferredMachineId" : "preferredScaleId";
        const preferred = settings.data?.[preferredKey] === device.id;
        const connected = device.state === "connected";
        const occupied = inventory.some((other) => other.type === device.type &&
          other.state === "connected" && other.connectionRole !== "auxiliary");
        const connecting = action.isPending && action.variables === device.id;
        const transitioning = device.state === "connecting" || device.state === "disconnecting";
        return (
          <div className="field" key={device.id}>
            <div className="field__label">
              <span className="row__title">{device.name || (device.type === "machine" ? "Decent machine" : "Scale")}</span>
              <span className="row__sub">
                {device.type === "machine" ? "Machine" : device.connectionRole === "auxiliary" ? "Auxiliary scale" : "Scale"}
                {" · "}{connecting ? "Connecting…" : connected ? "Connected" : transitioning ? device.state : device.available ? "Nearby" : "Not nearby"}
              </span>
            </div>
            <div className="toolbar__acts">
              {settings.data && device.connectionRole !== "auxiliary" && (
                <button type="button" className={`btn btn--compact ${preferred ? "" : "btn--quiet"}`}
                  aria-label={`Prefer ${device.name || device.type}`} aria-pressed={preferred} disabled={busy}
                  onClick={() => save.mutate({ [preferredKey]: preferred ? null : device.id })}>
                  {preferred ? "Preferred" : "Prefer"}
                </button>
              )}
              {!connected && device.available && !occupied && (
                <button type="button" className="btn btn--quiet btn--compact" disabled={busy || transitioning}
                  aria-label={`Connect ${device.name || device.type}`} onClick={() => action.mutate(device.id)}>
                  Connect
                </button>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
