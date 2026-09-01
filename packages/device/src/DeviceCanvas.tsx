/**
 * The canvas the device lives in.
 *
 * ⚑ **`frameloop="demand"` and `flat` are both load-bearing, for different
 * gates.**
 *
 * `frameloop="demand"` is §14.1's hard rule: the render loop is off by
 * default and an untouched device must produce **0 rAF callbacks**. Nothing in
 * this package calls `useFrame`, so the only frames rendered are the ones
 * React's own reconciliation asks for at mount.
 *
 * `flat` sets `NoToneMapping`. R3F's default is `ACESFilmicToneMapping`, which
 * is a filmic S-curve — it rolls the highlights off and would make §4.4's
 * `--steel-0 #F6F8FA` (250 units) unreachable no matter how bright the room
 * got, because ACES maps linear 1.0 to roughly 0.8 display. §12.3's stop tables
 * are the acceptance criterion and they are stated as sRGB output values, so
 * the output transform has to be the identity sRGB encode and nothing else.
 * ⚑ This is not a look preference: with tone mapping on, the ±4 gate is
 * arithmetically unreachable at the top of three of the five tables.
 */
import { Canvas } from "@react-three/fiber";
import { createContext, useMemo, type ReactNode } from "react";

import { Device, type DeviceProps } from "./Device";
import { CanvasPixelDensity } from "./CanvasPixelDensity";
import { DEVICE_LAYOUT } from "./layout";
import { applyDeviceRendererDefaults } from "./renderer-defaults";
import {
  FRONT_DEVICE_ORIENTATION,
  deviceScreenIsInteractable,
  resolveDeviceVisibleFace,
  type DeviceOrientation,
  type DeviceVisibleFace,
} from "./orientation";

export type DeviceCanvasProps = DeviceProps & {
  readonly className?: string;
  /**
   * Camera distance in body px.
   *
   * ⚑ Not a framing preference. The camera's distance sets how wide a band of
   * the room each flat face reflects — a face of height `h` at distance `D`
   * sweeps roughly `±atan(h/2D)` of elevation — so moving it moves the steel's
   * profile. That coupling is the proof the profile is a reflection rather
   * than a fill, and it is why this is an input rather than a constant.
   */
  readonly cameraDistance?: number;
  readonly cameraFov?: number;
  /**
   * Device pixel ratio. `[1, 2]` for looking at; **`1` for measuring** — the
   * luminance probe reads the drawing buffer, and at dpr 2 one body px is four
   * framebuffer pixels, so a target's column would land between them.
   */
  readonly dpr?: number | [number, number];
  /** Extra scene content. The spike route mounts its luminance probe here. */
  readonly children?: ReactNode;
};

export const DEFAULT_CAMERA_DISTANCE = 1160;
export const DEFAULT_CAMERA_FOV = 30;

export type DeviceCanvasOrientationState = {
  readonly orientation: DeviceOrientation;
  readonly visibleFace: DeviceVisibleFace;
  readonly frontInteractive: boolean;
};

const DEFAULT_CANVAS_ORIENTATION_STATE: DeviceCanvasOrientationState =
  Object.freeze({
    orientation: FRONT_DEVICE_ORIENTATION,
    visibleFace: "front",
    frontInteractive: true,
  });

/** Resolved pose state, consumed by front-only scene interactions. */
export const DeviceCanvasOrientationContext =
  createContext<DeviceCanvasOrientationState>(
    DEFAULT_CANVAS_ORIENTATION_STATE,
  );

export function DeviceCanvas({
  className,
  cameraDistance = DEFAULT_CAMERA_DISTANCE,
  cameraFov = DEFAULT_CAMERA_FOV,
  dpr = [1, 3],
  orientation = FRONT_DEVICE_ORIENTATION,
  children,
  ...device
}: DeviceCanvasProps) {
  const orientationState = useMemo<DeviceCanvasOrientationState>(
    () => ({
      orientation,
      visibleFace: resolveDeviceVisibleFace(orientation),
      frontInteractive: deviceScreenIsInteractable(orientation),
    }),
    [orientation],
  );

  return (
    <Canvas
      className={className}
      frameloop="demand"
      flat
      dpr={dpr}
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: false }}
      onCreated={({ gl }) => {
        applyDeviceRendererDefaults(gl);
      }}
      camera={{
        fov: cameraFov,
        near: cameraDistance - DEVICE_LAYOUT.body.height,
        far: cameraDistance + DEVICE_LAYOUT.body.height,
        position: [0, 0, cameraDistance],
      }}
    >
      <DeviceCanvasOrientationContext.Provider value={orientationState}>
        <CanvasPixelDensity enabled={Array.isArray(dpr)} />
        <Device {...device} orientation={orientation} />
        {children}
      </DeviceCanvasOrientationContext.Provider>
    </Canvas>
  );
}
