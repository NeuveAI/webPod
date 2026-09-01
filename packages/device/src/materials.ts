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
  readonly coverGlass: PhysicalSurfaceParams;
  readonly screen: ScreenSurfaceParams;
};

/**
 * §12.3 verbatim.
 *
 * Four annotations, all of them places where §12.3 under-specifies rather
 * than where this file departs from it:
 *
 * 1. **The steel is a `MeshPhysicalMaterial`, not a `MeshStandardMaterial`.**
 *    §12.3's row says `MeshStandardMaterial` *and* `anisotropy 0.75`, and
 *    three.js has no such property on `MeshStandardMaterial` — anisotropy is
 *    declared on `MeshPhysicalMaterial` (three@0.185, `src/materials/`).
 *    `MeshPhysicalMaterial` extends `MeshStandardMaterial`, so honouring the
 *    parameter is the reading that keeps both halves of the row. Dropping the
 *    anisotropy instead would delete §10.4 prevention #5.
 * 2. **The Select and glass rows give no `color`.** They are transmissive, so
 *    the base colour is nearly invisible; the §4.5 `--select-k-*` / `--select-w-*`
 *    tables give the value the plug reads at, and that is what is used.
 * 3. **`sheenRoughness`** is not in §12.3. three.js defaults it to 1.0, which
 *    is the broad velvet lobe; §5.1 L4's sub-surface warmth is a broad
 *    bottom-edge scatter, so the default is right and is written down rather
 *    than left implicit.
 * 4. **`envMapIntensity`** is not in §12.3 either. D-057 keeps the mirror back
 *    at 1.0 while front surfaces use lower gains: steel is room-driven and
 *    polycarbonate is light-driven. The bezel seam is a distinct chrome edge,
 *    not a strip of the mirror-back material.
 */
export const DEFAULT_DEVICE_MATERIALS: DeviceMaterials = {
  bodyBlack: {
    color: "#11161C",
    albedoScale: 0.34,
    roughness: 0.68,
    metalness: 0,
    clearcoat: 0.32,
    clearcoatRoughness: 0.46,
    reflectivity: 0.38,
    // D-067: the black shell keeps a warm broad sheen, and the hierarchy must
    // come from real light and shape rather than from a painted front gradient.
    sheen: 0.15,
    sheenColor: "#6E4A2E",
    sheenRoughness: 1,
    specularIntensity: 0.16,
    envMapIntensity: 0.008,
    // Three 0.185.1's WebGL physical material has no SSS term. These values
    // extend its per-direct-light loop using MeshSSSNodeMaterial's scattering
    // shape. Point-light color, intensity and distance attenuation remain
    // Three-owned, so the real key/kick rig remains the sole direct source.
    subsurfaceColor: "#5C6876",
    subsurfaceDistortion: 0.2214,
    subsurfaceAttenuation: 0.1,
    subsurfacePower: 1,
    subsurfaceScale: 1.4,
  },
  bodyWhite: {
    color: "#F4F7FA",
    // Preserve headroom for the key/clearcoat lobe. At 1.0 the diffuse term
    // clipped almost the whole face to white and erased Pencil's pearl trough.
    albedoScale: 0.6494,
    roughness: 0.78,
    metalness: 0,
    clearcoat: 0.12,
    clearcoatRoughness: 0.5,
    reflectivity: 0.1718,
    sheen: 0.0914,
    sheenColor: "#F2F6FA",
    sheenRoughness: 0.985,
    specularIntensity: 0.08,
    envMapIntensity: 0.0024,
    subsurfaceColor: "#F4FAFF",
    subsurfaceDistortion: 0.1824,
    subsurfaceAttenuation: 0.0479,
    subsurfacePower: 1,
    subsurfaceScale: 1.0416,
  },
  steelBack: {
    color: "#C4CBD2",
    metalness: 1.0,
    roughness: 0.08,
    anisotropy: 0.75,
    anisotropyRotation: 0,
    envMapIntensity: 1.0,
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
  wheelRingBlack: {
    color: "#1D2128",
    albedoScale: 0.6094,
    roughness: 0.3692,
    metalness: 0,
    clearcoat: 0.1009,
    clearcoatRoughness: 0.5013,
    envMapIntensity: 0.0061,
  },
  wheelRingWhite: {
    color: "#E7EDF3",
    albedoScale: 0.5928,
    roughness: 0.8675,
    metalness: 0,
    clearcoat: 0.0435,
    clearcoatRoughness: 0.6217,
    envMapIntensity: 0.0056,
  },
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
    color: "#D9E1E9",
    albedoScale: 0.6214,
    roughness: 0.8164,
    metalness: 0,
    clearcoat: 0.0224,
    clearcoatRoughness: 0.5518,
    envMapIntensity: 0.0028,
  },
  selectBlack: {
    // §4.5 `--select-k-2`, the plug's body value.
    color: "#1B1E23",
    transmission: 0.05,
    thickness: 1.1,
    ior: 1.52,
    attenuationColor: "#C0CCD8",
    attenuationDistance: 1.4,
    roughness: 0.46,
    clearcoat: 0.12,
    clearcoatRoughness: 0.4,
    metalness: 0,
    specularIntensity: 0.1,
    envMapIntensity: 0.008,
  },
  selectWhite: {
    // §4.5 `--select-w-2`.
    color: "#FAFCFE",
    albedoScale: 0.9041,
    transmission: 0.0516,
    thickness: 0.992,
    ior: 1.52,
    roughness: 0.5484,
    clearcoat: 0.0612,
    clearcoatRoughness: 0.4686,
    metalness: 0,
    specularIntensity: 0.0514,
    envMapIntensity: 0.0093,
  },
  coverGlass: {
    // §4.6's `--panel-bg` is behind the sheet; the sheet itself is colourless.
    color: "#FFFFFF",
    transmission: 0,
    ior: 1.5,
    thickness: 0.2,
    roughness: 0.08,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    specularIntensity: 0.35,
    metalness: 0,
    attenuationColor: "#F5F8FC",
    attenuationDistance: 48,
    opacity: 0.12,
    transparent: true,
    envMapIntensity: 0.16,
  },
  screen: {
    // The standalone default. W6 replaces the map; see `screen-mesh.ts`.
    color: "#0B0D11",
    toneMapped: false,
  },
};
