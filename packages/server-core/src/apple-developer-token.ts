import { basename, isAbsolute } from 'node:path'

export const APPLE_DEVELOPER_TOKEN_PATH = '/api/apple/developer-token' as const
export const APPLE_DEFAULT_TOKEN_TTL_SECONDS = 900
export const APPLE_MAX_LOCAL_TOKEN_TTL_SECONDS = 3_600

export type AppleTokenErrorCode =
  | 'invalid_request'
  | 'invalid_configuration'
  | 'key_unavailable'
  | 'signing_failed'

export class AppleTokenError extends Error {
  constructor(
    readonly code: AppleTokenErrorCode,
    readonly status: number,
    message: string,
    options?: { readonly cause?: unknown },
  ) {
    super(message, options)
    this.name = 'AppleTokenError'
  }
}

export interface AppleTokenConfig {
  readonly teamId: string
  readonly keyId: string
  readonly keyPath: string
  readonly ttlSeconds: number
}

export interface AppleDeveloperToken {
  readonly token: string
  readonly expiresAt: number
}

export interface AppleTokenSigner {
  sign(input: Uint8Array, keyPath: string): Promise<Uint8Array>
}

const TEN_CHARACTER_IDENTIFIER = /^[A-Z0-9]{10}$/

function configError(message: string): AppleTokenError {
  return new AppleTokenError('invalid_configuration', 503, message)
}

export function appleTokenConfigFromEnv(env: Readonly<Record<string, string | undefined>>): AppleTokenConfig {
  const teamId = env['APPLE_TEAM_ID']?.trim() ?? ''
  const keyPath = env['APPLE_MUSICKIT_KEY_PATH']?.trim() ?? ''
  const filenameKeyId = /^AuthKey_([A-Z0-9]{10})\.p8$/.exec(basename(keyPath))?.[1]
  const keyId = env['APPLE_MUSICKIT_KEY_ID']?.trim() || filenameKeyId || ''
  const rawTtl = env['APPLE_TOKEN_TTL_SECONDS']?.trim()
  const ttlSeconds = rawTtl === undefined || rawTtl === '' ? APPLE_DEFAULT_TOKEN_TTL_SECONDS : Number(rawTtl)

  if (!TEN_CHARACTER_IDENTIFIER.test(teamId)) throw configError('Apple Music Team ID is missing or invalid')
  if (!TEN_CHARACTER_IDENTIFIER.test(keyId)) throw configError('Apple Music key ID is missing or invalid')
  if (keyPath === '' || !isAbsolute(keyPath)) throw configError('Apple Music key path must be an absolute runtime path')
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 60 || ttlSeconds > APPLE_MAX_LOCAL_TOKEN_TTL_SECONDS) {
    throw configError(`Apple Music token TTL must be an integer from 60 to ${String(APPLE_MAX_LOCAL_TOKEN_TTL_SECONDS)} seconds`)
  }
  return { teamId, keyId, keyPath, ttlSeconds }
}

function base64url(value: Uint8Array | string): string {
  return Buffer.from(value).toString('base64url')
}

export async function mintAppleDeveloperToken(options: {
  readonly config: AppleTokenConfig
  readonly signer?: AppleTokenSigner
  readonly nowSeconds?: number
  readonly origin?: string
}): Promise<AppleDeveloperToken> {
  const issuedAt = Math.floor(options.nowSeconds ?? Date.now() / 1_000)
  const expiresAt = issuedAt + options.config.ttlSeconds
  const header = base64url(JSON.stringify({ alg: 'ES256', kid: options.config.keyId, typ: 'JWT' }))
  const claims = options.origin === undefined
    ? { iss: options.config.teamId, iat: issuedAt, exp: expiresAt }
    : { iss: options.config.teamId, iat: issuedAt, exp: expiresAt, origin: [options.origin] }
  const payload = base64url(JSON.stringify(claims))
  const signingInput = `${header}.${payload}`
  const signer = options.signer ?? webCryptoAppleTokenSigner
  try {
    const signature = await signer.sign(new TextEncoder().encode(signingInput), options.config.keyPath)
    if (signature.byteLength !== 64) throw new Error('ES256 signer did not return a 64-byte signature')
    return { token: `${signingInput}.${base64url(signature)}`, expiresAt }
  } catch (cause) {
    if (cause instanceof AppleTokenError) throw cause
    throw new AppleTokenError('signing_failed', 503, 'Apple Music developer token could not be signed', { cause })
  }
}

export const webCryptoAppleTokenSigner: AppleTokenSigner = {
  async sign(input, keyPath) {
    let der: Buffer | null = null
    try {
      const pem = await Bun.file(keyPath).text()
      const body = pem.replace(/-----BEGIN [^-]+-----/, '').replace(/-----END [^-]+-----/, '').replace(/\s+/g, '')
      if (body === '') throw new Error('empty PKCS#8 body')
      der = Buffer.from(body, 'base64')
      const keyBytes = new Uint8Array(new ArrayBuffer(der.byteLength))
      keyBytes.set(der)
      const inputBytes = new Uint8Array(new ArrayBuffer(input.byteLength))
      inputBytes.set(input)
      const key = await crypto.subtle.importKey('pkcs8', keyBytes, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
      return new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, inputBytes))
    } catch (cause) {
      throw new AppleTokenError('key_unavailable', 503, 'Apple Music signing key is unavailable', { cause })
    } finally {
      der?.fill(0)
    }
  },
}

function assertSameOrigin(request: Request): URL {
  const url = new URL(request.url)
  const fetchSite = request.headers.get('sec-fetch-site')
  const origin = request.headers.get('origin')
  if ((fetchSite !== null && fetchSite !== 'same-origin') || (origin !== null && origin !== url.origin)) {
    throw new AppleTokenError('invalid_request', 403, 'Apple Music token request origin is invalid')
  }
  return url
}

export async function handleAppleDeveloperTokenRequest(
  request: Request,
  options: { readonly env?: Readonly<Record<string, string | undefined>>; readonly signer?: AppleTokenSigner; readonly nowSeconds?: number } = {},
): Promise<Response> {
  try {
    if (request.method !== 'GET') throw new AppleTokenError('invalid_request', 405, 'Apple Music token endpoint accepts GET only')
    const url = assertSameOrigin(request)
    if (url.pathname !== APPLE_DEVELOPER_TOKEN_PATH || url.search !== '') {
      throw new AppleTokenError('invalid_request', 400, 'Apple Music token request is invalid')
    }
    const minted = await mintAppleDeveloperToken({
      config: appleTokenConfigFromEnv(options.env ?? process.env),
      signer: options.signer,
      nowSeconds: options.nowSeconds,
      origin: url.origin,
    })
    return Response.json(minted, { headers: { 'cache-control': 'no-store, private', pragma: 'no-cache' } })
  } catch (cause) {
    const error = cause instanceof AppleTokenError ? cause : new AppleTokenError('signing_failed', 503, 'Apple Music token service failed')
    return Response.json({ error: { code: error.code, message: error.message } }, {
      status: error.status,
      headers: { 'cache-control': 'no-store, private', pragma: 'no-cache' },
    })
  }
}
