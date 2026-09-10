import { Matrix4, Ray, Vector3, type Intersection, type Mesh, type Raycaster } from 'three';
import { DEVICE_LAYOUT } from './layout';
import type { DeviceEnvelope } from './device-envelope';
import { DEVICE_ORIENTATION_GRAB_BAND } from './orientation-grab';

/**
 * Conservative admission broad phase for orientation-only event meshes. A ray
 * crossing the entire enclosure depth strictly inside the eroded rectangle
 * cannot touch its grab perimeter. All uncertain/oblique contacts retain the
 * rendered shell's exact triangle raycast, including holes and material sides.
 * Never install this on the rendered shell: stickers/probes need its face hits.
 */
export function createOrientationRaycast(
  readShell: () => Mesh | null,
  touch: () => boolean,
  envelope: DeviceEnvelope,
): Mesh['raycast'] {
  const inverse = new Matrix4(), localRay = new Ray(), entry = new Vector3(), exit = new Vector3();
  const exact: Intersection[] = [];
  return function (this: Mesh, raycaster: Raycaster, hits: Intersection[]): void {
    const shell = readShell();
    if (shell === null) return;
    inverse.copy(this.matrixWorld).invert();
    localRay.copy(raycaster.ray).applyMatrix4(inverse);
    const band = touch() ? DEVICE_LAYOUT.body.width / 4 : DEVICE_ORIENTATION_GRAB_BAND;
    // A square inset by at least the corner radius lies within the rounded
    // silhouette. The touch maximum matches Device's foreshortening cap.
    const inset = Math.max(band, DEVICE_LAYOUT.body.cornerR);
    const halfX = DEVICE_LAYOUT.body.width / 2 - inset;
    const halfY = DEVICE_LAYOUT.body.height / 2 - inset;
    if (Math.abs(localRay.direction.z) > 1e-10) {
      localRay.at((envelope.min[2] - localRay.origin.z) / localRay.direction.z, entry);
      localRay.at((envelope.max[2] - localRay.origin.z) / localRay.direction.z, exit);
      if (Math.abs(entry.x) < halfX && Math.abs(exit.x) < halfX &&
          Math.abs(entry.y) < halfY && Math.abs(exit.y) < halfY) return;
    }
    // The sibling event mesh and rendered shell have the same authored frame.
    // Use that current frame even when Fiber dispatches between rendered frames.
    shell.matrixWorld.copy(this.matrixWorld);
    exact.length = 0;
    shell.raycast(raycaster, exact);
    for (const hit of exact) hits.push({ ...hit, object: this });
    exact.length = 0;
  };
}
