import { expect, test } from 'bun:test';
import { createStickerDamageField, stickerPixelSurvives } from './sticker-alpha';
import { stickerAlphaContours } from './sticker-contour';
function mask() {
  const width = 64; const height = 64; const pixels = new Uint8Array(width * height);
  for (let y = 5; y < 59; y++) for (let x = 4; x < 60; x++) if (!(x > 20 && x < 30 && y > 20 && y < 30) && !(x > 40 && y < 15)) pixels[y * width + x] = 255;
  return { width, height, pixels };
}
test('seeded fraying is deterministic, monotonic, restricted to edges and resets exactly', () => {
  const input = mask(); const field = createStickerDamageField(input, 'sound-check');
  expect(createStickerDamageField(input, 'sound-check').onset).toEqual(field.onset);
  expect(createStickerDamageField(input, 'pulse-code').onset).not.toEqual(field.onset);
  let removed = 0;
  for (let y = 0; y < input.height; y++) for (let x = 0; x < input.width; x++) {
    const original = (input.pixels[y * input.width + x] ?? 0) >= 16;
    expect(stickerPixelSurvives(field, x, y, 0)).toBe(original);
    const middle = stickerPixelSurvives(field, x, y, .5); const worn = stickerPixelSurvives(field, x, y, 1);
    if (worn) expect(middle).toBe(true);
    if (original && !worn) removed++;
  }
  expect(removed).toBeGreaterThan(30); expect(removed).toBeLessThan(600);
  expect(stickerPixelSurvives(field, 35, 35, 1)).toBe(true);
});
test('contours preserve concavities and holes, use bounded cache and monotonic damage boundaries', () => {
  const field = createStickerDamageField(mask(), 'sound-check');
  const clean = stickerAlphaContours(field, 0);
  expect(clean).toHaveLength(2);
  expect(clean.some((path) => path.length > 4)).toBe(true);
  const areas = clean.map((path) => path.reduce((sum, p, i) => { const q = path[(i + 1) % path.length]; return q ? sum + p.x * q.y - q.x * p.y : sum; }, 0));
  expect(areas.some((area) => area > 0)).toBe(true); expect(areas.some((area) => area < 0)).toBe(true);
  expect(stickerAlphaContours(field, .001)).toBe(clean);
  const worn = stickerAlphaContours(field, 1); expect(worn).not.toEqual(clean);
  expect(stickerAlphaContours(field, 0)).toBe(clean);
});

test('actual rear triangle projection retains concave boundary and excludes hole anchors under pose', async () => {
  const { Mesh, MeshPhysicalMaterial, BufferGeometry, Group, PerspectiveCamera, Vector3 } = await import('three');
  const { createStickerSurfaceGeometry } = await import('./sticker-surface');
  const { projectStickerContourField } = await import('./sticker-contour');
  const input = mask(); const field = createStickerDamageField(input, 'sound-check');
  const rear = new BufferGeometry();
  const geometry = createStickerSurfaceGeometry({ id: 'sound-check', url: '', width: 64, height: 64, visibleBounds: [0, 0, 64, 64] }, { stickerId: 'sound-check', surface: 'back', x: .5, y: .5, width: .15, rotationDeg: 23 }, rear);
  const print = new Mesh(geometry, new MeshPhysicalMaterial()); const content = new Group(); content.add(print); content.rotation.set(.15, .2, -.2);
  const camera = new PerspectiveCamera(40, 1, 1, 1000); camera.position.z = -300; camera.lookAt(0, 0, 0);
  const canvas = { left: 12, top: 30, width: 600, height: 600 };
  const result = projectStickerContourField(print, camera, canvas, field);
  if (!result) throw new Error('Expected actual contour');
  expect(result.paths).toHaveLength(2); expect(result.paths.some((path) => path.length > 4)).toBe(true);
  const positions = geometry.getAttribute('position');
  const center = new Vector3().fromBufferAttribute(positions, Math.floor(positions.count / 2)).applyMatrix4(print.matrixWorld).project(camera);
  expect(result.center.x).toBeCloseTo(canvas.left + (center.x + 1) * canvas.width / 2);
  expect(result.center.y).toBeCloseTo(canvas.top + (1 - center.y) * canvas.height / 2);
  const outer = result.paths[0]; if (!outer) throw new Error('Missing outer path');
  for (const anchor of result.anchors) expect(outer.some((point) => Math.hypot(point.x - anchor.x, point.y - anchor.y) < 1e-6)).toBe(true);
  expect(projectStickerContourField(print, camera, { ...canvas, width: 0 }, field)).toBeNull();
  print.material.dispose(); geometry.dispose(); rear.dispose();
});

test('prepared mask reads once, shares derived texture, flips typed rows explicitly and disposes once', async () => {
  const { Texture } = await import('three');
  const { prepareStickerDamage, stickerAlphaHit } = await import('./sticker-alpha');
  const input = mask(); const rgba = new Uint8ClampedArray(input.pixels.length * 4);
  input.pixels.forEach((alpha, i) => { rgba[i * 4 + 3] = alpha; });
  class SourceImage { complete = true; naturalWidth = input.width; naturalHeight = input.height; }
  const imageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'HTMLImageElement'); const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  let reads = 0;
  Object.defineProperty(globalThis, 'HTMLImageElement', { configurable: true, value: SourceImage });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage: () => {}, getImageData: () => { reads++; return { data: rgba }; } }) }) } });
  const source = new Texture(new SourceImage());
  try {
    const first = prepareStickerDamage(source, 'sound-check'); if (!first) throw new Error('Missing prepared damage');
    expect(prepareStickerDamage(source, 'sound-check')).toBe(first); expect(reads).toBe(1);
    expect(prepareStickerDamage(source, 'other-art')).toBeNull();
    expect(first.texture.flipY).toBe(false);
    const gpu = first.texture.image.data; if (gpu === null) throw new Error('Missing threshold bytes');
    for (let y = 0; y < first.field.height; y++) for (let x = 0; x < first.field.width; x++) expect(gpu[(first.field.height - 1 - y) * first.field.width + x]).toBe(first.field.onset[y * first.field.width + x]);
    let damaged = -1;
    for (let i = 0; i < first.field.onset.length; i++) if ((first.field.onset[i] ?? 255) < 255) { damaged = i; break; }
    if (damaged < 0) throw new Error('Expected a damaged edge pixel');
    const u = (damaged % first.field.width + .5) / first.field.width; const v = 1 - (Math.floor(damaged / first.field.width) + .5) / first.field.height;
    expect(stickerAlphaHit(source, 'sound-check', u, v, 0)).toBe(true); expect(stickerAlphaHit(source, 'sound-check', u, v, 1)).toBe(false);
    let disposals = 0; first.texture.addEventListener('dispose', () => { disposals++; });
    source.dispose(); source.dispose(); expect(disposals).toBe(1);
    const retried = prepareStickerDamage(source, 'sound-check'); expect(retried).not.toBe(first); expect(reads).toBe(2);
  } finally {
    source.dispose();
    if (imageDescriptor) Object.defineProperty(globalThis, 'HTMLImageElement', imageDescriptor); else Reflect.deleteProperty(globalThis, 'HTMLImageElement');
    if (documentDescriptor) Object.defineProperty(globalThis, 'document', documentDescriptor); else Reflect.deleteProperty(globalThis, 'document');
  }
});

test('owner-scale field retains fine resolution and its static edge band covers every worn boundary', () => {
  const width = 1024; const height = 1024; const pixels = new Uint8Array(width * height);
  for (let y = 80; y < 944; y++) for (let x = 80; x < 944; x++) if (!(x > 420 && x < 604 && y > 420 && y < 604)) pixels[y * width + x] = 255;
  const field = createStickerDamageField({ width, height, pixels }, 'owner-scale-night-shift');
  expect(field.width).toBe(1024); expect(field.height).toBe(1024);
  expect(field.boundaryCandidates.length).toBeLessThan(pixels.length / 8);
  const candidates = new Set(field.boundaryCandidates);
  for (const wear of [0, .5, 1]) {
    let missing = 0;
    for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) if (stickerPixelSurvives(field, x, y, wear)) {
      const boundary = !stickerPixelSurvives(field, x - 1, y, wear) || !stickerPixelSurvives(field, x + 1, y, wear) || !stickerPixelSurvives(field, x, y - 1, wear) || !stickerPixelSurvives(field, x, y + 1, wear);
      if (boundary && !candidates.has(y * width + x)) missing++;
    }
    expect(missing).toBe(0);
  }
  expect(stickerAlphaContours(field, 1).length).toBeGreaterThanOrEqual(2);
});
