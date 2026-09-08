import { expect, test } from 'bun:test';
import { BufferGeometry, Float32BufferAttribute, Matrix4, PerspectiveCamera, Vector3 } from 'three';
import { constrainStickerCarryExterior, constrainStickerCarryContacts, constrainStickerFreeCarry, createStickerGrabPeelGeometry, stickerGrabPeelRegion, createStickerFreeCarryGeometry, stickerGeometryUvPoint, interpolateStickerCarryGeometry, stickerCarryPointerOffset } from './sticker-free-carry';
import { createRearStickerPeelGeometry, createStickerSurfaceGeometry, STICKER_SURFACE } from './sticker-surface';

test('bounded contact keeps attached nodes exact and slides a moving node along its first exterior plane', () => {
  const source = new BufferGeometry(); source.setAttribute('position', new Float32BufferAttribute([0, 0, .18, 0, 0, 1], 3));
  const shown = source.clone(); shown.getAttribute('position').setXYZ(1, 2, 0, -1);
  const world = new Matrix4().makeRotationY(.7); world.setPosition(10, 20, 30); shown.applyMatrix4(world);
  const attached = [...shown.getAttribute('position').array].slice(0, 3);
  const result = constrainStickerCarryContacts(source, shown, world, (a, b) => {
    if (b.z >= 0 || a.z <= 0) return null;
    const point = a.clone().lerp(b, a.z / (a.z - b.z));
    return { point, normal: new Vector3(0, 0, -1), distance: a.distanceTo(point), source: 'plane', kind: 'surface' };
  });
  expect([...shown.getAttribute('position').array].slice(0, 3)).toEqual(attached);
  const point = new Vector3().fromBufferAttribute(shown.getAttribute('position'), 1).applyMatrix4(world.clone().invert());
  expect(point.x).toBeCloseTo(2, 5); expect(point.z).toBeCloseTo(.18, 5);
  expect(result.contacts).toBe(1); expect(result.unresolved).toBe(0); expect(result.queries).toBeLessThanOrEqual(6);
  shown.dispose(); source.dispose();
});

test('free sheet restores full original material rows and anchors the exact continuous picked UV', () => {
  const art = { id: 'test', url: '', width: 100, height: 180, visibleBounds: [0, 0, 100, 180] as const }, placement = { stickerId: 'test', surface: 'back' as const, x: .5, y: .5, width: .2, rotationDeg: 23 };
  const rear = new BufferGeometry(), source = createStickerSurfaceGeometry(art, placement, rear), world = new Matrix4().makeRotationY(.7); world.setPosition(23, -11, 7);
  const camera = new PerspectiveCamera(40, 1.4, 1, 3000); camera.position.set(0, 0, -1000); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const picked = stickerGeometryUvPoint(source, .273, .618), anchor = { uv: [.273, .618] as const, point: picked.toArray() as [number, number, number], tangentU: [-1, 0, 0] as const }, expected = picked.clone().applyMatrix4(world);
  const n = STICKER_SURFACE.segments;
  for (const curl of [0, .4, 1]) {
    const free = createStickerFreeCarryGeometry(art, placement, source, world, camera, anchor, curl), p = free.getAttribute('position');
    expect(stickerGeometryUvPoint(free, ...anchor.uv).distanceTo(expected)).toBeLessThan(2e-5);
    expect([...free.getAttribute('uv').array]).toEqual([...source.getAttribute('uv').array]); expect(free.index?.array).toEqual(source.index?.array);
    for (let row = 0; row <= n; row++) {
      let length = 0;
      for (let col = 0; col < n; col++) {
        const a = new Vector3().fromBufferAttribute(p, row * (n + 1) + col), b = new Vector3().fromBufferAttribute(p, row * (n + 1) + col + 1);
        length += a.distanceTo(b);
      }
      expect(length).toBeGreaterThan(66 * .999); expect(length).toBeLessThan(66 * 1.001);
    }
    for (let row = 0; row < n; row++) {
      const a = new Vector3().fromBufferAttribute(p, row * (n + 1)), b = new Vector3().fromBufferAttribute(p, (row + 1) * (n + 1));
      expect(a.distanceTo(b)).toBeGreaterThan(66 * 1.8 / n * .999); expect(a.distanceTo(b)).toBeLessThan(66 * 1.8 / n * 1.001);
    }
    free.dispose();
  }
  // Existing partial peel is unchanged, including every attached row and last vertex.
  const partial = createRearStickerPeelGeometry(art, placement, rear, .5, source, .625);
  for (let i = 60 * (n + 1); i < source.getAttribute('position').count; i++) for (let c = 0; c < 3; c++) expect(partial.getAttribute('position').array[i * 3 + c]).toBe(source.getAttribute('position').array[i * 3 + c]);
  partial.dispose(); source.dispose(); rear.dispose();
});


test('proper-frame carry transition keeps exact endpoints, reversible samples and displayed anchor offset', () => {
  const art = { id: 'test', url: '', width: 100, height: 180, visibleBounds: [0, 0, 100, 180] as const }, placement = { stickerId: 'test', surface: 'back' as const, x: .5, y: .5, width: .2, rotationDeg: 0 };
  const rear = new BufferGeometry(), source = createStickerSurfaceGeometry(art, placement, rear), world = new Matrix4().makeRotationY(2.5);
  const camera = new PerspectiveCamera(40, 1.4, 1, 3000); camera.position.set(0, 0, -1000); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const uv = [.273, .618] as const, point = stickerGeometryUvPoint(source, ...uv), anchor = { uv, point: point.toArray() as [number, number, number], tangentU: [-1, 0, 0] as const };
  const start = createRearStickerPeelGeometry(art, placement, rear, 1, source, 1); start.applyMatrix4(world);
  const free = createStickerFreeCarryGeometry(art, placement, source, world, camera, anchor, 1), prior = new Map<number, Float32Array>();
  for (const t of [0, .5, 1, .5, 0]) {
    const shown = start.clone(); interpolateStickerCarryGeometry(shown, free, ...uv, t); const p = shown.getAttribute('position');
    expect([...p.array].every(Number.isFinite)).toBe(true);
    if (t === 0) expect(p.array).toEqual(start.getAttribute('position').array);
    if (t === 1) expect(p.array).toEqual(free.getAttribute('position').array);
    const previous = prior.get(t); if (previous) expect(p.array).toEqual(previous); else prior.set(t, new Float32Array(p.array));
    shown.dispose();
  }
  const at = point.clone().applyMatrix4(world), before = at.clone().project(camera), delta = stickerCarryPointerOffset(at, camera, 840, 600, 81, 123), after = at.clone().add(delta).project(camera);
  expect((after.x - before.x) * 420).toBeCloseTo(81, 8); expect((before.y - after.y) * 300).toBeCloseTo(123, 8);
  source.dispose(); start.dispose(); free.dispose(); rear.dispose();
});

test('tilted large-sticker peels cannot sweep through the steel while adhesive contacts stay fixed', async () => {
  const { Euler } = await import('three');
  const { getSticker } = await import('@webpod/stickers');
  const { createRearShellGeometry } = await import('./product-shell');
  const { createStickerRearChart } = await import('./sticker-rear-chart');
  const { createStickerCollision } = await import('./sticker-collision');
  const { createStickerGrabPeelGeometry } = await import('./sticker-free-carry');
  const { DEVICE_LAYOUT } = await import('./layout');
  const { DEFAULT_DEVICE_FORM } = await import('./form');
  const art = getSticker('PW-B01'); if (!art) throw new Error('Missing artwork');
  const rear = createRearShellGeometry({ ...DEVICE_LAYOUT.body, frontThickness: DEFAULT_DEVICE_FORM.frontThickness, rearCrownInset: DEFAULT_DEVICE_FORM.rearCrownInset });
  const collider = createStickerCollision([{ geometry: rear, source: 'steel', kind: 'surface' }]);
  const placement = { stickerId: art.id, surface: 'back' as const, x: .5, y: .35, width: .92, rotationDeg: 0 };
  const source = createStickerSurfaceGeometry(art, placement, rear, createStickerRearChart(DEFAULT_DEVICE_FORM));
  const camera = new PerspectiveCamera(40, 1.4, 1, 3000); camera.position.set(0, 0, 1000); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const uv = [.65, .9] as const, point = stickerGeometryUvPoint(source, ...uv), anchor = { uv, point: point.toArray() as [number, number, number], tangentU: [-1, 0, 0] as const };
  let prevented = 0;
  for (const yaw of [120, 180, 240]) for (const pitch of [-30, -9.55, 30]) for (const pull of [{ x: 120, y: 150 }, { x: -100, y: -180 }]) for (const mode of ['grab', 'scripted'] as const) {
    const world = new Matrix4().makeRotationFromEuler(new Euler(pitch * Math.PI / 180, yaw * Math.PI / 180, .2));
    const shown = mode === 'grab' ? createStickerGrabPeelGeometry(source, art, placement, anchor, world, camera, .7, pull, 800, 900) : createRearStickerPeelGeometry(art, placement, rear, .7, source);
    if (mode === 'scripted') {
      shown.applyMatrix4(world);
      const free = createStickerFreeCarryGeometry(art, placement, source, world, camera, null, .7);
      interpolateStickerCarryGeometry(shown, free, ...uv, .5); free.dispose();
    }
    const before = new Float32Array(shown.getAttribute('position').array);
    const result = constrainStickerCarryExterior(source, shown, world);
    expect(result.queries).toBe(0); prevented += result.contacts;
    const inverse = world.clone().invert(), p = shown.getAttribute('position'), s = source.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const start = new Vector3().fromBufferAttribute(s, i), end = new Vector3().fromBufferAttribute(p, i).applyMatrix4(inverse);
      expect(collider.castSegment(start, end)).toBeNull();
      const originalWorld = start.applyMatrix4(world);
      if (originalWorld.distanceTo(new Vector3().fromArray(before, i * 3)) < 1e-4) {
        expect([p.getX(i), p.getY(i), p.getZ(i)]).toEqual(Array.from(before.subarray(i * 3, i * 3 + 3)));
      }
    }
    const ids = shown.index;
    if (!ids) throw new Error('Missing topology');
    let overlaps = 0;
    for (let i = 0; i < ids.count; i += 3) {
      const a = new Vector3().fromBufferAttribute(p, ids.getX(i)).applyMatrix4(inverse);
      const b = new Vector3().fromBufferAttribute(p, ids.getX(i + 1)).applyMatrix4(inverse);
      const c = new Vector3().fromBufferAttribute(p, ids.getX(i + 2)).applyMatrix4(inverse);
      if (b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() > 1e-12 && collider.intersectsTriangle(a, b, c)) overlaps++;
    }
    expect(overlaps).toBe(0);
    shown.dispose();
  }
  expect(prevented).toBeGreaterThan(0);
  collider.dispose(); source.dispose(); rear.dispose();
});

test('detached transport releases wrapped-edge constraints and retains the free sheet exactly', async () => {
  const { getSticker } = await import('@webpod/stickers');
  const { createStickerRearChart } = await import('./sticker-rear-chart');
  const { DEFAULT_DEVICE_FORM } = await import('./form');
  const art = getSticker('PW-B01'); if (!art) throw new Error('Missing artwork');
  const placement = { stickerId: art.id, surface: 'back' as const, x: .75, y: .35, width: .92, rotationDeg: 0 };
  const rear = new BufferGeometry(), world = new Matrix4().makeRotationY(Math.PI);
  const source = createStickerSurfaceGeometry(art, placement, rear, createStickerRearChart(DEFAULT_DEVICE_FORM));
  const camera = new PerspectiveCamera(40, 1.4, 1, 3000); camera.position.set(0, 0, 1000); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const free = createStickerFreeCarryGeometry(art, placement, source, world, camera, null, .3);
  free.translate(-300, -200, 80);
  const peeled = createRearStickerPeelGeometry(art, placement, rear, 1, source); peeled.applyMatrix4(world);
  constrainStickerCarryExterior(source, peeled, world);
  interpolateStickerCarryGeometry(peeled, free, .5, .5, 1);
  expect(peeled.getAttribute('position').array).toEqual(free.getAttribute('position').array);
  // The old post-transport constraint corrupts this exact edge-crossing case.
  const tethered = free.clone();
  expect(constrainStickerCarryExterior(source, tethered, world).contacts).toBeGreaterThan(0);
  expect(tethered.getAttribute('position').array).not.toEqual(free.getAttribute('position').array);
  tethered.dispose(); peeled.dispose(); free.dispose(); source.dispose(); rear.dispose();
});

test('final free carry clears steel after transport without changing screen position or tethering clear vertices', async () => {
  const { createRearShellGeometry } = await import('./product-shell');
  const { createStickerCollision } = await import('./sticker-collision');
  const { DEVICE_LAYOUT } = await import('./layout');
  const { DEFAULT_DEVICE_FORM } = await import('./form');
  const rear = createRearShellGeometry({ ...DEVICE_LAYOUT.body, frontThickness: DEFAULT_DEVICE_FORM.frontThickness, rearCrownInset: DEFAULT_DEVICE_FORM.rearCrownInset });
  const collider = createStickerCollision([{ geometry: rear, source: 'steel', kind: 'surface' }]);
  const world = new Matrix4().makeRotationY(Math.PI - .2), inverse = world.clone().invert();
  const camera = new PerspectiveCamera(40, 1.4, 1, 3000); camera.position.set(0, 0, 1000); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const eye = camera.getWorldPosition(new Vector3()).applyMatrix4(inverse);
  const geometry = new BufferGeometry();
  // Center inside the backplate, a point behind it, and a detached point beyond its edge.
  geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 30, 20, 5, 350, 0, 0], 3)); geometry.applyMatrix4(world);
  const before = new Float32Array(geometry.getAttribute('position').array);
  expect(collider.castSegment(eye, new Vector3())).not.toBeNull();
  constrainStickerFreeCarry(geometry, world, camera, collider.castSegment);
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const point = new Vector3().fromBufferAttribute(positions, i);
    expect(collider.castSegment(eye, point.clone().applyMatrix4(inverse))).toBeNull();
    const projected = point.project(camera), original = new Vector3().fromArray(before, i * 3).project(camera);
    expect(projected.x).toBeCloseTo(original.x, 6); expect(projected.y).toBeCloseTo(original.y, 6);
  }
  expect(Array.from(positions.array).slice(6)).toEqual(Array.from(before).slice(6));
  geometry.dispose(); collider.dispose(); rear.dispose();
});

test('landing resolves the displayed blend against the destination and preserves the fully seated endpoint', () => {
  const art = { id: 'test', url: '', width: 100, height: 180, visibleBounds: [0, 0, 100, 180] as const };
  const placement = { stickerId: art.id, surface: 'back' as const, x: .5, y: .5, width: .2, rotationDeg: 0 };
  const rear = new BufferGeometry(), seated = createStickerSurfaceGeometry(art, placement, rear), world = new Matrix4().makeRotationY(2.8);
  const inverse = world.clone().invert(), start = seated.getAttribute('position'), normal = seated.getAttribute('normal');
  for (const landing of [.1, .5, .9, 1]) {
    const shown = seated.clone(), positions = shown.getAttribute('position');
    for (let i = 0; i < positions.count; i++) positions.setZ(i, positions.getZ(i) + 30 * (1 - landing));
    shown.applyMatrix4(world);
    const before = new Float32Array(positions.array);
    const report = constrainStickerCarryExterior(seated, shown, world);
    if (landing < 1) expect(report.contacts).toBeGreaterThan(0);
    else expect(positions.array).toEqual(before);
    for (let i = 0; i < positions.count; i++) {
      const delta = new Vector3().fromBufferAttribute(positions, i).applyMatrix4(inverse).sub(new Vector3().fromBufferAttribute(start, i));
      expect(delta.dot(new Vector3().fromBufferAttribute(normal, i))).toBeGreaterThan(-1e-4);
    }
    shown.dispose();
  }
  seated.dispose(); rear.dispose();
});

test('grabbed edges bend without stretching material and leave the adhesive beyond the crease fixed', () => {
  const art = { id: 'test', url: '', width: 100, height: 100, visibleBounds: [0, 0, 100, 100] as const };
  const placement = { stickerId: art.id, surface: 'back' as const, x: .5, y: .5, width: .2, rotationDeg: 0 };
  const rear = new BufferGeometry(), source = createStickerSurfaceGeometry(art, placement, rear), world = new Matrix4();
  const camera = new PerspectiveCamera(40, 1, 1, 3000); camera.position.set(0, 0, -1000); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const n = STICKER_SURFACE.segments, original = source.getAttribute('position');
  for (const uv of [[.5, .95], [.95, .5], [.5, .05], [.05, .5]] as const) {
    const anchor = { uv, point: stickerGeometryUvPoint(source, uv[0], uv[1]).toArray() as [number, number, number], tangentU: [-1, 0, 0] as const };
    const region = stickerGrabPeelRegion(art, placement, anchor);
    for (const q of [.001, .25, .7, 1]) {
      const shown = createStickerGrabPeelGeometry(source, art, placement, anchor, world, camera, q, { x: 50, y: 40 }, 800, 800), p = shown.getAttribute('position');
      let raised = 0;
      for (let row = 0; row <= n; row++) for (let col = 0; col <= n; col++) {
        const i = row * (n + 1) + col;
        if (region.coordinate(col / n, row / n) >= region.start + q * (1 - region.start)) {
          expect([p.getX(i), p.getY(i), p.getZ(i)]).toEqual([original.getX(i), original.getY(i), original.getZ(i)]);
        }
        raised = Math.max(raised, original.getZ(i) - p.getZ(i));
        for (const j of [col < n ? i + 1 : -1, row < n ? i + n + 1 : -1]) {
          if (j < 0) continue;
          const before = new Vector3().fromBufferAttribute(original, i).distanceTo(new Vector3().fromBufferAttribute(original, j));
          const after = new Vector3().fromBufferAttribute(p, i).distanceTo(new Vector3().fromBufferAttribute(p, j));
          expect(Math.abs(after / before - 1)).toBeLessThan(.002);
        }
      }
      if (q >= .25) expect(raised).toBeGreaterThan(1);
      shown.dispose();
    }
  }
  source.dispose(); rear.dispose();
});

test('detach preserves the peeled material origin and landing returns exactly to an edge seat', async () => {
  const { alignStickerCarryOrigin, createStickerLandingGeometry } = await import('./sticker-free-carry');
  const { createStickerRearChart } = await import('./sticker-rear-chart');
  const { DEFAULT_DEVICE_FORM } = await import('./form');
  const art = { id: 'test', url: '', width: 100, height: 100, visibleBounds: [0, 0, 100, 100] as const };
  const placement = { stickerId: art.id, surface: 'back' as const, x: .85, y: .8, width: .35, rotationDeg: 23 };
  const rear = new BufferGeometry(), seated = createStickerSurfaceGeometry(art, placement, rear, createStickerRearChart(DEFAULT_DEVICE_FORM));
  const world = new Matrix4().makeRotationY(2.9), camera = new PerspectiveCamera(40, 1.4, 1, 3000);
  camera.position.set(0, 0, 1000); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const uv = [.27, .72] as const, point = stickerGeometryUvPoint(seated, ...uv);
  const anchor = { uv, point: point.toArray() as [number, number, number], tangentU: [-1, 0, 0] as const };
  const peeled = createStickerGrabPeelGeometry(seated, art, placement, anchor, world, camera, 1, { x: 60, y: 40 }, 800, 900);
  const origin = stickerGeometryUvPoint(peeled, ...uv);
  const free = createStickerFreeCarryGeometry(art, placement, seated, world, camera, anchor, .75);
  alignStickerCarryOrigin(peeled, free, uv, new Vector3());
  for (const progress of [0, .001, .25, .5, .999, 1]) {
    const shown = peeled.clone(); interpolateStickerCarryGeometry(shown, free, ...uv, progress);
    expect(stickerGeometryUvPoint(shown, ...uv).distanceTo(origin)).toBeLessThan(.0001);
    shown.dispose();
  }
  const target = createStickerLandingGeometry(art, placement, seated, world, camera, uv, 0, 800, 900);
  const expected = seated.clone().applyMatrix4(world);
  expect(target.getAttribute('position').array).toEqual(expected.getAttribute('position').array);
  for (const progress of [0, .001, .5, .999, 1]) {
    const shown = free.clone(); interpolateStickerCarryGeometry(shown, target, ...uv, progress);
    const expectedAnchor = stickerGeometryUvPoint(free, ...uv).lerp(stickerGeometryUvPoint(target, ...uv), progress);
    expect(stickerGeometryUvPoint(shown, ...uv).distanceTo(expectedAnchor)).toBeLessThan(.0001);
    if (progress === 1) expect(shown.getAttribute('position').array).toEqual(target.getAttribute('position').array);
    expect(Array.from(shown.getAttribute('position').array).every(Number.isFinite)).toBe(true);
    shown.dispose();
  }
  target.dispose(); expected.dispose(); free.dispose(); peeled.dispose(); seated.dispose(); rear.dispose();
});

test('landing collision corrects one coherent sheet without tearing vertices onto separate planes', async () => {
  const { constrainStickerLanding } = await import('./sticker-free-carry');
  const shown = new BufferGeometry(); shown.setAttribute('position', new Float32BufferAttribute([-2, 0, -2, 2, 0, 1, 0, 3, -1], 3));
  const destination = shown.clone(); const d = destination.getAttribute('position'); for (let i = 0; i < d.count; i++) d.setZ(i, .18);
  const camera = new PerspectiveCamera(40, 1, 1, 1000); camera.position.set(0, 0, 100); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const before = shown.clone(), eye = camera.position.clone();
  constrainStickerLanding(shown, destination, new Matrix4(), camera, (start, end) => {
    if (end.z >= 0) return null;
    const point = start.clone().lerp(end, start.z / (start.z - end.z));
    return { point, normal: new Vector3(0, 0, 1), distance: start.distanceTo(point), source: 'rear', kind: 'surface' };
  });
  let ratio: number | undefined;
  for (let i = 0; i < 3; i++) {
    const point = new Vector3().fromBufferAttribute(shown.getAttribute('position'), i), original = new Vector3().fromBufferAttribute(before.getAttribute('position'), i);
    expect(point.z).toBeGreaterThan(0);
    const scale = point.distanceTo(eye) / original.distanceTo(eye);
    if (ratio === undefined) ratio = scale; else expect(scale).toBeCloseTo(ratio, 6);
    const a = point.project(camera), b = original.project(camera);
    expect(a.x).toBeCloseTo(b.x, 6); expect(a.y).toBeCloseTo(b.y, 6);
  }
  shown.dispose(); destination.dispose(); before.dispose();
});

test('the exact grabbed UV follows the raw cursor throughout peel and transport at tilted poses', async () => {
  const { anchorStickerToPointer } = await import('./sticker-free-carry');
  const art = { id: 'test', url: '', width: 100, height: 100, visibleBounds: [0, 0, 100, 100] as const };
  const placement = { stickerId: art.id, surface: 'back' as const, x: .5, y: .5, width: .3, rotationDeg: 17 };
  const rear = new BufferGeometry(), source = createStickerSurfaceGeometry(art, placement, rear);
  const camera = new PerspectiveCamera(40, 1.4, 1, 3000); camera.position.set(0, 0, 1000); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  for (const yaw of [2.4, Math.PI, 3.5]) for (const uv of [[.23, .72], [.81, .36]] as const) {
    const world = new Matrix4().makeRotationY(yaw), point = stickerGeometryUvPoint(source, uv[0], uv[1]);
    const anchor = { uv, point: point.toArray() as [number, number, number], tangentU: [-1, 0, 0] as const };
    const origin = point.clone().applyMatrix4(world).project(camera);
    for (const [frontier, transport, dx, dy] of [[.1, 0, 4, -3], [.7, 0, 32, -16], [1, .5, 58, 20], [1, 1, 180, -95], [1, 1, -120, 70]]) {
      if (frontier === undefined || transport === undefined || dx === undefined || dy === undefined) throw new Error('Missing sample');
      const shown = createStickerGrabPeelGeometry(source, art, placement, anchor, world, camera, frontier, { x: dx, y: dy }, 800, 600);
      const before = new Float32Array(shown.getAttribute('position').array);
      anchorStickerToPointer(shown, art, placement, anchor, world, camera, { x: dx, y: dy }, 800, 600, frontier, transport);
      const actual = stickerGeometryUvPoint(shown, uv[0], uv[1]).project(camera);
      expect(Math.abs((actual.x - origin.x) * 400 - dx)).toBeLessThan(.001);
      expect(Math.abs((origin.y - actual.y) * 300 - dy)).toBeLessThan(.001);
      if (transport === 0) {
        const region = stickerGrabPeelRegion(art, placement, anchor), n = STICKER_SURFACE.segments, p = shown.getAttribute('position');
        for (let i = 0; i < p.count; i++) if (region.coordinate(i % (n + 1) / n, Math.floor(i / (n + 1)) / n) >= region.start + frontier * (1 - region.start)) {
          expect([p.getX(i), p.getY(i), p.getZ(i)]).toEqual(Array.from(before.subarray(i * 3, i * 3 + 3)));
        }
      }
      shown.dispose();
    }
  }
  source.dispose(); rear.dispose();
});
