import { DataTexture } from 'three';
import type { DeviceStickerScene, StickerArtwork } from '../../device/src/sticker-contract';
import { stickerPackGeometryKey, type StickerPackNode } from '../../device/src/sticker-pack-recipe';
import { prepareNativePackFrame, type NativePackFrame } from './native-pack-resources';

const MAX_ARTWORKS = 10, MAX_ARTWORK_BYTES = 64 * 1024 * 1024, MAX_RESOURCE_BYTES = 64 * 1024 * 1024, DEADLINE_MS = 60_000;
const APPEARANCES = ['earned', 'locked', 'placed'] as const;
type Owner = Awaited<ReturnType<typeof prepareNativePackFrame>>;
interface Request { readonly key: string; readonly ids: readonly string[]; readonly assets: readonly StickerArtwork[]; scene: DeviceStickerScene }
interface Sent { readonly sequence: number; readonly request: Request | null; readonly owner: Owner | null; readonly timer: ReturnType<typeof setTimeout> }
const emptyRecipe = (): StickerPackNode => ({kind: 'group', id: 'sticker-warmup', children: []});
const emptyFrame = (): NativePackFrame => ({key: 'sticker-warmup-empty', recipe: emptyRecipe(), geometry: [], damage: [], artworks: [], prints: []});

function request(scene: DeviceStickerScene): Request {
  const ids = [...new Set(scene.prepareIds ?? [])].sort();
  if (ids.length > MAX_ARTWORKS) throw new Error('Sticker warmup artwork capacity exceeded');
  const assets = ids.map(id => {
    const art = scene.assets.find(value => value.id === id);
    if (!art) throw new Error(`Sticker warmup artwork missing: ${id}`);
    if (![art.width, art.height, ...art.visibleBounds].every(Number.isFinite) || art.width <= 0 || art.height <= 0) throw new Error('Sticker warmup dimensions are invalid');
    return {id: art.id, url: art.url, width: art.width, height: art.height, visibleBounds: [art.visibleBounds[0], art.visibleBounds[1], art.visibleBounds[2], art.visibleBounds[3]] as const};
  });
  const urls = new Map(assets.map(art => [art.url, art.width * art.height * 4]));
  if ([...urls.values()].reduce((sum, bytes) => sum + bytes, 0) > MAX_ARTWORK_BYTES) throw new Error('Sticker warmup artwork byte capacity exceeded');
  // All three original appearances use zero wear. The current finish setting
  // affects programs; pose, inventory wear and callback identities do not.
  return {key: JSON.stringify({assets, finishEnabled: scene.finishEnabled !== false}), ids, assets, scene};
}

function recipe(input: Request): StickerPackNode {
  return {kind: 'group', id: 'sticker-warmup', children: input.assets.map(art => {
    const geometry = {kind: 'parked-print', art, width: 1} as const;
    return {kind: 'print', id: art.id, artId: art.id, geometry, geometryKey: stickerPackGeometryKey(geometry), width: 1, appearance: 'earned', wear: 0, renderOrder: 4};
  })};
}

/** Reuse each art's exact zero-wear resource across actual material variants.
 * Only descriptors expand: geometry, bitmap and damage are acquired once from
 * the existing owners, never copied or regenerated for a shader appearance. */
function validateBytes(owner: Owner): void {
  const buffers = new Set<ArrayBufferLike>();
  for (const resource of owner.prepared.values()) for (const geometry of Object.values(resource.parts)) {
    for (const attribute of Object.values(geometry.attributes)) buffers.add(attribute.array.buffer);
    if (geometry.index) buffers.add(geometry.index.array.buffer);
  }
  for (const print of owner.queryPrints.values()) {
    const field = print.damage.field;
    for (const array of [field.alpha, field.onset, field.boundaryCandidates, field.distance]) if (array) buffers.add(array.buffer);
    if (!(print.damage.texture instanceof DataTexture) || !ArrayBuffer.isView(print.damage.texture.image.data)) throw new Error('Invalid warmup damage storage');
    buffers.add(print.damage.texture.image.data.buffer);
  }
  if ([...buffers].reduce((sum, buffer) => sum + buffer.byteLength, 0) > MAX_RESOURCE_BYTES) throw new Error('Sticker warmup resource byte capacity exceeded');
}

function variants(owner: Owner): NativePackFrame {
  const nodes = owner.frame.recipe.kind === 'group' ? owner.frame.recipe.children : [];
  const children: StickerPackNode[] = [], prints: NativePackFrame['prints'][number][] = [];
  for (const node of nodes) {
    if (node.kind !== 'print') throw new Error('Unexpected warmup leaf');
    const print = owner.frame.prints.find(value => value.key === node.id);
    if (!print) throw new Error('Missing warmup print');
    for (const appearance of APPEARANCES) {
      const key = `${node.id}/${appearance}`;
      children.push({...node, id: key, appearance}); prints.push({...print, key, appearance});
    }
  }
  return {...owner.frame, recipe: {kind: 'group', id: 'sticker-warmup', children}, prints};
}

/** One active preparation, one latest source request and one in-flight frame.
 * At most ten artwork resources/30 appearance pairs are admitted. Existing
 * paper and transaction authorities retain their global byte/owner limits;
 * decoded bitmap export additionally enforces 64 MiB in prepareNativePackFrame.
 *
 * A zero-resource replacement barrier retires the previous warm root before
 * preparing another full collection. ACK must mean actual compile completion
 * and disposal of the prior root; rejected ACK must mean candidate disposal.
 * Supersession finishes bounded work then discards it instead of aborting a
 * shared producer's private copy. Failure/disposal aborts outstanding preparation.
 * Sent leases survive dispose until rendererRetired confirms worker teardown.
 */
export function createNativeStickerWarmup(options: {
  send(sequence: number, frame: NativePackFrame, transfer: Transferable[]): void;
  fail(error: Error): void;
}) {
  let latest: Request | null = null, active: AbortController | null = null;
  let retainedKey: string | null = null;
  let retained: Owner | null = null, sent: Sent | null = null, sequence = 0;
  let disposed = false, retired = false, sending = false;
  let deferredAck: {sequence: number; accepted: boolean} | null = null;
  const retireOwners = () => { retained?.release(); retained = null; retainedKey = null; sent?.owner?.release(); if (sent) clearTimeout(sent.timer); sent = null; };
  const dispose = () => {
    if (disposed) return; disposed = true; active?.abort();
    if (sent) clearTimeout(sent.timer);
    const previous = latest; latest = null; previous?.scene.onPrepared?.([]);
  };
  const fail = (error: unknown) => { if (disposed) return; dispose(); options.fail(error instanceof Error ? error : new Error('Sticker warmup failed')); };
  const send = (input: Request | null, owner: Owner | null) => {
    const current = ++sequence;
    const frame = owner ? variants(owner) : emptyFrame();
    const transfer: Transferable[] = [...frame.geometry.map(value => value.port), ...frame.damage.map(value => value.port), ...frame.artworks.map(value => value.bitmap.image)];
    sent = {sequence: current, request: input, owner, timer: setTimeout(() => fail(new Error('Sticker warmup acknowledgement timed out')), DEADLINE_MS)};
    sending = true;
    try { options.send(current, frame, transfer); owner?.transferred(); }
    catch (error) { clearTimeout(sent?.timer); owner?.release(); sent = null; fail(error); }
    finally { sending = false; }
    if (retired) retireOwners();
    const ack = deferredAck; deferredAck = null;
    if (ack) acknowledge(ack.sequence, ack.accepted);
  };
  const dispatch = () => {
    if (disposed || active || sent || !latest) return;
    if (retained) { if (retainedKey !== latest.key) send(null, null); return; }
    const input = latest;
    if (input.ids.length === 0) return;
    const controller = new AbortController(); active = controller;
    const timer = setTimeout(() => { controller.abort(); fail(new Error('Sticker warmup preparation timed out')); }, DEADLINE_MS);
    const scene: DeviceStickerScene = {assets: input.assets, prepareIds: input.ids, placements: [], pack: null, finishEnabled: input.scene.finishEnabled !== false};
    void prepareNativePackFrame(recipe(input), scene, controller.signal, {prepareContours: false}).then(owner => {
      if (disposed || controller.signal.aborted || latest?.key !== input.key) { owner.release(); return; }
      try { validateBytes(owner); send(input, owner); } catch (error) { owner.release(); fail(error); }
    }, error => { if (!disposed) fail(error); }).finally(() => { clearTimeout(timer); if (active === controller) active = null; dispatch(); });
  };
  const acknowledge = (id: number, accepted = true) => {
    if (sending) { if (sent?.sequence === id) deferredAck = {sequence: id, accepted}; return; }
    const completed = sent;
    if (disposed || !completed || completed.sequence !== id) return;
    clearTimeout(completed.timer); sent = null;
    if (!accepted) {
      completed.owner?.release();
      if (!completed.request || completed.request.key === latest?.key) { fail(new Error('Renderer rejected sticker warmup')); return; }
    } else {
      retained?.release(); retained = completed.owner; retained?.releaseQueries(); retainedKey = completed.request?.key ?? null;
      const input = completed.request;
      if (input && latest?.key === input.key) {
        for (const art of input.ids) {
          if (disposed || latest?.key !== input.key) break;
          latest.scene.onArtworkReady?.(art);
        }
        if (!disposed && latest?.key === input.key) latest.scene.onPrepared?.(input.ids);
      }
    }
    // A matching ready frame stays resident. A different source first crosses
    // the empty replacement barrier, never retaining two full private frames.
    if (!completed.request || completed.request.key !== latest?.key) dispatch();
  };
  return {
    update(scene: DeviceStickerScene) {
      if (disposed) return;
      let next: Request;
      try { next = request(scene); } catch (error) { fail(error); return; }
      if (latest?.key === next.key) { latest.scene = scene; return; }
      latest = next; scene.onPrepared?.([]);
      if (!disposed && latest === next) dispatch();
    },
    ack: acknowledge,
    dispose,
    rendererRetired() { retired = true; dispose(); if (!sending) retireOwners(); },
  };
}
