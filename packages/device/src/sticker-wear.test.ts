import { expect, test } from 'bun:test';
import { MeshPhysicalMaterial, Texture } from 'three';
import { applyStickerWear } from './sticker-wear';

test('wear changes one retained uniform without material versions or shader variants', () => {
  const map = new Texture(); const front = new MeshPhysicalMaterial({ map, clearcoat: .4 });
  const wear = applyStickerWear(front, 'PW-C01'); const version = front.version; const key = front.customProgramCacheKey();
  const shader = { uniforms: {} as Record<string, { value: unknown }>, fragmentShader: '#include <map_fragment>\n#include <roughnessmap_fragment>\n#include <lights_physical_fragment>' };
  wear.patch(shader);
  for (let index = 0; index <= 100; index++) { wear.set(index / 100); expect(shader.uniforms['stickerWear']).toBe(wear.amount); expect(front.version).toBe(version); expect(front.customProgramCacheKey()).toBe(key); }
  expect(wear.amount.value).toBe(1); wear.set(0); expect(wear.amount.value).toBe(0);
  expect(shader.fragmentShader).not.toContain('diffuseColor.a =');
  expect(shader.fragmentShader).not.toContain('diffuseColor.a *=');
  expect(shader.fragmentShader).not.toContain('discard');
  expect(shader.fragmentShader).toContain('material.clearcoatRoughness');
  expect(front.map).toBe(map); front.dispose(); map.dispose();
});

test('prepared clones retain the same mutable wear owner and deterministic artwork seed', () => {
  const front = new MeshPhysicalMaterial(); const wear = applyStickerWear(front, 'PW-C01');
  const clone = front.clone(); clone.onBeforeCompile = front.onBeforeCompile; clone.customProgramCacheKey = front.customProgramCacheKey;
  expect(clone.onBeforeCompile).toBe(wear.patch); expect(clone.customProgramCacheKey()).toBe(front.customProgramCacheKey());
  const matching = new MeshPhysicalMaterial(); const other = new MeshPhysicalMaterial();
  expect(applyStickerWear(matching, 'PW-C01').identity.value).toBe(wear.identity.value);
  expect(applyStickerWear(other, 'PW-C02').identity.value).not.toBe(wear.identity.value);
  wear.set(.7); expect(wear.amount.value).toBe(.7);
  front.dispose(); expect(wear.amount.value).toBe(.7); clone.dispose(); matching.dispose(); other.dispose();
});
