import { expect, test } from 'bun:test'
import { generateKeyPairSync, verify } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

test('production launcher provisions a synthetic secret and serves a signed origin-bound token', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const child = Bun.spawn(['bun', 'apps/web/scripts/start.ts'], {
    cwd: resolve(import.meta.dirname, '../../..'),
    env: {
      PATH: process.env['PATH'], TMPDIR: tmpdir(), NODE_ENV: 'production', VERCEL: '1', PORT: '0', HOST: '127.0.0.1',
      APPLE_TEAM_ID: 'ABCDEFGHIJ', APPLE_MUSICKIT_KEY_ID: 'KLMNOPQRST',
      APPLE_MUSICKIT_KEY_PATH: join(tmpdir(), 'synthetic.p8'),
      APPLE_MUSICKIT_PRIVATE_KEY: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    },
    stdout: 'pipe', stderr: 'pipe',
  })
  const stderr = new Response(child.stderr).text()
  try {
    const reader = child.stdout.getReader()
    const { value } = await reader.read()
    const line = new TextDecoder().decode(value)
    const origin = /webPod listening on (http:\/\/127\.0\.0\.1:\d+)/.exec(line)?.[1]
    if (origin === undefined) throw new Error('Production server did not start')
    const publicOrigin = origin.replace('http:', 'https:')
    const response = await fetch(`${origin}/api/apple/developer-token`, { headers: { origin: publicOrigin } })
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store, private')
    const body: unknown = await response.json()
    if (typeof body !== 'object' || body === null || !('token' in body) || typeof body.token !== 'string') throw new Error('Missing developer token')
    const parts = body.token.split('.')
    // Assert booleans/claims only; never include tokens in assertion output.
    expect(verify('sha256', Buffer.from(`${parts[0]}.${parts[1]}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(parts[2] ?? '', 'base64url'))).toBe(true)
    const claims = JSON.parse(Buffer.from(parts[1] ?? '', 'base64url').toString()) as { origin: string[]; exp: number; iat: number }
    expect(claims.origin).toEqual([publicOrigin])
    const rejected = await fetch(`${origin}/api/apple/developer-token`, { headers: { origin: 'https://unrelated.example' } })
    expect(rejected.status).toBe(403)
    expect(claims.exp - claims.iat).toBe(3600)
  } finally {
    child.kill('SIGTERM')
    await child.exited
    expect(await stderr).toBe('')
  }
})
