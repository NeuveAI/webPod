/**
 * `@webpod/device` — the react-three-fiber device layer.
 *
 * The iPod body, its materials and geometry, and the screen mesh boundary W6
 * composites onto (D-011). Panel content, DOM-in-canvas, `HTMLTexture` and the
 * tier strategy are all W6's; this package exposes the quad and fills it with a
 * flat default so the device renders standalone.
 *
 * ⚑ **The injection points, named once.** D-012 requires that a later fallback
 * tier could supply different textures, shaders or a renderer by *passing
 * different inputs*, not by editing this package. Those inputs are
 * {@link DeviceMaterials} (§12.3), {@link LightRigParams} (LAW 2),
 * {@link EnvRoomParams} (§4.4 + §5.2) and {@link DeviceFormParams} (the depths
 * §12.0 does not state) — each a prop on {@link Device} with a default. There
 * is one set of defaults and no registry, resolver or asset-pack loader, which
 * is the other half of D-012.
 */
export {
  Device,
  type Colourway,
  type DeviceProps,
} from "./Device";
export type {
  DeviceFace,
  DeviceOrientation,
  DevicePosePreset,
  DeviceVisibleFace,
} from "./orientation";
export {
  DEFAULT_CAMERA_DISTANCE,
  DEFAULT_CAMERA_FOV,
  DeviceCanvas,
  type DeviceCanvasProps,
} from "./DeviceCanvas";
export {
  clampDeviceOrientation,
  DEVICE_FRONT_VISIBILITY_THRESHOLD,
  DEVICE_ORIENTATION_PRESETS,
  deviceFrontVisibility,
  deviceOrientationToRotation,
  deviceScreenIsInteractable,
  EDGE_DEVICE_ORIENTATION,
  FRONT_DEVICE_ORIENTATION,
  orientationFromFace,
  REAR_DEVICE_ORIENTATION,
  resolveDeviceVisibleFace,
  THREE_QUARTER_DEVICE_ORIENTATION,
  wrapDegrees,
} from "./orientation";
export {
  DEVICE_DPR_RANGE,
  firstDevicePixelBox,
  resolveCanvasPixelRatio,
  type CanvasPixelMeasurement,
  type DevicePixelBox,
} from "./pixel-density";
export {
  CLICK_WHEEL_INPUT_POSITION,
  CLICK_WHEEL_INPUT_RADII,
  ClickWheelInputSurface,
  acceptsClickWheelPointer,
  clockwiseWheelAngleDeg,
  shortestWheelDeltaDeg,
  wheelAngleFromRay,
  type ClickWheelArcEnd,
  type ClickWheelArcSample,
  type ClickWheelInputSurfaceProps,
  type ClickWheelPointerType,
} from "./click-wheel-input";

export {
  DEFAULT_DEVICE_MATERIALS,
  type DeviceMaterials,
  type PhysicalSurfaceParams,
  type ScreenSurfaceParams,
} from "./materials";
export {
  DEFAULT_LIGHT_RIG,
  fillLightIntensity,
  fillLightPosition,
  keyLightPosition,
  type FillLightParams,
  type KeyLightParams,
  type LightRigParams,
} from "./light-rig";
export { DEVICE_MODEL_NAME } from "./ViewerLitDeviceFrame";
export {
  createRoomEnvMap,
  DEFAULT_ENV_ROOM,
  STEEL_STOPS,
  type EnvRoomParams,
  type HorizonLineParams,
  type RoomStop,
  type SkyBlobParams,
} from "./env-map";
export { DEFAULT_DEVICE_FORM, type DeviceFormParams } from "./form";

export {
  BODY_D,
  DEVICE_LAYOUT,
  GLASS_CORNER_R,
  GLASS_SURROUND,
  PX_PER_MM,
  SCREEN_CORNER_R,
  toCanvasTopLeft,
} from "./layout";
export { DEVICE_SURFACE_LAYOUT } from "./surface-layout";
export {
  circleHole,
  roundedRectHole,
  roundedRectShape,
  silhouetteShape,
  silhouetteFrameShape,
} from "./shapes";
export { curvedAnnulusGeometry, domedDiscGeometry } from "./curved-discs";
export {
  BODY_CROWN_ROW_STEP,
  frontCoreDepth,
  tessellateVerticalCrown,
  verticalCrownOffset,
  verticalCrownSlope,
} from "./curved-shell";
export {
  createMicroNoiseRoughnessMap,
  createSteelAnisotropyMap,
  createWheelLabelMap,
} from "./textures";

export {
  createScreenMeshHandle,
  type ScreenCorners,
  type ScreenMeshHandle,
  type ScreenMeshReady,
  type ScreenTransform,
  type ViewportPoint,
} from "./screen-mesh";
export { createScreenGeometry } from "./screen-geometry";
export {
  createCoverGlassMaterial,
  patchGlassShader,
} from "./physical-materials";
export {
  firstVisibleProbeHit,
  probeSurfaceIsCoherent,
  resolveProbeSurface,
  WHEEL_LABEL_DECAL_NAME,
  type ProbeHitIdentity,
  type ResolvedProbeSurface,
  type VisibleProbeHit,
} from "./probe-raycast";
export {
  addOpticalProfile,
  applyOpticalProfile,
  createBodyRoughnessMap,
  createOpticalNormalMap,
  DEFAULT_DEVICE_OPTICAL_PROFILES,
  type DeviceOpticalProfiles,
  type OpticalProfile,
} from "./optical-profile";

export {
  hexLuma255,
  hexToLinear,
  hexToSrgb,
  linearToSrgb,
  luma255,
  srgbToLinear,
} from "./colour";
export {
  BODY_BLACK_STOPS,
  BODY_WHITE_STOPS,
  evaluate,
  matchesProbeIdentity,
  LUMINANCE_TOLERANCE,
  probeTargets,
  rmsDelta,
  SELECT_BLACK_STOPS,
  SELECT_WHITE_STOPS,
  silhouetteHalfWidth,
  steelGradientParameter,
  WHEEL_BLACK_STOPS,
  WHEEL_WHITE_STOPS,
  type ProbeReading,
  type ProbeResult,
  type ProbeSurface,
  type ProbeTarget,
  type TargetOptions,
} from "./luminance-probe";
