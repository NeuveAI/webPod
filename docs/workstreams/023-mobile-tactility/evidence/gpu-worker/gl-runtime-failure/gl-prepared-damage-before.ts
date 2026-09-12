import { equalStickerDamageInputs } from '../../../../../../packages/device/src/sticker-damage-input';
import { yieldSteps } from '../../../../../../packages/device/src/sticker-computation-steps';
import { getStickerBoundsIndex, setStickerBoundsIndex } from '../../../../../../packages/device/src/sticker-bounds-index';
import { atom, createStore, useAtomValue } from '../../../../../../packages/device/node_modules/jotai';
import { useLayoutEffect, useMemo } from '../../../../../../packages/device/node_modules/react';
import { BufferAttribute, BufferGeometry, DataTexture, NearestFilter, RedFormat, type Texture } from '../../../../../../packages/device/node_modules/three/build/three.module.js';
import { prepareStickerAlpha, type StickerDamageResource } from '../../../../../../packages/device/src/sticker-alpha';
import { acquireStickerTransaction, requestStickerTransaction } from '../../../../../../packages/device/src/sticker-transaction-broker';
import { commitPreparedStickerSurface, preparedStickerPlacement, preparedStickerResources, registerPreparedStickerResources, type PreparedStickerResource } from '../../../../../../packages/device/src/sticker-transaction-client';
import type { StickerDamageRequest, StickerContourRequest } from '../../../../../../packages/device/src/sticker-transaction-data';
import { setPreparedStickerContour, type PreparedStickerContour } from '../../../../../../packages/device/src/sticker-contour-preparation-data';
import { createLatestStickerPreparation } from '../../../../../../packages/device/src/sticker-latest-preparation';
const identities = new WeakMap<object, number>(); let sequence = 0;
const identity = (value: object) => { let id = identities.get(value); if (id === undefined) { id = ++sequence; identities.set(value, id); } return id; };
export interface PreparedPrint { readonly texture: Texture; readonly geometry: BufferGeometry; readonly damage: StickerDamageResource; readonly wear: number; release(): void }
export interface PrintInput { readonly texture: Texture; readonly id: string; readonly geometry: BufferGeometry; readonly wearGeometry: BufferGeometry | null; readonly wear: number; readonly onError?: (id: string) => void }
/** Lightweight GPU wrappers borrow immutable arrays; old displayed geometry stays
 * alive when the upstream wrapper is replaced. Dense arrays are never cloned here. */
function borrowGeometry(source: BufferGeometry): BufferGeometry {
  const geometry = new BufferGeometry();
  for (const [name, attribute] of Object.entries(source.attributes)) {
    if (!(attribute instanceof BufferAttribute)) throw new Error('Sticker preparation requires noninterleaved attributes');
    geometry.setAttribute(name, new BufferAttribute(attribute.array, attribute.itemSize, attribute.normalized));
  }
  if (source.index) geometry.setIndex(new BufferAttribute(source.index.array, 1));
  geometry.boundingBox = source.boundingBox?.clone() ?? null; geometry.boundingSphere = source.boundingSphere?.clone() ?? null;
  geometry.groups = source.groups.map(group => ({ ...group })); geometry.setDrawRange(source.drawRange.start, source.drawRange.count);
  const bounds = getStickerBoundsIndex(source); if (bounds) setStickerBoundsIndex(geometry, bounds);
  return geometry;
}
/** Contours remain mandatory by default for every visible/query print. Only
 * an invisible shader warmup may omit them; damage identity and bytes are exact. */
export async function preparePrint(input: PrintInput, signal: AbortSignal, options?: { readonly prepareContour?: boolean; readonly reuseDamage?: readonly PreparedStickerResource[] }): Promise<PreparedPrint> {
  const { texture, id, geometry, wearGeometry, wear } = input;
  const mask = prepareStickerAlpha(texture); if (!mask) throw new Error('Sticker alpha is unavailable');
  const normals = wearGeometry?.getAttribute('normal'), uv = wearGeometry?.getAttribute('uv');
  if ((normals && !(normals.array instanceof Float32Array)) || (uv && !(uv.array instanceof Float32Array))) throw new Error('Sticker attributes require immutable float32 arrays');
  const surface = normals?.array instanceof Float32Array && uv?.array instanceof Float32Array ? { normals: normals.array, uv: uv.array } : null;
  let key = `damage:${id}:${identity(texture)}:${wearGeometry ? identity(wearGeometry) : 0}`;
  let damageInput: StickerDamageRequest = { kind: 'damage', artworkKey: String(identity(texture)), stickerId: id, mask, surface };
  if (options?.reuseDamage?.length) {
    if (options.reuseDamage.length > 64) throw new Error('Sticker damage reuse candidate capacity exceeded');
    for (const candidate of options.reuseDamage) {
      if (candidate.input.kind === 'damage' && candidate.input.stickerId === damageInput.stickerId && candidate.input.artworkKey === damageInput.artworkKey && await yieldSteps(equalStickerDamageInputs(damageInput, candidate.input), signal)) { key = candidate.key; damageInput = candidate.input; break; }
    }
  }
  const descriptors = preparedStickerResources(geometry), sources = descriptors.map(resource => acquireStickerTransaction(resource.key, resource.input));
  for (const source of sources) void source.result.catch(() => {});
  const releases: (() => void)[] = sources.map(source => source.release);
  let own: BufferGeometry | null = null, derived: DataTexture | null = null, released = false;
  const release = () => { if (released) return; released = true; own?.dispose(); derived?.dispose(); for (const dispose of releases) dispose(); };
  try {
    const damage = await requestStickerTransaction(key, damageInput, signal); releases.push(damage.release);
    if (damage.value.kind !== 'damage') throw new Error('Unexpected sticker damage result');
    let contour: PreparedStickerContour | null = null;
    if (options?.prepareContour !== false) {
      const positions = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
      if (!(positions?.array instanceof Float32Array) || !(uv?.array instanceof Float32Array)) throw new Error('Sticker contour requires immutable float32 arrays');
      const contourInput: StickerContourRequest = { kind: 'contour', damageKey: key, geometryKey: descriptors.find(resource => resource.input.kind === 'surface')?.key, field: damage.value.field, wear, positions: positions.array, uv: uv.array };
      const contourKey = `contour:${key}:${identity(geometry)}:${Math.floor(Math.max(0, Math.min(1, wear)) * 255)}`;
      const prepared = await requestStickerTransaction(contourKey, contourInput, signal); releases.push(prepared.release);
      if (prepared.value.kind !== 'contour') throw new Error('Unexpected sticker contour result');
      contour = prepared.value.contour;
    }
    signal.throwIfAborted();
    derived = new DataTexture(damage.value.gpu, damage.value.field.width, damage.value.field.height, RedFormat);
    derived.minFilter = NearestFilter; derived.magFilter = NearestFilter; derived.flipY = false; derived.generateMipmaps = false; derived.needsUpdate = true;
    own = borrowGeometry(geometry);
    const placement = preparedStickerPlacement(geometry); if (placement) commitPreparedStickerSurface(own, { ...placement, wear });
    if (contour) setPreparedStickerContour(own, damage.value.field, wear, contour);
    registerPreparedStickerResources(own, [...descriptors, { key, input: damageInput }]);
    return { texture, geometry: own, damage: { id, field: damage.value.field, texture: derived }, wear, release };
  } catch (error) { release(); throw error; }
}
/** Publish geometry, damage, visible wear and prepared contour as one frame. One
 * active plus one latest compatible input prevents cold-worker starvation; an
 * explicit gesture epoch rejects all old-gesture completions before adoption. */
export function usePreparedStickerDamage(texture: Texture | null, id: string, geometry: BufferGeometry, wearGeometry: BufferGeometry | null, wear: number, computationEpoch: number, onError?: (id: string) => void): PreparedPrint | null {
  const owner = useMemo(() => {
    const store = createStore(), state = atom<PreparedPrint | null>(null), retired = new Set<PreparedPrint>();
    return { store, state, retired, runtime: createLatestStickerPreparation(preparePrint, value => { const previous = store.get(state); if (previous) retired.add(previous); store.set(state, value); }, input => input.onError?.(input.id)) };
  }, []);
  const current = useAtomValue(owner.state, { store: owner.store });
  useLayoutEffect(() => {
    if (!texture) { owner.runtime.dispose(); return; }
    owner.runtime.request({ texture, id, geometry, wearGeometry, wear, onError }, `${id}:${identity(texture)}:${computationEpoch}`);
  }, [owner, texture, id, geometry, wearGeometry, wear, computationEpoch, onError]);
  useLayoutEffect(() => () => { owner.runtime.dispose(); owner.store.get(owner.state)?.release(); for (const value of owner.retired) value.release(); owner.retired.clear(); }, [owner]);
  useLayoutEffect(() => { for (const value of owner.retired) if (value !== current) { value.release(); owner.retired.delete(value); } return () => current?.release(); }, [owner, current]);
  return current?.texture === texture && current.damage.id === id ? current : null;
}
