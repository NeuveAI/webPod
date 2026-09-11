import type { ReactNode } from "react";
import { createDeviceLightRecipe } from "./device-light-recipe";
export { aimAreaLightAtOrigin, aimAreaLightAtTarget } from "./device-light-recipe";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";

import type { LightRigParams } from "./light-rig";
import {
  FRONT_DEVICE_ORIENTATION,
  deviceOrientationToRotation,
  type DeviceOrientation,
} from "./orientation";
import { completeDeviceEnvelope } from "./device-envelope";
import { DEFAULT_DEVICE_FORM, type DeviceFormParams } from "./form";

/** Stable scene-graph identity used by the calibration probe. */
export const DEVICE_MODEL_NAME = "device-model";
/** Rigid model contents translated so the complete enclosure center is zero. */
export const DEVICE_CONTENT_NAME = "device-model-content";

RectAreaLightUniformsLib.init();

type ViewerLitDeviceFrameProps = {
  readonly orientation?: DeviceOrientation;
  readonly lightRig: LightRigParams;
  readonly form?: DeviceFormParams;
  readonly children: ReactNode;
};

/**
 * Keeps the key, fill and rim world-fixed while rotating only the device.
 *
 * The sibling relationship is load-bearing: putting any light below the
 * model group would bolt it to the iPod and reverse the rig in the back view.
 */
export function ViewerLitDeviceFrame({
  orientation = FRONT_DEVICE_ORIENTATION,
  lightRig,
  form = DEFAULT_DEVICE_FORM,
  children,
}: ViewerLitDeviceFrameProps) {
  const lights = createDeviceLightRecipe(lightRig);
  const envelope = completeDeviceEnvelope(form);
  return (
    <>
      {lights.map(light=><rectAreaLight key={light.name} {...light} />)}
      <group
        name={DEVICE_MODEL_NAME}
        rotation={deviceOrientationToRotation(orientation)}
      >
        <group
          name={DEVICE_CONTENT_NAME}
          position={[
            -envelope.center[0],
            -envelope.center[1],
            -envelope.center[2],
          ]}
        >
          {children}
        </group>
      </group>
    </>
  );
}
