import assert from "node:assert/strict";
import { test } from "node:test";
import { findGhostShot, ghostMatch, ghostTrace, initialTimeSpan, matchesGhost, profileIdentity, profilePlan, targetTrace, timeSpan, yDomain } from "../src/components/shotGraph.ts";

// Decaid profile/shot wire shape; deliberately different controlled channels.
const profile = {
  title: "Sey turbo", version: "2", beverage_type: "espresso", tank_temperature: 93,
  target_volume_count_start: 1, target_weight: 40, target_volume: 0,
  steps: [
    { name: "Fill", pump: "flow", transition: "fast", seconds: 10, flow: 4, temperature: 93, sensor: "coffee", volume: 0, exit: { type: "pressure", condition: "over", value: 3 }, limiter: { value: 6, range: 1 } },
    { name: "Extract", pump: "pressure", transition: "fast", seconds: 35, pressure: 6, temperature: 93, sensor: "coffee", volume: 0 },
    { name: "Decline", pump: "pressure", transition: "smooth", seconds: 8, pressure: 3, temperature: 93, sensor: "coffee", volume: 0 },
  ],
};
const workflow = { profile, context: { beanBatchId: "bean-batch:sey-01", coffeeName: "Same Name" } };
const match = ghostMatch(workflow)!;
const before = Date.parse("2026-11-22T14:00:00Z");
const measurements = [
  { machine: { timestamp: "2026-11-22T12:00:00Z", state: { substate: "preparingForShot" }, pressure: 0, flow: 0 } },
  { machine: { timestamp: "2026-11-22T12:00:20Z", state: { substate: "preinfusion" }, pressure: 1, flow: 4 } },
  { machine: { timestamp: "2026-11-22T12:00:25Z", state: { substate: "pouring" }, pressure: 6, flow: 2 }, scale: { weightFlow: 1.8 } },
  { machine: { timestamp: "2026-11-22T12:00:45Z", state: { substate: "pouring" }, pressure: 3, flow: 2.5 } },
  { machine: { timestamp: "2026-11-22T12:00:50Z", state: { substate: "pouringDone" }, pressure: 0, flow: 0 } },
];
const shot = (id: string, minute: number, changes = {}) => ({
  id, timestamp: `2026-11-22T12:${String(minute).padStart(2, "0")}:00Z`, workflow,
  stopReason: "targetWeight", measurements, ...changes,
});

test("live horizon does not move at every 10-second boundary, expands only for overruns", () => {
  for (const t of [0, 1, 9.9, 10, 20, 30, 40, 50, 59.9, 60]) assert.equal(timeSpan(t), 60);
  assert.equal(timeSpan(60.01), 90);
  assert.equal(timeSpan(90), 90);
  assert.equal(timeSpan(90.01), 120);
});

test("conditional phase maxima do not shrink a short shot into a huge time axis", () => {
  assert.equal(initialTimeSpan(profile as never), 60);
  assert.equal(initialTimeSpan({ steps: [{ pump: "flow", flow: 3, transition: "fast", seconds: 180 }] }), 180);
  assert.equal(initialTimeSpan({ steps: [{ pump: "flow", flow: 3, transition: "fast", seconds: 999, weight: 40 }] }), 60);
});

test("y domain holds 0–12 normally but includes real higher/negative readings", () => {
  assert.deepEqual(yDomain([[{ t: 0, pressure: 9, flow: 4 }]]), { min: 0, max: 12 });
  assert.deepEqual(yDomain([[{ t: 0, pressure: 12.2, weightFlow: -0.2 }]]), { min: -2, max: 16 });
  assert.deepEqual(yDomain([[{ t: 0, pressure: NaN, flow: Infinity }]]), { min: 0, max: 12 });
});

test("plans distinguish pump goals from limiter/exit values; smooth has goal marker only", () => {
  const plan = profilePlan(profile as never);
  assert.deepEqual(plan.targets.map(({ channel, value, smooth }) => ({ channel, value, smooth })), [
    { channel: "flow", value: 4, smooth: false }, { channel: "pressure", value: 6, smooth: false }, { channel: "pressure", value: 3, smooth: true },
  ]);
  assert.equal(plan.variable, true);
  assert.equal(plan.duration, 53);
  assert.equal(profilePlan({ steps: [{ pump: "pressure", seconds: 10, pressure: 9 }] }).targets.length, 0);
});

test("unknown phase duration stops the preview rather than collapsing/skipping time", () => {
  const plan = profilePlan({ steps: [
    { pump: "flow", transition: "fast", flow: 3, seconds: 5 },
    { pump: "flow", transition: "fast", flow: 1 },
    { pump: "pressure", transition: "fast", pressure: 9, seconds: 20 },
  ] });
  assert.equal(plan.targets.length, 1);
  assert.equal(plan.duration, 5);
  assert.equal(plan.variable, true);
});

test("live phase targets follow frame, preserve zero, and do not fabricate smooth ramps", () => {
  const targets = targetTrace([
    { t: 0, profileFrame: 0, targetFlow: 4, targetPressure: 6 },
    { t: 3, profileFrame: 1 }, // early exit: phase changed before nominal 10s
    { t: 9, profileFrame: 2 }, // smooth setpoint absent, no invented 3bar plateau
    { t: 10, profileFrame: 2, targetPressure: 5 },
  ], profile as never);
  assert.equal(targets[0].targetFlow, 4);
  assert.equal(targets[0].targetPressure, undefined);
  assert.equal(targets[1].targetPressure, 6);
  assert.equal(targets[2].targetPressure, undefined);
  assert.equal(targets[3].targetPressure, 5);
  assert.equal(targetTrace([{ t: 0, profileFrame: 0, targetFlow: 0 }], { steps: [{ pump: "flow", flow: 0, transition: "fast" }] })[0].targetFlow, 0);
});

test("ghost identity requires both exact bean batch and execution-equivalent profile", () => {
  assert.equal(matchesGhost(shot("ok", 1), match, before), true);
  assert.equal(matchesGhost(shot("bean", 1, { workflow: { ...workflow, context: { beanBatchId: "other", coffeeName: "Same Name" } } }), match, before), false);
  assert.equal(matchesGhost(shot("edited", 1, { workflow: { ...workflow, profile: { ...profile, steps: [{ ...profile.steps[0], flow: 5 }, ...profile.steps.slice(1)] } } }), match, before), false);
  assert.equal(ghostMatch({ profile, context: { coffeeName: "Same Name" } }), null);
  assert.equal(profileIdentity({ title: profile.title }), null);
  assert.equal(profileIdentity({ ...profile, notes: "different note", author: "Editor" }), match.profile);
});

test("manual stops can be references, but failed, in-progress, unknown and future records cannot", () => {
  for (const stopReason of ["apiStop", "appStop"]) {
    assert.equal(matchesGhost(shot("manual", 1, { stopReason }), match, before), true);
  }
  for (const stopReason of ["error", "disconnected", "noScale", "stoppingBackstop", undefined, "futureReason"]) {
    assert.equal(matchesGhost(shot("bad", 1, { stopReason }), match, before), false);
  }
  assert.equal(matchesGhost(shot("current", 1, { timestamp: new Date(before).toISOString() }), match, before), false);
});

test("recorded trace starts at extraction, ignores preparation/done and rejects unusable data", () => {
  assert.deepEqual(ghostTrace(measurements).map((p) => p.t), [0, 5, 25]);
  assert.equal(ghostTrace([{ machine: { timestamp: "bad", state: { substate: "pouring" }, pressure: 8 } }]).length, 0);
  assert.equal(ghostTrace(measurements.map(({ machine }) => ({ machine: { ...machine, state: undefined } }))).length, 0);
  assert.equal(ghostTrace(measurements.slice(1, 2)).length, 0);
});

test("paginates past failures, deleted records and missing traces to the newest usable match", async () => {
  const offsets: number[] = [], requested: string[] = [];
  const pages = [
    [shot("failed", 59, { stopReason: "error" }), shot("deleted", 58)],
    [shot("empty", 57), shot("winner", 56), shot("older", 55)],
  ];
  const result = await findGhostShot(match, before, async (offset) => {
    offsets.push(offset); return { items: offset === 0 ? pages[0] : pages[1], total: 5 };
  }, async (id) => {
    requested.push(id);
    return id === "deleted" ? null : id === "empty" ? shot(id, 57, { measurements: [] }) : shot(id, 56);
  });
  assert.deepEqual(offsets, [0, 2]);
  assert.deepEqual(requested, ["deleted", "empty", "winner"]);
  assert.equal(result.shot?.id, "winner");
});

test("unavailable history fails explicitly; no silently older fallback on a server error", async () => {
  await assert.rejects(() => findGhostShot(match, before,
    async () => ({ items: [shot("newer", 59), shot("older", 58)], total: 2 }),
    async () => { throw new Error("503"); }), /503/);
  const result = await findGhostShot(match, before, async () => ({ items: [], total: 0 }), async () => null);
  assert.deepEqual(result, { shot: null, incomplete: false });
});

test("revalidates detail identity after a concurrent bean correction", async () => {
  const result = await findGhostShot(match, before, async () => ({ items: [shot("changed", 59)], total: 1 }),
    async () => shot("changed", 59, { workflow: { ...workflow, context: { beanBatchId: "other" } } }));
  assert.equal(result.shot, null);
});


test("a just-finished current shot cannot become its own ghost during a slow read", async () => {
  const result = await findGhostShot(match, Date.parse("2026-11-22T12:00:30Z"),
    async () => ({ items: [shot("current", 0)], total: 1 }), async () => shot("current", 0));
  assert.equal(result.shot, null);
});
