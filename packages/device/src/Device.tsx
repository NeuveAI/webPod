/**
 * The device, as react-three-fiber elements.
 *
 * ⚑ **Nothing in this file contains a material number, a light number, a
 * §12.0 radius or a room colour.** Materials come from `materials.ts`, the rig
 * from `light-rig.ts`, the room from `env-map.ts`, the plan from `layout.ts`
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
import { useCallback, useEffect, useMemo } from "react";
import {
  Color,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  type Material,
  type Mesh,
  MeshBasicMaterial,
  type Texture,
} from "three";

import { curvedAnnulusGeometry, domedDiscGeometry } from "./curved-discs";
import { frontCoreDepth, tessellateVerticalCrown } from "./curved-shell";
import {
  createRoomEnvMap,
  DEFAULT_ENV_ROOM,
  type EnvRoomParams,
} from "./env-map";
import { DEFAULT_DEVICE_FORM, type DeviceFormParams } from "./form";
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
  silhouetteFrameShape,
  silhouetteShape,
} from "./shapes";
import { createScreenMeshHandle, type ScreenMeshReady } from "./screen-mesh";
import { createScreenGeometry } from "./screen-geometry";
import {
  createBlackPolycarbonateMaterial,
  createCoverGlassMaterial,
} from "./physical-materials";
import { WHEEL_LABEL_DECAL_NAME } from "./probe-raycast";
import {
  addOpticalProfile,
  applyOpticalProfile,
  createBodyRoughnessMap,
  createOpticalNormalMap,
  DEFAULT_DEVICE_OPTICAL_PROFILES,
  type DeviceOpticalProfiles,
} from "./optical-profile";
import {
  createBackCompositionMap,
  createMicroNoiseRoughnessMap,
  createSelectThicknessMap,
  createSteelAnisotropyMap,
  createWheelLabelMap,
} from "./textures";
import { ViewerLitDeviceFrame } from "./ViewerLitDeviceFrame";
import {
  FRONT_DEVICE_ORIENTATION,
  type DeviceOrientation,
} from "./orientation";
import { DEVICE_SURFACE_LAYOUT } from "./surface-layout";

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
  /** LAW 2's rig. Injected; defaults to LAW 2. */
  readonly lightRig?: LightRigParams;
  /** The room. Injected; defaults to §4.4 + §5.2 L3/L5. */
  readonly envRoom?: EnvRoomParams;
  /** Depths and curvatures §12.0 does not state. */
  readonly form?: DeviceFormParams;
  /**
   * An environment map to use instead of the one built from `envRoom`.
   *
   * The renderer-specific escape hatch: a tier with a captured HDR of a real
   * room passes it here and `env-map.ts` is not called.
   */
  readonly envMap?: Texture | null;
  readonly opticalProfiles?: DeviceOpticalProfiles;
  /** Handed the screen quad once it exists. This is the W6 boundary (D-011). */
  readonly onScreenMeshReady?: ScreenMeshReady;
  /** Pre-installed material for the screen slot; `undefined` keeps the default. */
  readonly screenMaterial?: Material | null;
};

const { body, screen, wheel } = DEVICE_LAYOUT;
const { displayWell, glass } = DEVICE_SURFACE_LAYOUT.front;
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
  opticalProfiles = DEFAULT_DEVICE_OPTICAL_PROFILES,
  onScreenMeshReady,
  screenMaterial,
}: DeviceProps) {
  const invalidate = useThree((state) => state.invalidate);
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
  const bodyMaterial = isBlack ? materials.bodyBlack : materials.bodyWhite;
  const ringMaterial = isBlack
    ? materials.wheelRingBlack
    : materials.wheelRingWhite;
  const selectMaterial = isBlack
    ? materials.selectBlack
    : materials.selectWhite;
  const seamMaterial = isBlack ? materials.chromeSeamBlack : materials.chromeSeam;
  const opticalSignature = JSON.stringify(opticalProfiles);
  const parsedOptical = useMemo(
    () => JSON.parse(opticalSignature) as DeviceOpticalProfiles,
    [opticalSignature],
  );
  const opticalMaps = useMemo(() => {
    const p = parsedOptical;
    const bodyMap = createOpticalNormalMap(
      isBlack ? p.bodyBlack : p.bodyWhite,
      512,
      isBlack ? p.bodyBlackLateral : p.bodyWhiteLateral,
    );
    bodyMap.repeat.set(1, 1 / body.height);
    bodyMap.offset.set(0, 0.5);
    return {
      body: bodyMap,
      ring: createOpticalNormalMap(
        isBlack ? p.wheelBlack : p.wheelWhite,
        512,
        isBlack ? p.wheelBlackLateral : p.wheelWhiteLateral,
      ),
      select: createOpticalNormalMap(
        isBlack ? p.selectBlack : p.selectWhite,
        512,
        isBlack ? p.selectBlackLateral : p.selectWhiteLateral,
      ),
    };
  }, [isBlack, parsedOptical]);
  useEffect(
    () => () => {
      opticalMaps.body.dispose();
      opticalMaps.ring.dispose();
      opticalMaps.select.dispose();
    },
    [opticalMaps],
  );
  const surfaceMaps = materialMapOwnership({
    microNoise: noise,
    steelAnisotropy,
    bodyNormal: opticalMaps.body,
  });
  const bodyRoughness = useMemo(() => {
    const map = createBodyRoughnessMap(
      isBlack ? parsedOptical.bodyBlackRoughness : parsedOptical.bodyWhiteRoughness,
    );
    map.repeat.set(1 / 128, 1 / body.height);
    map.offset.set(0, 0.5);
    return map;
  }, [isBlack, parsedOptical]);
  useEffect(() => () => bodyRoughness.dispose(), [bodyRoughness]);

  // ── Geometry ───────────────────────────────────────────────────────────────
  // Built once per shape-affecting input. Under `frameloop="demand"` a rebuild
  // is also a re-render, so the memo keys are the whole render trigger.

  const frontFaceZ = body.depth / 2;

  // ⚑ **The chassis is three parts, and the split is load-bearing.** A single
  // solid steel slab is the obvious model and it is wrong: the click wheel is a
  // *recess*, so the ring surface lives several pixels **behind** the body face
  // — inside the slab. The first build of this scene did exactly that and the
  // wheel sampled at 210 units against a §4.5 target of 22, because what the
  // probe was reading through the recess opening was the steel's own front cap.
  // The openings therefore have to be cut through the steel as well as through
  // the plastic, which means the steel that shows at the perimeter and the
  // steel that shows when the device is flipped cannot be the same mesh.
  //
  //   steelShell     [splitZ … faceZ]   perimeter frame
  //   steelBackPlate [−D/2 … splitZ]    §5.2's mirror, uncut
  //   frontPlate     [plateBackZ … faceZ]  §5.1/§4.3, inset by the seam
  const splitZ = 0;
  const plateBackZ = frontFaceZ - form.frontThickness;

  const steelShellGeometry = useMemo(() => {
    const shape = silhouetteFrameShape(
      body.width,
      body.height,
      body.cornerR,
      form.seamWidth,
      body.exponent,
    );
    const geometry = new ExtrudeGeometry(shape, {
      depth: Math.max(0.1, frontFaceZ - splitZ - 2 * form.frontBevel),
      bevelEnabled: true,
      bevelThickness: form.frontBevel,
      bevelSize: form.frontBevel,
      bevelSegments: BEVEL_SEGMENTS,
      curveSegments: 1,
    });
    geometry.translate(0, 0, splitZ + form.frontBevel);
    return geometry;
  }, [form.frontBevel, form.seamWidth, frontFaceZ]);
  useEffect(() => () => steelShellGeometry.dispose(), [steelShellGeometry]);

  const backGeometry = useMemo(() => {
    const shape = silhouetteShape(
      body.width,
      body.height,
      body.cornerR,
      body.exponent,
    );
    const depth = frontFaceZ + splitZ - 2 * form.backBevel;
    const geometry = new ExtrudeGeometry(shape, {
      depth: Math.max(0.1, depth),
      bevelEnabled: true,
      bevelThickness: form.backBevel,
      bevelSize: form.backBevel,
      bevelSegments: BEVEL_SEGMENTS,
      curveSegments: 1,
    });
    geometry.translate(0, 0, -body.depth / 2 + form.backBevel);
    return geometry;
  }, [form.backBevel, frontFaceZ]);
  useEffect(() => () => backGeometry.dispose(), [backGeometry]);

  const frontGeometry = useMemo(() => {
    // §5.6 modelled rather than stroked: the polycarbonate front is inset by
    // the seam width, so what runs round the perimeter is the steel shell's own
    // rolled edge, presenting a different angle to the light at every point of
    // the silhouette — §10.4 prevention #6, for free.
    const seam = form.seamWidth;
    const shape = silhouetteShape(
      body.width - 2 * seam,
      body.height - 2 * seam,
      body.cornerR - seam,
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
    );
    extrusion.dispose();
    geometry.translate(0, 0, plateBackZ + form.frontBevel);
    return addOpticalProfile(
      geometry,
      isBlack ? parsedOptical.bodyBlack : parsedOptical.bodyWhite,
      isBlack ? parsedOptical.bodyBlackLateral : parsedOptical.bodyWhiteLateral,
      -body.height / 2 + seam,
      body.height / 2 - seam,
    );
  }, [
    form.seamWidth,
    form.frontThickness,
    form.frontBevel,
    form.bodyCrown,
    form.topEdgeCrown,
    form.bottomEdgeCrown,
    form.edgeCrownExtent,
    plateBackZ,
    isBlack,
    parsedOptical,
  ]);
  useEffect(() => () => frontGeometry.dispose(), [frontGeometry]);

  const ringGeometry = useMemo(
    () =>
      applyOpticalProfile(
        curvedAnnulusGeometry(
          wheel.selectR - 1,
          wheel.outerR,
          form.ringDishTiltDeg,
          form.ringDishExponent,
        ),
        isBlack ? parsedOptical.wheelBlack : parsedOptical.wheelWhite,
        isBlack
          ? parsedOptical.wheelBlackLateral
          : parsedOptical.wheelWhiteLateral,
        -wheel.outerR,
        wheel.outerR,
      ),
    [form.ringDishTiltDeg, form.ringDishExponent, isBlack, parsedOptical],
  );
  useEffect(() => () => ringGeometry.dispose(), [ringGeometry]);

  const selectGeometry = useMemo(
    () =>
      applyOpticalProfile(
        domedDiscGeometry(
          wheel.selectR,
          form.selectDomeTiltDeg,
          form.selectDomeExponent,
        ),
        isBlack ? parsedOptical.selectBlack : parsedOptical.selectWhite,
        isBlack
          ? parsedOptical.selectBlackLateral
          : parsedOptical.selectWhiteLateral,
        -wheel.selectR,
        wheel.selectR,
      ),
    [form.selectDomeTiltDeg, form.selectDomeExponent, isBlack, parsedOptical],
  );
  useEffect(() => () => selectGeometry.dispose(), [selectGeometry]);

  const selectWallGeometry = useMemo(
    () =>
      new CylinderGeometry(
        wheel.selectR,
        wheel.selectR,
        form.selectProud,
        128,
        1,
        true,
      ),
    [form.selectProud],
  );
  useEffect(() => () => selectWallGeometry.dispose(), [selectWallGeometry]);

  const glassGeometry = useMemo(() => {
    const shape = roundedRectShape(
      glass.width,
      glass.height,
      SCREEN_CORNER_R,
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

  const wheelWellGeometry = useMemo(
    () =>
      new CylinderGeometry(
        wheel.outerR,
        wheel.outerR,
        Math.max(0.1, form.recessDepth + form.wheelWellDepth),
        128,
        1,
        true,
      ),
    [form.recessDepth, form.wheelWellDepth],
  );
  useEffect(() => () => wheelWellGeometry.dispose(), [wheelWellGeometry]);

  const screenGeometry = useMemo(
    () => createScreenGeometry(screen.width, screen.height, SCREEN_CORNER_R),
    [],
  );
  useEffect(() => () => screenGeometry.dispose(), [screenGeometry]);

  // §5.3 L8's printed legends. `--wheel-k-label` / `--wheel-w-label` are §4.5
  // tokens; they are the only two colours written in this file, and they are
  // ink rather than material parameters.
  const labelMap = useMemo(
    () =>
      createWheelLabelMap({
        outerR: wheel.outerR,
        bandInnerR: wheel.labelBandInnerR,
        bandOuterR: wheel.labelBandOuterR,
        labelColor: isBlack ? "#A9AFB7" : "#5E646D",
        ringColor: ringMaterial.color,
        fontPx: 13,
        size: 1024,
      }),
    [isBlack, ringMaterial.color],
  );
  useEffect(() => () => labelMap?.dispose(), [labelMap]);
  const selectThicknessMap = useMemo(() => createSelectThicknessMap(), []);
  useEffect(() => () => selectThicknessMap.dispose(), [selectThicknessMap]);

  // ── Depths derived from the dish profiles ─────────────────────────────────
  const ringSag =
    (wheel.outerR * Math.tan((form.ringDishTiltDeg * Math.PI) / 180)) /
    form.ringDishExponent;
  const ringZ = frontFaceZ - form.recessDepth - ringSag;
  const ringInnerZ =
    ringZ +
    ringSag * ((wheel.selectR - 1) / wheel.outerR) ** form.ringDishExponent;
  const selectSag =
    (wheel.selectR * Math.tan((form.selectDomeTiltDeg * Math.PI) / 180)) /
    form.selectDomeExponent;
  const selectRimZ = ringInnerZ + form.selectProud;
  const displayWellFrontZ = frontFaceZ - form.displayWellInset;
  const glassFrontZ = frontFaceZ - form.glassInset;
  const wheelWellZ =
    frontFaceZ - (form.recessDepth + form.wheelWellDepth) / 2 + 0.15;
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
      createCoverGlassMaterial(materials.coverGlass, env, {
        width: glass.width,
        height: glass.height,
      }),
    [env, materials.coverGlass],
  );
  useEffect(() => () => coverGlassMaterial.dispose(), [coverGlassMaterial]);
  const blackBodyPhysicalMaterial = useMemo(
    () =>
      createBlackPolycarbonateMaterial(
        materials.bodyBlack,
        env,
      ),
    [env, materials.bodyBlack],
  );
  useEffect(
    () => () => blackBodyPhysicalMaterial.dispose(),
    [blackBodyPhysicalMaterial],
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

      {/* §5.6 — the steel shell: the perimeter seam and the opening walls. */}
      <mesh name="device-steel-shell" geometry={steelShellGeometry}>
        <meshPhysicalMaterial
          name={isBlack ? "chrome-seam-black" : "chrome-seam"}
          {...spread(seamMaterial)}
          envMap={env}
          roughnessMap={noise}
        />
      </mesh>

      {/* §5.1 / §4.3 — the polycarbonate front, inset by the seam. */}
      <mesh name="device-body" geometry={frontGeometry}>
        {isBlack ? (
          <primitive
            object={blackBodyPhysicalMaterial}
            attach="material"
            name="body-black"
            {...surfaceMaps.body}
            roughnessMap={bodyRoughness}
          />
        ) : (
          <meshPhysicalMaterial
            name="body-white"
            {...spread(bodyMaterial)}
            envMap={env}
            {...surfaceMaps.body}
            roughnessMap={bodyRoughness}
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
          envMap={env}
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
          envMap={env}
        />
      </mesh>

      <mesh
        name="device-wheel-well"
        geometry={wheelWellGeometry}
        position={[wheel.centerX, wheel.centerY, wheelWellZ]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <meshPhysicalMaterial
          name={isBlack ? "wheel-well-black" : "wheel-well-white"}
          {...spread(
            isBlack ? materials.wheelWellBlack : materials.wheelWellWhite,
          )}
          envMap={env}
        />
      </mesh>

      {/* §5.3 — the dished ring, at the bottom of the recess. */}
      <mesh
        name="device-wheel"
        geometry={ringGeometry}
        position={[wheel.centerX, wheel.centerY, ringZ]}
      >
        <meshPhysicalMaterial
          name={isBlack ? "wheel-black" : "wheel-white"}
          {...spread(ringMaterial)}
          envMap={env}
        />
      </mesh>

      {/* §5.3 L8 — screen-printed ink. A separate transparent decal is
          required because a multiplicative map cannot lighten the black ring. */}
      <mesh
        name={WHEEL_LABEL_DECAL_NAME}
        geometry={ringGeometry}
        position={[wheel.centerX, wheel.centerY, ringZ + 0.08]}
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

      {/* §5.4 — the translucent plug, the one raised element on the wheel. */}
      <mesh
        name="device-select"
        geometry={selectWallGeometry}
        position={[
          wheel.centerX,
          wheel.centerY,
          selectRimZ - form.selectProud / 2,
        ]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <meshPhysicalMaterial
          key={isBlack ? "select-cap-black" : "select-cap-white"}
          name={isBlack ? "select-black" : "select-white"}
          {...spread(selectMaterial)}
          envMap={env}
          {...(isBlack ? { thicknessMap: selectThicknessMap } : {})}
        />
      </mesh>
      <mesh
        name="device-select"
        geometry={selectGeometry}
        position={[wheel.centerX, wheel.centerY, selectRimZ + selectSag]}
      >
        <meshPhysicalMaterial
          key={isBlack ? "select-wall-black" : "select-wall-white"}
          name={isBlack ? "select-black" : "select-white"}
          {...spread(selectMaterial)}
          envMap={env}
        />
      </mesh>

      {/* ⚑ The W6 boundary. §12.3: MeshBasicMaterial, toneMapped false. */}
      <mesh
        ref={attachScreen}
        geometry={screenGeometry}
        position={[
          screen.centerX,
          screen.centerY,
          glassFrontZ - form.glassThickness - form.glassToPanel,
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
