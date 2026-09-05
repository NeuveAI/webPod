import { describe, expect, test } from 'bun:test';
import { Texture } from 'three';
import { createStickerTextureCache } from './sticker-texture-cache';
function harness() {
  const requests: { url: string; success: (texture: Texture) => void; failure: () => void }[] = [];
  const cache = createStickerTextureCache((url, success, failure) => { requests.push({ url, success, failure }); });
  return { cache, requests };
}
function trackedTexture() {
  const texture = new Texture();
  let disposals = 0;
  texture.addEventListener('dispose', () => { disposals++; });
  return { texture, disposals: () => disposals };
}
describe('shared sticker artwork recovery and ownership', () => {
  test('first failure recovers for both live subscribers with exactly one explicit retry', () => {
    const { cache, requests } = harness();
    let firstUpdates = 0; let secondUpdates = 0;
    const first = cache.subscribe('/print.png', () => { firstUpdates++; });
    const second = cache.subscribe('/print.png', () => { secondUpdates++; });
    expect(requests).toHaveLength(1);
    requests[0]?.failure();
    expect(cache.getSnapshot('/print.png').failed).toBe(true);
    expect(cache.retryFailed()).toBe(1);
    expect(cache.retryFailed()).toBe(0);
    expect(requests).toHaveLength(2);
    const loaded = trackedTexture(); requests[1]?.success(loaded.texture);
    expect(cache.getSnapshot('/print.png')).toEqual({ texture: loaded.texture, failed: false });
    expect(firstUpdates).toBeGreaterThan(1); expect(secondUpdates).toBeGreaterThan(1);
    expect(cache.retryFailed()).toBe(0);
    first(); expect(loaded.disposals()).toBe(0);
    second(); expect(loaded.disposals()).toBe(1);
  });
  test('repeated failures never schedule automatic requests and retry touches failed entries only', () => {
    const { cache, requests } = harness();
    const disposeA = cache.subscribe('/a.png', () => {});
    const disposeB = cache.subscribe('/b.png', () => {});
    requests[0]?.failure();
    expect(requests).toHaveLength(2);
    expect(cache.retryFailed()).toBe(1);
    requests[2]?.failure();
    expect(requests).toHaveLength(3);
    expect(cache.getSnapshot('/a.png').failed).toBe(true);
    expect(cache.getSnapshot('/b.png').failed).toBe(false);
    disposeA(); disposeB();
    expect(cache.retryFailed()).toBe(0);
  });
  test('late completion after final unmount disposes resources without resurrecting state', () => {
    const { cache, requests } = harness();
    const unsubscribe = cache.subscribe('/print.png', () => {});
    unsubscribe();
    const abandoned = trackedTexture(); requests[0]?.success(abandoned.texture);
    expect(abandoned.disposals()).toBe(1);
    expect(cache.getSnapshot('/print.png').texture).toBeNull();
    expect(cache.retryFailed()).toBe(0);
  });
  test('superseded request completion cannot replace or dispose successful retry resources', () => {
    const { cache, requests } = harness();
    const unsubscribe = cache.subscribe('/print.png', () => {});
    requests[0]?.failure(); cache.retryFailed();
    const current = trackedTexture(); requests[1]?.success(current.texture);
    const superseded = trackedTexture(); requests[0]?.success(superseded.texture);
    requests[0]?.failure();
    expect(superseded.disposals()).toBe(1);
    expect(current.disposals()).toBe(0);
    expect(cache.getSnapshot('/print.png').texture).toBe(current.texture);
    expect(cache.getSnapshot('/print.png').failed).toBe(false);
    unsubscribe(); expect(current.disposals()).toBe(1);
  });
});
