import { expect, test } from 'bun:test';
import { STICKER_CATALOGUE } from '@webpod/stickers';
import { PlaneGeometry, Vector3 } from 'three';
import { createStickerPaperGeometry, conformStickerToPaper, STICKER_PAPER, stickerPaperCurlProgress } from './sticker-paper';
import { createStickerPeelGeometry } from './sticker-surface';

test('curled thin stock has finite smooth normals and separated front/back surfaces at every vertex', () => {
  for (const pixel of [.55, 1, 1.8]) {
    const stock = createStickerPaperGeometry(320 * pixel, 336 * pixel, pixel, true);
    const positions = stock.front.getAttribute('position'), back = stock.back.getAttribute('position'), normals = stock.front.getAttribute('normal');
    let minimumSeparation = Infinity, largestNormalTurn = 0, maximumLift = 0, minimumFacing = 1;
    const normal = new Vector3(), nextNormal = new Vector3(), separation = new Vector3();
    for (let index = 0; index < positions.count; index++) {
      normal.fromBufferAttribute(normals, index);
      separation.set(positions.getX(index) - back.getX(index), positions.getY(index) - back.getY(index), positions.getZ(index) - back.getZ(index));
      minimumSeparation = Math.min(minimumSeparation, separation.dot(normal));
      maximumLift = Math.max(maximumLift, positions.getZ(index));
      minimumFacing = Math.min(minimumFacing, normal.z);
      expect(Number.isFinite(normal.length())).toBe(true);
      expect(normal.length()).toBeCloseTo(1, 5);
      if (index % (STICKER_PAPER.segments + 1) < STICKER_PAPER.segments) {
        nextNormal.fromBufferAttribute(normals, index + 1);
        largestNormalTurn = Math.max(largestNormalTurn, normal.angleTo(nextNormal));
      }
    }
    expect(minimumSeparation / pixel).toBeCloseTo(STICKER_PAPER.linerThicknessPx, 3);
    expect(largestNormalTurn).toBeLessThan(.17);
    expect(maximumLift / pixel).toBeGreaterThan(27);
    expect(maximumLift / pixel).toBeLessThan(32);
    expect(minimumFacing).toBeLessThan(-.2); // The curl actually exposes its underside.
    expect(stock.edge.getAttribute('position').count).toBe(STICKER_PAPER.segments * 4 * 6);
    for (const geometry of Object.values(stock)) geometry.dispose();
  }
});

test('stock curl leaves sheet UVs unchanged and only bends the unprinted corner in XY', () => {
  const stock = createStickerPaperGeometry(320, 336, 1, true);
  const plane = new PlaneGeometry(320, 336, STICKER_PAPER.segments, STICKER_PAPER.segments);
  expect(Array.from(stock.front.getAttribute('uv').array)).toEqual(Array.from(plane.getAttribute('uv').array));
  const flat = plane.getAttribute('position'), bent = stock.front.getAttribute('position');
  for (let index = 0; index < flat.count; index++) {
    // All five printed seats lie below this boundary; their DOM coordinates stay exact.
    if (flat.getY(index) < 100) {
      expect(bent.getX(index)).toBe(flat.getX(index));
      expect(bent.getY(index)).toBe(flat.getY(index));
    }
  }
  plane.dispose(); for (const geometry of Object.values(stock)) geometry.dispose();
});

test('unpeeled adhesive tail stays on the bowed printed seat throughout partial peeling', () => {
  const art = STICKER_CATALOGUE[0];
  if (art === undefined) throw new Error('catalogue must contain approved artwork');
  for (const seatX of [.19, .5, .81]) {
    const resting = conformStickerToPaper(createStickerPeelGeometry(art, 70, 0), 320, 1, seatX);
    const partial = conformStickerToPaper(createStickerPeelGeometry(art, 70, .4), 320, 1, seatX);
    const a = resting.getAttribute('position'), b = partial.getAttribute('position');
    expect(Array.from(resting.getAttribute('uv').array)).toEqual(Array.from(partial.getAttribute('uv').array));
    // The last 60% is still adhered; no flattening or seat translation is allowed.
    for (let row = 10; row <= 24; row++) for (let col = 0; col <= 24; col++) {
      const index = row * 25 + col;
      expect(b.getX(index)).toBeCloseTo(a.getX(index), 6);
      expect(b.getY(index)).toBeCloseTo(a.getY(index), 6);
      expect(b.getZ(index)).toBeCloseTo(a.getZ(index), 6);
    }
    resting.dispose(); partial.dispose();
  }
});

test('inserted and partially emerging liner cannot curl through the sleeve face', () => {
  for (const width of [180, 265, 320, 355]) {
    const height = width * 1.05;
    for (let clearance = 0; clearance <= 100; clearance += 2) {
      const progress = stickerPaperCurlProgress(width, height, 1, clearance);
      const stock = createStickerPaperGeometry(width, height, 1, true, progress);
      const positions = stock.front.getAttribute('position');
      let maximumCoveredLift = 0;
      for (let index = 0; index < positions.count; index++) {
        // Liner starts at z=2px; the pocket front begins at8px. Outside the
        // notch, covered vertices must remain behind that opaque pocket face.
        if (positions.getY(index) + clearance < height / 2 && positions.getX(index) > width * .1) {
          maximumCoveredLift = Math.max(maximumCoveredLift, positions.getZ(index));
        }
      }
      expect(maximumCoveredLift).toBeLessThan(6);
      if (clearance === 0) expect(progress).toBe(0);
      if (clearance === 100) expect(progress).toBe(1);
      for (const geometry of Object.values(stock)) geometry.dispose();
    }
  }
});
