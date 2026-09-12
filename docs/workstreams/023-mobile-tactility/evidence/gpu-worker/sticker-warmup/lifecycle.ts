import assert from 'node:assert/strict';
import {mock} from 'bun:test';
import type {prepareNativePackFrame, NativePackFrame} from '../../../../../../packages/composite/src/native-pack-resources';
import type {StickerPackNode} from '../../../../../../packages/device/src/sticker-pack-recipe';
import type {DeviceStickerScene, StickerArtwork} from '../../../../../../packages/device/src/sticker-contract';
type Owner = Awaited<ReturnType<typeof prepareNativePackFrame>>;
interface Job {signal: AbortSignal; finish(bytes?: number): void; reject(): void; released: number; queryReleased: number; transferred: number}
const jobs: Job[] = [];
mock.module('../../../../../../packages/composite/src/native-pack-resources', () => ({
  prepareNativePackFrame(recipe: StickerPackNode, _scene: DeviceStickerScene, signal: AbortSignal, options?: {readonly prepareContours?: boolean;readonly materialOnly?: boolean}): Promise<Owner> {
    assert.equal(options?.prepareContours, false);assert.equal(options?.materialOnly,true);
    return new Promise((resolve, reject) => {
      const job: Job = {signal, released: 0, queryReleased: 0, transferred: 0, reject() {reject(new Error('producer failure'));}, finish(bytes=0) {
        job.queryReleased=1;
        assert.equal(recipe.kind, 'group');
        const children = recipe.kind === 'group' ? recipe.children : [];
        const prints: NativePackFrame['prints'][number][] = [];
        for (const node of children) {assert.equal(node.kind, 'print'); if (node.kind !== 'print') throw Error('Unexpected leaf'); prints.push({key: node.id, id: node.artId, geometryKey: node.geometryKey, damageResource: 1, artwork: node.artId, wear: 0, visible: true, renderOrder: 4, appearance: 'earned', finishEnabled: true});}
        resolve({queryPeakBytes:bytes,queryCaptureBytes:bytes,cache:{owner:{},layout:null,retired:false,geometry:new Map(),prints:new Map(),damage:new Map(),artwork:new Map()},frame: {key: 'controlled', recipe, prints, geometry: [], damage: [], artworks: []}, prepared: new Map(), queryPrints: new Map(), releaseQueries() {if (!job.queryReleased) job.queryReleased++;}, release() {job.released++; if (!job.queryReleased) job.queryReleased++;}, transferred() {job.transferred++;}});
      }};
      jobs.push(job);
    });
  },
}));
const {createNativeStickerWarmup} = await import('../../../../../../packages/composite/src/native-sticker-warmup');
const art: StickerArtwork = {id: 'a', url: 'source-a', width: 8, height: 8, visibleBounds: [0, 0, 1, 1]};
const scene: DeviceStickerScene = {assets: [art], prepareIds: ['a'], placements: [], pack: null};
const changed: DeviceStickerScene = {...scene, assets: [{...art, url: 'source-b'}]};
const tick = async () => {await Promise.resolve(); await Promise.resolve(); await Promise.resolve();};
const job = () => {const value = jobs.at(-1); assert(value); return value;};
function fixture() {
  const sent: {sequence: number; frame: NativePackFrame}[] = [], events: string[] = [];
  let failures = 0;
  const owner = createNativeStickerWarmup({send(sequence, frame) {sent.push({sequence, frame});}, fail() {failures++;}});
  return {owner, sent, events, failures: () => failures, scene: {...scene, onPrepared(ids: readonly string[]) {events.push(ids.join(','));}, onArtworkReady(id: string) {events.push(`ready:${id}`);}}};
}
const current = (fixture: ReturnType<typeof fixture>) => {const message = fixture.sent.at(-1); assert(message); return message.sequence;};
let checks = 0;
// Source supersession before delivery finishes one bounded job, releases it,
// and dispatches only latest. It never cancels the shared canonical producer.
const first = fixture(); first.owner.update(first.scene); const obsolete = job(); first.owner.update(changed); assert.equal(obsolete.signal.aborted, false); obsolete.finish(); await tick(); assert.equal(obsolete.released, 1); assert.equal(first.sent.length, 0); const latest = job(); assert.notEqual(latest, obsolete); latest.finish(); await tick(); first.owner.ack(current(first)); first.owner.rendererRetired(); assert.equal(latest.released, 1); checks++;
// Same content/property order/pose/callback updates refresh callbacks without work.
const second = fixture(); second.owner.update(second.scene); const stable = job(), count = jobs.length;
const callbacks: string[] = []; second.owner.update({...scene, assets: [{height: 8, id: 'a', visibleBounds: [0, 0, 1, 1], width: 8, url: 'source-a'}], onPrepared(ids) {callbacks.push(ids.join(','));}});
assert.equal(jobs.length, count); stable.finish(); await tick(); second.owner.ack(current(second) - 1); assert.deepEqual(callbacks, []); second.owner.ack(current(second)); assert.deepEqual(callbacks, ['a']); assert.equal(stable.queryReleased, 1); second.owner.update(scene); assert.equal(jobs.length, count); second.owner.rendererRetired(); assert.equal(stable.released, 1); checks += 2;
// A source change after transfer requires an empty replacement ACK before new work.
const third = fixture(); third.owner.update(third.scene); const old = job(); old.finish(); await tick(); const oldSeq = current(third); third.owner.update({...changed, onPrepared(ids) {third.events.push(ids.join(','));}}); third.owner.ack(oldSeq); assert(!third.events.includes('ready:a')); assert.equal(third.sent.at(-1)?.frame.prints.length, 0); assert.equal(old.released, 0); const before = jobs.length; third.owner.ack(current(third)); assert.equal(old.released, 1); assert.equal(jobs.length, before + 1); const replacement = job(); replacement.finish(); await tick(); third.owner.ack(current(third)); third.owner.rendererRetired(); assert.equal(replacement.released, 1); checks += 2;
// Dispose clears readiness but holds transferred owners until hard retirement.
const fourth = fixture(); fourth.owner.update(fourth.scene); const held = job(); held.finish(); await tick(); fourth.owner.dispose(); fourth.owner.ack(current(fourth)); assert.equal(held.released, 0); assert.equal(held.queryReleased, 1); fourth.owner.rendererRetired(); fourth.owner.rendererRetired(); assert.equal(held.released, 1); assert(!fourth.events.includes('ready:a')); checks++;
const fifth = fixture(); fifth.owner.update(fifth.scene); const pending = job(); fifth.owner.dispose(); assert.equal(pending.signal.aborted, true); pending.finish(); await tick(); assert.equal(pending.released, 1); assert.equal(fifth.sent.length, 0); fifth.owner.rendererRetired(); checks++;
// Explicit rejection, producer failure and synchronous send failure are terminal.
const sixth = fixture(); sixth.owner.update(scene); const rejected = job(); rejected.finish(); await tick(); sixth.owner.ack(current(sixth), false); assert.equal(sixth.failures(), 1); assert.equal(rejected.released, 1); sixth.owner.rendererRetired(); checks++;
const seventh = fixture(); seventh.owner.update(scene); job().reject(); await tick(); assert.equal(seventh.failures(), 1); seventh.owner.rendererRetired(); checks++;
let errors = 0; const throwing = createNativeStickerWarmup({send() {throw Error('send');}, fail() {errors++;}}); throwing.update(scene); const unsent = job(); unsent.finish(); await tick(); assert.equal(errors, 1); assert.equal(unsent.released, 1); assert.equal(unsent.transferred, 0); throwing.rendererRetired(); checks++;
// Reentrant ACK occurs after transfer custody; reentrant callback supersession
// cannot publish the previous full readiness set.
const synchronous = createNativeStickerWarmup({send(sequence) {synchronous.ack(sequence);}, fail(error) {throw error;}}); synchronous.update(scene); const sync = job(); sync.finish(); await tick(); assert.equal(sync.transferred, 1); assert.equal(sync.released, 0); synchronous.rendererRetired(); assert.equal(sync.released, 1); checks++;
const reentrant = fixture(); reentrant.owner.update({...scene, onArtworkReady() {reentrant.owner.update(changed);}, onPrepared(ids) {reentrant.events.push(ids.join(','));}}); job().finish(); await tick(); reentrant.owner.ack(current(reentrant)); assert(!reentrant.events.includes('a')); reentrant.owner.rendererRetired(); checks++;
const capacity = fixture(); capacity.owner.update({...scene, prepareIds: Array.from({length: 11}, (_, i) => String(i))}); assert.equal(capacity.failures(), 1); capacity.owner.rendererRetired();
const bytes = fixture(); bytes.owner.update({...scene, assets: [{...art, width: 5000, height: 5000}]}); assert.equal(bytes.failures(), 1); bytes.owner.rendererRetired(); checks += 2;
const queryLimit=fixture();queryLimit.owner.update(scene);const oversized=job();oversized.finish(64*1024*1024+1);await tick();assert.equal(queryLimit.failures(),1);assert.equal(oversized.released,1);queryLimit.owner.rendererRetired();checks++;
const exactLimit=fixture();exactLimit.owner.update(scene);job().finish(64*1024*1024);await tick();assert.equal(exactLimit.failures(),0);exactLimit.owner.ack(current(exactLimit));exactLimit.owner.rendererRetired();checks++;
// Actual production deadlines, concurrently waited; no fake clock or timing claim.
const timeout = fixture(); timeout.owner.update(scene); const noAck = job(); noAck.finish(); await tick();
const prepTimeout = fixture(); prepTimeout.owner.update(scene); const noResult = job();
await Bun.sleep(60_050); assert.equal(timeout.failures(), 1); assert.equal(prepTimeout.failures(), 1); assert.equal(noAck.released, 0); assert.equal(noResult.signal.aborted, true); timeout.owner.rendererRetired(); noResult.finish(); await tick(); prepTimeout.owner.rendererRetired(); assert.equal(noAck.released, 1); assert.equal(noResult.released, 1); checks += 2;
const result = {method: 'Actual warmup controller with controlled preparation boundary and actual 60s preparation/ACK watchdogs; no GPU readiness claim.', checks};
await Bun.write(new URL('./lifecycle.json', import.meta.url), JSON.stringify(result, null, 2) + '\n'); console.log(result);
