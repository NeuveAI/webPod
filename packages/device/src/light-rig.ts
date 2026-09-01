/**
 * The owner-approved two-light studio rig.
 *
 * Both emitters are real world-space RectAreaLights. They remain siblings of
 * the orientation group, so their reflections travel over the model's normals
 * when the iPod turns. Nothing here is expressed in UV or camera shader space.
 *
 * `descentDeg` is the geometric angle between the key-to-target ray and the
 * horizontal x/z plane. The accepted range is 35–45°. `emitter` is both the
 * physical source size and the softness control: a larger rectangle subtends a
 * wider solid angle and therefore produces a broader highlight. Three's
 * RectAreaLight integrates that finite source in world space, so illumination
 * falls with its shrinking solid angle rather than a view-locked paint pass.
 */

export type AreaEmitterSize = {
  readonly width: number;
  readonly height: number;
};

export type KeyLightParams = {
  /** Degrees camera-right from the viewer's +z axis. */
  readonly viewerAzimuthDeg: number;
  /** Downward incidence from the horizontal plane; owner range 35–45°. */
  readonly descentDeg: number;
  /** Source-centre distance from the model origin, in model units. */
  readonly distance: number;
  /** Luminous power in lumens, before the rig exposure multiplier. */
  readonly power: number;
  /** Physical softbox dimensions; these are the softness parameters. */
  readonly emitter: AreaEmitterSize;
  readonly color: string;
};

export type KickLightParams = {
  /** Degrees camera-right from the viewer's +z axis. Negative is camera-left. */
  readonly viewerAzimuthDeg: number;
  /** Elevation below the horizontal plane. Must remain negative. */
  readonly elevationDeg: number;
  readonly distance: number;
  /** World-space aim point near one lower corner, so the strip rakes rather than bands. */
  readonly target: readonly [number, number, number];
  /** Fraction of the key's luminous power. Must remain below 1. */
  readonly powerRatio: number;
  /** Physical softbox dimensions; these are the softness parameters. */
  readonly emitter: AreaEmitterSize;
  readonly color: string;
};

export type LightRigParams = {
  /** Linear scene exposure applied equally to both physical emitters. */
  readonly exposure: number;
  readonly key: KeyLightParams;
  readonly kick: KickLightParams;
};

export const DEFAULT_LIGHT_RIG: LightRigParams = {
  // A small linear exposure adjustment keeps the output transform neutral;
  // canonical stop-table measurements are not passed through a filmic curve.
  exposure: 0.92,
  key: {
    viewerAzimuthDeg: 45,
    descentDeg: 40,
    distance: 720,
    power: 9_000_000,
    emitter: { width: 520, height: 380 },
    color: "#FFF9F2",
  },
  kick: {
    viewerAzimuthDeg: -120,
    elevationDeg: -10,
    distance: 650,
    target: [-110, -210, -20],
    powerRatio: 0.03,
    emitter: { width: 85, height: 300 },
    color: "#DCE7F2",
  },
};

/** World position of the top-right key, +y up and +z toward the viewer. */
export function keyLightPosition(
  key: KeyLightParams,
): [number, number, number] {
  const azimuth = (key.viewerAzimuthDeg * Math.PI) / 180;
  const descent = (key.descentDeg * Math.PI) / 180;
  const horizontal = Math.cos(descent) * key.distance;
  return [
    Math.sin(azimuth) * horizontal,
    Math.sin(descent) * key.distance,
    Math.cos(azimuth) * horizontal,
  ];
}

/** World position of the subordinate lower kick. */
export function kickLightPosition(
  kick: KickLightParams,
): [number, number, number] {
  const azimuth = (kick.viewerAzimuthDeg * Math.PI) / 180;
  const elevation = (kick.elevationDeg * Math.PI) / 180;
  const horizontal = Math.cos(elevation) * kick.distance;
  return [
    Math.sin(azimuth) * horizontal,
    Math.sin(elevation) * kick.distance,
    Math.cos(azimuth) * horizontal,
  ];
}

/** Recover the key's actual descent angle from its Cartesian position. */
export function keyDescentAngleDeg(
  position: readonly [number, number, number],
): number {
  const [x, y, z] = position;
  return (Math.atan2(y, Math.hypot(x, z)) * 180) / Math.PI;
}

/** Recover camera-right azimuth from +z, in viewer coordinates. */
export function viewerAzimuthAngleDeg(
  position: readonly [number, number, number],
): number {
  const [x, , z] = position;
  return (Math.atan2(x, z) * 180) / Math.PI;
}

/** Convert RectAreaLight luminous power (lm) to its intensity (nit). */
export function areaLightIntensity(
  power: number,
  emitter: AreaEmitterSize,
): number {
  if (!(power > 0)) throw new Error("area-light power must be positive");
  if (!(emitter.width > 0 && emitter.height > 0)) {
    throw new Error("area-light emitter dimensions must be positive");
  }
  return power / (emitter.width * emitter.height * Math.PI);
}

export function keyLightPower(rig: LightRigParams): number {
  return rig.key.power * rig.exposure;
}

export function kickLightPower(rig: LightRigParams): number {
  return keyLightPower(rig) * rig.kick.powerRatio;
}
