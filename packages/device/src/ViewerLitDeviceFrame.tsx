import type { ReactNode } from "react";

import {
  fillLightIntensity,
  fillLightPosition,
  keyLightPosition,
  type LightRigParams,
} from "./light-rig";

/** Stable scene-graph identity used by the calibration probe. */
export const DEVICE_MODEL_NAME = "device-model";

type ViewerLitDeviceFrameProps = {
  readonly face: "front" | "back";
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
  face,
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
        rotation={face === "back" ? [0, Math.PI, 0] : [0, 0, 0]}
      >
        {children}
      </group>
    </>
  );
}
