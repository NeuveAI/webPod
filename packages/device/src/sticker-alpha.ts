import { DataTexture, NearestFilter, RedFormat, type Texture } from 'three';

export interface StickerAlphaMask { readonly width: number; readonly height: number; readonly pixels: Uint8Array }
export interface StickerDamageField { readonly width: number; readonly height: number; readonly alpha: Uint8Array; readonly onset: Uint8Array; readonly boundaryCandidates: Uint32Array }
const masks = new WeakMap<Texture, StickerAlphaMask>();
const damage = new WeakMap<Texture, { readonly id: string; readonly field: StickerDamageField; readonly texture: DataTexture }>();
export const STICKER_ALPHA_THRESHOLD = 16;

/** Image readback happens once per loaded source, before gesture admission. */
export function prepareStickerAlpha(texture: Texture): StickerAlphaMask | null {
  const existing = masks.get(texture); if (existing) return existing;
  const source: unknown = texture.source.data;
  if (typeof HTMLImageElement === 'undefined' || !(source instanceof HTMLImageElement) || !source.complete || source.naturalWidth === 0) return null;
  const canvas = document.createElement('canvas'); canvas.width = source.naturalWidth; canvas.height = source.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true }); if (!context) return null;
  context.drawImage(source, 0, 0);
  const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const pixels = new Uint8Array(canvas.width * canvas.height);
  for (let i = 0; i < pixels.length; i++) pixels[i] = rgba[i * 4 + 3] ?? 0;
  const mask = { width: canvas.width, height: canvas.height, pixels }; masks.set(texture, mask); return mask;
}
function hash(x: number, y: number, seed: number): number {
  let value = Math.imul(x + 374761393, 668265263) ^ Math.imul(y + seed, 1274126177);
  value = Math.imul(value ^ value >>> 13, 1274126177); return ((value ^ value >>> 16) >>> 0) / 0xffffffff;
}
function noise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x); const iy = Math.floor(y); const fx = x - ix; const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx); const v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, seed); const b = hash(ix + 1, iy, seed); const c = hash(ix, iy + 1, seed); const d = hash(ix + 1, iy + 1, seed);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}
/** Bounded, deterministic edge-distance field; thresholding never creates new random damage. */
export function createStickerDamageField(mask: StickerAlphaMask, id: string): StickerDamageField {
  const scale = Math.min(1, 1024 / Math.max(mask.width, mask.height));
  const width = Math.max(1, Math.round(mask.width * scale)); const height = Math.max(1, Math.round(mask.height * scale));
  const alpha = new Uint8Array(width * height); const distance = new Uint16Array(width * height); const onset = new Uint8Array(width * height); onset.fill(255);
  const resolution = Math.max(1, Math.max(width, height) / 256);
  const candidates: number[] = [];
  let seed = 2166136261; for (const character of id) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    alpha[i] = mask.pixels[Math.min(mask.height - 1, Math.floor((y + .5) / height * mask.height)) * mask.width + Math.min(mask.width - 1, Math.floor((x + .5) / width * mask.width))] ?? 0;
    distance[i] = (alpha[i] ?? 0) < STICKER_ALPHA_THRESHOLD ? 0 : Math.min(x + 1, y + 1, width - x, height - y, 65534);
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const i = y * width + x; distance[i] = Math.min(distance[i] ?? 0, x ? (distance[i - 1] ?? 0) + 1 : 1, y ? (distance[i - width] ?? 0) + 1 : 1); }
  for (let y = height - 1; y >= 0; y--) for (let x = width - 1; x >= 0; x--) {
    const i = y * width + x; const d = Math.min(distance[i] ?? 0, x < width - 1 ? (distance[i + 1] ?? 0) + 1 : 1, y < height - 1 ? (distance[i + width] ?? 0) + 1 : 1); distance[i] = d;
    const band = Math.ceil(resolution * 4.75) + 1;
    if (d <= 0 || d > band) continue;
    candidates.push(i);
    // Smooth multi-scale edge depth avoids constant square noise cells. Fine
    // nicks remain subpixel at owner-scale400px prints, with occasional deeper tears.
    const grain = noise(x / (2.4 * resolution), y / (2.4 * resolution), seed);
    const fine = noise(x / (.7 * resolution), y / (.7 * resolution), seed + 7919);
    const depth = resolution * (.55 + grain ** 2 * 3.6 + fine * .6);
    const threshold = d / depth;
    // Only this static edge band can ever change topology. Contour updates scan
    // it rather than a million-pixel image during continuous wear input.

    if (d > 0 && threshold < 1) onset[i] = Math.max(1, Math.min(254, Math.ceil(threshold * 255)));
  }
  return { width, height, alpha, onset, boundaryCandidates: new Uint32Array(candidates) };
}
/** Derived GPU resource follows its immutable source texture's lifetime, never a wear value. */
export function prepareStickerDamage(texture: Texture, id: string) {
  const cached = damage.get(texture); if (cached) return cached.id === id ? cached : null;
  const mask = prepareStickerAlpha(texture); if (!mask) return null;
  const field = createStickerDamageField(mask, id);
  // DataTexture rows are bottom-up UV coordinates; copy once explicitly instead
  // of depending on browser pixel-store flipping of typed-array uploads.
  const gpu = new Uint8Array(field.onset.length);
  for (let y = 0; y < field.height; y++) gpu.set(field.onset.subarray(y * field.width, (y + 1) * field.width), (field.height - 1 - y) * field.width);
  const derived = new DataTexture(gpu, field.width, field.height, RedFormat);
  derived.minFilter = NearestFilter; derived.magFilter = NearestFilter; derived.flipY = false; derived.generateMipmaps = false; derived.needsUpdate = true;
  const resource = { id, field, texture: derived }; damage.set(texture, resource);
  const dispose = () => { derived.dispose(); damage.delete(texture); masks.delete(texture); texture.removeEventListener('dispose', dispose); };
  texture.addEventListener('dispose', dispose); return resource;
}
/** Same nearest texel and inclusive threshold as both physical material faces. */
export function stickerPixelSurvives(field: StickerDamageField, x: number, y: number, wear: number): boolean {
  const index = Math.max(0, Math.min(field.height - 1, y)) * field.width + Math.max(0, Math.min(field.width - 1, x));
  const onset = field.onset[index] ?? 255;
  return (field.alpha[index] ?? 0) >= STICKER_ALPHA_THRESHOLD && (onset === 255 || wear < onset / 255);
}
export function stickerAlphaHit(texture: Texture, id: string, u: number, v: number, wear: number): boolean {
  const mask = prepareStickerAlpha(texture); const resource = prepareStickerDamage(texture, id); if (!mask || !resource) return false;
  const x = Math.max(0, Math.min(mask.width - 1, Math.floor(u * mask.width))); const y = Math.max(0, Math.min(mask.height - 1, Math.floor((1 - v) * mask.height)));
  if ((mask.pixels[y * mask.width + x] ?? 0) < STICKER_ALPHA_THRESHOLD) return false;
  const field = resource.field;
  const i = Math.max(0, Math.min(field.height - 1, Math.floor((1 - v) * field.height))) * field.width + Math.max(0, Math.min(field.width - 1, Math.floor(u * field.width)));
  const onset = field.onset[i] ?? 255; return onset === 255 || wear < onset / 255;
}
