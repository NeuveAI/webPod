import type { ReactNode } from "react";
import { RectAreaLight } from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";

import {
  fillSurfaceLightIntensity,
  fillLightPosition,
  keyLightPosition,
  surfaceLightIntensity,
  type LightRigParams,
} from "./light-rig";
import { DEVICE_LAYOUT } from "./layout";
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
 * Keeps LAW 2's lamps in viewer/world space while rotating only the device.
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
  const fillPosition = fillLightPosition(lightRig.fill);
  return (
    <>
      <rectAreaLight
        name="device-key-light"
        position={keyPosition}
        rotation={aimAreaLightAtOrigin(keyPosition)}
        intensity={surfaceLightIntensity(
          lightRig.key.intensity,
          lightRig.key.distance,
        )}
        color={lightRig.key.color}
        width={DEVICE_LAYOUT.body.width * 1.65}
        height={DEVICE_LAYOUT.body.height * 0.52}
      />
      <rectAreaLight
        name="device-fill-light"
        position={fillPosition}
        rotation={aimAreaLightAtOrigin(fillPosition)}
        intensity={fillSurfaceLightIntensity(lightRig)}
        color={lightRig.fill.color}
        width={DEVICE_LAYOUT.body.width * 1.2}
        height={DEVICE_LAYOUT.body.height * 0.42}
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
