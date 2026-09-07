import type { MeshPhysicalMaterial } from 'three';
import { prepareStickerDamage, setStickerMaterialDamage, type StickerDamageResource } from './sticker-alpha';

/** One uniform owner is intentionally shared by preparation clones and the live print. */
export function applyStickerWear(material: MeshPhysicalMaterial, stickerId: string, backing = false) {
  const field = material.map === null ? null : prepareStickerDamage(material.map, stickerId);
  const amount = { value: 0 };
  const damageTexture = { value: field?.texture ?? null }, damageEnabled = { value: field !== null };
  let seed = 2166136261;
  for (const character of stickerId) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);
  const identity = { value: (seed >>> 0) / 0xffffffff * 97 };
  const patch = (shader: Pick<Parameters<MeshPhysicalMaterial['onBeforeCompile']>[0], 'uniforms' | 'fragmentShader'>) => {
    shader.uniforms['stickerWear'] = amount;
    shader.uniforms['stickerWearSeed'] = identity;
    shader.uniforms['stickerDamageField'] = damageTexture;
    shader.uniforms['stickerDamageEnabled'] = damageEnabled;
    shader.fragmentShader = `uniform float stickerWear;
      uniform float stickerWearSeed;
      uniform sampler2D stickerDamageField;
      uniform bool stickerDamageEnabled;
      float stickerDamage = 0.0;
      float stickerGroove = 0.0;
      float stickerHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + stickerWearSeed) * 43758.5453); }
      float stickerNoise(vec2 p) {
        vec2 cell = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(stickerHash(cell), stickerHash(cell + vec2(1.0, 0.0)), f.x), mix(stickerHash(cell + vec2(0.0, 1.0)), stickerHash(cell + vec2(1.0)), f.x), f.y);
      }
      ${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      #ifdef USE_MAP
      if (stickerDamageEnabled && stickerWear > 0.0) {
        float damageOnset = texture2D(stickerDamageField, vMapUv).r;
        diffuseColor.a *= 1.0 - step(damageOnset, stickerWear) * (1.0 - step(0.999, damageOnset));
      }
      ${backing ? 'diffuseColor.rgb = vec3(0.66, 0.60, 0.49);' : ''}
      if (stickerWear > 0.0 && ${backing ? 'false' : 'true'}) {
        vec2 uv = vMapUv;
        vec2 edgeStep = vec2(0.012);
        float adjacentAlpha = min(min(texture2D(map, uv + vec2(edgeStep.x, 0.0)).a, texture2D(map, uv - vec2(edgeStep.x, 0.0)).a), min(texture2D(map, uv + vec2(0.0, edgeStep.y)).a, texture2D(map, uv - vec2(0.0, edgeStep.y)).a));
        float edgeScuff = (1.0 - smoothstep(0.1, 0.9, adjacentAlpha)) * smoothstep(0.35, 0.8, stickerNoise(uv * 95.0));
        float abrasionPatch = smoothstep(0.72, 0.92, stickerNoise(uv * vec2(91.0, 113.0))) * smoothstep(0.35, 0.8, stickerNoise(uv * 281.0));
        vec2 scratchCell = floor(uv * 12.0);
        vec2 scratchLocal = fract(uv * 12.0) - 0.5;
        float scratchAngle = stickerHash(scratchCell) * 6.283185;
        vec2 scratchAxis = vec2(cos(scratchAngle), sin(scratchAngle));
        float scratchAlong = dot(scratchLocal, scratchAxis);
        float scratchAcross = abs(dot(scratchLocal, vec2(-scratchAxis.y, scratchAxis.x)));
        float hairline = (1.0 - smoothstep(0.012, 0.035, scratchAcross)) * (1.0 - smoothstep(0.15, 0.42, abs(scratchAlong))) * step(0.45, stickerHash(scratchCell + 7.0));
        stickerDamage = clamp(stickerWear * (edgeScuff * 0.95 + abrasionPatch * 0.18 + hairline * 0.8), 0.0, 0.9);
        float heavyWear = smoothstep(0.55, 1.0, stickerWear);
        // Sparse elongated cuts with a dark trough and a narrow exposed-paper lip.
        vec2 grooveUv = uv * vec2(7.0, 5.0);
        vec2 grooveCell = floor(grooveUv), grooveLocal = fract(grooveUv) - 0.5;
        float grooveAngle = stickerHash(grooveCell + 19.0) * 1.4 + 0.7;
        vec2 grooveAxis = vec2(cos(grooveAngle), sin(grooveAngle));
        float grooveAcross = abs(dot(grooveLocal, vec2(-grooveAxis.y, grooveAxis.x)));
        float grooveAlong = abs(dot(grooveLocal, grooveAxis));
        float grooveLength = 1.0 - smoothstep(0.12 + stickerHash(grooveCell + 13.0) * 0.12, 0.43, grooveAlong);
        float grooveMask = grooveLength * step(0.65, stickerHash(grooveCell + 31.0)) * heavyWear;
        float aa = max(fwidth(grooveAcross), 0.002);
        stickerGroove = (1.0 - smoothstep(0.006, 0.006 + aa, grooveAcross)) * grooveMask;
        float grooveLip = (1.0 - smoothstep(0.015, 0.015 + aa, grooveAcross)) * grooveMask;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.72, 0.68, 0.58), max(stickerDamage, grooveLip * 0.85));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.20, 0.18, 0.14), stickerGroove * 0.75);
        stickerDamage = max(stickerDamage, grooveLip);
      }
      #endif`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 0.95, stickerDamage);');
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n #ifdef USE_CLEARCOAT\n material.clearcoat *= 1.0 - stickerDamage * 0.8;\n material.clearcoatRoughness = mix(material.clearcoatRoughness, 0.95, stickerDamage);\n #endif');
  };
  material.onBeforeCompile = patch;
  material.customProgramCacheKey = () => `webpod-sticker-wear-v5-${backing ? 'back' : 'front'}`;
  return { amount, identity, patch, setDamage(resource: StickerDamageResource | null) {
    damageTexture.value = resource?.texture ?? null; damageEnabled.value = resource !== null;
    setStickerMaterialDamage(material, resource);
  }, set(value: number) { amount.value = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0; } };
}
