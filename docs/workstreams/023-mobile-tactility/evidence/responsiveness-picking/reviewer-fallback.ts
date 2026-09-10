import { deepStrictEqual } from 'node:assert/strict';
import { BoxGeometry, Mesh, MeshBasicMaterial, Raycaster, Vector3, type Intersection } from '../../../../../packages/device/node_modules/three';
import { buildShellPickingIndex } from '../../../../../packages/device/src/shell-picking-index';
import { createIndexedShellRaycast, createShellPicking } from '../../../../../packages/device/src/shell-picking';
const geometry = new BoxGeometry(10, 20, 5), material = new MeshBasicMaterial();
const mesh = new Mesh(geometry, material); mesh.updateMatrixWorld();
const position = geometry.getAttribute('position');
const index = buildShellPickingIndex({ positions: Float32Array.from(position.array), indices: geometry.index ? Uint32Array.from(geometry.index.array) : null });
const prepared = createIndexedShellRaycast(geometry, index);
const ray = new Raycaster(new Vector3(0, 0, 30), new Vector3(0, 0, -1), 1, 100);
const check = (pick: Mesh['raycast']) => {
  const expected: Intersection[] = [], actual: Intersection[] = [];
  Mesh.prototype.raycast.call(mesh, ray, expected); pick.call(mesh, ray, actual);
  deepStrictEqual(actual.map(hit => hit.object === mesh), expected.map(hit => hit.object === mesh));
  deepStrictEqual(JSON.stringify(actual, (key, value) => key === 'object' ? undefined : value), JSON.stringify(expected, (key, value) => key === 'object' ? undefined : value));
};
check(prepared.raycast);
geometry.setDrawRange(0, 6); check(prepared.raycast); geometry.setDrawRange(0, Infinity);
const grouped = new Mesh(geometry, [material, material, material, material, material, material]); grouped.updateMatrixWorld();
const e: Intersection[] = [], a: Intersection[] = [];
Mesh.prototype.raycast.call(grouped, ray, e); prepared.raycast.call(grouped, ray, a); deepStrictEqual(a.map(hit => hit.object === grouped), e.map(hit => hit.object === grouped)); deepStrictEqual(JSON.stringify(a, (key, value) => key === 'object' ? undefined : value), JSON.stringify(e, (key, value) => key === 'object' ? undefined : value));
position.setZ(0, position.getZ(0) + 1); position.needsUpdate = true; geometry.computeBoundingSphere(); check(prepared.raycast);
deepStrictEqual(prepared.current(), false);
const pending = createShellPicking(); check(pending.raycast);
const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
Object.defineProperty(globalThis, 'Worker', { configurable: true, value: class { constructor() { throw new Error('Unavailable'); } } });
try { const cancel = pending.prepare(geometry); await new Promise(resolve => setTimeout(resolve, 0)); check(pending.raycast); cancel(); check(pending.raycast); }
finally { if (descriptor) Object.defineProperty(globalThis, 'Worker', descriptor); else Reflect.deleteProperty(globalThis, 'Worker'); }
prepared.dispose(); geometry.dispose(); material.dispose();
console.log(JSON.stringify({ exactReady: true, partialDrawRange: true, materialGroups: true, changedPositionVersion: true, pending: true, failedWorker: true, disposed: true }));
