import { expect, test } from 'bun:test'
import { PerspectiveCamera, Vector3 } from 'three'
import { routeStickerReturn } from './sticker-return-path'

test('return lifts before crossing an overlapping packet and descends only over the seat', () => {
  const camera = new PerspectiveCamera(40, 375 / 900, 1, 2000)
  camera.position.z = 600; camera.updateMatrixWorld()
  const source = new Vector3(-20, 80, 0), seat = new Vector3(30, -80, 130)
  const clearance = new Vector3(0, 0, 160).project(camera).z
  const start = source.clone().project(camera), end = seat.clone().project(camera)
  for (const t of [0, .05, .15, .3, .5, .75, .85, .95, 1]) {
    const point = source.clone()
    routeStickerReturn(point, seat.clone(), camera, clearance, t)
    if (t === 0) expect(point.distanceTo(source)).toBe(0)
    else if (t === 1) expect(point.distanceTo(seat)).toBe(0)
    else {
      point.project(camera)
      if (t <= .15) { expect(point.x).toBeCloseTo(start.x); expect(point.y).toBeCloseTo(start.y) }
      if (t >= .15 && t <= .85) expect(point.z).toBeLessThanOrEqual(clearance + 1e-10)
      if (t >= .85) { expect(point.x).toBeCloseTo(end.x); expect(point.y).toBeCloseTo(end.y) }
    }
  }
})
