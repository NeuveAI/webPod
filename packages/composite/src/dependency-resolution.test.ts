import { describe, expect, test } from 'bun:test'

describe('package-owned dependency resolution', () => {
  test('resolves jotai/vanilla from the composite package boundary', () => {
    const packageRoot = new URL('..', import.meta.url).pathname
    const resolved = Bun.resolveSync('jotai/vanilla', packageRoot)
    expect(resolved).toContain('/jotai/')
    expect(resolved).toMatch(/\/vanilla\.(?:mjs|js)$/)
  })
})
