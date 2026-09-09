import { expect, test } from 'bun:test'
import { generateKeyPairSync } from 'node:crypto'
import { stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { provisionAppleRuntimeKey } from './apple-runtime-key.ts'
import { appleTokenConfigFromEnv, mintAppleDeveloperToken } from './apple-developer-token.ts'

test('runtime secret creates an isolated private key, signs, and cleans up', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const env: NodeJS.ProcessEnv = {
    APPLE_TEAM_ID: 'ABCDEFGHIJ', APPLE_MUSICKIT_KEY_ID: 'KLMNOPQRST',
    APPLE_MUSICKIT_KEY_PATH: join(tmpdir(), 'apple.p8'),
    APPLE_MUSICKIT_PRIVATE_KEY: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  }
  const cleanup = await provisionAppleRuntimeKey(env)
  const config = appleTokenConfigFromEnv(env)
  try {
    expect(env['APPLE_MUSICKIT_PRIVATE_KEY']).toBeUndefined()
    expect((await stat(config.keyPath)).mode & 0o777).toBe(0o600)
    expect((await stat(dirname(config.keyPath))).mode & 0o777).toBe(0o700)
    const minted = await mintAppleDeveloperToken({ config, origin: 'https://webpod.vercel.app' })
    const parts = minted.token.split('.')
    const { verify } = await import('node:crypto')
    expect(verify('sha256', Buffer.from(`${parts[0]}.${parts[1]}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(parts[2] ?? '', 'base64url'))).toBe(true)
  } finally { await cleanup() }
  expect(await Bun.file(config.keyPath).exists()).toBe(false)
})

test('file-only configuration is unchanged and bad runtime input stays redacted', async () => {
  const env = { APPLE_MUSICKIT_KEY_PATH: '/private/existing.p8' }
  await (await provisionAppleRuntimeKey(env))()
  expect(env.APPLE_MUSICKIT_KEY_PATH).toBe('/private/existing.p8')
  await expect(provisionAppleRuntimeKey({ APPLE_MUSICKIT_PRIVATE_KEY: 'synthetic-secret-not-a-key' })).rejects.toThrow('Apple Music runtime signing credentials are invalid')
  await expect(provisionAppleRuntimeKey({ APPLE_TEAM_ID: 'ABCDEFGHIJ', APPLE_MUSICKIT_KEY_ID: 'KLMNOPQRST', APPLE_MUSICKIT_KEY_PATH: '/app/public/apple.p8', APPLE_MUSICKIT_PRIVATE_KEY: 'synthetic-secret-not-a-key' })).rejects.toThrow('Apple Music runtime signing credentials are invalid')
})
