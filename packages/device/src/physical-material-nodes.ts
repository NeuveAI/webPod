import { nodeVec3 } from './node-material-values';
import { Color, type RectAreaLight, type Texture } from 'three';
import { MeshPhysicalNodeMaterial, PhysicalLightingModel, RectAreaLightNode, type NodeBuilder } from 'three/webgpu';
import { cameraViewMatrix, color, mat3, normalView, objectWorldMatrix, positionView, positionViewDirection, vec4 } from 'three/tsl';
import { evaluateAreaLightNodes } from './area-light-nodes';
import type { PhysicalSurfaceParams } from './materials';

type DirectInput = Parameters<PhysicalLightingModel['direct']>[0];
type AreaInput = Parameters<PhysicalLightingModel['directRectArea']>[0];
export interface GlassCardLights {
  readonly key: RectAreaLight;
  /** Same first-two RectAreaLight identities/order as the authored GL rig. */
  readonly aligned: readonly RectAreaLight[];
}
interface Transport { readonly color: Color; readonly distortion: number; readonly attenuation: number; readonly power: number; readonly scale: number }

/** Extends stock physical lighting instead of replacing its BRDF/transmission.
 * Extra diffuse transport and card size/power are the exact authored GL terms.
 */
class DevicePhysicalLighting extends PhysicalLightingModel {
  constructor(material: MeshPhysicalNodeMaterial, private readonly transport?: Transport, private readonly cards?: GlassCardLights) {
    super(material.useClearcoat, material.useSheen, material.useIridescence, material.useAnisotropy, material.useTransmission, material.useDispersion);
  }
  override direct(data: DirectInput, builder: NodeBuilder) {
    if (this.transport) {
      const t = this.transport;
      const half = nodeVec3(data.lightDirection).add(normalView.mul(t.distortion)).normalize();
      const amount = positionViewDirection.dot(half.negate()).saturate().pow(t.power).mul(t.scale * t.attenuation);
      data.reflectedLight.directDiffuse.assign(nodeVec3(data.reflectedLight.directDiffuse).add(color(t.color).mul(amount).mul(nodeVec3(data.lightColor))));
    }
    super.direct(data, builder);
  }
  override directRectArea(original: AreaInput, builder: NodeBuilder) {
    let data = original;
    if (this.cards) {
      let width = nodeVec3(data.halfWidth), height = nodeVec3(data.halfHeight);
      if (data.lightNode instanceof RectAreaLightNode && data.lightNode.light !== null && this.cards.aligned.includes(data.lightNode.light)) {
        const keyView = cameraViewMatrix.mul(objectWorldMatrix(this.cards.key));
        width = keyView.mul(vec4(1, 0, 0, 0)).xyz.normalize().mul(width.length());
        height = keyView.mul(vec4(0, 1, 0, 0)).xyz.normalize().mul(height.length());
      }
      data = { ...data, halfWidth: width.mul(1.6), halfHeight: height.mul(1.6), lightColor: nodeVec3(data.lightColor).div(2.56) };
    }
    if (this.transport) {
      const t = this.transport, lightPosition = nodeVec3(data.lightPosition), width = nodeVec3(data.halfWidth), height = nodeVec3(data.halfHeight);
      const half = lightPosition.sub(positionView).normalize().add(normalView.mul(t.distortion)).normalize();
      const amount = positionViewDirection.dot(half.negate()).saturate().pow(t.power).mul(t.scale * t.attenuation);
      const irradiance = evaluateAreaLightNodes({ N: normalView, V: positionViewDirection, P: positionView, mInv: mat3(1, 0, 0, 0, 1, 0, 0, 0, 1), p0: lightPosition.add(width).sub(height), p1: lightPosition.sub(width).sub(height), p2: lightPosition.sub(width).add(height), p3: lightPosition.add(width).add(height) });
      data.reflectedLight.directDiffuse.assign(nodeVec3(data.reflectedLight.directDiffuse).add(color(t.color).mul(amount).mul(nodeVec3(data.lightColor)).mul(nodeVec3(irradiance))));
    }
    super.directRectArea(data, builder);
  }
}
class DevicePhysicalNodeMaterial extends MeshPhysicalNodeMaterial {
  transport?: Transport;
  cards?: GlassCardLights;
  override setupLightingModel() { return new DevicePhysicalLighting(this, this.transport, this.cards); }
  override customProgramCacheKey() {
    const t = this.transport;
    return `${super.customProgramCacheKey()}:webpod-physical:${t ? [t.color.r, t.color.g, t.color.b, t.distortion, t.attenuation, t.power, t.scale].join(',') : 'no-transport'}:${this.cards ? [this.cards.key.uuid, ...this.cards.aligned.map(light => light.uuid)].join(',') : 'no-cards'}`;
  }
}

/** Node equivalent of the authored polycarbonate factory; all physical fields survive. */
export function createPolycarbonateNodeMaterial(params: PhysicalSurfaceParams, envMap: Texture | null) {
  const { subsurfaceColor = '#000000', subsurfaceDistortion = 0, subsurfaceAttenuation = 0, subsurfacePower = 1, subsurfaceScale = 0, albedoScale = 1, color, ...physical } = params;
  const material = new DevicePhysicalNodeMaterial({ ...physical, color: new Color(color).multiplyScalar(albedoScale), envMap });
  if (subsurfaceScale > 0 && subsurfaceAttenuation > 0) material.transport = { color: new Color(subsurfaceColor), distortion: subsurfaceDistortion, attenuation: subsurfaceAttenuation, power: subsurfacePower, scale: subsurfaceScale };
  return material;
}

/** Keep the exact glass model and only alter reflected rectangle cards. */
export function createCoverGlassNodeMaterial(params: PhysicalSurfaceParams, envMap: Texture | null, lights: GlassCardLights) {
  const material = new DevicePhysicalNodeMaterial({ ...params, depthWrite: false, envMap });
  material.cards = lights;
  return material;
}
