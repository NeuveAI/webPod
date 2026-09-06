import type { MeshPhysicalMaterial } from 'three';

/** One uniform owner is intentionally shared by preparation clones and the live print. */
export function applyStickerWear(material: MeshPhysicalMaterial, stickerId: string) {
  const amount = { value: 0 };
  let seed = 2166136261;
  for (const character of stickerId) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);
  const identity = { value: (seed >>> 0) / 0xffffffff * 97 };
  const patch = (shader: Pick<Parameters<MeshPhysicalMaterial['onBeforeCompile']>[0], 'uniforms' | 'fragmentShader'>) => {
    shader.uniforms['stickerWear'] = amount;
    shader.uniforms['stickerWearSeed'] = identity;
    shader.fragmentShader = `uniform float stickerWear;
      uniform float stickerWearSeed;
      float stickerDamage = 0.0;
      float stickerHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + stickerWearSeed) * 43758.5453); }
      ${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      #ifdef USE_MAP
      if (stickerWear > 0.0) {
        vec2 uv = vMapUv;
        vec2 edgeStep = vec2(0.012);
        float adjacentAlpha = min(min(texture2D(map, uv + vec2(edgeStep.x, 0.0)).a, texture2D(map, uv - vec2(edgeStep.x, 0.0)).a), min(texture2D(map, uv + vec2(0.0, edgeStep.y)).a, texture2D(map, uv - vec2(0.0, edgeStep.y)).a));
        float edgeScuff = (1.0 - smoothstep(0.1, 0.9, adjacentAlpha)) * smoothstep(0.28, 0.78, stickerHash(floor(uv * 61.0)));
        float abrasionPatch = smoothstep(0.91, 0.99, stickerHash(floor(uv * vec2(49.0, 57.0)))) * step(0.3, stickerHash(floor(uv * 213.0)));
        float line = abs(fract(uv.y * 23.0 + uv.x * 6.0 + stickerWearSeed) - 0.5);
        float hairline = (1.0 - smoothstep(0.015, 0.045, line)) * step(0.7, stickerHash(floor(uv * vec2(9.0, 23.0))));
        stickerDamage = clamp(stickerWear * (edgeScuff * 0.95 + abrasionPatch * 0.65 + hairline * 0.8), 0.0, 0.9);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.72, 0.68, 0.58), stickerDamage);
      }
      #endif`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 0.95, stickerDamage);');
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n #ifdef USE_CLEARCOAT\n material.clearcoat *= 1.0 - stickerDamage * 0.8;\n material.clearcoatRoughness = mix(material.clearcoatRoughness, 0.95, stickerDamage);\n #endif');
  };
  material.onBeforeCompile = patch;
  material.customProgramCacheKey = () => 'webpod-sticker-wear-v1';
  return { amount, identity, patch, set(value: number) { amount.value = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0; } };
}
