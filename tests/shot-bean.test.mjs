import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { saveShotBean } from '../src/api/shotBean.ts';
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const selected = { beanBatchId: 'bag-real', coffeeName: 'Real coffee', coffeeRoaster: 'Roaster' };

test('reassigns testing context canonically without overwriting ratings or brew context', async () => {
  const stored = { id: 'shot-1', workflow: { context: { coffeeName: 'testing', beanBatchId: 'test', grinderSetting: '2', targetDoseWeight: 18 }, profile: { title: 'Turbo' } }, annotations: { enjoyment: 8, extras: { unknown: true } } };
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'http://fixture/shots/shot-1');
    assert.equal(init.method, 'PUT');
    const patch = JSON.parse(init.body);
    assert.deepEqual(patch, { workflow: { context: selected } });
    Object.assign(stored.workflow.context, patch.workflow.context);
    return Response.json(stored);
  };
  const result = await saveShotBean('http://fixture/shots/shot-1', 'shot-1', selected);
  assert.equal(result.workflow.context.grinderSetting, '2');
  assert.equal(result.annotations.enjoyment, 8);
  assert.deepEqual(result.annotations.extras, { unknown: true });
});
test('supports correction without a batch, clearing the old wrong bag', async () => {
  const selection = { ...selected, beanBatchId: null };
  globalThis.fetch = async (_url, init) => {
    assert.equal(JSON.parse(init.body).workflow.context.beanBatchId, null);
    return Response.json({ id: 'shot-1', workflow: { context: { coffeeName: selected.coffeeName, coffeeRoaster: selected.coffeeRoaster } } });
  };
  await saveShotBean('fixture', 'shot-1', selection);
});
test('does not report success when an older gateway ignores workflow patches', async () => {
  globalThis.fetch = async () => Response.json({ id: 'shot-1', workflow: { context: { coffeeName: 'testing' } } });
  await assert.rejects(saveShotBean('fixture', 'shot-1', selected), /did not confirm/);
});
test('surfaces gateway errors and allows a successful retry', async () => {
  globalThis.fetch = async () => new Response('', { status: 500 });
  await assert.rejects(saveShotBean('fixture', 'shot-1', selected), /gateway 500/);
  globalThis.fetch = async () => Response.json({ id: 'shot-1', workflow: { context: selected } });
  await saveShotBean('fixture', 'shot-1', selected);
});
test('does not confirm a response for a different shot', async () => {
  globalThis.fetch = async () => Response.json({ id: 'wrong-shot', workflow: { context: selected } });
  await assert.rejects(saveShotBean('fixture', 'shot-1', selected), /did not confirm/);
});
test('network failure and malformed confirmation never look like a successful save', async () => {
  globalThis.fetch = async () => { throw new Error('Network unavailable'); };
  await assert.rejects(saveShotBean('fixture', 'shot-1', selected), /Network unavailable/);
  globalThis.fetch = async () => new Response('not JSON');
  await assert.rejects(saveShotBean('fixture', 'shot-1', selected));
});
