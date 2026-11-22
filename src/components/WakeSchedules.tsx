import { useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { restUrl } from "../api/gateway";

interface WakeSchedule {
  id: string;
  time: string;
  daysOfWeek: number[];
  enabled: boolean;
}

const scheduleKey = ["wake-schedules"] as const;
const schedulePath = "/presence/schedules";
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const recurrence = { daily: [], weekdays: [1, 2, 3, 4, 5], weekends: [6, 7] };
type Recurrence = keyof typeof recurrence;
type ScheduleChange =
  | { kind: "add"; time: string; daysOfWeek: number[] }
  | { kind: "toggle"; id: string; enabled: boolean }
  | { kind: "remove"; id: string };

function describeDays(dayNumbers: number[]) {
  if (!dayNumbers.length || dayNumbers.length === 7) return "Every day";
  return dayNumbers.map((day) => days[day - 1]).join(", ");
}

export function WakeSchedules() {
  const timeId = useId();
  const daysId = useId();
  const [time, setTime] = useState("07:00");
  const [repeat, setRepeat] = useState<Recurrence>("weekdays");
  const [removing, setRemoving] = useState<string | null>(null);
  const client = useQueryClient();
  const schedules = useQuery({
    queryKey: scheduleKey,
    queryFn: async ({ signal }): Promise<WakeSchedule[]> => {
      const response = await fetch(restUrl(schedulePath), { signal });
      if (!response.ok) throw new Error(`Gateway returned ${response.status}`);
      return response.json();
    },
  });
  const change = useMutation({
    mutationFn: async (action: ScheduleChange) => {
      const path = action.kind === "add" ? schedulePath : `${schedulePath}/${encodeURIComponent(action.id)}`;
      const response = await fetch(restUrl(path), {
        method: action.kind === "add" ? "POST" : action.kind === "toggle" ? "PUT" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: action.kind === "add" ? JSON.stringify({ time: action.time, daysOfWeek: action.daysOfWeek })
          : action.kind === "toggle" ? JSON.stringify({ enabled: action.enabled }) : undefined,
      });
      if (!response.ok) throw new Error(`Gateway returned ${response.status}`);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: scheduleKey }),
  });

  return (
    <section className="group">
      <div className="group__h"><h2 className="lbl">Wake schedule</h2></div>
      {schedules.isLoading ? <p className="row__sub">Loading schedules…</p> : schedules.isError ? (
        <p className="err" role="alert">Could not load wake schedules from Decaid.</p>
      ) : (
        <>
          {schedules.data?.map((schedule) => (
            <div className="field wake-schedule__row" key={schedule.id}>
              <div className="field__label">
                <div className="wake-schedule__state">
                  <span className="row__title num">{schedule.time}</span>
                  <span className={`tag ${schedule.enabled ? "tag--on" : "tag--quiet"}`}>
                    {schedule.enabled ? "On" : "Off"}
                  </span>
                </div>
                <span className="row__sub">{describeDays(schedule.daysOfWeek)}</span>
              </div>
              <div className="toolbar__acts">
                <button type="button" className="btn btn--quiet btn--compact"
                  aria-label={`Turn ${schedule.enabled ? "off" : "on"} wake at ${schedule.time}, ${describeDays(schedule.daysOfWeek)}`}
                  disabled={change.isPending}
                  onClick={() => change.mutate({ kind: "toggle", id: schedule.id, enabled: !schedule.enabled })}>
                  {change.isPending && change.variables.kind === "toggle" && change.variables.id === schedule.id
                    ? "Saving…"
                    : schedule.enabled ? "Turn off" : "Turn on"}
                </button>
                <button type="button" className={`btn btn--compact ${removing === schedule.id ? "btn--danger" : "btn--quiet"}`}
                  disabled={change.isPending}
                  onClick={() => {
                    if (removing !== schedule.id) setRemoving(schedule.id);
                    else change.mutate({ kind: "remove", id: schedule.id }, { onSuccess: () => setRemoving(null) });
                  }}>
                  {removing === schedule.id ? "Confirm remove" : "Remove"}
                </button>
                {removing === schedule.id && (
                  <button type="button" className="btn btn--quiet btn--compact" disabled={change.isPending}
                    onClick={() => setRemoving(null)}>Cancel</button>
                )}
              </div>
            </div>
          ))}
          <form className="field wake-schedule__form" onSubmit={(event) => {
            event.preventDefault();
            if (time && !change.isPending) change.mutate({ kind: "add", time, daysOfWeek: recurrence[repeat] });
          }}>
            <label className="sr-only" htmlFor={timeId}>Wake time</label>
            <input id={timeId} className="field__in field__in--text num" type="time" required value={time}
              onChange={(event) => setTime(event.currentTarget.value)} />
            <label className="sr-only" htmlFor={daysId}>Repeat</label>
            <select id={daysId} className="field__in field__in--text" value={repeat}
              onChange={(event) => setRepeat(event.currentTarget.value as Recurrence)}>
              <option value="weekdays">Weekdays</option>
              <option value="weekends">Weekends</option>
              <option value="daily">Every day</option>
            </select>
            <button type="submit" className="btn btn--compact" disabled={!time || change.isPending}>
              {change.isPending && change.variables.kind === "add" ? "Adding…" : "Add schedule"}
            </button>
          </form>
          <p className="row__sub">Uses the Decaid device’s local time.</p>
          {change.isError && <p className="err" role="alert">Could not save the wake schedule.</p>}
        </>
      )}
    </section>
  );
}
