import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeFlushId, editFlushPreset, parseFlushPresets, isFlushValues } from '../src/api/flushPresets.ts';

test('editing Quick retains Quick and reload restores all edited values', () => {
  const initial = parseFlushPresets(null);
  const edited = editFlushPreset(initial, 'quick', initial.quick, { duration: 7, flow: 7.5, targetTemperature: 92 });
  const reloaded = parseFlushPresets(JSON.parse(JSON.stringify(edited)));
  assert.equal(activeFlushId(reloaded, reloaded.quick), 'quick');
  assert.deepEqual(reloaded.quick, { duration: 7, flow: 7.5, targetTemperature: 92 });
  assert.deepEqual(reloaded.standard, initial.standard);
});
test('editing Standard remains distinct from Quick', () => {
  const initial = parseFlushPresets(null);
  const edited = editFlushPreset(initial, 'standard', initial.standard, { duration: 20 });
  assert.equal(activeFlushId(edited, edited.standard), 'standard');
  assert.equal(edited.quick.duration, 5);
});
test('explicit Custom survives reload and matching a named preset', () => {
  const initial = parseFlushPresets(null);
  const edited = editFlushPreset(initial, 'custom', initial.quick, {});
  const reloaded = parseFlushPresets(JSON.parse(JSON.stringify(edited)));
  assert.equal(activeFlushId(reloaded, initial.quick), 'custom');
});
test('external workflow differences show Custom, never a mismatched saved preset', () => {
  const saved = { ...parseFlushPresets(null), activeId: 'quick' as const };
  assert.equal(activeFlushId(saved, { ...saved.quick, flow: 9 }), 'custom');
});
test('uninitialized store infers a matching default without applying settings', () => {
  const saved = parseFlushPresets(null);
  assert.equal(activeFlushId(saved, saved.quick), 'quick');
  assert.equal(activeFlushId(saved, saved.standard), 'standard');
  assert.equal(activeFlushId(saved, undefined), 'custom');
});
test('malformed storage cannot introduce unsafe settings', () => {
  const saved = parseFlushPresets({ activeId: 'bad', quick: { duration: -1 }, standard: { targetTemperature: 1000, duration: 5, flow: 6 }, custom: { targetTemperature: 90, duration: NaN, flow: 6 } });
  assert.equal(saved.activeId, null);
  assert.equal(saved.quick.duration, 5);
  assert.equal(saved.standard.targetTemperature, 90);
  assert.equal(saved.custom, null);
  assert.equal(isFlushValues({ targetTemperature: 90, duration: 61, flow: 6 }), false);
  assert.throws(() => editFlushPreset(saved, 'quick', saved.quick, { flow: Infinity }));
});
