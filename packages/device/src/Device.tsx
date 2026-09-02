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
import { useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Color,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  type Group,
  type Material,
  type Mesh,
  MeshBasicMaterial,
  type Texture,
  TorusGeometry,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

import { frontCoreDepth, tessellateVerticalCrown } from "./curved-shell";
import { useControlPhysics } from "./ControlPhysicsScope";
import { createFrontControlPatchGeometry } from "./front-control-geometry";
import {
  createRearShellGeometry,
  frontShellPlan,
  productShellDepths,
} from "./product-shell";
import {
  createRoomEnvMap,
  DEFAULT_ENV_ROOM,
  type EnvRoomParams,
} from "./env-map";
import { DEFAULT_DEVICE_FORM, type DeviceFormParams } from "./form";
import {
  resolveFrontAssemblyDepths,
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
import {
  createPolycarbonateMaterial,
  createBlackPolycarbonateMaterial,
  createCoverGlassMaterial,
} from "./physical-materials";
import { WHEEL_LABEL_DECAL_NAME } from "./probe-raycast";
import {
  createBackCompositionMap,
  createMicroNoiseRoughnessMap,
  createSteelAnisotropyMap,
  createWheelLabelMap,
} from "./textures";
import { ViewerLitDeviceFrame } from "./ViewerLitDeviceFrame";
import {
  FRONT_DEVICE_ORIENTATION,
  type DeviceOrientation,
} from "./orientation";
import { DEVICE_SURFACE_LAYOUT } from "./surface-layout";
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
  /** Mirror-rear calibration room. Injected; defaults to §4.4 + §5.2 L3/L5. */
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
};

const { body, screen, wheel } = DEVICE_LAYOUT;
const { displayWell, glass, mask } = DEVICE_SURFACE_LAYOUT.front;
const rear = DEVICE_SURFACE_LAYOUT.rear;

// D-067 puts VWaJS's circular 26px enclosure in DEVICE_LAYOUT; every shell
// below consumes that single typed geometry.

/** Bevel segments everywhere. Rolled edges are the §10.4 conic response. */
const BEVEL_SEGMENTS = 6;

export function Device({
  colourway = "black",
  orientation = FRONT_DEVICE_ORIENTATION,
  materials = DEFAULT_DEVICE_MATERIALS,
  lightRig = DEFAULT_LIGHT_RIG,
  envRoom = DEFAULT_ENV_ROOM,
  form = DEFAULT_DEVICE_FORM,
  envMap,
  onScreenMeshReady,
  screenMaterial,
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

  // ⚑ Keyed on the room's **values**, not on the object's identity. Building
  // the room is the most expensive thing this package does — a 2048 × 1024
  // float equirect, plus three's PMREM conversion — and identity is exactly the
  // wrong key for it: a parent that renders `envRoom={{ ...DEFAULT_ENV_ROOM }}`
  // inline, or a control surface that spreads a patch over it, hands a fresh
  // object every render and rebuilds a 32MB texture for a value that did not
  // change. The rig tuner did precisely that and its inner loop went from
  // milliseconds to four seconds.
  const envSignature = JSON.stringify(envRoom);
  const builtEnv = useMemo(() => {
    if (envMap !== undefined) return null;
    // Parsed from the signature rather than closed over `envRoom`, so the memo
    // and its input cannot disagree about which room was built.
    return createRoomEnvMap(JSON.parse(envSignature) as EnvRoomParams);
  }, [envMap, envSignature]);
  useEffect(() => () => builtEnv?.dispose(), [builtEnv]);
  const env = envMap ?? builtEnv;
  const studio = useStudioEnvironmentSnapshot();

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
  const backComposition = useMemo(() => createBackCompositionMap(), []);
  useEffect(() => () => backComposition?.dispose(), [backComposition]);
  const backCompositionGeometry = useMemo(
    () => createScreenGeometry(body.width, body.height, body.cornerR),
    [],
  );
  useEffect(
    () => () => backCompositionGeometry.dispose(),
    [backCompositionGeometry],
  );

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

  // The thin 30GB chassis is two material shells meeting at one seam plane:
  //
  //   formed steel rear [−D/2 … plateBackZ]
  //   polycarbonate front [plateBackZ … faceZ]
  //
  // The previous full-depth steel perimeter continued from z=0 all the way to
  // the face and then placed the plastic extrusion beside it. At edge-on that
  // read as two unrelated slabs. The rear tray now rolls once from its inset
  // back face into a continuous side wall and terminates exactly where the
  // front shell starts. The only plan difference is the intentional 1.2px
  // material seam.
  const plateBackZ = shellDepths.seamZ;

  const backGeometry = useMemo(
    () =>
      createRearShellGeometry({
        width: body.width,
        height: body.height,
        depth: body.depth,
        cornerR: body.cornerR,
        exponent: body.exponent,
        frontThickness: form.frontThickness,
        rearCrownInset: form.rearCrownInset,
      }),
    [form.frontThickness, form.rearCrownInset],
  );
  useEffect(() => () => backGeometry.dispose(), [backGeometry]);

  const frontGeometry = useMemo(() => {
    // §5.6 modelled rather than stroked: the polycarbonate front is inset by
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

  const { ringGeometry, selectGeometry, wheelGapGeometry } = useMemo(() => {
    const controlForm = {
      seamWidth: form.seamWidth,
      bodyCrown: form.bodyCrown,
      bodyCrossCrown: form.bodyCrossCrown,
      topEdgeCrown: form.topEdgeCrown,
      bottomEdgeCrown: form.bottomEdgeCrown,
      edgeCrownExtent: form.edgeCrownExtent,
    };
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
      selectGeometry: createFrontControlPatchGeometry(
        {
          centerX: wheel.centerX,
          centerY: wheel.centerY,
          innerRadius: 0,
          outerRadius: wheel.selectR,
          uvRadius: wheel.outerR,
        },
        controlForm,
      ),
      wheelGapGeometry: createFrontControlPatchGeometry(
        {
          centerX: wheel.centerX,
          centerY: wheel.centerY,
          innerRadius: 0,
          outerRadius: wheel.outerR,
          uvRadius: wheel.outerR,
        },
        controlForm,
      ),
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
      wheelGapGeometry.dispose();
    },
    [ringGeometry, selectGeometry, wheelGapGeometry],
  );
  useEffect(() => {
    const assembly = wheelAssemblyRef.current;
    if (assembly === null) return;
    return controlPhysics?.attachWheel(assembly);
  }, [controlPhysics]);
  useEffect(
    () => controlPhysics?.attachSelect(selectGeometry),
    [controlPhysics, selectGeometry],
  );

  const glassGeometry = useMemo(() => {
    const shape = roundedRectShape(
      glass.width,
      glass.height,
      glass.cornerR,
      12,
    );
    const geometry = new ExtrudeGeometry(shape, {
      depth: form.glassThickness,
      bevelEnabled: false,
      curveSegments: 1,
    });
    geometry.translate(0, 0, -form.glassThickness);
    return geometry;
  }, [form.glassThickness]);
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
        width: glass.width,
        height: glass.height,
        radius: glass.cornerR,
      },
      12,
    );
    const geometry = new ExtrudeGeometry(shape, {
      depth: Math.max(0.1, form.displayWellDepth),
      bevelEnabled: false,
      curveSegments: 1,
    });
    geometry.translate(0, 0, -Math.max(0.1, form.displayWellDepth));
    return geometry;
  }, [form.displayWellDepth]);
  useEffect(() => () => displayWellGeometry.dispose(), [displayWellGeometry]);

  const rearInlayGeometry = useMemo(() => {
    const depth = Math.max(0.1, form.rearInlayInset);
    const shape = roundedRectShape(
      rear.inlay.width,
      rear.inlay.height,
      rear.inlay.cornerR,
      12,
    );
    const geometry = new ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: false,
      curveSegments: 1,
    });
    geometry.translate(0, 0, -depth);
    return geometry;
  }, [form.rearInlayInset]);
  useEffect(() => () => rearInlayGeometry.dispose(), [rearInlayGeometry]);

  // The top controls are separate solids on the steel/plastic seam. Their
  // protrusion and recess remain visible when the full model rotates; no
  // front-facing decal can survive the product's edge and flip interactions.
  const holdRecessGeometry = useMemo(
    () => new RoundedBoxGeometry(52, 2.2, 15, 4, 2.8),
    [],
  );
  useEffect(() => () => holdRecessGeometry.dispose(), [holdRecessGeometry]);
  const holdIndicatorGeometry = useMemo(
    () => new RoundedBoxGeometry(36, 1.2, 8.5, 4, 1.8),
    [],
  );
  useEffect(
    () => () => holdIndicatorGeometry.dispose(),
    [holdIndicatorGeometry],
  );
  const holdSliderGeometry = useMemo(
    () => new RoundedBoxGeometry(20, 2.2, 10, 4, 2.1),
    [],
  );
  useEffect(() => () => holdSliderGeometry.dispose(), [holdSliderGeometry]);
  const headphoneRimGeometry = useMemo(
    () => new TorusGeometry(7.1, 1.8, 24, 64),
    [],
  );
  useEffect(
    () => () => headphoneRimGeometry.dispose(),
    [headphoneRimGeometry],
  );
  const headphoneWellGeometry = useMemo(
    () => new CylinderGeometry(5.8, 5.8, 1.4, 64),
    [],
  );
  useEffect(
    () => () => headphoneWellGeometry.dispose(),
    [headphoneWellGeometry],
  );

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
    displayWellFrontZ,
    glassFrontZ,
    screenFrontZ,
    wheelSurfaceBaseZ,
    wheelGapFloorBaseZ,
    wheelTopAtCenterZ,
  } = resolveFrontAssemblyDepths(form);
  const rearInlayZ = -body.depth / 2 + form.rearInlayInset;

  // ── The screen mesh boundary (D-011) ──────────────────────────────────────
  const screenDefaultMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: isBlack ? materials.screen.color : "#F2F6FB",
        toneMapped: materials.screen.toneMapped,
      }),
    [isBlack, materials.screen.color, materials.screen.toneMapped],
  );
  useEffect(
    () => () => screenDefaultMaterial.dispose(),
    [screenDefaultMaterial],
  );
  const coverGlassMaterial = useMemo(
    () =>
      createCoverGlassMaterial(
        withStudioEnvironment(materials.coverGlass, studio.intensity),
        studio.texture,
      ),
    [materials.coverGlass, studio],
  );
  useEffect(() => () => coverGlassMaterial.dispose(), [coverGlassMaterial]);
  const blackBodyPhysicalMaterial = useMemo(
    () =>
      createBlackPolycarbonateMaterial(
        withStudioEnvironment(materials.bodyBlack, studio.intensity),
        studio.texture,
      ),
    [materials.bodyBlack, studio],
  );
  useEffect(
    () => () => blackBodyPhysicalMaterial.dispose(),
    [blackBodyPhysicalMaterial],
  );
  const whiteBodyPhysicalMaterial = useMemo(
    () =>
      createPolycarbonateMaterial(
        withStudioEnvironment(materials.bodyWhite, studio.intensity),
        studio.texture,
      ),
    [materials.bodyWhite, studio],
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
    <ViewerLitDeviceFrame orientation={orientation} lightRig={lightRig}>
      {/* §5.2 — the mirror-polished back plate, uncut. */}
      <mesh name="device-steel-back" geometry={backGeometry}>
        <meshPhysicalMaterial
          name="steel-back"
          {...spread(materials.steelBack)}
          envMap={env}
          {...surfaceMaps.steel}
        />
      </mesh>

      <mesh
        name="device-display-mask"
        geometry={displayMaskGeometry}
        position={[mask.centerX, mask.centerY, screenFrontZ + 0.1]}
      >
        <meshPhysicalMaterial
          name="display-mask"
          {...spread(materials.displayWell)}
          {...studioEnvironmentProps(materials.displayWell, studio)}
        />
      </mesh>

      {/* zbTc3's etched identity and Settings inlay. The transparent texture
          leaves the physical steel reflection visible everywhere else. */}
      <mesh
        name="device-back-composition"
        geometry={backCompositionGeometry}
        position={[0, 0, -body.depth / 2 - 0.04]}
        rotation={[0, Math.PI, 0]}
        renderOrder={3}
      >
        <meshBasicMaterial
          name="back-composition"
          map={backComposition}
          transparent
          depthWrite={false}
          toneMapped={false}
          side={DoubleSide}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>

      {/* The 5G's top-edge identity: recessed HOLD slider and 3.5mm jack. */}
      <mesh
        name="device-hold-recess"
        geometry={holdRecessGeometry}
        position={[-96, body.height / 2 + 0.4, 0]}
      >
        <meshPhysicalMaterial
          name="hold-recess"
          {...spread(materials.displayWell)}
          {...studioEnvironmentProps(materials.displayWell, studio)}
        />
      </mesh>
      <mesh
        name="device-hold-indicator"
        geometry={holdIndicatorGeometry}
        position={[-96, body.height / 2 + 1.35, 0]}
      >
        <meshPhysicalMaterial
          name="hold-indicator"
          {...spread(materials.holdIndicator)}
          {...studioEnvironmentProps(materials.holdIndicator, studio)}
        />
      </mesh>
      <mesh
        name="device-hold-slider"
        geometry={holdSliderGeometry}
        position={[-105, body.height / 2 + 2.15, 0]}
      >
        <meshPhysicalMaterial
          name={isBlack ? "hold-slider-black" : "hold-slider-white"}
          {...spread(isBlack ? materials.chromeSeamBlack : materials.chromeSeam)}
          {...studioEnvironmentProps(
            isBlack ? materials.chromeSeamBlack : materials.chromeSeam,
            studio,
          )}
        />
      </mesh>
      <mesh
        name="device-headphone-rim"
        geometry={headphoneRimGeometry}
        position={[108, body.height / 2 + 1.45, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <meshPhysicalMaterial
          name="headphone-rim"
          {...spread(materials.steelBack)}
          {...studioEnvironmentProps(materials.steelBack, studio)}
        />
      </mesh>
      <mesh
        name="device-headphone-well"
        geometry={headphoneWellGeometry}
        position={[108, body.height / 2 + 1.25, 0]}
      >
        <meshPhysicalMaterial
          name="headphone-well"
          {...spread(materials.displayWell)}
          {...studioEnvironmentProps(materials.displayWell, studio)}
        />
      </mesh>

      {/* §5.1 / §4.3 — the polycarbonate front, inset by the seam. */}
      <mesh name="device-body" geometry={frontGeometry}>
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
        name="device-rear-inlay"
        geometry={rearInlayGeometry}
        position={[rear.inlay.centerX, rear.inlay.centerY, rearInlayZ]}
      >
        <meshPhysicalMaterial
          name="rear-inlay"
          {...spread(materials.rearInlay)}
          {...studioEnvironmentProps(materials.rearInlay, studio)}
          side={DoubleSide}
        />
      </mesh>

      <mesh
        name="device-display-well"
        geometry={displayWellGeometry}
        position={[glass.centerX, glass.centerY, displayWellFrontZ]}
      >
        <meshPhysicalMaterial
          name="display-well"
          {...spread(materials.displayWell)}
          {...studioEnvironmentProps(materials.displayWell, studio)}
        />
      </mesh>

      {/* The zero-wall floor belongs to the fixed faceplate and remains behind
          the two physical hairlines while the rigid wheel rocks above it. */}
      <mesh
        name="device-wheel-gap-floor"
        geometry={wheelGapGeometry}
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

      {/* Select is a separate matte plastic surface patch. Its crown, top plane
          and normals match the wheel exactly; only the one-pixel assembly gap
          and independent material identify the part. */}
      <mesh
        name="device-select"
        geometry={selectGeometry}
        position={[wheel.centerX, wheel.centerY, wheelSurfaceBaseZ]}
      >
        <meshPhysicalMaterial
          key={isBlack ? "select-flat-black" : "select-flat-white"}
          name={isBlack ? "select-black" : "select-white"}
          {...spread(selectMaterial)}
          {...studioEnvironmentProps(selectMaterial, studio)}
        />
      </mesh>

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
