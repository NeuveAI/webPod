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
import { Canvas, useThree } from "@react-three/fiber";
import { createContext, useLayoutEffect, useMemo, type ReactNode } from "react";
import { Box3, PerspectiveCamera, Vector3 } from "three";

import { Device, type DeviceProps } from "./Device";
import { CanvasPixelDensity } from "./CanvasPixelDensity";
import {
  applyDeviceCameraFit,
  fitPerspectiveCameraToBounds,
  projectedBoundsExtent,
  type DeviceCameraFit,
} from "./camera-fit";
import { applyDeviceRendererDefaults } from "./renderer-defaults";
import { StudioEnvironment, type StudioEnvironmentProps } from "./StudioEnvironment";
import { DEVICE_MODEL_NAME } from "./ViewerLitDeviceFrame";
import {
  FRONT_DEVICE_ORIENTATION,
  deviceScreenIsInteractable,
  resolveDeviceVisibleFace,
  type DeviceOrientation,
  type DeviceVisibleFace,
} from "./orientation";

export type DeviceCanvasProps = DeviceProps & {
  readonly className?: string;
  /** Explicit canonical-calibration distance. Omit for measured responsive fit. */
  readonly cameraDistance?: number;
  readonly cameraFov?: number;
  /** CSS-pixel safe area around the projected model. */
  readonly cameraSafePadding?: number;
  /** RoomEnvironment/PMREM parameters; `null` disables the studio environment. */
  readonly studioEnvironment?: StudioEnvironmentProps | null;
  /** Receives the measured fit after mount and every viewport/pose change. */
  readonly onCameraFit?: (fit: DeviceCameraFit) => void;
  /**
   * Device pixel ratio. `[1, 2]` for looking at; **`1` for measuring** — the
   * luminance probe reads the drawing buffer, and at dpr 2 one body px is four
   * framebuffer pixels, so a target's column would land between them.
   */
  readonly dpr?: number | [number, number];
  /** Extra scene content. The spike route mounts its luminance probe here. */
  readonly children?: ReactNode;
};

/** Initial camera only; responsive canvases replace it from actual model bounds. */
export const DEFAULT_CAMERA_DISTANCE = 1160;
export const DEFAULT_CAMERA_FOV = 30;
export const DEFAULT_CAMERA_SAFE_PADDING = 28;

function publishCameraFitDiagnostics(
  canvas: HTMLCanvasElement,
  bounds: Box3,
  fit: DeviceCameraFit,
  projected: { readonly x: number; readonly y: number },
  safePadding: number,
) {
  canvas.dataset["wpCameraFitDistance"] = fit.distance.toFixed(4);
  canvas.dataset["wpCameraFitPadding"] = String(safePadding);
  canvas.dataset["wpModelBoundsMin"] = bounds.min.toArray().join(",");
  canvas.dataset["wpModelBoundsMax"] = bounds.max.toArray().join(",");
  canvas.dataset["wpProjectedExtentX"] = projected.x.toFixed(6);
  canvas.dataset["wpProjectedExtentY"] = projected.y.toFixed(6);
  canvas.dataset["wpProjectedLimitX"] = fit.maxNdcX.toFixed(6);
  canvas.dataset["wpProjectedLimitY"] = fit.maxNdcY.toFixed(6);
}

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
  cameraDistance,
  cameraFov = DEFAULT_CAMERA_FOV,
  cameraSafePadding = DEFAULT_CAMERA_SAFE_PADDING,
  studioEnvironment = {},
  onCameraFit,
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
  const initialDistance = cameraDistance ?? DEFAULT_CAMERA_DISTANCE;
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
        near: 0.1,
        far: initialDistance * 4,
        position: [0, 0, initialDistance],
      }}
    >
      <DeviceCanvasOrientationContext.Provider value={orientationState}>
        <CanvasPixelDensity enabled={Array.isArray(dpr)} />
        {studioEnvironment === null ? null : (
          <StudioEnvironment {...studioEnvironment} />
        )}
        <Device {...device} orientation={orientation} />
        <ResponsiveDeviceCamera
          explicitDistance={cameraDistance}
          fov={cameraFov}
          orientation={orientation}
          safePadding={cameraSafePadding}
          onFit={onCameraFit}
        />
        {children}
      </DeviceCanvasOrientationContext.Provider>
    </Canvas>
  );
}

function ResponsiveDeviceCamera({
  explicitDistance,
  fov,
  orientation,
  safePadding,
  onFit,
}: {
  readonly explicitDistance: number | undefined;
  readonly fov: number;
  readonly orientation: DeviceOrientation;
  readonly safePadding: number;
  readonly onFit: ((fit: DeviceCameraFit) => void) | undefined;
}) {
  const camera = useThree((state) => state.camera);
  const scene = useThree((state) => state.scene);
  const canvas = useThree((state) => state.gl.domElement);
  const size = useThree((state) => state.size);
  const invalidate = useThree((state) => state.invalidate);

  useLayoutEffect(() => {
    const model = scene.getObjectByName(DEVICE_MODEL_NAME);
    if (model === undefined || !(camera instanceof PerspectiveCamera)) return;
    model.updateWorldMatrix(true, true);
    const bounds = new Box3().setFromObject(model, true);
    if (bounds.isEmpty()) return;
    const viewport = {
      width: size.width,
      height: size.height,
      safePadding,
    };
    const measured = fitPerspectiveCameraToBounds(bounds, viewport, fov);
    const fit =
      explicitDistance === undefined
        ? measured
        : {
            ...measured,
            distance: explicitDistance,
            near: Math.max(0.1, explicitDistance - bounds.getSize(new Vector3()).length()),
            far: explicitDistance + bounds.getSize(new Vector3()).length() * 2,
          };
    applyDeviceCameraFit(camera, fit, viewport);
    const projected = projectedBoundsExtent(bounds, camera);
    publishCameraFitDiagnostics(canvas, bounds, fit, projected, safePadding);
    onFit?.(fit);
    invalidate();
  }, [
    camera,
    canvas,
    explicitDistance,
    fov,
    invalidate,
    onFit,
    orientation.pitchDeg,
    orientation.rollDeg,
    orientation.yawDeg,
    safePadding,
    scene,
    size.height,
    size.width,
  ]);

  return null;
}
