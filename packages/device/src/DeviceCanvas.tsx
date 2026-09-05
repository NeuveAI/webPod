import { StickerPackScene } from "./StickerPackScene";
/**
 * Demand-rendered physical device canvas. An untouched device schedules no
 * animation loop. Renderer defaults select AgX at exposure1 for photographic
 * highlight roll-off on the shell and hardware; the emissive LCD and its mask
 * explicitly use toneMapped:false and keep their canonical sRGB presentation.
 * Old absolute steel stop-table calibration is superseded by the product studio.
 */
import { Canvas, useThree } from "@react-three/fiber";
import { createContext, useLayoutEffect, useMemo, type ReactNode } from "react";
import { Box3, PerspectiveCamera } from "three";

import { Device, type DeviceProps } from "./Device";
import { CanvasPixelDensity } from "./CanvasPixelDensity";
import { ControlPhysicsScope } from "./ControlPhysicsScope";
import {
  applyDeviceCameraFit,
  boxCorners,
  DEFAULT_DEVICE_CAMERA_SAFE_MARGIN_RATIO,
  fitPerspectiveCameraToRotationalEnvelope,
  projectedPointsMetrics,
  type DeviceCameraFit,
} from "./camera-fit";
import { applyDeviceRendererDefaults } from "./renderer-defaults";
import { StudioEnvironment, type StudioEnvironmentProps } from "./StudioEnvironment";
import { DEVICE_CONTENT_NAME } from "./ViewerLitDeviceFrame";
import { DEFAULT_DEVICE_FORM, type DeviceFormParams } from "./form";
import {
  completeDeviceEnvelope,
  deviceEnvelopeBounds,
  type DeviceEnvelope,
} from "./device-envelope";
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
  /** Receives the immutable-envelope fit after mount and viewport changes. */
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

/** Initial camera only; responsive canvases replace it from the fixed envelope. */
export const DEFAULT_CAMERA_DISTANCE = 1160;
export const DEFAULT_CAMERA_FOV = 30;
export const DEFAULT_CAMERA_SAFE_PADDING = 28;

function publishCameraFitDiagnostics(
  canvas: HTMLCanvasElement,
  fit: DeviceCameraFit,
  safePadding: number,
) {
  canvas.dataset["wpCameraFitDistance"] = fit.distance.toFixed(4);
  canvas.dataset["wpCameraFitPadding"] = String(safePadding);
  canvas.dataset["wpCameraFitMarginRatio"] = String(
    DEFAULT_DEVICE_CAMERA_SAFE_MARGIN_RATIO,
  );
  canvas.dataset["wpProjectedLimitX"] = fit.maxNdcX.toFixed(6);
  canvas.dataset["wpProjectedLimitY"] = fit.maxNdcY.toFixed(6);
}

function publishProjectionDiagnostics(
  canvas: HTMLCanvasElement,
  bounds: Box3,
  projected: ReturnType<typeof projectedPointsMetrics>,
) {
  canvas.dataset["wpModelBoundsMin"] = bounds.min.toArray().join(",");
  canvas.dataset["wpModelBoundsMax"] = bounds.max.toArray().join(",");
  canvas.dataset["wpProjectedExtentX"] = projected.maxAbsX.toFixed(6);
  canvas.dataset["wpProjectedExtentY"] = projected.maxAbsY.toFixed(6);
  canvas.dataset["wpProjectedCenterX"] = projected.centerX.toFixed(6);
  canvas.dataset["wpProjectedCenterY"] = projected.centerY.toFixed(6);
  canvas.dataset["wpProjectedWidth"] = projected.width.toFixed(6);
  canvas.dataset["wpProjectedHeight"] = projected.height.toFixed(6);
}

export type DeviceCanvasOrientationState = {
  readonly orientation: DeviceOrientation;
  readonly visibleFace: DeviceVisibleFace;
  readonly frontInteractive: boolean;
  /** The same injected solid-form contract consumed by visible front meshes. */
  readonly form: DeviceFormParams;
};

const DEFAULT_CANVAS_ORIENTATION_STATE: DeviceCanvasOrientationState =
  Object.freeze({
    orientation: FRONT_DEVICE_ORIENTATION,
    visibleFace: "front",
    frontInteractive: true,
    form: DEFAULT_DEVICE_FORM,
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
  const form = device.form ?? DEFAULT_DEVICE_FORM;
  const envelope = useMemo(() => completeDeviceEnvelope(form), [form]);
  const orientationState = useMemo<DeviceCanvasOrientationState>(
    () => ({
      orientation,
      visibleFace: resolveDeviceVisibleFace(orientation),
      frontInteractive: deviceScreenIsInteractable(orientation),
      form,
    }),
    [form, orientation],
  );
  const initialDistance = cameraDistance ?? DEFAULT_CAMERA_DISTANCE;
  return (
    <Canvas
      className={className}
      frameloop="demand"
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
      <ControlPhysicsScope>
        <DeviceCanvasOrientationContext.Provider value={orientationState}>
          <CanvasPixelDensity enabled={Array.isArray(dpr)} />
          {studioEnvironment === null ? null : (
            <StudioEnvironment {...studioEnvironment} />
          )}
          <Device {...device} form={form} orientation={orientation} />
          {device.stickerScene === undefined ? null : <StickerPackScene scene={device.stickerScene} />}
          <ResponsiveDeviceCamera
            explicitDistance={cameraDistance}
            fov={cameraFov}
            envelope={envelope}
            safePadding={cameraSafePadding}
            onFit={onCameraFit}
          />
          <DeviceProjectionDiagnostics
            envelope={envelope}
            orientation={orientation}
          />
          {children}
        </DeviceCanvasOrientationContext.Provider>
      </ControlPhysicsScope>
    </Canvas>
  );
}

function ResponsiveDeviceCamera({
  explicitDistance,
  fov,
  envelope,
  safePadding,
  onFit,
}: {
  readonly explicitDistance: number | undefined;
  readonly fov: number;
  readonly envelope: DeviceEnvelope;
  readonly safePadding: number;
  readonly onFit: ((fit: DeviceCameraFit) => void) | undefined;
}) {
  const camera = useThree((state) => state.camera);
  const canvas = useThree((state) => state.gl.domElement);
  const size = useThree((state) => state.size);
  const invalidate = useThree((state) => state.invalidate);

  useLayoutEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    const viewport = {
      width: size.width,
      height: size.height,
      safePadding,
      safeMarginRatio: DEFAULT_DEVICE_CAMERA_SAFE_MARGIN_RATIO,
    };
    const measured = fitPerspectiveCameraToRotationalEnvelope(
      deviceEnvelopeBounds(envelope),
      viewport,
      fov,
    );
    const fit =
      explicitDistance === undefined
        ? measured
        : {
            ...measured,
            distance: explicitDistance,
            near: Math.max(
              0.1,
              (explicitDistance - envelope.boundingRadius) * 0.5,
            ),
            far: explicitDistance + envelope.boundingRadius * 2,
          };
    applyDeviceCameraFit(camera, fit, viewport);
    publishCameraFitDiagnostics(canvas, fit, safePadding);
    onFit?.(fit);
    invalidate();
  }, [
    camera,
    canvas,
    explicitDistance,
    fov,
    invalidate,
    envelope,
    onFit,
    safePadding,
    size.height,
    size.width,
  ]);

  return null;
}

function DeviceProjectionDiagnostics({
  envelope,
  orientation,
}: {
  readonly envelope: DeviceEnvelope;
  readonly orientation: DeviceOrientation;
}) {
  const camera = useThree((state) => state.camera);
  const scene = useThree((state) => state.scene);
  const canvas = useThree((state) => state.gl.domElement);

  useLayoutEffect(() => {
    const content = scene.getObjectByName(DEVICE_CONTENT_NAME);
    if (content === undefined || !(camera instanceof PerspectiveCamera)) return;
    content.updateWorldMatrix(true, true);
    const points = boxCorners(deviceEnvelopeBounds(envelope)).map((corner) =>
      corner.applyMatrix4(content.matrixWorld),
    );
    const bounds = new Box3().setFromPoints(points);
    publishProjectionDiagnostics(
      canvas,
      bounds,
      projectedPointsMetrics(points, camera),
    );
  }, [
    camera,
    canvas,
    envelope,
    orientation.pitchDeg,
    orientation.rollDeg,
    orientation.yawDeg,
    scene,
  ]);

  return null;
}
