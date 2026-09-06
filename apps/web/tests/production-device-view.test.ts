import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = (path: string): string =>
  readFileSync(resolve(import.meta.dirname, '..', 'src', path), 'utf8')

test('root owns the shared product page and diagnostics remain development-only', () => {
  const shared = source('production-device-view.tsx')
  const root = source('routes/index.tsx')
  const probe = source('routes/[_]probe.composite.tsx')
  const spike = source('routes/[_]spike.device.tsx')

  const page = source('device-page.tsx')
  expect(page).toContain('<ProductionDeviceView')
  expect(spike).toContain('import.meta.env.DEV ? <DevicePage />')
  expect(probe).toContain("to: '/_spike/device'")
  expect(root).toContain('component: DevicePage')
  expect(root).not.toContain('redirect')
  expect(page).toContain('const capture = import.meta.env.DEV')
  expect(root).not.toContain("from '@webpod/panel'")
  expect(root).not.toMatch(/fixture|demo/i)
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
