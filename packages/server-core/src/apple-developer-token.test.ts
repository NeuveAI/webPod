import { describe, expect, test } from 'bun:test'
import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { APPLE_DEFAULT_TOKEN_TTL_SECONDS, APPLE_DEVELOPER_TOKEN_PATH, appleTokenConfigFromEnv, handleAppleDeveloperTokenRequest, mintAppleDeveloperToken, type AppleTokenSigner } from './apple-developer-token.ts'

const config = { teamId: 'TEAMID1234', keyId: 'KEYID12345', keyPath: '/private/runtime/AuthKey_KEYID12345.p8', ttlSeconds: 300 }
const signer: AppleTokenSigner = { async sign() { return new Uint8Array(64).fill(7) } }
const decode = (part: string): Record<string, unknown> => JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>
const execFileAsync = promisify(execFile)

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
    expect(appleTokenConfigFromEnv({ APPLE_TEAM_ID: 'TEAMID1234', APPLE_MUSICKIT_KEY_ID: 'KEYID12345', APPLE_MUSICKIT_KEY_PATH: '/runtime/key.p8' }).ttlSeconds).toBe(APPLE_DEFAULT_TOKEN_TTL_SECONDS)
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

  test('real Web Crypto signer reads a generated PKCS#8 key under Node', async () => {
    const temporaryDirectory = await mkdtemp(join(tmpdir(), 'webpod-apple-signer-'))
    const keyPath = join(temporaryDirectory, 'AuthKey_SYNTHETIC.p8')
    try {
      const keyPair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify'],
      )
      const pkcs8 = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey)
      const encoded = Buffer.from(pkcs8).toString('base64').match(/.{1,64}/g)?.join('\n') ?? ''
      const pemLabel = ['PRIVATE', 'KEY'].join(' ')
      const beginBoundary = ['-----BEGIN ', pemLabel, '-----'].join('')
      const endBoundary = ['-----END ', pemLabel, '-----'].join('')
      await writeFile(keyPath, `${beginBoundary}\n${encoded}\n${endBoundary}\n`, {
        encoding: 'utf8',
        mode: 0o600,
      })

      const moduleUrl = new URL('./apple-developer-token.ts', import.meta.url).href
      const probe = [
        "const { webCryptoAppleTokenSigner } = await import(process.argv[1])",
        "const signature = await webCryptoAppleTokenSigner.sign(new TextEncoder().encode('header.payload'), process.argv[2])",
        "if (signature.byteLength !== 64) throw new Error('unexpected signature length')",
        "process.stdout.write('ok')",
      ].join(';')
      const { stdout } = await execFileAsync(
        'node',
        ['--experimental-transform-types', '--input-type=module', '--eval', probe, moduleUrl, keyPath],
        { encoding: 'utf8' },
      )

      expect(stdout).toBe('ok')
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true })
    }
  })
})
