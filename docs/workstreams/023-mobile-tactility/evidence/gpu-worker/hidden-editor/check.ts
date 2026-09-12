import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
const root = process.cwd();
const path = 'apps/web/src/sticker-editor.tsx';
const source = await Bun.file(`${root}/${path}`).text();
const baseline = await Bun.file(`${import.meta.dir}/baseline.txt`).text();
function harness(text: string) {
  const start = text.indexOf('  const contourVisible =');
  const fallback = text.indexOf('  const { shape } = useMemo');
  const end = text.indexOf('  if (shown === null || presence <= 0)', fallback);
  assert.ok(fallback >= 0 && end > fallback);
  const fragment = text.slice(start >= 0 ? start : fallback, end);
  const execute = new Function('shown', 'presence', 'projectionVersion', 'selectedId', 'contour', 'deviceStore', 'shownEditorAtom', 'useMemo', `${fragment}\nreturn shape;`);
  let previous: readonly unknown[] | undefined, saved: unknown, pose = 0, presented: {draft: string} | null = null;
  const calls: number[] = [];
  const contour = () => { calls.push(pose); return {pose}; };
  const memo = (factory: () => unknown, deps: readonly unknown[]) => {
    if (!previous || deps.some((value, index) => !Object.is(value, previous?.[index]))) { saved = factory(); previous = deps; }
    return saved;
  };
  return { calls, render(shown: boolean, presence: number, version: number, selected: string | null = null) {
    pose = version; presented = shown ? {draft: 'retained-selection'} : null;
    return execute(presented, presence, version, selected, contour, {get: () => presented}, {}, memo) as {pose: number} | null;
  }};
}
const current = harness(source), old = harness(baseline);
for (const h of [current, old]) {
  h.render(false, 0, 0);
  h.render(true, 1, 1, 'A');
  h.render(true, .5, 2); // dismissed selection, retained positive exit
  h.render(true, .001, 3);
  h.render(true, 0, 4);
  for (let pose = 5; pose <= 24; pose++) h.render(true, 0, pose);
}
assert.deepEqual(current.calls, [1, 2, 3]);
assert.equal(old.calls.length, 24); // same source-extracted scenario reproduces baseline work
assert.deepEqual(current.render(true, .01, 24, 'A'), {pose: 24});
assert.deepEqual(current.calls, [1, 2, 3, 24]);
current.render(true, .1, 24, 'A');
assert.equal(current.calls.length, 4); // presence-only animation does not bust memo
current.render(true, 0, 25); // reduced-motion/final dismissal
assert.equal(current.calls.length, 4);
current.render(false, 0, 26);
assert.equal(current.calls.length, 4);
const suffix = '  if (shown === null || presence <= 0)';
assert.equal(source.slice(source.indexOf(suffix)), baseline.slice(baseline.indexOf(suffix))); // error/return/HUD branches unchanged
assert.equal(source.slice(0, source.indexOf('  const contourVisible =')), baseline.slice(0, baseline.indexOf('  const { shape } = useMemo'))); // all hooks, dismissal, cancellation and cleanup unchanged
const result = {baselineCommit: '902c9d1a54af93c524b53076abc037949b12176f', sourceSha256: createHash('sha256').update(source).digest('hex'), baselineContourCalls: old.calls.length, correctedBeforeReentry: 3, hiddenProjectionUpdates: 21, hiddenContourCalls: 0, reentryPose: 24, unchangedLifecycleAndReturnBranches: true, limitation: 'Executes extracted production memo with deterministic dependency semantics; not a mounted React or browser timing test.'};
await Bun.write(`${import.meta.dir}/check.json`, `${JSON.stringify(result, null, 2)}\n`);
console.log(result);
