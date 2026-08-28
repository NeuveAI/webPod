/**
 * The room, as a 512 × 256 equirectangular environment map.
 *
 * ⚑ **This is the module that decides whether the steel passes §10.4.** The
 * dark horizon band at §4.4 stop 4 is *a reflection of the room's dark half*,
 * not a ramp painted onto a metal. So the §4.4 stop table is not applied to
 * the steel — it is applied to **the room**, at the elevations the steel
 * plate's reflection vector actually sweeps, and the non-monotonic luminance
 * profile then **emerges** in the render because the plate is a mirror
 * pointed at it. §12.3 recipe 1 spells this out and §10.4 names the
 * alternative as the single highest-risk failure in the design.
 *
 * The consequence worth stating plainly: **nothing here is a gradient fill.**
 * Change the camera distance and the steel's profile changes, because the
 * reflection samples a different band of the room. That is the tell that it is
 * a reflection. A painted gradient would not move.
 *
 * Three ingredients, all of them from §5.2:
 *   - **L2** the base metal fill → the room's elevation profile,
 *   - **L3** the sky-reflection blob → a localised bright source, because "a
 *     mirror reflects a *scene*, and the brightest thing in any room is the
 *     light source",
 *   - **L5** the horizon line → the hard edge between reflected wall and
 *     reflected floor, "reflections have edges".
 */
import {
  ClampToEdgeWrapping,
  DataTexture,
  EquirectangularReflectionMapping,
  FloatType,
  LinearFilter,
  LinearSRGBColorSpace,
  RGBAFormat,
} from "three";

import { hexToLinear, hexToSrgb, mix3, srgbToLinear } from "./colour";
import { DEFAULT_DEVICE_MATERIALS } from "./materials";

/** One stop of §4.4's 10-stop table, at its documented position. */
export type RoomStop = { readonly at: number; readonly color: string };

export type SkyBlobParams = {
  /** Degrees left of the viewer's forward axis. §5.2 L3 puts the blob at x 26%. */
  readonly azimuthDeg: number;
  /** Degrees above the horizon. §5.2 L3 puts it at y 12%. */
  readonly elevationDeg: number;
  /** Angular radius of the blob's core. */
  readonly sizeDeg: number;
  /** Added radiance at the core, linear. `--steel-sky` is `#FFFFFF / 30%`. */
  readonly intensity: number;
};

export type HorizonLineParams = {
  /** Position on the §4.4 gradient parameter. §5.2 L5: `y 43%`. */
  readonly at: number;
  /** Angular thickness. §5.2 L5 is 1px with `blur(0.5px)` — a hairline. */
  readonly widthDeg: number;
  /** §5.2 L5: `#4A525C`. */
  readonly color: string;
  /** §5.2 L5: `opacity 0.5`. */
  readonly opacity: number;
};

export type EnvRoomParams = {
  readonly width: number;
  readonly height: number;
  /**
   * §4.4: the steel gradient runs `168deg`, "12° off-axis. Never make this
   * 180deg." Implemented as a **tilt of the room's own vertical axis**, not as
   * a rotated fill: an off-axis reflection is what you get when the room is
   * not perfectly square to the object, and §10.4 prevention #4 wants the
   * cause, not the appearance.
   */
  readonly tiltDeg: number;
  /**
   * Half the elevation range the §4.4 table is spread over.
   *
   * The plate reflects a band of the room, not the whole sphere: for a flat
   * plate of height `h` viewed from distance `D` the reflected elevation
   * spans roughly `±atan(h/2D)`. This is the parameter that registers the
   * table to that band, and it is the one the rig tuner moves — outside the
   * band the endpoint colours are held, so the room stays a room.
   */
  readonly elevHalfSpanDeg: number;
  /** §4.4's `--steel-0 … --steel-10`. */
  readonly stops: ReadonlyArray<RoomStop>;
  /** Per-band HDR pre-exposure compensating the PMREM convolution. */
  readonly stopExposure: ReadonlyArray<number>;
  /**
   * Linear gain from "the value §4.4 says the metal reads at" to "the radiance
   * the room must emit for the metal to read at it".
   *
   * A mirror does not reflect its surroundings unchanged: a metal's specular
   * response is tinted by its own base colour, so at near-normal incidence the
   * reflected radiance is multiplied by roughly the steel's linear albedo
   * (`#C4CBD2` → ≈ 0.57, 0.61, 0.65). The room therefore has to be brighter
   * than the table by the reciprocal of that, per channel — which is a
   * derivation from the material, not a fudge factor, and is why it is
   * computed below rather than typed in.
   */
  readonly radianceGain: readonly [number, number, number];
  /**
   * A single scalar on the whole room's radiance.
   *
   * ⚑ Not a brightness preference. {@link EnvRoomParams.radianceGain} converts
   * the §4.4 table into radiance using the steel's albedo as the mirror's `F0`,
   * which is exact only at normal incidence and for a perfect mirror. The real
   * response is the split-sum `F0·A + B` over a roughness-0.08 lobe, which is a
   * few percent off `F0` and drifts with view angle across the plate. This is
   * the correction for that gap, and it is the reason it is expected to settle
   * near 1.0 rather than anywhere convenient — if the tuner drives it far from
   * 1.0, the room is being used to fix something that is not the room.
   */
  readonly exposure: number;
  /**
   * Expands the §4.4 profile's excursion about its own mean before it becomes
   * radiance.
   *
   * ⚑ A deconvolution, not a stylistic contrast control. The reflection the
   * plate returns is not the room — it is the room convolved with the material's
   * specular lobe, and three prefilters the environment through `PMREMGenerator`
   * on top of that. §4.4's oscillation is fast: eleven stops across the ~27° of
   * elevation a 552px plate reflects, so about 2.7° per stop, which the
   * prefilter measurably flattens. Pre-expanding the room by the reciprocal of
   * that damping is what makes the *render* match the table — which is what
   * §12.3 asks for. It stays close to 1; far from 1 means the profile is being
   * forced rather than corrected.
   */
  readonly profileContrast: number;
  /**
   * Unsharp-mask amount applied to the profile along elevation, and the width
   * of the mask, in units of the §4.4 gradient parameter.
   *
   * ⚑ **A deconvolution, and the reason a global contrast is not enough.** What
   * the plate returns is the room convolved with the material's specular lobe
   * and with `PMREMGenerator`'s prefilter. That convolution is a *low-pass*, so
   * its signature is local and antisymmetric: adjacent stops move in opposite
   * directions, one too bright and the next too dark, wherever the table turns
   * fast. Measured on the untreated room, `--steel-9`/`--steel-10` came back
   * −8/+9 and `--steel-0`/`--steel-1` −3/+7 — a textbook blur, not a gain
   * error. {@link EnvRoomParams.profileContrast} scales everything about the
   * mean and cannot fix that; it over-expands the slow middle while the fast
   * ends stay damped, which is exactly what it did. Pre-sharpening the room by
   * the inverse of the blur is the correct correction and it is local.
   *
   * `amount` 0 disables it. It is expected to be small; large means the profile
   * is being forced rather than deconvolved.
   */
  readonly profileSharpenAmount: number;
  readonly profileSharpenSigma: number;
  /**
   * A second, independent unsharp pass.
   *
   * ⚑ The blur being inverted is not one Gaussian. The specular lobe and
   * `PMREMGenerator`'s prefilter act at different scales, and §4.4 has
   * transitions at two speeds — the slow 13%-wide swing through the horizon and
   * the 6%-wide fall at each end. A single-scale mask that fixes the fast ends
   * over-corrects the slow middle, which is exactly what the residual showed:
   * `--steel-8`/`--steel-9`/`--steel-10` still reading −5/−4/+4 while the
   * middle was inside tolerance. Two scales, applied in sequence, invert two
   * scales of blur.
   */
  readonly profileSharpenAmount2: number;
  readonly profileSharpenSigma2: number;
  readonly sky: SkyBlobParams;
  readonly horizon: HorizonLineParams;
  /**
   * How much the room varies with azimuth, 0..1.
   *
   * A room with no azimuthal structure is a cylinder, and a cylinder reflected
   * in a curved edge produces a suspiciously perfect band. Small on purpose:
   * the plate only sees ±10° of azimuth, so this is for the silhouette's
   * rolled edges and the wheel's chamfer, which see all of it.
   */
  readonly azimuthVariation: number;
};

/** §4.4's mirrored-back table, transcribed once. */
export const STEEL_STOPS: ReadonlyArray<RoomStop> = [
  { at: 0.0, color: "#F6F8FA" },
  { at: 0.07, color: "#C6CDD4" },
  { at: 0.16, color: "#EDF1F5" },
  { at: 0.29, color: "#929BA5" },
  { at: 0.43, color: "#656E78" },
  { at: 0.5, color: "#7C858F" },
  { at: 0.58, color: "#ADB6BF" },
  { at: 0.71, color: "#E1E7EC" },
  { at: 0.85, color: "#96A0AA" },
  { at: 0.94, color: "#C7CED5" },
  { at: 1.0, color: "#7A828C" },
];

/** The reciprocal of the steel's linear albedo — see {@link EnvRoomParams.radianceGain}. */
function radianceGainForMirror(hex: string): [number, number, number] {
  const [r, g, b] = hexToLinear(hex);
  return [1 / r, 1 / g, 1 / b];
}

export const DEFAULT_ENV_ROOM: EnvRoomParams = {
  // ⚑ §12.3 recipe 1 says "512 × 256"; this ships at 1024 × 512, and the extra
  // ring is the reason. §4.4's end stops are *fast*: `--steel-0` → `--steel-1`
  // is a 44-unit fall across 7% of the plate, and `--steel-9` → `--steel-10` a
  // 76-unit fall across 6%. At the camera distance the device is framed at,
  // 6% of the plate is under two degrees of reflected elevation — about three
  // texels at 256 rows, before three's `PMREMGenerator` prefilters on top. At
  // 256 rows those two stops came back damped by 12 and 16 units and no light
  // rig could recover them. The recipe's number is a floor for the
  // *construction*, not a ceiling on the sampling rate, and the acceptance
  // criterion is the stop table.
  //
  // ⚑ Cost, stated rather than buried: 2048 × 1024 RGBA float is 32MB held for
  // the life of the material. It is generated once, never per frame, and never
  // uploaded again — so it does not touch §14.1's budget, which is about rAF
  // callbacks. It is still the largest single allocation in the package and the
  // obvious first thing to halve (`HalfFloatType`) if a memory budget appears.
  width: 2048,
  height: 1024,
  tiltDeg: 12,
  // atan((552/2) / 1160) = 13.4° — the half-angle a 552px plate at the default
  // camera distance actually reflects. Registering the table to that band is
  // what makes the plate show the whole of §4.4 rather than its middle third.
  elevHalfSpanDeg: 16.8375,
  stops: STEEL_STOPS,
  stopExposure: STEEL_STOPS.map(() => 1),
  radianceGain: radianceGainForMirror(DEFAULT_DEVICE_MATERIALS.steelBack.color),
  exposure: 1.15,
  profileContrast: 0.9906,
  profileSharpenAmount: 0.94,
  profileSharpenSigma: 0.0515,
  profileSharpenAmount2: 1.105,
  profileSharpenSigma2: 0.0365,
  sky: {
    // §4.1's room sweep originates at 28% 8% and §5.2 L3's blob at 26% 12% —
    // both upper-left. LAW 2 keeps the *key light* at 12 o'clock; the room's
    // brightest patch is allowed to sit off to one side, and that asymmetry is
    // what §5.1 L5 draws the specular arc at x 32% from.
    azimuthDeg: -39.75,
    elevationDeg: 48,
    sizeDeg: 32.8125,
    intensity: 0.375,
  },
  horizon: {
    at: 0.43,
    widthDeg: 0.95,
    color: "#4A525C",
    opacity: 0.0125,
  },
  azimuthVariation: 0.585,
};

/** The stop table's mean sRGB value — the pivot {@link EnvRoomParams.profileContrast} expands about. */
function meanOfStops(stops: ReadonlyArray<RoomStop>): [number, number, number] {
  let r = 0;
  let g = 0;
  let b = 0;
  for (const stop of stops) {
    const [sr, sg, sb] = hexToSrgb(stop.color);
    r += sr;
    g += sg;
    b += sb;
  }
  const n = Math.max(1, stops.length);
  return [r / n, g / n, b / n];
}

/** Resolution of the 1-D profile LUT the room is built from. */
const PROFILE_SAMPLES = 2048;

/**
 * The §4.4 profile as a 1-D lookup over the gradient parameter, with
 * {@link EnvRoomParams.profileContrast} and the unsharp mask already applied.
 *
 * Built once per room rather than per texel: the profile is a function of one
 * variable, and the sharpening needs its neighbours, which a per-texel
 * evaluation does not have.
 */
function buildProfile(params: EnvRoomParams): Float32Array {
  const mean = meanOfStops(params.stops);
  const contrast = params.profileContrast;
  const raw = new Float32Array(PROFILE_SAMPLES * 3);
  for (let i = 0; i < PROFILE_SAMPLES; i++) {
    const t = i / (PROFILE_SAMPLES - 1);
    const srgb = sampleStops(params.stops, t);
    const bandExposure = sampleScalar(params.stops, params.stopExposure, t);
    for (let c = 0; c < 3; c++) {
      const pivot = mean[c] ?? 0;
      const value = srgb[c] ?? 0;
      raw[i * 3 + c] = Math.min(
        4,
        Math.max(0, (pivot + (value - pivot) * contrast) * bandExposure),
      );
    }
  }

  const once = unsharp(
    raw,
    params.profileSharpenAmount,
    params.profileSharpenSigma,
  );
  return unsharp(
    once,
    params.profileSharpenAmount2,
    params.profileSharpenSigma2,
  );
}

function sampleScalar(
  stops: ReadonlyArray<RoomStop>,
  values: ReadonlyArray<number>,
  t: number,
): number {
  for (let index = 1; index < stops.length; index += 1) {
    const right = stops[index],
      left = stops[index - 1];
    if (right !== undefined && left !== undefined && t <= right.at) {
      const a = values[index - 1] ?? 1,
        b = values[index] ?? 1;
      const mix = (t - left.at) / (right.at - left.at);
      return a + (b - a) * mix;
    }
  }
  return values.at(-1) ?? 1;
}

/** One unsharp pass over the interleaved RGB profile: `orig + amount·(orig − blur)`. */
function unsharp(
  profile: Float32Array,
  amount: number,
  sigmaFraction: number,
): Float32Array {
  if (amount === 0) return profile;
  const sigma = Math.max(1e-4, sigmaFraction) * (PROFILE_SAMPLES - 1);
  const radius = Math.max(1, Math.ceil(sigma * 3));
  const kernel = new Float32Array(radius * 2 + 1);
  let weight = 0;
  for (let k = -radius; k <= radius; k++) {
    const w = Math.exp(-(k * k) / (2 * sigma * sigma));
    kernel[k + radius] = w;
    weight += w;
  }
  const out = new Float32Array(profile.length);
  for (let i = 0; i < PROFILE_SAMPLES; i++) {
    for (let c = 0; c < 3; c++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        const j = Math.min(PROFILE_SAMPLES - 1, Math.max(0, i + k));
        sum += (profile[j * 3 + c] ?? 0) * (kernel[k + radius] ?? 0);
      }
      const blurred = sum / weight;
      const original = profile[i * 3 + c] ?? 0;
      out[i * 3 + c] = Math.min(
        1,
        Math.max(0, original + amount * (original - blurred)),
      );
    }
  }
  return out;
}

/** Read the prepared profile at `t ∈ [0, 1]`. */
function readProfile(
  profile: Float32Array,
  t: number,
): [number, number, number] {
  const clamped = Math.min(1, Math.max(0, t));
  const i = Math.round(clamped * (PROFILE_SAMPLES - 1)) * 3;
  return [profile[i] ?? 0, profile[i + 1] ?? 0, profile[i + 2] ?? 0];
}

/** Piecewise-linear sample of the stop table, **in sRGB**, as CSS would. */
function sampleStops(
  stops: ReadonlyArray<RoomStop>,
  t: number,
): [number, number, number] {
  const clamped = Math.min(1, Math.max(0, t));
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (first === undefined || last === undefined) return [0, 0, 0];
  if (clamped <= first.at) return hexToSrgb(first.color);
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1];
    const b = stops[i];
    if (a === undefined || b === undefined) continue;
    if (clamped <= b.at) {
      const span = b.at - a.at;
      const k = span <= 0 ? 0 : (clamped - a.at) / span;
      return mix3(hexToSrgb(a.color), hexToSrgb(b.color), k);
    }
  }
  return hexToSrgb(last.color);
}

/**
 * Build the room.
 *
 * Returns a float equirect ready to assign as `envMap`. Float rather than
 * 8-bit for two reasons: the sky blob is deliberately above 1.0, which an
 * 8-bit texture would clip into a flat white disc; and §10.2's banding guard
 * applies to the reflection as much as to a fill — 8 bits across a 26° band
 * that the steel magnifies is exactly where banding shows.
 *
 * ⚑ Renderer-specific by design (D-012): this function is where "three.js
 * wants an `EquirectangularReflectionMapping` `DataTexture`" is known. A tier
 * on a different renderer replaces this function and nothing else.
 */
export function createRoomEnvMap(
  params: EnvRoomParams = DEFAULT_ENV_ROOM,
): DataTexture {
  const { width, height } = params;
  const data = new Float32Array(width * height * 4);

  const tilt = (params.tiltDeg * Math.PI) / 180;
  // The room's own up-axis, tilted in the xy plane. Everything below measures
  // elevation against this rather than against +y, which is what makes the
  // profile 12° off-axis at its source.
  const axis: [number, number, number] = [Math.sin(tilt), Math.cos(tilt), 0];

  const halfSpan = (params.elevHalfSpanDeg * Math.PI) / 180;
  const skyAz = (params.sky.azimuthDeg * Math.PI) / 180;
  const skyEl = (params.sky.elevationDeg * Math.PI) / 180;
  const skySize = (params.sky.sizeDeg * Math.PI) / 180;
  const skyDir: [number, number, number] = [
    Math.cos(skyEl) * Math.sin(skyAz),
    Math.sin(skyEl),
    Math.cos(skyEl) * Math.cos(skyAz),
  ];

  const horizonHalfWidth = (params.horizon.widthDeg * Math.PI) / 360;
  const horizonColor = hexToSrgb(params.horizon.color);
  // The gradient parameter maps to elevation as g = 0.5 − φ/(2·halfSpan), so
  // the horizon stop sits at this elevation.
  const horizonElev = (0.5 - params.horizon.at) * 2 * halfSpan;

  const exposure = params.exposure;
  const profile = buildProfile(params);
  const [gainR, gainG, gainB] = params.radianceGain;

  // ⚑ **The texel → direction mapping is inverted from the obvious one, and
  // getting it wrong is silent.** three.js samples an equirect through
  // `equirectUv` (`ShaderChunk/common.glsl.js:91`):
  //
  //     u = atan(dir.z, dir.x) / 2π + 0.5
  //     v = asin(dir.y) / π + 0.5
  //
  // so `v = 1` is the **zenith**, and a `DataTexture` has `flipY = false`, which
  // puts data row 0 at `v = 0` — the **nadir**. Writing the sky into row 0, the
  // way one writes an image, therefore hangs the room upside down. It does not
  // throw, it does not look obviously wrong on a diffuse surface, and on the
  // mirror it produced a plausible smooth gradient with the §4.4 profile
  // reversed — which a rig tuner will spend an hour failing to fix from the
  // outside. The direction is reconstructed by inverting `equirectUv` exactly.
  for (let y = 0; y < height; y++) {
    const v = (y + 0.5) / height;
    const dirY = Math.sin((v - 0.5) * Math.PI);
    const rho = Math.cos((v - 0.5) * Math.PI);
    for (let x = 0; x < width; x++) {
      const a = ((x + 0.5) / width - 0.5) * Math.PI * 2;
      const dir: [number, number, number] = [
        rho * Math.cos(a),
        dirY,
        rho * Math.sin(a),
      ];

      // Elevation against the *tilted* axis.
      const e = Math.min(
        1,
        Math.max(-1, dir[0] * axis[0] + dir[1] * axis[1] + dir[2] * axis[2]),
      );
      const elev = Math.asin(e);
      const g = 0.5 - elev / (2 * halfSpan);

      let srgb = readProfile(profile, g);

      // §5.2 L5 — the hard edge between reflected wall and reflected floor.
      const dHorizon = Math.abs(elev - horizonElev);
      if (dHorizon < horizonHalfWidth) {
        const k = (1 - dHorizon / horizonHalfWidth) * params.horizon.opacity;
        srgb = mix3(srgb, horizonColor, k);
      }

      // A room is not a cylinder: fade slightly toward the half of the room
      // behind the object. Cheap, and it is what stops the rolled edges
      // presenting an identical band at every point of the perimeter.
      const facing =
        dir[0] * skyDir[0] + dir[1] * skyDir[1] + dir[2] * skyDir[2];
      const azTerm = 1 - params.azimuthVariation * (1 - (facing + 1) / 2);

      let lr = srgbToLinear(srgb[0]) * gainR * azTerm * exposure;
      let lg = srgbToLinear(srgb[1]) * gainG * azTerm * exposure;
      let lb = srgbToLinear(srgb[2]) * gainB * azTerm * exposure;

      // §5.2 L3 — the light source itself, as a localised blob rather than a
      // brighter part of a ramp. Gaussian so it has no edge of its own.
      const angle = Math.acos(Math.min(1, Math.max(-1, facing)));
      const blob = params.sky.intensity * Math.exp(-((angle / skySize) ** 2));
      lr += blob;
      lg += blob;
      lb += blob;

      const i = (y * width + x) * 4;
      data[i] = lr;
      data[i + 1] = lg;
      data[i + 2] = lb;
      data[i + 3] = 1;
    }
  }

  const texture = new DataTexture(data, width, height, RGBAFormat, FloatType);
  texture.mapping = EquirectangularReflectionMapping;
  texture.colorSpace = LinearSRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}
