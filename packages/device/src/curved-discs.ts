/**
 * The two curved surfaces on the wheel, built as geometry rather than painted.
 *
 * ⚑ **Why these are curved at all — a finding, not a stylistic choice.**
 *
 * §4.5's ring table runs `#14161A` at 0% (top) to `#2C3037` at 100% (bottom):
 * **dark at the top, light at the bottom**, and §4.5 attributes the dark top to
 * "shadow from the recess lip". That attribution cannot survive the move to 3D.
 * The broad key descends at 20° from the horizontal, so a lip standing `h` above the
 * ring casts a shadow reaching `h / tan(72°) ≈ 0.32·h` down the ring face.
 * §5.3 puts the ring **1.5px** below the body plane, which buys 0.5px of
 * shadow; the ramp §4.5 specifies is spread over ~88px. Making the lip deep
 * enough to cast it would need a pit roughly 270px deep in a device 59px thick.
 * The recess-lip story is a 2D construction and it does not transfer.
 *
 * What does transfer, and is also simply true of the object: **the ring is
 * dished.** A shallow concave bowl is what a thumb rides in, and on a bowl lit
 * from 12 o'clock the upper wall's normal tilts *away* from the key while the
 * lower wall's tilts *toward* it. At a rim tilt of ~10° the `N·L` ratio between
 * the bottom and top of the ring is ≈ 3.4 — against the 3.5 the §4.5 table
 * asks for. The specified appearance and the physical object agree; only §4.5's
 * *explanation* of it was 2D.
 *
 * ⚑ **One conflict this creates, stated rather than absorbed.** §5.3 L4 calls
 * the wheel face "very slightly **domed**" and puts a sheen at upper-left,
 * which is convex — the opposite curvature. §4.5's token table and §5.3 L4
 * cannot both be right. The token table wins, because it is the acceptance
 * criterion and L4's sheen is a 9%-white overlay. Recorded in
 * `decisions/w4.md` W4-D4.
 *
 * The centre Select button keeps §4.5's stated geometry — "the only *raised*
 * element on the wheel", highlight top and shadow bottom — so it is **convex**,
 * and the deliberate inversion against the dish around it is what makes it pop.
 */
import { BufferAttribute, BufferGeometry } from "three";

/**
 * An annulus displaced into a shallow spherical dish or dome.
 *
 * `edgeTiltDeg` is the surface tilt at `outerR`: **positive is concave** (a
 * bowl, whose normals lean inward, so the upper wall faces away from a light
 * at 12 o'clock) and negative is convex.
 *
 * The profile is `z(r) = sag·(r/outerR)^p`, whose slope at the rim is
 * `p·sag/outerR`, so `sag = outerR·tan(tilt)/p`. The caller states the thing
 * that matters optically — the rim tilt, which is what sets `N·L` — and the
 * depth follows from it. `p` exists because the rim tilt alone does not fix
 * the shape: at `p = 2` a 10° rim on a 115px wheel is a 10px-deep bowl, which
 * is about 1.9mm and far deeper than the real part, while a higher exponent
 * keeps the centre flat and turns up near the rim, reaching the same tilt in
 * a third of the depth. It is the profile, not just the rim, that the §4.5
 * stops sample.
 */
export function curvedAnnulusGeometry(
  innerR: number,
  outerR: number,
  edgeTiltDeg: number,
  exponent = 3,
  radialSegments = 128,
  ringSegments = 24,
): BufferGeometry {
  const tilt = (edgeTiltDeg * Math.PI) / 180;
  const sag = (outerR * Math.tan(tilt)) / exponent;

  const positions: Array<number> = [];
  const normals: Array<number> = [];
  const uvs: Array<number> = [];
  const indices: Array<number> = [];

  const zAt = (r: number) => sag * (r / outerR) ** exponent;
  const slopeAt = (r: number) =>
    (exponent * sag * r ** (exponent - 1)) / outerR ** exponent;

  for (let j = 0; j <= ringSegments; j++) {
    const r = innerR + ((outerR - innerR) * j) / ringSegments;
    const z = zAt(r);
    const slope = slopeAt(r);
    // Normal of a surface of revolution z = f(r): (−f'(r)·r̂ + ẑ), normalised.
    const nr = -slope;
    const nz = 1;
    const nl = Math.hypot(nr, nz);
    for (let i = 0; i <= radialSegments; i++) {
      const a = (i / radialSegments) * Math.PI * 2;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      positions.push(r * cos, r * sin, z);
      normals.push((nr * cos) / nl, (nr * sin) / nl, nz / nl);
      // Planar UVs over the disc's bounding square, so an anisotropy or
      // roughness map applied here has a stable horizontal tangent.
      uvs.push((r * cos) / (2 * outerR) + 0.5, (r * sin) / (2 * outerR) + 0.5);
    }
  }

  const stride = radialSegments + 1;
  for (let j = 0; j < ringSegments; j++) {
    for (let i = 0; i < radialSegments; i++) {
      const a = j * stride + i;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(positions), 3),
  );
  geometry.setAttribute(
    "normal",
    new BufferAttribute(new Float32Array(normals), 3),
  );
  geometry.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * A convex cap over a full disc — the Select button's face.
 *
 * Same profile as {@link curvedAnnulusGeometry} with `innerR = 0` and the sign
 * forced negative, so the caller cannot accidentally dish the one element
 * §4.5 defines as raised.
 */
export function domedDiscGeometry(
  radius: number,
  edgeTiltDeg: number,
  exponent = 3,
  radialSegments = 128,
  ringSegments = 18,
): BufferGeometry {
  return curvedAnnulusGeometry(
    0,
    radius,
    -Math.abs(edgeTiltDeg),
    exponent,
    radialSegments,
    ringSegments,
  );
}
