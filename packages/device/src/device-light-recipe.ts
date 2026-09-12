import { RectAreaLight } from 'three';
import { areaLightIntensity, keyLightPower, keyLightPosition, kickLightPosition, kickLightPower, rimLightPower, type LightRigParams } from './light-rig';

export interface DeviceLightRecipe {
  readonly name: string;
  readonly position: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
  readonly color: string; readonly intensity: number; readonly width: number; readonly height: number;
}
export function aimAreaLightAtTarget(position: readonly [number, number, number], target: readonly [number, number, number]): readonly [number, number, number] {
  const light = new RectAreaLight(); light.position.fromArray(position); light.lookAt(...target);
  return [light.rotation.x, light.rotation.y, light.rotation.z];
}
export function aimAreaLightAtOrigin(position: readonly [number, number, number]): readonly [number, number, number] { return aimAreaLightAtTarget(position, [0, 0, 0]); }
/** Exact authored ordering: key, kick, rim. The lights remain world siblings of
 * the model in both renderers; no light follows orientation or control pose. */
export function createDeviceLightRecipe(rig: LightRigParams): readonly DeviceLightRecipe[] {
  const key = keyLightPosition(rig.key), kick = kickLightPosition(rig.kick);
  return [
    { name: 'device-key-light', position: key, rotation: aimAreaLightAtOrigin(key), intensity: areaLightIntensity(keyLightPower(rig), rig.key.emitter), color: rig.key.color, ...rig.key.emitter },
    { name: 'device-kick-light', position: kick, rotation: aimAreaLightAtTarget(kick, rig.kick.target), intensity: areaLightIntensity(kickLightPower(rig), rig.kick.emitter), color: rig.kick.color, ...rig.kick.emitter },
    { name: 'device-rim-light', position: rig.rim.position, rotation: aimAreaLightAtTarget(rig.rim.position, rig.rim.target), intensity: areaLightIntensity(rimLightPower(rig), rig.rim.emitter), color: rig.rim.color, ...rig.rim.emitter },
  ];
}
