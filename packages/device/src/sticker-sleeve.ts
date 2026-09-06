import { ExtrudeGeometry, Shape } from 'three';

/** Printed paper under a broad, matte protective coat; cut edges remain raw. */
export const SLEEVE_LAMINATE = Object.freeze({ metalness: 0, roughness: .68, clearcoat: 1, clearcoatRoughness: .28, envMapIntensity: .8 });

/** Material groups: 0 printed exterior, 1 raw cut/bevel, 2 raw interior.
 * ExtrudeGeometry shares both caps in group 0. Split that cap by its authored
 * normal without moving vertices, changing UVs, or adding a coincident overlay. */
export function createStickerSleeveGeometry(width: number, height: number, pixel: number): ExtrudeGeometry {
  const shape = new Shape(); const half = width / 2; const top = height / 2; const notch = width * .075;
  shape.moveTo(-half, -top); shape.lineTo(half, -top); shape.lineTo(half, top); shape.lineTo(notch, top);
  shape.quadraticCurveTo(notch * .6, top - notch, 0, top - notch);
  shape.quadraticCurveTo(-notch * .6, top - notch, -notch, top);
  shape.lineTo(-half, top); shape.closePath();
  const geometry = new ExtrudeGeometry(shape, { depth: pixel * .7, bevelEnabled: true, bevelThickness: pixel * .15, bevelSize: pixel * .18, bevelSegments: 3, curveSegments: 32, steps: 1 });
  const groups = [...geometry.groups];
  const normal = geometry.getAttribute('normal');
  geometry.clearGroups();
  for (const group of groups) {
    if (group.materialIndex !== 0) { geometry.addGroup(group.start, group.count, 1); continue; }
    for (let start = group.start; start < group.start + group.count; start += 3) {
      const material = normal.getZ(start) > 0 ? 0 : 2;
      const previous = geometry.groups.at(-1);
      if (previous?.materialIndex === material && previous.start + previous.count === start) previous.count += 3;
      else geometry.addGroup(start, 3, material);
    }
  }
  return geometry;
}
