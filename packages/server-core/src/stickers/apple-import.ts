import { classifyGenre } from './policy.ts'
import { StickerError, type ImportedTrack } from './repository.ts'

export const APPLE_IMPORT_MAX_PAGES = 25
export const APPLE_IMPORT_MAX_TRACKS = 2_500
export const APPLE_RESPONSE_MAX_BYTES = 2_000_000
const APPLE_ORIGIN = 'https://api.music.apple.com'
function record(value: unknown): Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {} }

/** Bound response bytes even when the upstream omits Content-Length. Never exposes upstream bodies. */
async function readAppleJson(response: Response): Promise<unknown> {
  if (response.body === null) throw new StickerError('apple_response', 502, 'Apple Music returned an incomplete response.')
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0
  try {
    while (true) {
      const next = await reader.read(); if (next.done) break
      size += next.value.byteLength
      if (size > APPLE_RESPONSE_MAX_BYTES) throw new StickerError('apple_response', 502, 'Apple Music returned too much data.')
      chunks.push(next.value)
    }
  } finally { await reader.cancel().catch(() => undefined) }
  const buffer = new Uint8Array(size); let offset = 0
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length }
  try { return JSON.parse(new TextDecoder().decode(buffer)) as unknown } catch { throw new StickerError('apple_response', 502, 'Apple Music returned unreadable data.') }
}

export interface AppleStickerAccess { readonly developerToken: string; readonly musicUserToken?: string; readonly signal?: AbortSignal; readonly fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> }

/** Fixed Apple origin, no redirects, no cookies, bounded timeout and safe errors. Credentials remain request-local. */
export function createAppleStickerClient(access: AppleStickerAccess) {
  const fetcher = access.fetch ?? fetch
  async function request(path: string, signal: AbortSignal): Promise<Record<string, unknown>> {
    let response: Response
    try {
      response = await fetcher(`${APPLE_ORIGIN}${path}`, { headers: { authorization: `Bearer ${access.developerToken}`, ...(access.musicUserToken === undefined ? {} : { 'music-user-token': access.musicUserToken }), accept: 'application/json' }, redirect: 'error', signal: access.signal === undefined ? signal : AbortSignal.any([signal, access.signal]) })
    } catch { throw new StickerError('apple_unavailable', 503, 'Apple Music is temporarily unavailable. Try again.') }
    if (response.status === 401 || response.status === 403) throw new StickerError('apple_authorization', 401, 'Reconnect Apple Music to collect stickers.')
    if (!response.ok) throw new StickerError('apple_unavailable', 503, 'Apple Music is temporarily unavailable. Try again.')
    return record(await readAppleJson(response))
  }
  function normalize(value: unknown, catalog: boolean): ImportedTrack | null {
    const row = record(value); const attributes = record(row['attributes'])
    const params = record(attributes['playParams'])
    const rawId = catalog ? row['id'] : params['catalogId']
    if (typeof rawId !== 'string' || !/^\d{1,24}$/.test(rawId)) return null
    const duration = attributes['durationInMillis']
    if (typeof duration !== 'number' || !Number.isSafeInteger(duration) || duration <= 0 || duration > 86_400_000) return null
    const names = Array.isArray(attributes['genreNames']) ? attributes['genreNames'].filter((name: unknown): name is string => typeof name === 'string') : []
    return { catalogId: rawId, genre: classifyGenre(names), durationMs: duration }
  }
  return {
    /** Upstream verification is mandatory before session activation. Does not claim Apple account identity. */
    async verify(): Promise<string> {
      const result = await request('/v1/me/storefront', AbortSignal.timeout(10_000))
      const data = result['data']; const first = Array.isArray(data) ? record(data[0]) : {}
      if (typeof first['id'] !== 'string' || !/^[a-z]{2}$/.test(first['id'])) throw new StickerError('apple_response', 502, 'Apple Music storefront is unavailable.')
      return first['id']
    },
    /** Snapshot import is all-or-nothing on malformed pages, timeout or upstream failure. The caller
     * marks failure while retaining its previous persisted snapshot; no completed-page prefix is
     * returned as a successful taste result. `partial` exclusively denotes the declared page/row cap. */
    async importLibrary(): Promise<{ readonly tracks: readonly ImportedTrack[]; readonly status: 'complete' | 'partial' }> {
      const signal = AbortSignal.timeout(30_000); const imported = new Map<string, ImportedTrack>(); const seen = new Set<string>()
      let path: string | null = '/v1/me/library/songs?limit=100'
      for (let page = 0; path !== null && page < APPLE_IMPORT_MAX_PAGES; page++) {
        if (seen.has(path)) throw new StickerError('apple_pagination', 502, 'Apple Music library pages repeated. Try again.')
        seen.add(path)
        const result = await request(path, signal)
        if (!Array.isArray(result['data'])) throw new StickerError('apple_response', 502, 'Apple Music library is unavailable.')
        for (const row of result['data'].slice(0, 100)) { const track = normalize(row, false); if (track !== null) imported.set(track.catalogId, track) }
        const next = result['next']
        if (next === undefined || next === null) path = null
        else {
          if (typeof next !== 'string' || next.length > 512) throw new StickerError('apple_pagination', 502, 'Apple Music library pagination is invalid.')
          const url = new URL(next, APPLE_ORIGIN)
          if (url.origin !== APPLE_ORIGIN || url.pathname !== '/v1/me/library/songs' || [...url.searchParams.keys()].some((key) => key !== 'offset' && key !== 'limit')
            || [...url.searchParams.values()].some((value) => !/^\d{1,8}$/.test(value))) throw new StickerError('apple_pagination', 502, 'Apple Music library pagination is invalid.')
          url.searchParams.set('limit', '100'); path = url.pathname + url.search
        }
        if (imported.size >= APPLE_IMPORT_MAX_TRACKS) break
      }
      return { tracks: [...imported.values()], status: path === null ? 'complete' : 'partial' }
    },
    async enrich(catalogId: string, storefront: string): Promise<ImportedTrack> {
      if (!/^\d{1,24}$/.test(catalogId) || !/^[a-z]{2}$/.test(storefront)) throw new StickerError('invalid_track', 400, 'This track cannot earn stickers yet.')
      const result = await request(`/v1/catalog/${storefront}/songs/${catalogId}`, AbortSignal.timeout(10_000))
      const rows = result['data']; const track = Array.isArray(rows) ? normalize(rows[0], true) : null
      if (track === null || track.catalogId !== catalogId) throw new StickerError('invalid_track', 400, 'This track cannot earn stickers yet.')
      return track
    },
  }
}
