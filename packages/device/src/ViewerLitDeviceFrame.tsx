import type { ReactNode } from "react";
import { RectAreaLight } from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";

import {
  areaLightIntensity,
  keyLightPower,
  keyLightPosition,
  kickLightPosition,
  kickLightPower,
  type LightRigParams,
} from "./light-rig";
import {
  FRONT_DEVICE_ORIENTATION,
  deviceOrientationToRotation,
  type DeviceOrientation,
} from "./orientation";

/** Stable scene-graph identity used by the calibration probe. */
export const DEVICE_MODEL_NAME = "device-model";

RectAreaLightUniformsLib.init();

type ViewerLitDeviceFrameProps = {
  readonly orientation?: DeviceOrientation;
  readonly lightRig: LightRigParams;
  readonly children: ReactNode;
};

/**
 * Keeps the authored key and kick in world space while rotating only the device.
 *
 * The sibling relationship is load-bearing: putting either light below the
 * model group would bolt it to the iPod and reverse the rig in the back view.
 */
export function ViewerLitDeviceFrame({
  orientation = FRONT_DEVICE_ORIENTATION,
  lightRig,
  children,
}: ViewerLitDeviceFrameProps) {
  const keyPosition = keyLightPosition(lightRig.key);
  const kickPosition = kickLightPosition(lightRig.kick);
  return (
    <>
      <rectAreaLight
        name="device-key-light"
        position={keyPosition}
        rotation={aimAreaLightAtOrigin(keyPosition)}
        intensity={areaLightIntensity(keyLightPower(lightRig), lightRig.key.emitter)}
        color={lightRig.key.color}
        width={lightRig.key.emitter.width}
        height={lightRig.key.emitter.height}
      />
      <rectAreaLight
        name="device-kick-light"
        position={kickPosition}
        rotation={aimAreaLightAtOrigin(kickPosition)}
        intensity={areaLightIntensity(kickLightPower(lightRig), lightRig.kick.emitter)}
        color={lightRig.kick.color}
        width={lightRig.kick.emitter.width}
        height={lightRig.kick.emitter.height}
      />
      <group
        name={DEVICE_MODEL_NAME}
        rotation={deviceOrientationToRotation(orientation)}
      >
        {children}
      </group>
    </>
  );
}

/** XYZ radians that point a RectAreaLight's emitting face at model origin. */
export function aimAreaLightAtOrigin(
  position: readonly [number, number, number],
): readonly [number, number, number] {
  const light = new RectAreaLight();
  light.position.fromArray(position);
  light.lookAt(0, 0, 0);
  return [light.rotation.x, light.rotation.y, light.rotation.z];
}
