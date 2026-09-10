import type { Camera, Vector3 } from 'three'

const RETURN_PATH = { liftEnd: .15, settleStart: .85 } as const
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t) }
/** Lift toward the camera, cross above the packet, then descend onto the liner.
 * Both arguments are scratch world points. Screen-space travel preserves the
 * apparent size and never cuts diagonally through the packet's front plane. */
export function routeStickerReturn(point: Vector3, destination: Vector3, camera: Camera, clearanceDepth: number, progress: number): void {
  const t = Math.max(0, Math.min(1, progress))
  if (t === 0) return
  if (t === 1) { point.copy(destination); return }
  point.project(camera); destination.project(camera)
  const depth = Math.min(clearanceDepth, point.z, destination.z)
  const travel = smooth((t - RETURN_PATH.liftEnd) / (RETURN_PATH.settleStart - RETURN_PATH.liftEnd))
  const z = t < RETURN_PATH.liftEnd
    ? point.z + (depth - point.z) * smooth(t / RETURN_PATH.liftEnd)
    : depth + (destination.z - depth) * smooth((t - RETURN_PATH.settleStart) / (1 - RETURN_PATH.settleStart))
  point.lerp(destination, travel); point.z = z; point.unproject(camera)
}
