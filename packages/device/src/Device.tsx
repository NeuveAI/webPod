import { BACKPLATE_FINISH, createBackplateFinishMaps } from "./backplate-finish";
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
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Color,
  ExtrudeGeometry,
  type Group,
  type Material,
  type Mesh,
  MeshBasicMaterial,
  ShapeGeometry,
  type Texture,
} from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { frontCoreDepth, tessellateVerticalCrown } from "./curved-shell";
import { useControlPhysics } from "./ControlPhysicsScope";
import { AxialSelectControl } from "./AxialSelectControl";
import {
  createFrontControlPatchGeometry,
  createWheelGapFloorGeometries,
} from "./front-control-geometry";
import {
  createRearShellGeometry,
  frontShellPlan,
  productShellDepths,
} from "./product-shell";
import {
  createRoomEnvMap,
  type EnvRoomParams,
} from "./env-map";
import { DEFAULT_DEVICE_FORM, type DeviceFormParams } from "./form";
import {
  resolveFrontAssemblyDepths,
  SELECT_CONCAVITY,
  WHEEL_OUTER_SEAM_WIDTH,
} from "./front-surface";
import { DEVICE_LAYOUT, SCREEN_CORNER_R } from "./layout";
import { DEFAULT_LIGHT_RIG, type LightRigParams } from "./light-rig";
import { materialMapOwnership } from "./material-map-ownership";
import {
  DEFAULT_DEVICE_MATERIALS,
  type DeviceMaterials,
  type PhysicalSurfaceParams,
} from "./materials";
import {
  circleHole,
  roundedRectFrameShape,
  roundedRectHole,
  roundedRectShape,
  silhouetteShape,
} from "./shapes";
import { createScreenMeshHandle, type ScreenMeshReady } from "./screen-mesh";
import { createScreenGeometry } from "./screen-geometry";
import { removeOpaqueApertureWalls, squareRoundedRectApertureWalls } from "./screen-aperture";
import {
  createPolycarbonateMaterial,
  createCoverGlassMaterial,
} from "./physical-materials";
import { WHEEL_LABEL_DECAL_NAME } from "./probe-raycast";
import {
  createMicroNoiseRoughnessMap,
  createAluminumFinishMaps,
  createSteelAnisotropyMap,
  createWheelLabelMap,
} from "./textures";
import { ViewerLitDeviceFrame } from "./ViewerLitDeviceFrame";
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
import { DeviceHardware } from "./DeviceHardware";
import { cutHardwareApertures } from "./hardware-apertures";
import {
  effectiveStudioEnvironmentIntensity,
  useStudioEnvironmentSnapshot,
  type StudioEnvironmentSnapshot,
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
const { displayWell, glass, mask } = DEVICE_SURFACE_LAYOUT.front;

// D-067 puts VWaJS's circular 26px enclosure in DEVICE_LAYOUT; every shell
// below consumes that single typed geometry.

/** Bevel segments everywhere. Rolled edges are the §10.4 conic response. */
const BEVEL_SEGMENTS = 16;

export function Device({
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
  const invalidate = useThree((state) => state.invalidate);
  const controlPhysics = useControlPhysics();
  const wheelAssemblyRef = useRef<Group>(null);
  // A getter, not a value: r3f swaps the camera on some prop changes and the
  // viewport changes on every resize, so the handle must read both at the
  // moment it projects rather than capture them (see `screen-mesh.ts`).
  const store = useThree((state) => state);
  const view = useCallback(
    () => ({
      camera: store.camera,
      width: store.size.width,
      height: store.size.height,
    }),
    [store],
  );
  const onShellPointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (onOrientationGrabStart === undefined) return;
      const start = orientationGrabStart(event);
      if (start === null || !onOrientationGrabStart(start)) return;
      // Browser panning is disabled declaratively by the application root's
      // touch-action. R3F delegates this callback through a native listener
      // that may be passive, so native preventDefault() is not legal here.
      event.stopPropagation();
    },
    [onOrientationGrabStart],
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

  const backplateFinish = useMemo(() => createBackplateFinishMaps(), []);
  useEffect(() => () => backplateFinish?.dispose(), [backplateFinish]);

  const noise = useMemo(() => {
    const map = createMicroNoiseRoughnessMap();
    map.repeat.set(0.04, 0.04);
    return map;
  }, []);
  useEffect(() => () => noise.dispose(), [noise]);
  const steelAnisotropy = useMemo(() => {
    const map = createSteelAnisotropyMap();
    map.repeat.set(0.02, 0.02);
    return map;
  }, []);
  useEffect(() => () => steelAnisotropy.dispose(), [steelAnisotropy]);
  const aluminumGrain = useMemo(() => createAluminumFinishMaps(), []);
  useEffect(() => () => aluminumGrain.dispose(), [aluminumGrain]);
  const isBlack = colourway === "black";
  const ringMaterial = isBlack
    ? materials.wheelRingBlack
    : materials.wheelRingWhite;
  const selectMaterial = isBlack
    ? materials.selectBlack
    : materials.selectWhite;
  const surfaceMaps = materialMapOwnership({
    microNoise: noise,
    steelAnisotropy,
  });

  // ── Geometry ───────────────────────────────────────────────────────────────
  // Built once per shape-affecting input. Under `frameloop="demand"` a rebuild
  // is also a re-render, so the memo keys are the whole render trigger.

  const shellDepths = productShellDepths(body.depth, form.frontThickness);

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
  const plateBackZ = shellDepths.seamZ;

  const backGeometry = useMemo(() => {
    const shell = createRearShellGeometry({
      width: body.width,
      height: body.height,
      depth: body.depth,
      cornerR: body.cornerR,
      exponent: body.exponent,
      frontThickness: form.frontThickness,
      rearCrownInset: form.rearCrownInset,
      frontRimInset: form.seamWidth + form.frontBevel + 0.25,
    });
    const opened = cutHardwareApertures(shell);
    shell.dispose();
    return opened;
  }, [form.frontThickness, form.rearCrownInset, form.seamWidth, form.frontBevel]);
  useEffect(() => () => backGeometry.dispose(), [backGeometry]);

  const frontGeometry = useMemo(() => {
    // §5.6 modelled rather than stroked: the aluminum front is inset by
    // the seam width, so what runs round the perimeter is the steel shell's own
    // rolled edge, presenting a different angle to the light at every point of
    // the silhouette — §10.4 prevention #6, for free.
    const seam = form.seamWidth;
    const plan = frontShellPlan(
      body.width,
      body.height,
      body.cornerR,
      seam,
      form.frontBevel,
    );
    const shape = silhouetteShape(
      plan.faceWidth,
      plan.faceHeight,
      plan.faceCornerR,
      body.exponent,
      48,
    );
    shape.holes.push(
      roundedRectHole(
        displayWell.centerX,
        displayWell.centerY,
        displayWell.width,
        displayWell.height,
        displayWell.cornerR,
      ),
    );
    shape.holes.push(circleHole(wheel.centerX, wheel.centerY, wheel.outerR));
    const extrusion = new ExtrudeGeometry(shape, {
      depth: frontCoreDepth(form.frontThickness, form.frontBevel),
      bevelEnabled: true,
      bevelThickness: form.frontBevel,
      bevelSize: form.frontBevel,
      bevelSegments: BEVEL_SEGMENTS,
      curveSegments: 1,
    });
    // Three applies the outer-shell bevel to holes as well. The flush LCD
    // opening is square to the glossy face, so collapse only this hole's
    // generated slope before the shell crown is applied.
    squareRoundedRectApertureWalls(
      extrusion,
      {
        centerX: displayWell.centerX,
        centerY: displayWell.centerY,
        width: displayWell.width,
        height: displayWell.height,
        cornerR: displayWell.cornerR,
      },
      form.frontBevel,
    );
    removeOpaqueApertureWalls(extrusion, {
      centerX: displayWell.centerX, centerY: displayWell.centerY,
      width: displayWell.width, height: displayWell.height, cornerR: displayWell.cornerR,
    });
    // Smooth the rolled aluminum before deformation; preserve the LCD wall
    // crease. ExtrudeGeometry starts with an independent normal per triangle.
    toCreasedNormals(extrusion, Math.PI / 4);
    const geometry = tessellateVerticalCrown(
      extrusion,
      body.height / 2 - seam,
      form.bodyCrown,
      undefined,
      { top: form.topEdgeCrown, bottom: form.bottomEdgeCrown, extent: form.edgeCrownExtent },
      {
        halfWidth: body.width / 2 - seam,
        crown: form.bodyCrossCrown,
      },
    );
    extrusion.dispose();
    geometry.translate(0, 0, plateBackZ + form.frontBevel);
    return geometry;
  }, [
    form.seamWidth,
    form.frontThickness,
    form.frontBevel,
    form.bodyCrown,
    form.bodyCrossCrown,
    form.topEdgeCrown,
    form.bottomEdgeCrown,
    form.edgeCrownExtent,
    plateBackZ,
  ]);
  useEffect(() => () => frontGeometry.dispose(), [frontGeometry]);

  const {
    ringGeometry,
    selectGeometry,
    selectSeamGeometry,
    outerSeamGeometry,
  } = useMemo(() => {
    const controlForm = {
      seamWidth: form.seamWidth,
      bodyCrown: form.bodyCrown,
      bodyCrossCrown: form.bodyCrossCrown,
      topEdgeCrown: form.topEdgeCrown,
      bottomEdgeCrown: form.bottomEdgeCrown,
      edgeCrownExtent: form.edgeCrownExtent,
    };
    const gapFloor = createWheelGapFloorGeometries(controlForm);
    const selectGeometry = createFrontControlPatchGeometry(
        {
          centerX: wheel.centerX,
          centerY: wheel.centerY,
          innerRadius: 0,
          outerRadius: wheel.selectR,
          concavity: SELECT_CONCAVITY,
          uvRadius: wheel.outerR,
        },
        controlForm,
      );
    // Match the extrusion's model-unit UVs; the wheel retains its decal UVs.
    const position = selectGeometry.getAttribute("position");
    const uv = selectGeometry.getAttribute("uv");
    for (let index = 0; index < uv.count; index++) {
      uv.setXY(index, position.getX(index) + wheel.centerX, position.getY(index) + wheel.centerY);
    }
    uv.needsUpdate = true;
    return {
      ringGeometry: createFrontControlPatchGeometry(
        {
          centerX: wheel.centerX,
          centerY: wheel.centerY,
          innerRadius: wheel.selectLipR,
          outerRadius: wheel.outerR - WHEEL_OUTER_SEAM_WIDTH,
          uvRadius: wheel.outerR,
        },
        controlForm,
      ),
      selectGeometry,
      selectSeamGeometry: gapFloor.selectSeam,
      outerSeamGeometry: gapFloor.outerSeam,
    };
  }, [
    form.seamWidth,
    form.bodyCrown,
    form.bodyCrossCrown,
    form.topEdgeCrown,
    form.bottomEdgeCrown,
    form.edgeCrownExtent,
  ]);
  useEffect(
    () => () => {
      ringGeometry.dispose();
      selectGeometry.dispose();
      selectSeamGeometry.dispose();
      outerSeamGeometry.dispose();
    },
    [outerSeamGeometry, ringGeometry, selectGeometry, selectSeamGeometry],
  );
  useEffect(() => {
    const assembly = wheelAssemblyRef.current;
    if (assembly === null) return;
    return controlPhysics?.attachWheel(assembly);
  }, [controlPhysics]);

  const glassGeometry = useMemo(() => {
    const shape = roundedRectShape(
      glass.width,
      glass.height,
      glass.cornerR,
      12,
    );
    // The cover sheet contributes reflection across its face, not a raised
    // perimeter. A planar shape keeps its thickness from becoming a visible
    // silver lip around the LCD opening at oblique viewing angles.
    return new ShapeGeometry(shape, 1);
  }, []);
  useEffect(() => () => glassGeometry.dispose(), [glassGeometry]);

  const displayMaskGeometry = useMemo(() => {
    const shape = roundedRectFrameShape(
      {
        width: mask.width,
        height: mask.height,
        radius: mask.cornerR,
      },
      {
        width: screen.width,
        height: screen.height,
        radius: screen.cornerR,
      },
      12,
    );
    const geometry = new ExtrudeGeometry(shape, {
      depth: 0.08,
      bevelEnabled: false,
      curveSegments: 1,
    });
    geometry.translate(0, 0, -0.08);
    return geometry;
  }, []);
  useEffect(() => () => displayMaskGeometry.dispose(), [displayMaskGeometry]);

  const displayWellGeometry = useMemo(() => {
    const shape = roundedRectFrameShape(
      {
        width: displayWell.width,
        height: displayWell.height,
        radius: displayWell.cornerR,
      },
      {
        width: glass.width - 1,
        height: glass.height - 1,
        radius: glass.cornerR - 0.5,
      },
      12,
    );
    const geometry = new ExtrudeGeometry(shape, {
      // Fill the complete opening depth with black so the glossy face's own
      // hole wall never becomes a reflective bezel at a quarter view.
      depth: Math.max(
        0.1,
        form.displayWellInset + form.displayWellDepth,
      ),
      bevelEnabled: false,
      curveSegments: 1,
    });
    geometry.translate(
      0,
      0,
      -Math.max(0.1, form.displayWellInset + form.displayWellDepth),
    );
    return geometry;
  }, [form.displayWellDepth, form.displayWellInset]);
  useEffect(() => () => displayWellGeometry.dispose(), [displayWellGeometry]);

  const screenGeometry = useMemo(
    () => createScreenGeometry(screen.width, screen.height, SCREEN_CORNER_R),
    [],
  );
  useEffect(() => () => screenGeometry.dispose(), [screenGeometry]);

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
  const {
    displayReferenceZ,
    glassFrontZ,
    screenFrontZ,
    wheelSurfaceBaseZ,
    wheelGapFloorBaseZ,
    wheelTopAtCenterZ,
  } = resolveFrontAssemblyDepths(form);

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
  const coverGlassMaterial = useMemo(
    () =>
      createCoverGlassMaterial(
        withStudioEnvironment(materials.coverGlass, studio.intensity),
        studio.screenTexture,
      ),
    [materials.coverGlass, studio],
  );
  useEffect(() => () => coverGlassMaterial.dispose(), [coverGlassMaterial]);
  const blackBodyPhysicalMaterial = useMemo(
    () => {
      const material = createPolycarbonateMaterial(
        withStudioEnvironment(materials.bodyBlack, studio.intensity),
        studio.texture,
      );
      material.roughnessMap = aluminumGrain.roughness;
      material.map = aluminumGrain.color;
      material.bumpMap = aluminumGrain.height;
      return material;
    },
    [materials.bodyBlack, studio, aluminumGrain],
  );
  useEffect(
    () => () => blackBodyPhysicalMaterial.dispose(),
    [blackBodyPhysicalMaterial],
  );
  const whiteBodyPhysicalMaterial = useMemo(
    () => {
      const material = createPolycarbonateMaterial(
        withStudioEnvironment(materials.bodyWhite, studio.intensity),
        studio.texture,
      );
      material.roughnessMap = aluminumGrain.roughness;
      material.map = aluminumGrain.color;
      material.bumpMap = aluminumGrain.height;
      return material;
    },
    [materials.bodyWhite, studio, aluminumGrain],
  );
  useEffect(
    () => () => whiteBodyPhysicalMaterial.dispose(),
    [whiteBodyPhysicalMaterial],
  );
  const wheelPhysicalMaterial = useMemo(() => {
    const material = createPolycarbonateMaterial(
      withStudioEnvironment(ringMaterial, studio.intensity),
      studio.texture,
    );
    material.name = isBlack ? "wheel-black" : "wheel-white";
    return material;
  }, [isBlack, ringMaterial, studio]);
  useEffect(
    () => () => wheelPhysicalMaterial.dispose(),
    [wheelPhysicalMaterial],
  );

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
      {/* §5.2 — the mirror-polished back plate, uncut. */}
      <mesh
        name="device-steel-back"
        geometry={backGeometry}
        onPointerDown={
          onOrientationGrabStart === undefined ? undefined : onShellPointerDown
        }
        onPointerMove={
          onOrientationGrabHoverChange === undefined
            ? undefined
            : onShellPointerMove
        }
        onPointerOut={
          onOrientationGrabHoverChange === undefined
            ? undefined
            : onShellPointerOut
        }
      >
        <meshPhysicalMaterial
          name="steel-back"
          {...spread(materials.steelBack)}
          envMap={env}
          {...surfaceMaps.steel}
          {...(backplateFinish === null ? {} : {
            roughness: Math.min(1, BACKPLATE_FINISH.etchedRoughness *
              materials.steelBack.roughness / DEFAULT_DEVICE_MATERIALS.steelBack.roughness),
            roughnessMap: backplateFinish.roughnessMap,
            bumpMap: backplateFinish.bumpMap,
            bumpScale: BACKPLATE_FINISH.bumpDepth,
          })}
        />
      </mesh>

      <mesh
        name="device-display-mask"
        geometry={displayMaskGeometry}
        position={[mask.centerX, mask.centerY, screenFrontZ + 0.1]}
      >
        <meshBasicMaterial
          name="display-reveal"
          color={materials.screenReveal.color}
          toneMapped={materials.screenReveal.toneMapped}
        />
      </mesh>

      <DeviceHardware form={form} isBlack={isBlack} />

      <mesh
        name="device-body"
        geometry={frontGeometry}
        onPointerDown={
          onOrientationGrabStart === undefined ? undefined : onShellPointerDown
        }
        onPointerMove={
          onOrientationGrabHoverChange === undefined
            ? undefined
            : onShellPointerMove
        }
        onPointerOut={
          onOrientationGrabHoverChange === undefined
            ? undefined
            : onShellPointerOut
        }
      >
        {isBlack ? (
          <primitive
            object={blackBodyPhysicalMaterial}
            attach="material"
            name="body-black"
          />
        ) : (
          <primitive
            object={whiteBodyPhysicalMaterial}
            attach="material"
            name="body-white"
          />
        )}
      </mesh>

      <mesh
        name="device-display-well"
        geometry={displayWellGeometry}
        position={[glass.centerX, glass.centerY, displayReferenceZ]}
      >
        <meshBasicMaterial
          name="display-reveal-wall"
          color={materials.screenReveal.color}
          toneMapped={materials.screenReveal.toneMapped}
        />
      </mesh>

      {/* The fixed floor exists only under the two physical hairlines. A full
          backing disk would sit in front of Select as soon as the separate
          button travels inward, visually replacing its plastic with the well. */}
      <group name="device-wheel-gap-floor">
        <mesh
          name="device-select-seam-floor"
          geometry={selectSeamGeometry}
          position={[wheel.centerX, wheel.centerY, wheelGapFloorBaseZ]}
        >
          <meshPhysicalMaterial
            name={isBlack ? "wheel-gap-black" : "wheel-gap-white"}
            {...spread(
              isBlack ? materials.wheelWellBlack : materials.wheelWellWhite,
            )}
            {...studioEnvironmentProps(
              isBlack ? materials.wheelWellBlack : materials.wheelWellWhite,
              studio,
            )}
          />
        </mesh>
        <mesh
          name="device-outer-seam-floor"
          geometry={outerSeamGeometry}
          position={[wheel.centerX, wheel.centerY, wheelGapFloorBaseZ]}
        >
          <meshPhysicalMaterial
            name={isBlack ? "wheel-gap-black" : "wheel-gap-white"}
            {...spread(
              isBlack ? materials.wheelWellBlack : materials.wheelWellWhite,
            )}
            {...studioEnvironmentProps(
              isBlack ? materials.wheelWellBlack : materials.wheelWellWhite,
              studio,
            )}
          />
        </mesh>
      </group>

      {/* The ring and its ink are one rigid plastic disc. Its group origin is
          the wheel's flush surface centre, so contact changes only one tiny
          center-pivot rotation; child geometry, normals and scale stay exact. */}
      <group
        ref={wheelAssemblyRef}
        name="device-wheel-assembly"
        position={[wheel.centerX, wheel.centerY, wheelTopAtCenterZ]}
      >
        {/* The wheel is a separate plastic patch on the faceplate surface. */}
        <mesh
          name="device-wheel"
          geometry={ringGeometry}
          position={[0, 0, wheelSurfaceBaseZ - wheelTopAtCenterZ]}
        >
          <primitive object={wheelPhysicalMaterial} attach="material" />
        </mesh>

        {/* §5.3 L8 — screen-printed ink. A separate transparent decal is
            required because a multiplicative map cannot lighten black. */}
        <mesh
          name={WHEEL_LABEL_DECAL_NAME}
          geometry={ringGeometry}
          position={[0, 0, wheelSurfaceBaseZ - wheelTopAtCenterZ + 0.08]}
          renderOrder={2}
        >
          <meshBasicMaterial
            map={labelMap}
            transparent
            depthWrite={false}
            toneMapped={false}
            polygonOffset
            polygonOffsetFactor={-1}
          />
        </mesh>
      </group>

      {/* Classic Select shares the front's aluminum and grain, with a shallow
          geometric bowl. Its rim stays flush while the interior curves inward. */}
      <AxialSelectControl
        geometry={selectGeometry}
        position={[wheel.centerX, wheel.centerY, wheelSurfaceBaseZ]}
      >
        <meshPhysicalMaterial
          key={isBlack ? "select-flat-black" : "select-flat-white"}
          name={isBlack ? "select-black" : "select-white"}
          {...spread(selectMaterial)}
          roughnessMap={aluminumGrain.roughness}
          map={aluminumGrain.color}
          bumpMap={aluminumGrain.height}
          {...studioEnvironmentProps(selectMaterial, studio)}
        />
      </AxialSelectControl>

      {/* ⚑ The W6 boundary. §12.3: MeshBasicMaterial, toneMapped false. */}
      <mesh
        ref={attachScreen}
        geometry={screenGeometry}
        position={[
          screen.centerX,
          screen.centerY,
          screenFrontZ,
        ]}
        material={screenDefaultMaterial}
      />

      {/* §5.5 — the cover glass sheet, above everything in the window. */}
      <mesh
        geometry={glassGeometry}
        position={[glass.centerX, glass.centerY, glassFrontZ]}
        material={coverGlassMaterial}
      />
    </ViewerLitDeviceFrame>
  );
}

function isOrientationGrabHit(event: ThreeEvent<PointerEvent>): boolean {
  if (
    !acceptsDeviceOrientationPointer(event) ||
    !isFirstVisibleDeviceShellHit(event.object, event.intersections)
  ) {
    return false;
  }
  const localPoint = event.object.worldToLocal(event.point.clone());
  return isDeviceOuterGrabPoint(localPoint.x, localPoint.y);
}

function orientationGrabStart(
  event: ThreeEvent<PointerEvent>,
): DeviceOrientationGrabStart | null {
  if (!isOrientationGrabHit(event)) return null;
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

/**
 * Widen a frozen parameter record for JSX spreading.
 *
 * `PhysicalSurfaceParams` is deeply `readonly` so nothing can mutate the §12.3
 * table in place; three's element props are mutable. The cast is confined to
 * this one function so the immutability holds everywhere it matters.
 */
function spread(params: PhysicalSurfaceParams): Record<string, unknown> {
  const { albedoScale = 1, color, ...physical } = params;
  return { ...physical, color: new Color(color).multiplyScalar(albedoScale) };
}

function withStudioEnvironment(
  params: PhysicalSurfaceParams,
  intensity: number,
): PhysicalSurfaceParams {
  return {
    ...params,
    envMapIntensity: effectiveStudioEnvironmentIntensity(
      params.envMapIntensity,
      intensity,
    ),
  };
}

function studioEnvironmentProps(
  params: PhysicalSurfaceParams,
  studio: StudioEnvironmentSnapshot,
): {
  readonly envMap: Texture | null;
  readonly envMapIntensity: number;
} {
  return {
    envMap: studio.texture,
    envMapIntensity: effectiveStudioEnvironmentIntensity(
      params.envMapIntensity,
      studio.intensity,
    ),
  };
}
