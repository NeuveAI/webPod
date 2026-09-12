import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Group } from '../../../../../../packages/device/node_modules/three/build/three.module.js';
import { advanceDeviceMotion } from '../../../../../../packages/device/src/device-motion-runtime';
import type { RenderMotionProgram } from '../../../../../../packages/device/src/device-render-protocol';
import type { ControlPhysicsController, ControlPhysicsDependencies } from '../../../../../../packages/device/src/control-physics';

const baseline = 'f3d738fca7806f86c31cc849c2312ce2d9de54e8';
const directory = mkdtempSync(join(tmpdir(), 'webpod-control-parity-'));
try {
  let source = execFileSync('git', ['show', `${baseline}:packages/device/src/control-physics.ts`], {encoding: 'utf8'});
  source = source.replace(/(['"])(\.\/[^'"]+)\1/g, (_match: string, _quote: string, path: string) => JSON.stringify(resolve('packages/device/src', path)));
  source = source.replace(/from "three"/, `from ${JSON.stringify(resolve('packages/device/node_modules/three/build/three.module.js'))}`);
  writeFileSync(join(directory, 'reference.ts'), source);
  const reference = await import(join(directory, 'reference.ts')) as {ControlPhysicsController: new (deps: ControlPhysicsDependencies) => ControlPhysicsController; CONTROL_TRAVEL: {wheelModel: number; selectModel: number}};
  let comparisons = 0;
  for (const channel of ['wheel', 'select'] as const) {
    for (const angle of [0, 33, 90, 180, 275]) {
      const object = new Group(); object.position.set(3, -7, 2); object.rotation.set(0.17, -0.2, 0.4); object.scale.set(1.1, 0.9, 1.3); object.updateMatrix();
      const restPosition = object.position.toArray(), restQuaternion = object.quaternion.toArray(), restScale = object.scale.toArray(), restMatrix = object.matrix.toArray();
      let callback: FrameRequestCallback | null = null;
      const controller = new reference.ControlPhysicsController({now: () => 1000, invalidate() {}, requestFrame(next) {callback = next; return 1;}, cancelFrame() {callback = null;}});
      let program: RenderMotionProgram | null = {kind: 'control-release', channel, nodeId: channel, origin: {commandSequence: 1, motionEpoch: 1},
        restPosition, restQuaternion, restScale, restMatrix, contactAngleDeg: angle, initialDepth: reference.CONTROL_TRAVEL[channel === 'wheel' ? 'wheelModel' : 'selectModel'], durationMs: channel === 'wheel' ? 120 : 96,
        startedAtTimestampMs: 1000, lastTimestampMs: 1000, stalledFrames: 0};
      if (channel === 'wheel') {controller.attachWheel(object); controller.pressWheel(angle); controller.releaseWheel();}
      else {controller.attachSelect(object); controller.pressSelect(); controller.releaseSelect();}
      for (const timestamp of [1000, 1008, 1020, 1010, NaN, 1040, 1080, 1120]) {
        if (!program) break;
        const step = advanceDeviceMotion(program, timestamp); program = step.program;
        const current = callback; callback = null;
        if (current) (current as FrameRequestCallback)(timestamp);
        assert(step.control); assert.deepEqual(step.control.matrix, object.matrix.toArray()); comparisons++;
      }
      controller.dispose();
    }
  }
  console.log(JSON.stringify({baseline, exactMatrixComparisons: comparisons, transformedRest: true, timestampRollbackAndNaN: true, scope: 'Original controller versus shared worker step; no GPU timing claim.'}, null, 2));
} finally {rmSync(directory, {recursive: true, force: true});}
