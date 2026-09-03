import { describe, expect, test } from 'bun:test'
import { musicRuntime, resolveMusicRuntimeMode, selectMusicRuntime } from './music-runtime'

describe('music runtime selection', () => {
  test('fixture is the safe default and explicit query values win', () => {
    expect(resolveMusicRuntimeMode(null, undefined)).toBe('fixture')
    expect(resolveMusicRuntimeMode(null, 'apple')).toBe('apple')
    expect(resolveMusicRuntimeMode('fixture', 'apple')).toBe('fixture')
    expect(resolveMusicRuntimeMode('apple', undefined)).toBe('apple')
    expect(resolveMusicRuntimeMode('other', 'apple')).toBe('apple')
  })

  test('fixture selection publishes deterministic provider data', async () => {
    await selectMusicRuntime('fixture')
    const snapshot = musicRuntime.getSnapshot()
    expect(snapshot.activeMode).toBe('fixture')
    expect(snapshot.phase).toBe('fixture')
    expect(snapshot.provider.session?.status).toBe('authorized')
    expect(snapshot.source.songs.length).toBeGreaterThan(0)
  })
})
