import { isStickerPlacement, MAX_STICKER_PLACEMENTS, type ListeningObservation, type StickerInventory } from '@webpod/stickers'
import { StickerError, type StickerRepository } from './repository.ts'

export const STICKER_BODY_MAX_BYTES = 32_768
function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function invalid(): never { throw new StickerError('invalid_request', 400, 'This sticker request is invalid.') }
export function assertStickerSameOrigin(request: Request) {
  const origin = request.headers.get('origin'); const site = request.headers.get('sec-fetch-site')
  if (origin !== new URL(request.url).origin || (site !== null && site !== 'same-origin')) throw new StickerError('invalid_origin', 403, 'Open your collection from webPod.')
}
/** Read bounded request bytes before parsing; Content-Length alone is not trusted. */
export async function readStickerBody(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json') invalid()
  if (request.body === null) invalid()
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0
  try {
    while (true) { const next = await reader.read(); if (next.done) break; size += next.value.byteLength; if (size > STICKER_BODY_MAX_BYTES) throw new StickerError('body_too_large', 413, 'This sticker request is too large.'); chunks.push(next.value) }
  } finally { await reader.cancel().catch(() => undefined) }
  const bytes = new Uint8Array(size); let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  let value: unknown
  try { value = JSON.parse(new TextDecoder().decode(bytes)) as unknown } catch { invalid() }
  if (!record(value)) invalid()
  return value
}
export function parseListeningObservation(body: Record<string, unknown>): ListeningObservation {
  const { eventId, streamId, sequence, catalogId, positionMs, playing } = body
  if (typeof eventId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(eventId) || typeof streamId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(streamId)
    || typeof sequence !== 'number' || !Number.isSafeInteger(sequence) || sequence < 0 || sequence > 10_000_000
    || typeof catalogId !== 'string' || !/^\d{1,24}$/.test(catalogId)
    || typeof positionMs !== 'number' || !Number.isSafeInteger(positionMs) || positionMs < 0 || positionMs > 86_400_000 || typeof playing !== 'boolean') invalid()
  return { eventId, streamId, sequence, catalogId, positionMs, playing }
}
export interface StickerHttpServices {
  readonly prepare: (request: Request) => Promise<readonly string[]>
  readonly authorized: <A>(request: Request, operation: (repository: StickerRepository, owner: string) => A) => Promise<A>
  readonly resolveOwner: (request: Request) => Promise<string>
  readonly run: <A>(operation: (repository: StickerRepository) => A) => Promise<A>
  readonly bootstrap: (request: Request, musicUserToken: string) => Promise<{ readonly inventory: StickerInventory; readonly cookies: readonly string[] }>
  readonly enrich: (owner: string, catalogId: string, request?: Request) => Promise<void>
  readonly logout: (request: Request) => Promise<readonly string[]>
}

function reply(body: unknown, status = 200, cookies: readonly string[] = []) {
  const headers = new Headers({ 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' })
  for (const cookie of cookies) headers.append('set-cookie', cookie)
  return new Response(JSON.stringify(body), { status, headers })
}

/** Thin Start transport. Authentication is injected; domain logic cannot accept a browser-supplied owner. */
export async function handleStickerRequest(request: Request, services: StickerHttpServices): Promise<Response> {
  try {
    const path = new URL(request.url).pathname
    if (request.method !== 'GET') assertStickerSameOrigin(request)
    if (path === '/api/stickers/device' && request.method === 'POST') return reply({ ready: true }, 200, await services.prepare(request))
    if (path === '/api/stickers/session' && request.method === 'POST') {
      const body = await readStickerBody(request); const token = body['musicUserToken']
      if (typeof token !== 'string' || token.length < 1 || token.length > 16_384 || /[\r\n]/.test(token)) invalid()
      const result = await services.bootstrap(request, token)
      return reply(result.inventory, 200, result.cookies)
    }
    if (path === '/api/stickers/session' && request.method === 'DELETE') return reply({ signedOut: true }, 200, await services.logout(request))
    const owner = await services.resolveOwner(request)
    const run = <A>(operation: (repository: StickerRepository, owner: string) => A): Promise<A> => services.authorized(request, operation)
    if (path === '/api/stickers' && request.method === 'GET') return reply(await run((repository, owner) => repository.inventory(owner)))
    const body = await readStickerBody(request)
    if (path === '/api/stickers/listening' && request.method === 'POST') {
      const observation = parseListeningObservation(body)
      if (await run((repository, owner) => repository.needsEnrichment(owner, observation.catalogId))) await services.enrich(owner, observation.catalogId, request)
      return reply(await run((repository, owner) => repository.observe(owner, observation)))
    }
    if (path === '/api/stickers/packs/open' && request.method === 'POST') {
      if (typeof body['packId'] !== 'string' || body['packId'].length > 100) invalid()
      const id = body['packId']; return reply(await run((repository, owner) => repository.openPack(owner, id)))
    }
    if (path === '/api/stickers/placements' && request.method === 'PUT') {
      const revision = body['revision']; const placements = body['placements']
      if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0 || !Array.isArray(placements) || placements.length > MAX_STICKER_PLACEMENTS || !placements.every(isStickerPlacement)) invalid()
      return reply(await run((repository, owner) => repository.place(owner, revision, placements)))
    }
    return reply({ code: 'not_found', message: 'Sticker endpoint not found.' }, 404)
  } catch (cause) {
    if (cause instanceof StickerError) return reply({ code: cause.code, message: cause.message }, cause.status)
    return reply({ code: 'unavailable', message: 'Your sticker collection is temporarily unavailable.' }, 503)
  }
}
