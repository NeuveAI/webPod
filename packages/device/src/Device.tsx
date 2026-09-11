import { DeviceAssembly } from "./DeviceAssembly";
import { createDeviceAssemblyRecipe, deviceAssemblyGeometries } from "./device-assembly-recipe";
import { createDeviceAssemblyMaterials } from "./device-assembly-materials";
import {registerStickerAssembly,markStickerAssemblyChanged} from './sticker-assembly-revision';
import { usePreparedImmutableShells } from './immutable-shell-preparation';
import { createShellPicking } from './shell-picking';
import { createOrientationRaycast } from './orientation-picking';
import { completeDeviceEnvelope } from './device-envelope';
import { bindStickerWrapSurface, createStickerWrapSurface } from './sticker-wrap';
import { StickerSurface } from "./StickerSurface";
import type { DeviceStickerScene } from "./sticker-contract";
import { createBackplateFinishMaps } from "./backplate-finish";
/**
 * The device, as react-three-fiber elements.
 *
 * ⚑ **Nothing in this file contains a material number, a light number, a
 * §12.0 radius or a room colour.** Materials come from `materials.ts`, the rig
 * from `light-rig.ts`, the studio from `StudioEnvironment.tsx`, the calibrated
 * mirror-rear room from `env-map.ts`, the plan from `layout.ts`
 * (which imports `@webpod/tokens`) and the depths from `form.ts` — and every
 * one of them arrives as a prop with a default, per D-012. There is exactly
 * one set of defaults and no mechanism for choosing between sets; the test of
 * the seam is that a caller *could* pass a different one, not that a registry
 * exists to pick it.
 *
 * ⚑ **No `useFrame` anywhere in this package.** §14.1 makes an untouched
 * device produce zero rAF callbacks, and the surest way to honour that is to
 * have nothing that could poll. The screen mesh's change notification hangs
 * off `onBeforeRender` instead (see `screen-mesh.ts`).
 */
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  type Camera,
  Vector3,
  type Group,
  type Material,
  Mesh,
  MeshBasicMaterial,
  type Texture,
} from "three";

import { useControlPhysics } from "./ControlPhysicsScope";
import {
  createRoomEnvMap,
  type EnvRoomParams,
} from "./env-map";
import { DEFAULT_DEVICE_FORM, type DeviceFormParams } from "./form";
import {
  resolveFrontAssemblyDepths,
} from "./front-surface";
import { DEVICE_LAYOUT } from "./layout";
import { DEFAULT_LIGHT_RIG, type LightRigParams } from "./light-rig";
import {
  DEFAULT_DEVICE_MATERIALS,
  type DeviceMaterials,
} from "./materials";
import { createScreenMeshHandle, type ScreenMeshReady } from "./screen-mesh";
import {
  createWheelLabelMap,
} from "./textures";
import { ViewerLitDeviceFrame, DEVICE_CONTENT_NAME } from "./ViewerLitDeviceFrame";
import {
  FRONT_DEVICE_ORIENTATION,
  type DeviceOrientation,
} from "./orientation";
import {
  acceptsDeviceOrientationHover,
  acceptsDeviceOrientationPointer,
  isDeviceOuterGrabPoint,
  isFirstVisibleDeviceShellHit,
  type DeviceOrientationGrabStart,
  type DeviceOrientationPointerCapture,
} from "./orientation-grab";
import { DEVICE_SURFACE_LAYOUT } from "./surface-layout";
import {
  useStudioEnvironmentSnapshot,
} from "./StudioEnvironment";

/** LAW 5: both modes are the product, so both colourways are first class. */
export type Colourway = "black" | "white";
export type {
  DeviceFace,
  DeviceOrientation,
  DevicePosePreset,
  DeviceVisibleFace,
} from "./orientation";

export type DeviceProps = {
  readonly stickerScene?: DeviceStickerScene;
  readonly colourway?: Colourway;
  readonly orientation?: DeviceOrientation;
  /** §12.3's parameter table. Injected (D-012); defaults to §12.3. */
  readonly materials?: DeviceMaterials;
  /** Owner-approved two-light rig. Injected for deterministic verification. */
  readonly lightRig?: LightRigParams;
  /** Optional legacy calibration room; production uses the shared product studio. */
  readonly envRoom?: EnvRoomParams;
  /** Depths and curvatures §12.0 does not state. */
  readonly form?: DeviceFormParams;
  /**
   * A mirror-rear environment map to use instead of the one built from `envRoom`.
   *
   * The renderer-specific escape hatch: a tier with a captured HDR of a real
   * room passes it here and `env-map.ts` is not called.
   */
  readonly envMap?: Texture | null;
  /** Handed the screen quad once it exists. This is the W6 boundary (D-011). */
  readonly onScreenMeshReady?: ScreenMeshReady;
  /** Pre-installed material for the screen slot; `undefined` keeps the default. */
  readonly screenMaterial?: Material | null;
  /**
   * Begins free preview orientation from a ray-confirmed enclosure edge.
   * Returning false leaves the pointer untouched for another product control.
   */
  readonly onOrientationGrabStart?: (
    start: DeviceOrientationGrabStart,
  ) => boolean;
  /** Cursor affordance for the currently ray-confirmed enclosure edge. */
  readonly onOrientationGrabHoverChange?: (grabbable: boolean) => void;
};

const { body, screen, wheel } = DEVICE_LAYOUT;
const { glass } = DEVICE_SURFACE_LAYOUT.front;

// D-067 puts VWaJS's circular 26px enclosure in DEVICE_LAYOUT; every shell
// below consumes that single typed geometry.

/** Bevel segments everywhere. Rolled edges are the §10.4 conic response. */


export function Device({
  stickerScene,
  colourway = "black",
  orientation = FRONT_DEVICE_ORIENTATION,
  materials = DEFAULT_DEVICE_MATERIALS,
  lightRig = DEFAULT_LIGHT_RIG,
  envRoom,
  form = DEFAULT_DEVICE_FORM,
  envMap,
  onScreenMeshReady,
  screenMaterial,
  onOrientationGrabStart,
  onOrientationGrabHoverChange,
}: DeviceProps) {
  const prepared = usePreparedImmutableShells(form);
  const { front: frontGeometry, back: backGeometry } = prepared;
  const {ringGeometry,selectGeometry,glassGeometry}=prepared.inserts;
  const recipe=useMemo(()=>createDeviceAssemblyRecipe(form,prepared.hardware),[form,prepared]);
  const geometries=useMemo(()=>deviceAssemblyGeometries(prepared),[prepared]);
  const invalidate = useThree((state) => state.invalidate);
  const controlPhysics = useControlPhysics();
  const wheelAssemblyRef = useRef<Group>(null);
  const selectRef = useRef<Mesh>(null);
  useEffect(()=>{const select=selectRef.current;return select?controlPhysics?.attachSelect(select):undefined;},[controlPhysics]);
  useLayoutEffect(()=>{
    let root=wheelAssemblyRef.current?.parent;
    while(root&&root.name!==DEVICE_CONTENT_NAME)root=root.parent;
    return root?registerStickerAssembly(root):undefined;
  },[]);
  useLayoutEffect(()=>{
    const wheel=wheelAssemblyRef.current;if(wheel)markStickerAssemblyChanged(wheel);
  },[prepared,materials,colourway,screenMaterial]);
  // A getter, not a value: r3f swaps the camera on some prop changes and the
  // viewport changes on every resize, so the handle must read both at the
  // moment it projects rather than capture them (see `screen-mesh.ts`).
  const getStore = useThree((state) => state.get);
  const orientationRaycasts = useMemo(() => {
    const touch = () => {
      const event = getStore().internal.lastEvent.current;
      return event !== null && 'pointerType' in event && event.pointerType === 'touch';
    };
    const envelope = completeDeviceEnvelope(form);
    const shellReader = (name: string) => {
      let shell: Mesh | null = null;
      return () => {
        if (shell?.parent) return shell;
        const object = getStore().scene.getObjectByName(name);
        shell = object instanceof Mesh ? object : null;
        return shell;
      };
    };
    return {
      front: createOrientationRaycast(shellReader('device-body'), touch, envelope),
      back: createOrientationRaycast(shellReader('device-steel-back'), touch, envelope),
    };
  }, [getStore, form]);
  const view = useCallback(
    () => {
      const store = getStore();
      return { camera: store.camera, width: store.size.width, height: store.size.height };
    },
    [getStore],
  );
  const onShellPointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (onOrientationGrabStart === undefined) return;
      const start = orientationGrabStart(event, view());
      if (start === null || !onOrientationGrabStart(start)) return;
      // Browser panning is disabled declaratively by the application root's
      // touch-action. R3F delegates this callback through a native listener
      // that may be passive, so native preventDefault() is not legal here.
      event.stopPropagation();
    },
    [onOrientationGrabStart, view],
  );
  const onShellPointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (onOrientationGrabHoverChange === undefined) return;
      if (
        !acceptsDeviceOrientationHover(event) ||
        !isFirstVisibleDeviceShellHit(event.object, event.intersections)
      ) {
        return;
      }
      const localPoint = event.object.worldToLocal(event.point.clone());
      onOrientationGrabHoverChange(
        isDeviceOuterGrabPoint(localPoint.x, localPoint.y),
      );
    },
    [onOrientationGrabHoverChange],
  );
  const onShellPointerOut = useCallback(() => {
    onOrientationGrabHoverChange?.(false);
  }, [onOrientationGrabHoverChange]);

  // ⚑ Keyed on the room's **values**, not on the object's identity. Building
  // the room is the most expensive thing this package does — a 2048 × 1024
  // float equirect, plus three's PMREM conversion — and identity is exactly the
  // wrong key for it: a parent that renders `envRoom={{ ...DEFAULT_ENV_ROOM }}`
  // inline, or a control surface that spreads a patch over it, hands a fresh
  // object every render and rebuilds a 32MB texture for a value that did not
  // change. The rig tuner did precisely that and its inner loop went from
  // milliseconds to four seconds.
  const envSignature = JSON.stringify(envRoom ?? null);
  const builtEnv = useMemo(() => {
    if (envMap !== undefined || envSignature === "null") return null;
    // Parsed from the signature rather than closed over `envRoom`, so the memo
    // and its input cannot disagree about which room was built.
    return createRoomEnvMap(JSON.parse(envSignature) as EnvRoomParams);
  }, [envMap, envSignature]);
  useEffect(() => () => builtEnv?.dispose(), [builtEnv]);
  const studio = useStudioEnvironmentSnapshot();
  const env = envMap !== undefined ? envMap : builtEnv ?? studio.texture;

  const backplateFinish = useMemo(() => createBackplateFinishMaps(undefined,prepared.backplatePixels), [prepared]);
  useEffect(() => () => backplateFinish?.dispose(), [backplateFinish]);
  const isBlack = colourway === "black";
  // ── Geometry ───────────────────────────────────────────────────────────────
  // Built once per shape-affecting input. Under `frameloop="demand"` a rebuild
  // is also a re-render, so the memo keys are the whole render trigger.



  // The thin Classic chassis is two material shells meeting at one seam plane:
  //
  //   formed steel rear [−D/2 … plateBackZ]
  //   aluminum front [plateBackZ … faceZ]
  //
  // The previous full-depth steel perimeter continued from z=0 all the way to
  // the face and then placed the plastic extrusion beside it. At edge-on that
  // read as two unrelated slabs. The rear tray now rolls once from its inset
  // back face into a continuous side wall and terminates exactly where the
  // front shell starts. The only plan difference is the intentional 1.2px
  // material seam.


  const frontPicking = useMemo(() => createShellPicking(), []);
  const backPicking = useMemo(() => createShellPicking(), []);
  useEffect(() => frontPicking.prepare(frontGeometry), [frontGeometry, frontPicking]);
  useEffect(() => backPicking.prepare(backGeometry), [backGeometry, backPicking]);

  useEffect(() => {
    const assembly = wheelAssemblyRef.current;
    if (assembly === null) return;
    return controlPhysics?.attachWheel(assembly);
  }, [controlPhysics]);

  // OEM black and white wheels use independently calibrated ink. Keeping it
  // in the injected material table prevents a white model from becoming a
  // mechanical inversion of the black one.
  const labelMap = useMemo(
    () =>
      createWheelLabelMap({
        outerR: wheel.outerR,
        bandInnerR: wheel.labelBandInnerR,
        bandOuterR: wheel.labelBandOuterR,
        labelColor: isBlack
          ? materials.wheelLabelBlack
          : materials.wheelLabelWhite,
        fontPx: 13,
        size: 1024,
      }),
    [isBlack, materials.wheelLabelBlack, materials.wheelLabelWhite],
  );
  useEffect(() => () => labelMap?.dispose(), [labelMap]);

  // ── Every front insert is resolved from the same crowned shell ─────────────
  const {glassFrontZ,wheelSurfaceBaseZ}=resolveFrontAssemblyDepths(form);

  const wrapSampler = useMemo(() => createStickerWrapSurface(form, [
      { geometry: frontGeometry },
      { geometry: glassGeometry, offset: [glass.centerX, glass.centerY, glassFrontZ] },
      { geometry: ringGeometry, offset: [wheel.centerX, wheel.centerY, wheelSurfaceBaseZ] },
      { geometry: selectGeometry, offset: [wheel.centerX, wheel.centerY, wheelSurfaceBaseZ] },
    ]), [frontGeometry, glassGeometry, ringGeometry, selectGeometry, form, glassFrontZ, wheelSurfaceBaseZ]);
  useLayoutEffect(() => bindStickerWrapSurface(backGeometry, wrapSampler), [backGeometry, wrapSampler]);

  // ── The screen mesh boundary (D-011) ──────────────────────────────────────
  // Keep the LCD material identity across enclosure finish changes: the
  // compositor installs its live texture on this object through the mesh handle.
  const screenDefaultMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: materials.screen.color,
        toneMapped: materials.screen.toneMapped,
      }),
    [materials.screen.color, materials.screen.toneMapped],
  );
  useEffect(
    () => () => screenDefaultMaterial.dispose(),
    [screenDefaultMaterial],
  );
  const assemblyMaterials=useMemo(()=>createDeviceAssemblyMaterials({
    backend:{kind:"webgl"},isBlack,params:materials,screen:screenDefaultMaterial,
    maps:{prepared:prepared.textures,rearEnvironment:env,studio:studio.texture,screenStudio:studio.screenTexture,
      studioIntensity:studio.intensity,label:labelMap,backplate:backplateFinish},
  }),[isBlack,materials,screenDefaultMaterial,prepared,env,studio,labelMap,backplateFinish]);
  useEffect(()=>()=>assemblyMaterials.dispose(),[assemblyMaterials]);

  const attachScreen = useCallback(
    (mesh: Mesh | null) => {
      // ⚑ No ref is kept. The handle's lifetime belongs to whoever asked for
      // it, and the mesh keeps it alive through the `onBeforeRender` closure;
      // a ref here would be a second owner with nothing to do.
      if (mesh === null) return;
      const handle = createScreenMeshHandle({
        mesh,
        panel: {
          width: screen.width / screen.scale,
          height: screen.height / screen.scale,
          scale: screen.scale,
        },
        size: { width: screen.width, height: screen.height },
        defaultMaterial: screenDefaultMaterial,
        invalidate,
        view,
      });
      if (screenMaterial !== undefined) handle.setMaterial(screenMaterial);
      onScreenMeshReady?.(handle);
    },
    [
      screenDefaultMaterial,
      invalidate,
      onScreenMeshReady,
      screenMaterial,
      view,
    ],
  );

  return (
    <ViewerLitDeviceFrame
      orientation={orientation}
      lightRig={lightRig}
      form={form}
    >
      {stickerScene === undefined ? null : <StickerSurface scene={stickerScene} rear={backGeometry} wrap={wrapSampler} />}
      <DeviceAssembly nodes={recipe} geometries={geometries} materials={assemblyMaterials.materials} bindings={{
        wheel:wheelAssemblyRef,select:selectRef,screen:attachScreen,
        frontRaycast:frontPicking.raycast,backRaycast:backPicking.raycast,
        frontInputRaycast:orientationRaycasts.front,backInputRaycast:orientationRaycasts.back,
        onPointerDown:onOrientationGrabStart===undefined?undefined:onShellPointerDown,
        onPointerMove:onOrientationGrabHoverChange===undefined?undefined:onShellPointerMove,
        onPointerOut:onOrientationGrabHoverChange===undefined?undefined:onShellPointerOut,
      }} />
    </ViewerLitDeviceFrame>
  );
}

function isOrientationGrabHit(
  event: ThreeEvent<PointerEvent>,
  view: { readonly camera: Camera; readonly width: number; readonly height: number },
): boolean {
  if (
    !acceptsDeviceOrientationPointer(event) ||
    !isFirstVisibleDeviceShellHit(event.object, event.intersections)
  ) {
    return false;
  }
  const localPoint = event.object.worldToLocal(event.point.clone());
  if (event.pointerType !== "touch") return isDeviceOuterGrabPoint(localPoint.x, localPoint.y);
  // Preserve front controls even when their glass or decal is not an event
  // target. Sticker meshes retain first-visible-hit ownership above the shell.
  const front = event.face !== null && event.face !== undefined && event.face.normal.z > 0;
  if (front && (
    (Math.abs(localPoint.x - glass.centerX) <= glass.width / 2 &&
      Math.abs(localPoint.y - glass.centerY) <= glass.height / 2) ||
    Math.hypot(localPoint.x - wheel.centerX, localPoint.y - wheel.centerY) <= wheel.outerR
  )) return false;
  const project = (point: Vector3) => {
    point.applyMatrix4(event.object.matrixWorld).project(view.camera);
    return point.set(point.x * view.width / 2, point.y * view.height / 2, 0);
  };
  const origin = project(localPoint.clone());
  const scaleX = project(localPoint.clone().add(new Vector3(1, 0, 0))).distanceTo(origin);
  const scaleY = project(localPoint.clone().add(new Vector3(0, 1, 0))).distanceTo(origin);
  // Size in CSS pixels, bounded at a quarter of the face when viewed edge-on.
  const band = Math.min(body.width / 4, 44 / Math.max(0.01, Math.min(scaleX, scaleY)));
  return isDeviceOuterGrabPoint(localPoint.x, localPoint.y, band);
}

function orientationGrabStart(
  event: ThreeEvent<PointerEvent>,
  view: { readonly camera: Camera; readonly width: number; readonly height: number },
): DeviceOrientationGrabStart | null {
  if (!isOrientationGrabHit(event, view)) return null;
  const host = event.nativeEvent.currentTarget;
  const capture = orientationPointerCapture(event.target);
  const pointerType = orientationPointerType(event.pointerType);
  if (host === null || capture === null || pointerType === null) return null;
  return {
    pointerId: event.pointerId,
    pointerType,
    clientX: event.clientX,
    clientY: event.clientY,
    timestampMs: event.timeStamp,
    rollMode: event.altKey,
    host,
    capture,
  };
}

function orientationPointerType(
  value: string,
): DeviceOrientationGrabStart["pointerType"] | null {
  if (value === "mouse" || value === "pen" || value === "touch") return value;
  return null;
}

function orientationPointerCapture(
  target: EventTarget | null,
): DeviceOrientationPointerCapture | null {
  if (
    target === null ||
    !("hasPointerCapture" in target) ||
    !("setPointerCapture" in target) ||
    !("releasePointerCapture" in target) ||
    typeof target.hasPointerCapture !== "function" ||
    typeof target.setPointerCapture !== "function" ||
    typeof target.releasePointerCapture !== "function"
  ) {
    return null;
  }
  const hasPointerCapture = target.hasPointerCapture;
  const setPointerCapture = target.setPointerCapture;
  const releasePointerCapture = target.releasePointerCapture;
  return {
    hasPointerCapture: (pointerId) =>
      Reflect.apply(hasPointerCapture, target, [pointerId]) === true,
    setPointerCapture: (pointerId) => {
      Reflect.apply(setPointerCapture, target, [pointerId]);
    },
    releasePointerCapture: (pointerId) => {
      Reflect.apply(releasePointerCapture, target, [pointerId]);
    },
  };
}
