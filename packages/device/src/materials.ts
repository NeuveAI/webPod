/**
 * The §12.3 material parameter table, as data.
 *
 * ⚑ **This module is the only place a material number is written down.** No
 * component constructs a material with an inline literal — D-012 requires the
 * parameters to arrive as *inputs*, so a later fallback tier can supply a
 * different set by passing a different object rather than by editing a
 * component. There is exactly one set here and exactly one caller path; the
 * mechanism to choose between sets is deliberately absent (D-012's
 * anti-overbuild rule).
 *
 * ⚑ **Where this ought to live.** D-012 says these defaults are "sourced from
 * `packages/tokens`". W4's guardrail says W4 owns `packages/device/**` and
 * nothing else. The two conflict, and the guardrail wins for now: the table
 * lives here, in one module, shaped so it can be lifted into
 * `packages/tokens` verbatim by the lane that owns that package. Geometry —
 * which *is* already exported by `packages/tokens` — is imported, never
 * re-typed. See `decisions/w4.md` W4-D1.
 *
 * Colours are the sRGB hex strings from the spec. `THREE.Color` decodes them
 * through `ColorManagement`, so the number written here is the number in
 * §12.3 and the linear-space conversion is the renderer's problem.
 */

/**
 * Parameters for a `MeshPhysicalMaterial`.
 *
 * A structural subset rather than `Partial<MeshPhysicalMaterialParameters>`:
 * naming the fields is what makes an alternative parameter set checkable
 * against this one instead of being an arbitrary bag.
 */
export type PhysicalSurfaceParams = {
  readonly color: string;
  /** Linear-sRGB albedo multiplier; `1` preserves the authored base colour. */
  readonly albedoScale?: number;
  readonly roughness: number;
  readonly bumpScale?: number;
  readonly metalness?: number;
  readonly clearcoat?: number;
  readonly clearcoatRoughness?: number;
  readonly reflectivity?: number;
  readonly sheen?: number;
  readonly sheenColor?: string;
  readonly sheenRoughness?: number;
  readonly specularIntensity?: number;
  readonly anisotropy?: number;
  readonly anisotropyRotation?: number;
  readonly transmission?: number;
  readonly thickness?: number;
  readonly ior?: number;
  readonly attenuationColor?: string;
  readonly attenuationDistance?: number;
  readonly opacity?: number;
  readonly transparent?: boolean;
  readonly envMapIntensity?: number;
  readonly subsurfaceColor?: string;
  readonly subsurfaceDistortion?: number;
  readonly subsurfaceAttenuation?: number;
  readonly subsurfacePower?: number;
  readonly subsurfaceScale?: number;
};

/** Parameters for the screen quad's `MeshBasicMaterial` (§12.3, last row). */
export type ScreenSurfaceParams = {
  readonly color: string;
  /** ⚑ §12.3: `toneMapped false`. The panel is emissive; it is not lit. */
  readonly toneMapped: boolean;
};

/**
 * Every surface §12.3 hands to R3F, keyed by the name §12.3 uses.
 *
 * Both colourways are present at once because the physical light rig is shared
 * and the acceptance criterion samples both against §4.2 *and* §4.3 — a rig
 * tuned against one colourway alone is not tuned.
 */
export type DeviceMaterials = {
  readonly bodyBlack: PhysicalSurfaceParams;
  readonly bodyWhite: PhysicalSurfaceParams;
  readonly steelBack: PhysicalSurfaceParams;
  readonly chromeSeam: PhysicalSurfaceParams;
  readonly chromeSeamBlack: PhysicalSurfaceParams;
  readonly displayWell: PhysicalSurfaceParams;
  readonly rearInlay: PhysicalSurfaceParams;
  readonly holdIndicator: PhysicalSurfaceParams;
  readonly wheelRingBlack: PhysicalSurfaceParams;
  readonly wheelRingWhite: PhysicalSurfaceParams;
  readonly wheelWellBlack: PhysicalSurfaceParams;
  readonly wheelWellWhite: PhysicalSurfaceParams;
  readonly selectBlack: PhysicalSurfaceParams;
  readonly selectWhite: PhysicalSurfaceParams;
  /** Screen-printed ink is colourway-calibrated, not a material inversion. */
  readonly wheelLabelBlack: string;
  readonly wheelLabelWhite: string;
  readonly coverGlass: PhysicalSurfaceParams;
  /** Non-reflective black assembly reveal between the face opening and LCD. */
  readonly screenReveal: ScreenSurfaceParams;
  readonly screen: ScreenSurfaceParams;
};

export type WheelColourwayParams = {
  readonly ring: PhysicalSurfaceParams;
  readonly select: PhysicalSurfaceParams;
  readonly labelColor: string;
};

/** The Classic's anodized aluminum is shared by the front and Select.
 * `white` remains the persisted light-variant key; its finish is now silver.
 * Owner IMG_2289/2290 establish the metal/plastic separation. */
export const CLASSIC_ALUMINUM = Object.freeze({
  black: Object.freeze({
    color: "#4E4D4B", roughness: 0.56, metalness: 1,
    clearcoat: 0, sheen: 0, transmission: 0,
    bumpScale: 0.035, anisotropy: 0.36, anisotropyRotation: 0, envMapIntensity: 0.72,
  }),
  white: Object.freeze({
    color: "#D5D7D8", roughness: 0.54, metalness: 1,
    clearcoat: 0, sheen: 0, transmission: 0,
    bumpScale: 0.035, anisotropy: 0.36, anisotropyRotation: 0, envMapIntensity: 0.72,
  }),
});

/** Separate matte plastic wheel rings; Select uses the enclosure's metal. */
export const DEFAULT_WHEEL_COLOURWAYS: Readonly<
  Record<"black" | "white", WheelColourwayParams>
> = Object.freeze({
  black: Object.freeze({
    ring: Object.freeze({
      color: "#242321", albedoScale: 0.75, roughness: 0.76,
      metalness: 0, clearcoat: 0, specularIntensity: 0.22,
      envMapIntensity: 0.012,
    }),
    select: CLASSIC_ALUMINUM.black,
    labelColor: "#F0EFEB",
  }),
  white: Object.freeze({
    ring: Object.freeze({
      color: "#FFFFFF", albedoScale: 1.3, roughness: 0.8,
      metalness: 0, clearcoat: 0, specularIntensity: 0.22,
      envMapIntensity: 0.012,
    }),
    select: CLASSIC_ALUMINUM.white,
    labelColor: "#777B7D",
  }),
});

/** Production Classic material table; the clear screen cover is independent. */
export const DEFAULT_DEVICE_MATERIALS: DeviceMaterials = {
  bodyBlack: CLASSIC_ALUMINUM.black,
  bodyWhite: CLASSIC_ALUMINUM.white,
  steelBack: {
    // The green-channel microtexture now preserves this authored roughness.
    // A soft polished lobe keeps reflected softboxes graduated through rotation.
    color: "#C4CBD2",
    metalness: 1.0,
    roughness: 0.14,
    anisotropy: 0.12,
    anisotropyRotation: 0,
    envMapIntensity: 0.65,
  },
  chromeSeam: {
    color: "#A6AFBA",
    metalness: 0.35,
    roughness: 0.4986,
    envMapIntensity: 0.045,
  },
  chromeSeamBlack: {
    color: "#252A31",
    metalness: 0.2,
    roughness: 0.5398,
    specularIntensity: 0.1774,
    envMapIntensity: 0.0363,
  },
  displayWell: {
    color: "#1B2430",
    roughness: 0.7833,
    metalness: 0.02,
    clearcoat: 0.0386,
    clearcoatRoughness: 0.5105,
    envMapIntensity: 0.0127,
  },
  rearInlay: {
    color: "#11161E",
    roughness: 0.58,
    metalness: 0.04,
    clearcoat: 0.24,
    clearcoatRoughness: 0.26,
    envMapIntensity: 0.18,
  },
  holdIndicator: {
    color: "#F16A24",
    roughness: 0.62,
    metalness: 0,
    clearcoat: 0.16,
    clearcoatRoughness: 0.34,
    envMapIntensity: 0.08,
  },
  wheelRingBlack: DEFAULT_WHEEL_COLOURWAYS.black.ring,
  wheelRingWhite: DEFAULT_WHEEL_COLOURWAYS.white.ring,
  wheelWellBlack: {
    color: "#0E1218",
    albedoScale: 0.8391,
    roughness: 0.7934,
    metalness: 0.02,
    clearcoat: 0.04,
    clearcoatRoughness: 0.4502,
    envMapIntensity: 0.0069,
  },
  wheelWellWhite: {
    // The assembly gap is a hairline cavity, not a painted dark annulus. A
    // light warm-neutral floor lets real occlusion create the contact line.
    color: "#E8E5DF",
    albedoScale: 0.72,
    roughness: 0.8164,
    metalness: 0,
    clearcoat: 0.0224,
    clearcoatRoughness: 0.5518,
    envMapIntensity: 0.0028,
  },
  selectBlack: DEFAULT_WHEEL_COLOURWAYS.black.select,
  selectWhite: DEFAULT_WHEEL_COLOURWAYS.white.select,
  wheelLabelBlack: DEFAULT_WHEEL_COLOURWAYS.black.labelColor,
  wheelLabelWhite: DEFAULT_WHEEL_COLOURWAYS.white.labelColor,
  coverGlass: {
    // Flush plastic window: black diffuse albedo removes the opaque white
    // wash; dielectric specular/clearcoat remain colorless. Alpha composites
    // reflections over the sharp LCD without a transmission sampling pass.
    color: "#000000",
    transmission: 0,
    ior: 1.5,
    thickness: 0.2,
    roughness: 0.08,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    specularIntensity: 1,
    metalness: 0,
    attenuationColor: "#F5F8FC",
    attenuationDistance: 48,
    opacity: 0.2,
    transparent: true,
    envMapIntensity: 1.1,
  },
  screenReveal: {
    color: "#050608",
    toneMapped: false,
  },
  screen: {
    // The standalone default. W6 replaces the map; see `screen-mesh.ts`.
    color: "#0B0D11",
    toneMapped: false,
  },
};
