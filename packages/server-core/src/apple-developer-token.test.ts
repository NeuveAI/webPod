import { describe, expect, test } from 'bun:test'
import { APPLE_DEVELOPER_TOKEN_PATH, appleTokenConfigFromEnv, handleAppleDeveloperTokenRequest, mintAppleDeveloperToken, type AppleTokenSigner } from './apple-developer-token.ts'

const config = { teamId: 'TEAMID1234', keyId: 'KEYID12345', keyPath: '/private/runtime/AuthKey_KEYID12345.p8', ttlSeconds: 300 }
const signer: AppleTokenSigner = { async sign() { return new Uint8Array(64).fill(7) } }
const decode = (part: string): Record<string, unknown> => JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>

describe('Apple developer token service', () => {
  test('mints short-lived ES256 claims with an origin restriction', async () => {
    const result = await mintAppleDeveloperToken({ config, signer, nowSeconds: 1_000, origin: 'http://localhost:3000' })
    const parts = result.token.split('.')
    expect(parts).toHaveLength(3)
    expect(decode(parts[0] ?? '')).toEqual({ alg: 'ES256', kid: 'KEYID12345', typ: 'JWT' })
    expect(decode(parts[1] ?? '')).toEqual({ iss: 'TEAMID1234', iat: 1_000, exp: 1_300, origin: ['http://localhost:3000'] })
    expect(result.expiresAt).toBe(1_300)
  })

  test('requires an absolute runtime key path and bounded expiry', () => {
    expect(() => appleTokenConfigFromEnv({ APPLE_TEAM_ID: 'TEAMID1234', APPLE_MUSICKIT_KEY_ID: 'KEYID12345', APPLE_MUSICKIT_KEY_PATH: 'cert/key.p8' })).toThrow('absolute runtime path')
    expect(() => appleTokenConfigFromEnv({ APPLE_TEAM_ID: 'TEAMID1234', APPLE_MUSICKIT_KEY_ID: 'KEYID12345', APPLE_MUSICKIT_KEY_PATH: '/runtime/key.p8', APPLE_TOKEN_TTL_SECONDS: '3601' })).toThrow('from 60 to 3600')
  })

  test('endpoint is same-origin, GET-only, no-store, and exposes no configuration fields', async () => {
    const request = new Request(`http://localhost:4173${APPLE_DEVELOPER_TOKEN_PATH}`, { headers: { origin: 'http://localhost:4173', 'sec-fetch-site': 'same-origin' } })
    const response = await handleAppleDeveloperTokenRequest(request, { env: { APPLE_TEAM_ID: config.teamId, APPLE_MUSICKIT_KEY_ID: config.keyId, APPLE_MUSICKIT_KEY_PATH: config.keyPath, APPLE_TOKEN_TTL_SECONDS: '300' }, signer, nowSeconds: 1_000 })
    expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toContain('no-store')
    const body = await response.text(); expect(body).not.toContain(config.keyPath); expect(body).not.toContain(config.teamId); expect(body).not.toContain(config.keyId)
    expect(Object.keys(JSON.parse(body) as object).sort()).toEqual(['expiresAt', 'token'])
  })

  test('error responses never expose causes or secret configuration', async () => {
    const response = await handleAppleDeveloperTokenRequest(new Request(`http://localhost:4173${APPLE_DEVELOPER_TOKEN_PATH}`), { env: {} })
    const body = await response.text(); expect(response.status).toBe(503); expect(body).not.toContain('undefined'); expect(body).not.toContain('cause')
  })
})
