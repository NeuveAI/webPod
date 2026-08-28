import {
  ARTWORK_PROXY_PATH,
  ARTWORK_PROXY_PX_PARAM,
  ARTWORK_PROXY_SRC_PARAM,
  TEMPLATE_ARTWORK_CEILING_PX,
} from '@webpod/providers'
import { Context, Effect, Layer } from 'effect'

export const ARTWORK_MAX_BYTES = 8 * 1024 * 1024
export const ARTWORK_FETCH_TIMEOUT_MS = 5_000
export const ARTWORK_MAX_CONCURRENT = 8
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
  | 'upstream_content_invalid'
  | 'artwork_too_large'
  | 'upstream_timeout'
  | 'request_not_same_origin'
  | 'artwork_busy'

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

/**
 * Test/deployment overrides that may only tighten the process security budget.
 * Every supplied value must be a positive safe integer at or below its matching
 * exported hard ceiling; invalid configuration is rejected before transport I/O.
 */
export interface ArtworkProxyOptions {
  readonly maxBytes?: number
  readonly timeoutMs?: number
  readonly maxConcurrent?: number
}

interface ValidatedArtworkProxyOptions {
  readonly maxBytes: number
  readonly timeoutMs: number
  readonly maxConcurrent: number
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
  readonly body: Uint8Array<ArrayBuffer>
  readonly contentType: string
}

interface ImageMetadata {
  readonly contentType: string
  readonly width: number
  readonly height: number
}

const inFlightArtwork = new Map<string, Promise<ArtworkPayload>>()
let activeRemoteArtwork = 0

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

/**
 * Parses the closed `/artwork` request contract without performing I/O.
 *
 * Only GET requests, one bounded pixel size, and either an exact fixture path
 * or an HTTPS Apple/Spotify artwork URL are accepted. Malformed or disallowed
 * input throws `ArtworkProxyError` before transport admission or buffering.
 */
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

function u16be(body: Uint8Array, offset: number): number {
  return (body[offset] ?? 0) * 0x100 + (body[offset + 1] ?? 0)
}

function u24le(body: Uint8Array, offset: number): number {
  return (body[offset] ?? 0) + (body[offset + 1] ?? 0) * 0x100 + (body[offset + 2] ?? 0) * 0x10000
}

function u32be(body: Uint8Array, offset: number): number {
  return ((body[offset] ?? 0) * 0x1000000 + (body[offset + 1] ?? 0) * 0x10000 + (body[offset + 2] ?? 0) * 0x100 + (body[offset + 3] ?? 0)) >>> 0
}

function u32le(body: Uint8Array, offset: number): number {
  return ((body[offset] ?? 0) + (body[offset + 1] ?? 0) * 0x100 + (body[offset + 2] ?? 0) * 0x10000 + (body[offset + 3] ?? 0) * 0x1000000) >>> 0
}

function ascii(body: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...body.subarray(offset, offset + length))
}

function crc32(body: Uint8Array, start: number, end: number): number {
  let crc = 0xffffffff
  for (let index = start; index < end; index += 1) {
    crc ^= body[index] ?? 0
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

function invalidImage(): ArtworkProxyError {
  return new ArtworkProxyError('upstream_content_invalid', 502, 'artwork server returned invalid image data')
}

function pngMetadata(body: Uint8Array): ImageMetadata | null {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10]
  if (body.length < 45 || !signature.every((byte, index) => body[index] === byte)) return null
  if (u32be(body, 8) !== 13 || ascii(body, 12, 4) !== 'IHDR') throw invalidImage()
  const width = u32be(body, 16)
  const height = u32be(body, 20)
  let offset = 8
  let sawEnd = false
  while (offset + 12 <= body.length) {
    const length = u32be(body, offset)
    const next = offset + 12 + length
    if (next > body.length) throw invalidImage()
    const type = ascii(body, offset + 4, 4)
    if (crc32(body, offset + 4, offset + 8 + length) !== u32be(body, offset + 8 + length)) throw invalidImage()
    offset = next
    if (type === 'IEND') {
      if (length !== 0 || offset !== body.length) throw invalidImage()
      sawEnd = true
      break
    }
  }
  if (!sawEnd || width === 0 || height === 0) throw invalidImage()
  return { contentType: 'image/png', width, height }
}

function jpegMetadata(body: Uint8Array): ImageMetadata | null {
  if (body.length < 6 || body[0] !== 0xff || body[1] !== 0xd8) return null
  if (body.at(-2) !== 0xff || body.at(-1) !== 0xd9) throw invalidImage()
  let offset = 2
  let dimensions: readonly [number, number] | null = null
  while (offset < body.length - 2) {
    if (body[offset] !== 0xff) throw invalidImage()
    while (body[offset] === 0xff) offset += 1
    const marker = body[offset]
    offset += 1
    if (marker === 0xda) break
    if (marker === undefined || marker === 0x00 || marker === 0xd8 || marker === 0xd9) throw invalidImage()
    const length = u16be(body, offset)
    if (length < 2 || offset + length > body.length - 2) throw invalidImage()
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      if (length < 7) throw invalidImage()
      dimensions = [u16be(body, offset + 5), u16be(body, offset + 3)]
    }
    offset += length
  }
  if (dimensions === null || dimensions[0] === 0 || dimensions[1] === 0) throw invalidImage()
  return { contentType: 'image/jpeg', width: dimensions[0], height: dimensions[1] }
}

function webpMetadata(body: Uint8Array): ImageMetadata | null {
  if (body.length < 30 || ascii(body, 0, 4) !== 'RIFF' || ascii(body, 8, 4) !== 'WEBP') return null
  if (u32le(body, 4) + 8 !== body.length) throw invalidImage()
  const kind = ascii(body, 12, 4)
  let width = 0
  let height = 0
  if (kind === 'VP8X') {
    width = u24le(body, 24) + 1
    height = u24le(body, 27) + 1
  } else if (kind === 'VP8L' && body[20] === 0x2f) {
    const bits = u32le(body, 21)
    width = (bits & 0x3fff) + 1
    height = ((bits >>> 14) & 0x3fff) + 1
  } else if (kind === 'VP8 ' && body[23] === 0x9d && body[24] === 0x01 && body[25] === 0x2a) {
    width = u16be(Uint8Array.of(body[27] ?? 0, body[26] ?? 0), 0) & 0x3fff
    height = u16be(Uint8Array.of(body[29] ?? 0, body[28] ?? 0), 0) & 0x3fff
  }
  if (width === 0 || height === 0) throw invalidImage()
  return { contentType: 'image/webp', width, height }
}

function avifMetadata(body: Uint8Array): ImageMetadata | null {
  if (body.length < 24 || ascii(body, 4, 4) !== 'ftyp') return null
  const ftypLength = u32be(body, 0)
  if (ftypLength < 16 || ftypLength > body.length) throw invalidImage()
  const brands = ascii(body, 8, ftypLength - 8)
  if (!brands.includes('avif') && !brands.includes('avis')) return null
  for (let offset = ftypLength; offset + 20 <= body.length; offset += 1) {
    if (ascii(body, offset + 4, 4) !== 'ispe' || u32be(body, offset) < 20) continue
    const width = u32be(body, offset + 12)
    const height = u32be(body, offset + 16)
    if (width === 0 || height === 0) throw invalidImage()
    return { contentType: 'image/avif', width, height }
  }
  throw invalidImage()
}

function validateImage(body: Uint8Array, declaredType: string, px: number): ImageMetadata {
  const metadata = pngMetadata(body) ?? jpegMetadata(body) ?? webpMetadata(body) ?? avifMetadata(body)
  if (metadata === null || metadata.contentType !== declaredType) throw invalidImage()
  if (metadata.width !== px || metadata.height !== px) {
    throw new ArtworkProxyError('upstream_content_invalid', 502, 'artwork dimensions do not match the requested size')
  }
  return metadata
}

function validatedOptions(options: ArtworkProxyOptions): ValidatedArtworkProxyOptions {
  const maxBytes = options.maxBytes ?? ARTWORK_MAX_BYTES
  const timeoutMs = options.timeoutMs ?? ARTWORK_FETCH_TIMEOUT_MS
  const maxConcurrent = options.maxConcurrent ?? ARTWORK_MAX_CONCURRENT
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > ARTWORK_MAX_BYTES) throw invalidRequest('artwork byte limit configuration is invalid')
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > ARTWORK_FETCH_TIMEOUT_MS) throw invalidRequest('artwork timeout configuration is invalid')
  if (!Number.isSafeInteger(maxConcurrent) || maxConcurrent < 1 || maxConcurrent > ARTWORK_MAX_CONCURRENT) throw invalidRequest('artwork concurrency configuration is invalid')
  return { maxBytes, timeoutMs, maxConcurrent }
}

function assertSameOriginBrowserRequest(request: Request): void {
  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite !== null && fetchSite !== 'same-origin') {
    throw new ArtworkProxyError('request_not_same_origin', 403, 'artwork request origin is invalid')
  }
}

async function readBoundedBody(response: Response, maxBytes: number): Promise<Uint8Array<ArrayBuffer>> {
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
  px: number,
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
    const body = await readBoundedBody(response, maxBytes)
    const metadata = validateImage(body, contentType, px)
    return { body, contentType: metadata.contentType }
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

async function admittedRemoteArtwork(
  request: Request,
  source: RemoteArtworkSource,
  fetchImpl: typeof globalThis.fetch,
  options: ValidatedArtworkProxyOptions,
  px: number,
): Promise<ArtworkPayload> {
  const key = `${source.url.href}\n${String(px)}\n${String(options.maxBytes)}\n${String(options.timeoutMs)}`
  const existing = inFlightArtwork.get(key)
  if (existing !== undefined) return existing
  if (activeRemoteArtwork >= options.maxConcurrent) {
    throw new ArtworkProxyError('artwork_busy', 503, 'artwork service is busy')
  }
  activeRemoteArtwork += 1
  const pending = fetchRemoteArtwork(request, source, fetchImpl, options.maxBytes, options.timeoutMs, px)
  inFlightArtwork.set(key, pending)
  try {
    return await pending
  } finally {
    if (inFlightArtwork.get(key) === pending) inFlightArtwork.delete(key)
    activeRemoteArtwork -= 1
  }
}

function artworkResponse(payload: ArtworkPayload): Response {
  return new Response(payload.body.buffer, {
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

/**
 * Builds the Effect program for one artwork response.
 *
 * Browser requests with non-same-origin Fetch Metadata are rejected before
 * transport access. Remote work is coalesced by source and admitted under a
 * process-wide hard concurrency ceiling; saturation returns `artwork_busy`.
 * The upstream is never redirected, is aborted on timeout/client cancellation,
 * and is buffered only up to the validated byte ceiling. Bytes must form a
 * supported image with dimensions equal to `px`; all failures are typed as
 * `ArtworkProxyError`. Options may only tighten, never weaken, hard ceilings.
 */
export function artworkProxyEffect(
  request: Request,
  options: ArtworkProxyOptions = {},
): Effect.Effect<Response, ArtworkProxyError, ArtworkTransport> {
  return Effect.gen(function* () {
    const transport = yield* ArtworkTransport
    const securityOptions = yield* Effect.try({
      try: () => {
        assertSameOriginBrowserRequest(request)
        return validatedOptions(options)
      },
      catch: (cause) =>
        cause instanceof ArtworkProxyError
          ? cause
          : new ArtworkProxyError('invalid_request', 400, 'artwork request is malformed', { cause }),
    })
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
        admittedRemoteArtwork(
          request,
          remoteSource,
          transport.fetch,
          securityOptions,
          parsed.px,
        ),
      catch: (cause) =>
        cause instanceof ArtworkProxyError
          ? cause
          : new ArtworkProxyError('upstream_failure', 502, 'artwork server could not be reached', { cause }),
    })
    return artworkResponse(payload)
  })
}

/**
 * Executes the artwork Effect and maps every typed failure to structured JSON.
 *
 * It shares the process-wide admission/coalescing budget used by all callers.
 * Client abort and timeout cleanup complete before the returned promise settles;
 * successful remote bodies are fully bounded and validated in memory. `fetch`
 * exists for deterministic server tests only, while numeric options can tighten
 * but cannot exceed the exported hard byte/time/concurrency ceilings.
 */
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
