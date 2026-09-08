import { expect, test } from 'bun:test';
import type { ComputeFunction, RootState } from '@react-three/fiber';
import { PerspectiveCamera, Raycaster, Vector2 } from 'three';
import { computeCanvasPointer } from './canvas-events';

function fixture() {
  const rect = { left: 0, top: 0, width: 1280, height: 900 };
  const camera = new PerspectiveCamera(30, 1280 / 900, .1, 4000);
  camera.position.z = 1160;
  camera.updateMatrixWorld(true);
  const state = {
    camera, pointer: new Vector2(), raycaster: new Raycaster(),
    gl: { domElement: { closest: () => null, getBoundingClientRect: () => rect } },
  } as unknown as RootState;
  const compute = (clientX: number, clientY: number, offsetX = clientX, offsetY = clientY) =>
    computeCanvasPointer({ clientX, clientY, offsetX, offsetY } as Parameters<ComputeFunction>[0], state);
  return { rect, state, compute };
}

test('composited descendant offsets do not change the actual canvas ray', () => {
  const { state, compute } = fixture();
  compute(567.0681229844442, 147.83122958236646);
  const ray = state.raycaster.ray.clone();
  compute(567.0681229844442, 147.83122958236646, 151.0838, 8.6893);
  expect(state.raycaster.ray.equals(ray)).toBe(true);
  expect(state.pointer.x).toBeCloseTo(-.1139560578, 8);
  expect(state.pointer.y).toBeCloseTo(.6714861565, 8);
});

test('native rotation capture skips shell picking only for its owned movement', () => {
  const { state } = fixture();
  const owner = { dataset: { orientationPointerId: '7' } };
  Object.assign(state.gl.domElement, { closest: () => owner });
  const compute = (type: string, pointerId: number) => computeCanvasPointer({ type, pointerId, clientX: 640, clientY: 450 } as Parameters<ComputeFunction>[0], state);
  compute('pointermove', 7);
  expect(state.raycaster.camera).toBeNull();
  compute('pointermove', 8);
  expect(state.raycaster.camera).toBe(state.camera);
  compute('pointerdown', 7);
  expect(state.raycaster.camera).toBe(state.camera);
  Object.assign(state.gl.domElement, { closest: () => null });
  compute('pointermove', 7);
  expect(state.raycaster.camera).toBe(state.camera);
});

test('viewport-relative rect handles translation, scroll and axis-aligned CSS scaling', () => {
  const { rect, state, compute } = fixture();
  compute(320, 225);
  const ray = state.raycaster.ray.clone();
  Object.assign(rect, { left: 125, top: -70, width: 640, height: 450 });
  compute(285, 42.5, 999, 999);
  expect(state.raycaster.ray.equals(ray)).toBe(true);
  expect(state.pointer.toArray()).toEqual([-.5, .5]);
  compute(124, -71);
  expect(state.pointer.x).toBeLessThan(-1);
  expect(state.pointer.y).toBeGreaterThan(1);
});

test('invalid rectangles or client coordinates cannot reuse the preceding valid ray', () => {
  const { rect, state, compute } = fixture();
  for (const invalid of [
    { width: 0 }, { height: -1 }, { left: Number.NaN }, { top: Infinity },
    { width: Infinity }, { height: Number.NaN },
  ]) {
    Object.assign(rect, { left: 0, top: 0, width: 1280, height: 900 });
    compute(640, 450);
    expect(state.raycaster.camera).toBe(state.camera);
    Object.assign(rect, invalid);
    compute(640, 450);
    expect(state.raycaster.camera).toBeNull();
    expect(Number.isNaN(state.raycaster.ray.direction.z)).toBe(true);
  }
  Object.assign(rect, { left: 0, top: 0, width: 1280, height: 900 });
  compute(Infinity, 450);
  expect(state.raycaster.camera).toBeNull();
  compute(640, 450);
  expect(state.raycaster.camera).toBe(state.camera);
  expect(state.pointer.toArray()).toEqual([0, 0]);
});
