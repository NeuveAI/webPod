/**
 * LAW 2 — One Light, as numbers.
 *
 * > *"A single key light at 12 o'clock, 18° behind the viewer, plus one cool
 * > fill from the lower-left at 22% intensity. Every highlight, every shadow,
 * > every gradient direction in this document derives from it."*
 *
 * ⚑ **There are exactly two lights and there is no ambient term.** The ambient
 * *is* the environment map — the room the object stands in (§4.1) — which is
 * also where §4.2's floor bounce at stops 5–7 comes from. Adding an
 * `ambientLight` or a `hemisphereLight` would be a third and a fourth light,
 * and it would let the body's vertical profile be dialled in by a knob that
 * corresponds to nothing in the room. Every unit of light on this object
 * arrives from the key, the fill, or the room.
 *
 * The key is a **point** light, not a directional one, and that is load-bearing
 * rather than incidental: on a flat face a directional light produces a
 * constant `N·L` and therefore no vertical profile at all, whereas a light at
 * a stated distance falls off across the 552px face exactly as a real one in a
 * room does. §4.2's "rapid falloff (gloss = short falloff)" and §4.3's broad
 * diffuse shoulder are the same rig seen through two different albedos.
 */

export type KeyLightParams = {
  /**
   * Degrees the light sits toward the viewer from straight up. LAW 2: **18°**.
   * Not a free parameter.
   */
  readonly tiltTowardViewerDeg: number;
  /** Distance from the body's face centre, in body px. */
  readonly distance: number;
  /** Candela, three.js physical units — irradiance is `intensity / d²`. */
  readonly intensity: number;
  readonly color: string;
};

export type FillLightParams = {
  /** Degrees left of the viewer's forward axis. LAW 2: lower-**left**. */
  readonly azimuthDeg: number;
  /** Degrees **below** the horizon. LAW 2: **lower**-left. */
  readonly elevationDeg: number;
  readonly distance: number;
  /**
   * Fraction of the key's intensity. LAW 2: **0.22**. Not a free parameter —
   * the tuner moves the key, and the fill follows it.
   */
  readonly intensityRatio: number;
  /**
   * §4.2 `--poly-k-edge-lo` is `#8FB4D8 / 12%`, described in the same row as
   * "(fill light)". The fill's colour is therefore already stated by the token
   * that records its effect.
   */
  readonly color: string;
};

export type LightRigParams = {
  readonly key: KeyLightParams;
  readonly fill: FillLightParams;
};

export const DEFAULT_LIGHT_RIG: LightRigParams = {
  key: {
    tiltTowardViewerDeg: 18,
    distance: 1375,
    intensity: 15500000,
    color: "#FFFFFF",
  },
  fill: {
    azimuthDeg: -26.7116,
    elevationDeg: -59.0468,
    distance: 459.375,
    intensityRatio: 0.22,
    color: "#8FB4D8",
  },
};

/** World position of the key light, body-local, +y up, +z toward the viewer. */
export function keyLightPosition(
  key: KeyLightParams,
): [number, number, number] {
  const tilt = (key.tiltTowardViewerDeg * Math.PI) / 180;
  return [0, Math.cos(tilt) * key.distance, Math.sin(tilt) * key.distance];
}

/** World position of the fill light. */
export function fillLightPosition(
  fill: FillLightParams,
): [number, number, number] {
  const az = (fill.azimuthDeg * Math.PI) / 180;
  const el = (fill.elevationDeg * Math.PI) / 180;
  return [
    Math.cos(el) * Math.sin(az) * fill.distance,
    Math.sin(el) * fill.distance,
    Math.cos(el) * Math.cos(az) * fill.distance,
  ];
}

/** The fill's absolute intensity, derived from the key so LAW 2's 22% holds. */
export function fillLightIntensity(rig: LightRigParams): number {
  const scale = (rig.fill.distance / rig.key.distance) ** 2;
  return rig.key.intensity * rig.fill.intensityRatio * scale;
}
