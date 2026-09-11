import { nodeVec4 } from './node-material-values';
import { DataTexture, RGBAFormat, type Texture } from 'three';
import { MeshPhysicalNodeMaterial, type Node, type NodeBuilder } from 'three/webgpu';
import { Fn, If, abs, clamp, clearcoat, clearcoatRoughness, cos, float, floor, fract, fwidth, materialColor, materialRoughness, max, min, mix, sin, smoothstep, step, texture, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import { prepareStickerDamage, type StickerDamageResource } from './sticker-alpha';


/** Wear modifies clearcoat after stock geometry-roughness processing, matching
 * the authored lights_physical_fragment insertion point exactly. */
export class StickerPhysicalNodeMaterial extends MeshPhysicalNodeMaterial {
  wearDamageNode: Node<'float'> | null = null;
  override setupVariants(builder: NodeBuilder) {
    super.setupVariants(builder);
    if (this.wearDamageNode && this.useClearcoat) {
      clearcoat.mulAssign(float(1).sub(this.wearDamageNode.mul(.8)));
      clearcoatRoughness.assign(mix(clearcoatRoughness, .95, this.wearDamageNode));
    }
  }
}

function mappedUv(image: Texture) {
  const matrix = uniform(image.matrix).onRenderUpdate(() => {
    if (image.matrixAutoUpdate) image.updateMatrix();
    return image.matrix;
  });
  return matrix.mul(vec3(uv(image.channel), 1)).xy;
}

/** Exact authored UV wear field expressed as backend-neutral TSL. The mask
 * resource remains owned by the existing damage cache; only the empty fallback
 * texture belongs to this controller. Uniform changes never rebuild shaders.
 */
export function applyStickerWearNodes(material: StickerPhysicalNodeMaterial, stickerId: string, backing = false, preparedDamage: StickerDamageResource | null = material.map === null ? null : prepareStickerDamage(material.map, stickerId)) {
  const amount = uniform(0);
  let seed = 2166136261;
  for (const character of stickerId) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);
  const identity = uniform((seed >>> 0) / 0xffffffff * 97);
  const field = preparedDamage;
  const empty = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, RGBAFormat); empty.needsUpdate = true;
  const damageMap = texture(field?.texture ?? empty);
  const enabled = uniform(field !== null);
  const map = material.map ? texture(material.map) : null;
  if (map) map.updateMatrix = false;
  const coordinates = material.map ? mappedUv(material.map) : uv();
  damageMap.updateMatrix = false;
  const hash = Fn(([p]: [Node<'vec2'>]) => fract(sin(p.dot(vec2(127.1, 311.7)).add(identity)).mul(43758.5453)));
  const noise = Fn(([p]: [Node<'vec2'>]) => {
    const cell = floor(p), f0 = fract(p), f = f0.mul(f0).mul(float(3).sub(f0.mul(2)));
    return mix(mix(hash(cell), hash(cell.add(vec2(1, 0))), f.x), mix(hash(cell.add(vec2(0, 1))), hash(cell.add(vec2(1))), f.x), f.y);
  });
  const fields = Fn(() => {
    const damage = float(0).toVar(), groove = float(0).toVar(), alpha = float(1).toVar(), lip = float(0).toVar();
    if (map) {
      const coord = coordinates;
      If(enabled.and(amount.greaterThan(0)), () => {
        const onset = damageMap.sample(coord).r;
        alpha.assign(float(1).sub(step(onset, amount).mul(float(1).sub(step(.999, onset)))));
      });
      if (!backing) If(amount.greaterThan(0), () => {
        const adjacent = min(min(map.sample(coord.add(vec2(.012, 0))).a, map.sample(coord.sub(vec2(.012, 0))).a), min(map.sample(coord.add(vec2(0, .012))).a, map.sample(coord.sub(vec2(0, .012))).a));
        const edgeScuff = float(1).sub(smoothstep(.1, .9, adjacent)).mul(smoothstep(.35, .8, noise(coord.mul(95))));
        const abrasion = smoothstep(.72, .92, noise(coord.mul(vec2(91, 113)))).mul(smoothstep(.35, .8, noise(coord.mul(281))));
        const scratchCell = floor(coord.mul(12)), scratchLocal = fract(coord.mul(12)).sub(.5);
        const scratchAngle = hash(scratchCell).mul(6.283185), scratchAxis = vec2(cos(scratchAngle), sin(scratchAngle));
        const along = scratchLocal.dot(scratchAxis), across = abs(scratchLocal.dot(vec2(scratchAxis.y.negate(), scratchAxis.x)));
        const hairline = float(1).sub(smoothstep(.012, .035, across)).mul(float(1).sub(smoothstep(.15, .42, abs(along)))).mul(step(.45, hash(scratchCell.add(7))));
        damage.assign(clamp(amount.mul(edgeScuff.mul(.95).add(abrasion.mul(.18)).add(hairline.mul(.8))), 0, .9));
        const grooveUv = coord.mul(vec2(7, 5)), cell = floor(grooveUv), local = fract(grooveUv).sub(.5);
        const angle = hash(cell.add(19)).mul(1.4).add(.7), axis = vec2(cos(angle), sin(angle));
        const acrossGroove = abs(local.dot(vec2(axis.y.negate(), axis.x))), alongGroove = abs(local.dot(axis));
        const length = float(1).sub(smoothstep(hash(cell.add(13)).mul(.12).add(.12), .43, alongGroove));
        const mask = length.mul(step(.65, hash(cell.add(31)))).mul(smoothstep(.55, 1, amount));
        const aa = max(fwidth(acrossGroove), .002);
        groove.assign(float(1).sub(smoothstep(.006, aa.add(.006), acrossGroove)).mul(mask));
        lip.assign(float(1).sub(smoothstep(.015, aa.add(.015), acrossGroove)).mul(mask));
      });
    }
    return vec4(damage, groove, alpha, lip);
  })().toVar('stickerWearFields');
  material.colorNode = Fn(() => {
    const base = nodeVec4(materialColor), rgb = (backing && map ? vec3(.66, .60, .49) : base.rgb).toVar();
    if (!backing) {
      rgb.assign(mix(rgb, vec3(.72, .68, .58), max(fields.x, fields.w.mul(.85))));
      rgb.assign(mix(rgb, vec3(.20, .18, .14), fields.y.mul(.75)));
    }
    return vec4(rgb, base.a.mul(fields.z));
  })();
  const damage = max(fields.x, fields.w);
  material.roughnessNode = mix(materialRoughness, .95, damage);
  material.wearDamageNode = damage;
  return {
    amount, identity,
    set(value: number) { amount.value = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0; },
    setDamage(resource: StickerDamageResource | null) { damageMap.value = resource?.texture ?? empty; enabled.value = resource !== null; },
    dispose() { empty.dispose(); },
  };
}

/** Locked/consumed sheet seats intentionally replace front wear, as in GL. */
export function installStickerSeatNodes(material: MeshPhysicalNodeMaterial, appearance: 'locked' | 'placed', map: Texture | null) {
  if (appearance === 'locked') {
    material.colorNode = Fn(() => { const base = nodeVec4(materialColor); return vec4(mix(vec3(base.rgb.dot(vec3(.299, .587, .114))), vec3(.42, .40, .34), .35), base.a); })();
    material.opacity = .85;
  } else {
    material.colorNode = Fn(() => {
      const base = nodeVec4(materialColor);
      if (!map) return vec4(vec3(.43, .40, .34), base.a);
      const sample = texture(map), coord = mappedUv(map), cut = fwidth(coord).mul(1.3);
      sample.updateMatrix = false;
      const neighbor = min(min(sample.sample(coord.add(vec2(cut.x, 0))).a, sample.sample(coord.sub(vec2(cut.x, 0))).a), min(sample.sample(coord.add(vec2(0, cut.y))).a, sample.sample(coord.sub(vec2(0, cut.y))).a));
      return vec4(vec3(.43, .40, .34), base.a.mul(mix(.15, .9, float(1).sub(neighbor))));
    })();
    material.opacity = 1;
  }
  if (material instanceof StickerPhysicalNodeMaterial) material.wearDamageNode = null;
  material.roughnessNode = null;
  material.clearcoatNode = null;
  material.clearcoatRoughnessNode = null;
  material.clearcoat = 0;
}
