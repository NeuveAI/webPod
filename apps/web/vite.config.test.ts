import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { normalizeAppleServerEnv } from './vite.config.ts'

describe('Apple server environment normalization', () => {
  const workspaceRoot = '/workspace/webpod'

  test('resolves a relative MusicKit key path from the workspace root', () => {
    const result = normalizeAppleServerEnv(
      workspaceRoot,
      { APPLE_MUSICKIT_KEY_PATH: ' cert/AuthKey_TEST.p8 ' },
      {},
    )

    expect(result.APPLE_MUSICKIT_KEY_PATH).toBe(resolve(workspaceRoot, 'cert/AuthKey_TEST.p8'))
  })

  test('preserves an absolute MusicKit key path after trimming', () => {
    const result = normalizeAppleServerEnv(
      workspaceRoot,
      { APPLE_MUSICKIT_KEY_PATH: ' /runtime/AuthKey_TEST.p8 ' },
      {},
    )

    expect(result.APPLE_MUSICKIT_KEY_PATH).toBe('/runtime/AuthKey_TEST.p8')
  })

  test('leaves an empty MusicKit key path empty for server validation', () => {
    const result = normalizeAppleServerEnv(
      workspaceRoot,
      { APPLE_MUSICKIT_KEY_PATH: '   ' },
      {},
    )

    expect(result.APPLE_MUSICKIT_KEY_PATH).toBe('')
  })

  test('gives the runtime environment precedence over file values', () => {
    const result = normalizeAppleServerEnv(
      workspaceRoot,
      {
        APPLE_TEAM_ID: 'FILETEAM01',
        APPLE_MUSICKIT_KEY_PATH: 'cert/file.p8',
      },
      {
        APPLE_TEAM_ID: 'RUNTIME001',
        APPLE_MUSICKIT_KEY_PATH: '/runtime/key.p8',
      },
    )

    expect(result.APPLE_TEAM_ID).toBe('RUNTIME001')
    expect(result.APPLE_MUSICKIT_KEY_PATH).toBe('/runtime/key.p8')
  })
})
