import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = (path: string): string =>
  readFileSync(resolve(import.meta.dirname, path), 'utf8')

test('orientation release is bounded while the canonical canvas stays demand-rendered', () => {
  const controls = source('device-preview-orientation.ts')
  const motion = source('device-orientation-motion.ts')
  const canvas = source('../../../packages/device/src/DeviceCanvas.tsx')
  const route = source('routes/[_]spike.device.tsx')

  expect(canvas).toContain('frameloop="demand"')
  expect(controls).toContain('requestAnimationFrame')
  expect(controls).toContain('cancelAnimationFrame')
  expect(controls).toContain('advanceDeviceOrientationRelease')
  expect(motion).toContain('Math.exp(-ORIENTATION_COAST_DECAY_PER_SECOND')
  expect(controls).not.toContain('useFrame')
  expect(controls).not.toContain('setInterval')
  expect(controls).not.toContain('useState')
  expect(route).not.toContain('useState')
})

test('canonical spike has no broad stage drag or pose-preset controls', () => {
  const route = source('routes/[_]spike.device.tsx')

  expect(route).not.toContain('stage.addEventListener("pointerdown"')
  expect(route).not.toContain('Shift-drag')
  expect(route).not.toContain('>Front</button>')
  expect(route).not.toContain('>Quarter</button>')
  expect(route).not.toContain('>Edge</button>')
  expect(route).not.toContain('>Rear</button>')
  expect(route).toContain('onOrientationGrabStart={onOrientationGrabStart}')
  expect(route).toContain('Reset view')
})

test('shell handlers are attached to the physical enclosure, never the stage', () => {
  const device = source('../../../packages/device/src/Device.tsx')

  expect(device).toContain('name="device-steel-back"')
  expect(device).toContain('name="device-body"')
  expect(device.match(/onPointerDown=/g)).toHaveLength(2)
  expect(device).toContain('isFirstVisibleDeviceShellHit')
  expect(device).toContain('isDeviceOuterGrabPoint')
})
