import type { ReactNode } from "react";

import {
  fillLightIntensity,
  fillLightPosition,
  keyLightPosition,
  type LightRigParams,
} from "./light-rig";
import {
  FRONT_DEVICE_ORIENTATION,
  deviceOrientationToRotation,
  type DeviceOrientation,
} from "./orientation";

/** Stable scene-graph identity used by the calibration probe. */
export const DEVICE_MODEL_NAME = "device-model";

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
  return (
    <>
      <pointLight
        name="device-key-light"
        position={keyLightPosition(lightRig.key)}
        intensity={lightRig.key.intensity}
        color={lightRig.key.color}
        decay={2}
      />
      <pointLight
        name="device-fill-light"
        position={fillLightPosition(lightRig.fill)}
        intensity={fillLightIntensity(lightRig)}
        color={lightRig.fill.color}
        decay={2}
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
