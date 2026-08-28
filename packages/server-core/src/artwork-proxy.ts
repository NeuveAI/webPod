import {
  ARTWORK_PROXY_PATH,
  ARTWORK_PROXY_PX_PARAM,
  ARTWORK_PROXY_SRC_PARAM,
  TEMPLATE_ARTWORK_CEILING_PX,
} from '@webpod/providers'
import { Context, Effect, Layer } from 'effect'

export const ARTWORK_MAX_BYTES = 8 * 1024 * 1024
export const ARTWORK_FETCH_TIMEOUT_MS = 5_000
export const ARTWORK_CACHE_CONTROL = 'public, max-age=86400, stale-while-revalidate=604800'

const REMOTE_IMAGE_TYPES = new Set(['image/avif', 'image/jpeg', 'image/png', 'image/webp'])
const FIXTURE_SOURCE = /^\/artwork-source\/([a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?)\/(\d{1,4})x(\d{1,4})\.png$/
const APPLE_ARTWORK_HOST = /^is\d+-ssl\.mzstatic\.com$/

export type ArtworkProxyErrorCode =
  | 'invalid_request'
  | 'source_not_allowed'
  | 'upstream_failure'
  | 'upstream_response'
  | 'upstream_content_type'
  | 'artwork_too_large'
  | 'upstream_timeout'

export class ArtworkProxyError extends Error {
  readonly _tag = 'ArtworkProxyError'

  constructor(
    readonly code: ArtworkProxyErrorCode,
    readonly status: number,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'ArtworkProxyError'
  }
}

export interface ArtworkTransportShape {
  readonly fetch: typeof globalThis.fetch
}

export class ArtworkTransport extends Context.Service<ArtworkTransport, ArtworkTransportShape>()(
  '@webpod/server-core/ArtworkTransport',
) {}

export const ArtworkTransportLive = Layer.succeed(ArtworkTransport, { fetch: globalThis.fetch })

export interface ArtworkProxyOptions {
  readonly maxBytes?: number
  readonly timeoutMs?: number
}

interface ParsedArtworkRequest {
  readonly px: number
  readonly source: FixtureArtworkSource | RemoteArtworkSource
}

interface FixtureArtworkSource {
  readonly _tag: 'FixtureArtworkSource'
  readonly slug: string
}

interface RemoteArtworkSource {
  readonly _tag: 'RemoteArtworkSource'
  readonly url: URL
}

interface ArtworkPayload {
  readonly body: Uint8Array
  readonly contentType: string
}

function invalidRequest(message: string): ArtworkProxyError {
  return new ArtworkProxyError('invalid_request', 400, message)
}

function parsePixelSize(raw: string | null): number {
  if (raw === null || !/^[1-9]\d{0,3}$/.test(raw)) {
    throw invalidRequest(`query parameter ${ARTWORK_PROXY_PX_PARAM} must be a positive integer`)
  }
  const px = Number(raw)
  if (px > TEMPLATE_ARTWORK_CEILING_PX) {
    throw invalidRequest(
      `query parameter ${ARTWORK_PROXY_PX_PARAM} must not exceed ${String(TEMPLATE_ARTWORK_CEILING_PX)}`,
    )
  }
  return px
}

function parseRemoteSource(raw: string): RemoteArtworkSource {
  let source: URL
  try {
    source = new URL(raw)
  } catch (cause) {
    throw new ArtworkProxyError('source_not_allowed', 403, 'artwork source host or path is invalid', { cause })
  }

  const hasCleanAuthority =
    source.protocol === 'https:' &&
    source.port === '' &&
    source.username === '' &&
    source.password === '' &&
    source.hash === ''
  const isApple = APPLE_ARTWORK_HOST.test(source.hostname) && source.pathname.startsWith('/image/thumb/')
  const isSpotify = source.hostname === 'i.scdn.co' && source.pathname.startsWith('/image/')

  if (!hasCleanAuthority || (!isApple && !isSpotify)) {
    throw new ArtworkProxyError('source_not_allowed', 403, 'artwork source host or path is invalid')
  }

  return { _tag: 'RemoteArtworkSource', url: source }
}

function parseSource(raw: string | null, px: number): FixtureArtworkSource | RemoteArtworkSource {
  if (raw === null || raw.length === 0 || raw.length > 4_096) {
    throw invalidRequest(`query parameter ${ARTWORK_PROXY_SRC_PARAM} is required`)
  }

  if (raw.startsWith('/')) {
    const fixture = FIXTURE_SOURCE.exec(raw)
    if (fixture === null) {
      throw new ArtworkProxyError('source_not_allowed', 403, 'artwork source host or path is invalid')
    }
    const width = Number(fixture[2])
    const height = Number(fixture[3])
    if (width !== px || height !== px) {
      throw invalidRequest('fixture artwork dimensions must match the requested pixel size')
    }
    const slug = fixture[1]
    if (slug === undefined) throw invalidRequest('fixture artwork slug is missing')
    return { _tag: 'FixtureArtworkSource', slug }
  }

  return parseRemoteSource(raw)
}

export function parseArtworkRequest(request: Request): ParsedArtworkRequest {
  if (request.method !== 'GET') throw invalidRequest('artwork proxy accepts GET only')

  const url = new URL(request.url)
  const allowedParams = new Set([ARTWORK_PROXY_SRC_PARAM, ARTWORK_PROXY_PX_PARAM])
  for (const key of url.searchParams.keys()) {
    if (!allowedParams.has(key)) throw invalidRequest(`unexpected query parameter ${key}`)
  }
  if (url.searchParams.getAll(ARTWORK_PROXY_SRC_PARAM).length !== 1) {
    throw invalidRequest(`query parameter ${ARTWORK_PROXY_SRC_PARAM} must occur exactly once`)
  }
  if (url.searchParams.getAll(ARTWORK_PROXY_PX_PARAM).length !== 1) {
    throw invalidRequest(`query parameter ${ARTWORK_PROXY_PX_PARAM} must occur exactly once`)
  }

  const px = parsePixelSize(url.searchParams.get(ARTWORK_PROXY_PX_PARAM))
  return { px, source: parseSource(url.searchParams.get(ARTWORK_PROXY_SRC_PARAM), px) }
}

function fixturePalette(slug: string): readonly [string, string, string] {
  let hash = 0x811c9dc5
  for (const codePoint of slug) {
    hash ^= codePoint.codePointAt(0) ?? 0
    hash = Math.imul(hash, 0x01000193)
  }
  const hue = Math.abs(hash) % 360
  return [`hsl(${String(hue)} 54% 32%)`, `hsl(${String((hue + 47) % 360)} 68% 55%)`, '#f4ead8']
}

function fixtureArtwork(slug: string, px: number): ArtworkPayload {
  const [dark, bright, ink] = fixturePalette(slug)
  const title = slug
    .split('-')
    .slice(0, 3)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${String(px)}" height="${String(px)}" viewBox="0 0 100 100"><rect width="100" height="100" fill="${dark}"/><circle cx="72" cy="25" r="38" fill="${bright}" opacity=".78"/><path d="M-8 83L46 29l62 62v17H-8z" fill="${ink}" opacity=".24"/><text x="8" y="91" fill="${ink}" font-family="system-ui,sans-serif" font-size="17" font-weight="700" letter-spacing="1">${title}</text></svg>`
  return { body: new TextEncoder().encode(svg), contentType: 'image/svg+xml' }
}

function contentTypeOf(response: Response): string {
  return response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() ?? ''
}

function declaredLengthOf(response: Response): number | null {
  const raw = response.headers.get('content-length')
  if (raw === null) return null
  if (!/^\d+$/.test(raw)) {
    throw new ArtworkProxyError('upstream_response', 502, 'artwork server returned an invalid response')
  }
  return Number(raw)
}

async function readBoundedBody(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declaredLength = declaredLengthOf(response)
  if (declaredLength !== null && declaredLength > maxBytes) {
    await response.body?.cancel('artwork body exceeds limit')
    throw new ArtworkProxyError('artwork_too_large', 413, 'artwork exceeds the response size limit')
  }
  if (response.body === null) {
    throw new ArtworkProxyError('upstream_response', 502, 'artwork server returned an empty response')
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      total += next.value.byteLength
      if (total > maxBytes) {
        await reader.cancel('artwork body exceeds limit')
        throw new ArtworkProxyError('artwork_too_large', 413, 'artwork exceeds the response size limit')
      }
      chunks.push(next.value)
    }
  } finally {
    reader.releaseLock()
  }

  const body = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return body
}

async function fetchRemoteArtwork(
  request: Request,
  source: RemoteArtworkSource,
  fetchImpl: typeof globalThis.fetch,
  maxBytes: number,
  timeoutMs: number,
): Promise<ArtworkPayload> {
  const controller = new AbortController()
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const abortForClient = () => controller.abort()
  request.signal.addEventListener('abort', abortForClient, { once: true })
  if (request.signal.aborted) controller.abort()

  try {
    const response = await fetchImpl(source.url, {
      headers: { accept: 'image/avif,image/webp,image/png,image/jpeg' },
      redirect: 'manual',
      signal: controller.signal,
    })
    if (response.status !== 200) {
      await response.body?.cancel('artwork response rejected')
      throw new ArtworkProxyError('upstream_response', 502, 'artwork server returned an invalid response')
    }
    const contentType = contentTypeOf(response)
    if (!REMOTE_IMAGE_TYPES.has(contentType)) {
      await response.body?.cancel('artwork content type rejected')
      throw new ArtworkProxyError('upstream_content_type', 502, 'artwork server returned a non-image response')
    }
    return { body: await readBoundedBody(response, maxBytes), contentType }
  } catch (cause) {
    if (cause instanceof ArtworkProxyError) throw cause
    if (timedOut) {
      throw new ArtworkProxyError('upstream_timeout', 504, 'artwork server timed out', { cause })
    }
    throw new ArtworkProxyError('upstream_failure', 502, 'artwork server could not be reached', { cause })
  } finally {
    clearTimeout(timeout)
    request.signal.removeEventListener('abort', abortForClient)
  }
}

function artworkResponse(payload: ArtworkPayload): Response {
  const body = Uint8Array.from(payload.body).buffer
  return new Response(body, {
    status: 200,
    headers: {
      'cache-control': ARTWORK_CACHE_CONTROL,
      'content-security-policy': "default-src 'none'; sandbox",
      'content-length': String(payload.body.byteLength),
      'content-type': payload.contentType,
      'cross-origin-resource-policy': 'same-origin',
      'x-content-type-options': 'nosniff',
    },
  })
}

function errorResponse(error: ArtworkProxyError): Response {
  return Response.json(
    { error: { code: error.code, message: error.message } },
    {
      status: error.status,
      headers: {
        'cache-control': 'no-store',
        'cross-origin-resource-policy': 'same-origin',
        'x-content-type-options': 'nosniff',
      },
    },
  )
}

export function artworkProxyEffect(
  request: Request,
  options: ArtworkProxyOptions = {},
): Effect.Effect<Response, ArtworkProxyError, ArtworkTransport> {
  return Effect.gen(function* () {
    const transport = yield* ArtworkTransport
    const parsed = yield* Effect.try({
      try: () => parseArtworkRequest(request),
      catch: (cause) =>
        cause instanceof ArtworkProxyError
          ? cause
          : new ArtworkProxyError('invalid_request', 400, 'artwork request is malformed', { cause }),
    })
    if (parsed.source._tag === 'FixtureArtworkSource') {
      return artworkResponse(fixtureArtwork(parsed.source.slug, parsed.px))
    }
    const remoteSource: RemoteArtworkSource = {
      _tag: 'RemoteArtworkSource',
      url: parsed.source.url,
    }
    const payload = yield* Effect.tryPromise({
      try: () =>
        fetchRemoteArtwork(
          request,
          remoteSource,
          transport.fetch,
          options.maxBytes ?? ARTWORK_MAX_BYTES,
          options.timeoutMs ?? ARTWORK_FETCH_TIMEOUT_MS,
        ),
      catch: (cause) =>
        cause instanceof ArtworkProxyError
          ? cause
          : new ArtworkProxyError('upstream_failure', 502, 'artwork server could not be reached', { cause }),
    })
    return artworkResponse(payload)
  })
}

export function handleArtworkRequest(
  request: Request,
  options: ArtworkProxyOptions & { readonly fetch?: typeof globalThis.fetch } = {},
): Promise<Response> {
  return Effect.runPromise(
    artworkProxyEffect(request, options).pipe(
      Effect.provideService(ArtworkTransport, { fetch: options.fetch ?? globalThis.fetch }),
      Effect.match({ onFailure: errorResponse, onSuccess: (response) => response }),
    ),
  )
}

export { ARTWORK_PROXY_PATH }
