import { expect, test } from 'bun:test';
import { Group, Material, Mesh, MeshPhysicalMaterial, PerspectiveCamera, PlaneGeometry, Scene, Texture } from 'three';
import { prepareStickerPrograms } from './sticker-program-preparation';

type Renderer = Parameters<typeof prepareStickerPrograms>[0];
const pause = (ms = 25): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
function harness() {
  const root = new Group(), geometry = new PlaneGeometry(), map = new Texture();
  const material = new MeshPhysicalMaterial({ map, clearcoat: .3 });
  material.name = 'active-print';
  material.onBeforeCompile = function () { this.userData.compiledVariant = this.name; };
  material.customProgramCacheKey = function () { return this.name + '-locked'; };
  root.add(new Mesh(geometry, material), new Mesh(geometry, [material, material]));
  const camera = new PerspectiveCamera(), scene = new Scene(), signal = new AbortController();
  const events = new EventTarget();
  const properties = new Map<Material, unknown>();
  const clones: Material[] = [];
  const disposals = new Map<Material, number>();
  let compilations = 0, polls = 0, lost = false, ready = false;
  let originalDisposals = 0, geometryDisposals = 0, mapDisposals = 0;
  let afterCompile: (() => void) | undefined;
  let beforeReady: (() => void) | undefined;
  material.addEventListener('dispose', () => { originalDisposals++; properties.delete(material); });
  geometry.addEventListener('dispose', () => { geometryDisposals++; });
  map.addEventListener('dispose', () => { mapDisposals++; });
  const renderer: Renderer = {
    properties: { get: (value) => properties.get(value) },
    domElement: events,
    getContext: () => ({ isContextLost: () => lost }),
    compile(copy, receivedCamera, receivedScene) {
      compilations++;
      expect(copy).not.toBe(root); expect(receivedCamera).toBe(camera); expect(receivedScene).toBe(scene);
      const compiled = new Set<Material>();
      copy.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        expect(object.geometry).toBe(geometry);
        for (const value of Array.isArray(object.material) ? object.material : [object.material]) compiled.add(value);
      });
      for (const value of compiled) {
        clones.push(value); disposals.set(value, 0);
        value.addEventListener('dispose', () => { disposals.set(value, (disposals.get(value) ?? 0) + 1); properties.delete(value); });
        const program = { token: 'bound-receiver', isReady() {
          expect(this.token).toBe('bound-receiver');
          expect(disposals.get(value)).toBe(0);
          polls++; beforeReady?.(); return ready;
        } };
        properties.set(value, { currentProgram: program });
      }
      afterCompile?.();
      return compiled;
    },
  };
  return { root, material, geometry, map, camera, scene, signal, renderer, clones, properties, disposals,
    run: (timeoutMs?: number) => prepareStickerPrograms(renderer, root, camera, scene, signal.signal, timeoutMs),
    counts: () => ({ compilations, polls, originalDisposals, geometryDisposals, mapDisposals }),
    ready: () => { ready = true; },
    afterCompile: (fn: () => void) => { afterCompile = fn; },
    beforeReady: (fn: () => void) => { beforeReady = fn; },
    lose: () => { lost = true; events.dispatchEvent(new Event('webglcontextlost')); },
    restore: () => { lost = false; },
    disposeBorrowed: () => { material.dispose(); geometry.dispose(); map.dispose(); },
  };
}

test('successful preparation preserves exact variants and holds warmed program owners until abort', async () => {
  const h = harness(); h.ready(); await h.run();
  expect(h.clones).toHaveLength(1); // Shared material aliases stay shared in the copied graph.
  const clone = h.clones[0]; if (clone === undefined) throw new Error('Expected prepared material');
  expect(clone).not.toBe(h.material);
  expect(clone).toBeInstanceOf(MeshPhysicalMaterial);
  if (!(clone instanceof MeshPhysicalMaterial)) throw new Error('Expected physical material');
  expect(clone.map).toBe(h.map); expect(clone.clearcoat).toBe(.3);
  expect(clone.onBeforeCompile).toBe(h.material.onBeforeCompile);
  expect(clone.customProgramCacheKey()).toBe('active-print-locked');
  expect(h.disposals.get(clone)).toBe(0);
  const polls = h.counts().polls; await pause(); expect(h.counts().polls).toBe(polls);
  h.signal.abort(); h.signal.abort(); h.lose();
  expect(h.disposals.get(clone)).toBe(1);
  expect(h.counts()).toMatchObject({ originalDisposals: 0, geometryDisposals: 0, mapDisposals: 0 });
  h.disposeBorrowed();
});

test('original unmount cannot invalidate captured cloned-program metadata while pending', async () => {
  const h = harness(); const task = h.run();
  h.root.clear(); h.material.dispose(); h.geometry.dispose(); h.map.dispose();
  expect(h.clones.every((material) => h.properties.has(material))).toBe(true);
  h.ready(); await task;
  expect(h.disposals.get(h.clones[0] ?? h.material)).toBe(0);
  h.signal.abort();
  expect(h.counts()).toMatchObject({ originalDisposals: 1, geometryDisposals: 1, mapDisposals: 1 });
  expect([...h.disposals.values()]).toEqual([1]);
});

test('pre-abort does not clone or compile; in-flight abort cancels polling and settles once', async () => {
  const early = harness(); early.signal.abort(); await expect(early.run()).rejects.toMatchObject({ name: 'AbortError' });
  expect(early.counts().compilations).toBe(0); expect(early.clones).toHaveLength(0); early.disposeBorrowed();
  const h = harness(); const task = h.run();
  h.signal.abort(); await expect(task).rejects.toMatchObject({ name: 'AbortError' });
  const polls = h.counts().polls; h.ready(); await pause();
  expect(h.counts().polls).toBe(polls); expect([...h.disposals.values()]).toEqual([1]);
  h.disposeBorrowed();
});

test('abort raised inside synchronous compile defers disposal until compile returns', async () => {
  const h = harness();
  h.afterCompile(() => { h.signal.abort(); expect([...h.disposals.values()]).toEqual([0]); });
  await expect(h.run()).rejects.toMatchObject({ name: 'AbortError' });
  expect([...h.disposals.values()]).toEqual([1]); expect(h.counts().polls).toBe(0);
  h.disposeBorrowed();
});

test('context loss cancels before invalid program queries; restoration requires a fresh generation', async () => {
  const h = harness(); const task = h.run(); h.lose();
  await expect(task).rejects.toMatchObject({ name: 'AbortError' });
  const polls = h.counts().polls; await pause(); expect(h.counts().polls).toBe(polls);
  expect([...h.disposals.values()]).toEqual([1]);
  h.restore(); h.ready(); const restored = new AbortController();
  await prepareStickerPrograms(h.renderer, h.root, h.camera, h.scene, restored.signal);
  expect(h.counts().compilations).toBe(2); expect(h.clones[0]).not.toBe(h.clones[1]);
  expect([...h.disposals.values()]).toEqual([1, 0]);
  restored.abort(); expect([...h.disposals.values()]).toEqual([1, 1]); h.disposeBorrowed();
});

test('missing metadata, throwing readiness and synchronous compile failure reject without leaked owners', async () => {
  for (const failure of ['missing', 'invalid', 'poll', 'compile'] as const) {
    const h = harness();
    h.afterCompile(() => {
      if (failure === 'compile') throw new Error('Synthetic compile failure');
      for (const material of h.clones) h.properties.set(material, failure === 'missing' ? {} : failure === 'invalid' ? { currentProgram: { isReady: false } } : { currentProgram: { isReady() { throw new Error('Synthetic driver failure'); } } });
    });
    await expect(h.run()).rejects.toBeInstanceOf(Error);
    const polls = h.counts().polls; await pause(); expect(h.counts().polls).toBe(polls);
    expect([...h.disposals.values()]).toEqual([1]); h.disposeBorrowed();
  }
});

test('never-ready programs time out, clear their timer, and cannot report late readiness', async () => {
  const h = harness(); await expect(h.run(20)).rejects.toThrow('timed out');
  const polls = h.counts().polls; h.ready(); await pause();
  expect(h.counts().polls).toBe(polls); expect([...h.disposals.values()]).toEqual([1]); h.disposeBorrowed();
});

test('cancellation raised while polling does not dispose a program during its readiness call', async () => {
  const h = harness();
  h.beforeReady(() => { h.signal.abort(); expect([...h.disposals.values()]).toEqual([0]); });
  await expect(h.run()).rejects.toMatchObject({ name: 'AbortError' });
  expect([...h.disposals.values()]).toEqual([1]); h.disposeBorrowed();
});
