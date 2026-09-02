import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = (path: string): string =>
  readFileSync(resolve(import.meta.dirname, '..', 'src', path), 'utf8')

test('spike owns the product view and the legacy probe can only redirect to it', () => {
  const shared = source('production-device-view.tsx')
  const probe = source('routes/[_]probe.composite.tsx')
  const spike = source('routes/[_]spike.device.tsx')

  expect(spike).toContain('<ProductionDeviceView')
  expect(probe).toContain("to: '/_spike/device'")
  expect(probe).toContain('search: {}')
  expect(probe).toContain('replace: true')
  expect(probe).not.toContain("from '@webpod/composite'")
  expect(probe).not.toContain("from '@webpod/panel'")
  expect(probe).not.toContain('ProductionDeviceView')
  expect(probe).not.toContain('ProductionPanelView')
  expect(probe).not.toContain('dynamicTypeScale')
  expect(probe).not.toContain('validateSearch')
  expect(probe).not.toContain('useSearch')
  expect(spike).not.toContain('from "@webpod/composite"')
  expect(spike).not.toContain('from "@webpod/panel"')

  expect(shared.match(/<Panel\b/g)).toHaveLength(1)
  expect(shared).toContain("state = 'ready'")
  expect(shared).toContain('dynamicTypeScale = 1')
  expect(shared).toContain('density={null}')
  expect(shared).toContain('actor="human"')
  expect(shared).toContain('longList={false}')
})
