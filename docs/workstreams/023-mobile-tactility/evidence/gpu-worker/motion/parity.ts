import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { advanceDeviceOrientationRelease } from '../../../../../../packages/device/src/device-orientation-motion';
import { deviceRevealFrame } from '../../../../../../packages/device/src/device-reveal-motion';

const baseline = 'f3d738fca7806f86c31cc849c2312ce2d9de54e8';
const directory = mkdtempSync(join(tmpdir(), 'webpod-motion-parity-'));
try {
  const source = (path: string) => execFileSync('git', ['show', `${baseline}:${path}`], {encoding: 'utf8'});
  const originalMotion = source('apps/web/src/device-orientation-motion.ts').replace("'@webpod/device'", JSON.stringify(resolve('packages/device/src/orientation.ts')));
  const originalReveal = source('apps/web/src/device-reveal.ts');
  writeFileSync(join(directory, 'orientation.ts'), originalMotion);
  writeFileSync(join(directory, 'reveal.ts'), originalReveal.slice(originalReveal.indexOf('export const DEVICE_REVEAL_TIMING'), originalReveal.indexOf('/** One scene-entry owner;')));
  const previous = await import(join(directory, 'orientation.ts')) as {advanceDeviceOrientationRelease: typeof advanceDeviceOrientationRelease};
  const reveal = await import(join(directory, 'reveal.ts')) as {deviceRevealFrame: typeof deviceRevealFrame};
  let steps = 0;
  for (const kind of ['coast', 'opposite-face', 'flick-snap'] as const) {
    for (const yaw of [-721, -180, 0, 179, 721]) {
      for (const dt of [0, -0.01, NaN, Infinity, 1/120, 1/60, 0.2]) {
        const state = {kind, orientation: {pitchDeg: 12, yawDeg: yaw, rollDeg: -7}, velocity: {pitchDegPerSecond: 50, yawDegPerSecond: 900, rollDegPerSecond: -22}, targetYawDeg: yaw + 180, flickDirection: 1 as const};
        assert.deepEqual(advanceDeviceOrientationRelease(state, dt), previous.advanceDeviceOrientationRelease(state, dt)); steps++;
      }
    }
  }
  const times = [-1, 0, 1, 439, 440, 441, 1450, 1599, 1600, 1601, 1899, 1900, 1901, 2299, 2300, 2720, 2800, 3460, 5000];
  for (const time of times) assert.deepEqual(deviceRevealFrame(time), reveal.deviceRevealFrame(time));
  console.log(JSON.stringify({baseline, orientationSingleStepCases: steps, revealCurveBoundaryCases: times.length, exact: true,
    scope: 'Extracted equations only; driver, clocks, cancellation, controls and live integration have separate evidence.'}, null, 2));
} finally { rmSync(directory, {recursive: true, force: true}); }
