import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = (path: string): string =>
  readFileSync(resolve(import.meta.dirname, '..', 'src', path), 'utf8')

test('probe and spike delegate production panel ownership to one shared view', () => {
  const shared = source('production-device-view.tsx')
  const probe = source('routes/[_]probe.composite.tsx')
  const spike = source('routes/[_]spike.device.tsx')

  expect(probe).toContain('<ProductionDeviceView')
  expect(spike).toContain('<ProductionDeviceView')
  expect(probe).not.toContain("from '@webpod/composite'")
  expect(probe).not.toContain("from '@webpod/panel'")
  expect(spike).not.toContain('from "@webpod/composite"')
  expect(spike).not.toContain('from "@webpod/panel"')

  expect(shared.match(/<Panel\b/g)).toHaveLength(1)
  expect(shared).toContain("state = 'ready'")
  expect(shared).toContain('dynamicTypeScale = 1')
  expect(shared).toContain('density={null}')
  expect(shared).toContain('actor="human"')
  expect(shared).toContain('longList={false}')
})
