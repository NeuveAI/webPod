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
  readonly opacity?: number;
  readonly transparent?: boolean;
  readonly envMapIntensity?: number;
  readonly subsurfaceColor?: string;
  readonly subsurfaceAmbient?: number;
  readonly subsurfaceDistortion?: number;
  readonly subsurfacePower?: number;
  readonly subsurfaceScale?: number;
  readonly edgeTransmission?: number;
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
 * Both colourways are present at once because the light rig is shared (LAW 2)
 * and the acceptance criterion samples both against §4.2 *and* §4.3 — a rig
 * tuned against one colourway alone is not tuned.
 */
export type DeviceMaterials = {
  readonly bodyBlack: PhysicalSurfaceParams;
  readonly bodyWhite: PhysicalSurfaceParams;
  readonly steelBack: PhysicalSurfaceParams;
  readonly chromeSeam: PhysicalSurfaceParams;
  readonly chromeSeamBlack: PhysicalSurfaceParams;
  readonly wheelRingBlack: PhysicalSurfaceParams;
  readonly wheelRingWhite: PhysicalSurfaceParams;
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
    color: "#0D1015",
    albedoScale: 1,
    roughness: 0.26,
    metalness: 0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.045,
    reflectivity: 0.6,
    sheen: 0.12,
    sheenColor: "#687482",
    sheenRoughness: 0.7,
    specularIntensity: 0.28,
    envMapIntensity: 0.32,
    // Three 0.185.1's WebGL physical material has no SSS term. These values
    // drive the bounded shader extension in physical-materials.ts using the
    // same distortion/ambient/power/scale vocabulary as MeshSSSNodeMaterial.
    subsurfaceColor: "#596675",
    subsurfaceAmbient: 0.006,
    subsurfaceDistortion: 0.18,
    subsurfacePower: 3.5,
    subsurfaceScale: 0.05,
    edgeTransmission: 0.016,
  },
  bodyWhite: {
    color: "#E2E5E8",
    // Preserve headroom for the key/clearcoat lobe. At 1.0 the diffuse term
    // clipped almost the whole face to white and erased Pencil's pearl trough.
    albedoScale: 0.9,
    roughness: 0.3,
    metalness: 0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.055,
    reflectivity: 0.5,
    specularIntensity: 0.32,
    envMapIntensity: 0.31,
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
    roughness: 0.32,
    envMapIntensity: 0.25,
  },
  chromeSeamBlack: {
    color: "#252A31",
    metalness: 0.2,
    roughness: 0.24,
    specularIntensity: 0.34,
    envMapIntensity: 0.38,
  },
  wheelRingBlack: {
    color: "#23262B",
    roughness: 0.34,
    metalness: 0,
    clearcoat: 0.6,
    clearcoatRoughness: 0.14,
    envMapIntensity: 0.005,
  },
  wheelRingWhite: {
    color: "#E1E6EB",
    roughness: 0.56,
    metalness: 0,
    clearcoat: 0.6,
    clearcoatRoughness: 0.22,
    envMapIntensity: 0.075,
  },
  selectBlack: {
    // §4.5 `--select-k-2`, the plug's body value.
    color: "#1B1E23",
    transmission: 0.35,
    thickness: 1.2,
    ior: 1.52,
    roughness: 0.18,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    metalness: 0,
    envMapIntensity: 0.2175,
  },
  selectWhite: {
    // §4.5 `--select-w-2`.
    color: "#E4E7EA",
    transmission: 0.35,
    thickness: 1.2,
    ior: 1.52,
    roughness: 0.18,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    metalness: 0,
    envMapIntensity: 0.6237,
  },
  coverGlass: {
    // §4.6's `--panel-bg` is behind the sheet; the sheet itself is colourless.
    color: "#FFFFFF",
    transmission: 0.92,
    ior: 1.52,
    thickness: 0.6,
    roughness: 0.02,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    specularIntensity: 0.2,
    metalness: 0,
    opacity: 1,
    transparent: false,
    envMapIntensity: 0.08,
  },
  screen: {
    // The standalone default. W6 replaces the map; see `screen-mesh.ts`.
    color: "#0B0D11",
    toneMapped: false,
  },
};
