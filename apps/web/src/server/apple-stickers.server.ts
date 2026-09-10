import { appleTokenConfigFromEnv, mintAppleDeveloperToken } from '@webpod/server-core'
import { createAppleStickerClient, assertStickerSameOrigin, readStickerBody, StickerError } from '@webpod/server-core/apple-stickers'

export interface AppleStickerOptions {
  readonly developerToken?: () => Promise<string>
  readonly fetch?: typeof fetch
}
let pending = 0
/** Stateless metadata transport. It never opens storage or establishes collection identity. */
export async function appleStickersRoute(request: Request, options: AppleStickerOptions = {}): Promise<Response> {
  const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
  let admitted = false
  try {
    assertStickerSameOrigin(request)
    const body = await readStickerBody(request)
    const action = body['action']
    const token = body['musicUserToken']
    if (action !== 'import' && action !== 'enrich') throw new StickerError('invalid_request', 400, 'Invalid metadata request.')
    if (action === 'import' && (typeof token !== 'string' || token.length < 1 || token.length > 16_384 || /[\r\n]/.test(token))) throw new StickerError('invalid_request', 400, 'Reconnect Apple Music.')
    if (action === 'enrich' && (typeof body['catalogId'] !== 'string' || !/^\d{1,24}$/.test(body['catalogId']) || typeof body['storefront'] !== 'string' || !/^[a-z]{2}$/.test(body['storefront']))) throw new StickerError('invalid_request', 400, 'Invalid track.')
    if (pending >= 4) throw new StickerError('rate_limited', 429, 'Library import is busy. Try again shortly.')
    pending++; admitted = true
    const developerToken = await (options.developerToken?.() ?? mintAppleDeveloperToken({ config: appleTokenConfigFromEnv(process.env) }).then(value => value.token))
    const client = createAppleStickerClient({ developerToken, ...(action === 'import' ? { musicUserToken: token as string } : {}), signal: request.signal, ...(options.fetch === undefined ? {} : { fetch: options.fetch }) })
    if (action === 'enrich') return Response.json(await client.enrich(body['catalogId'] as string, body['storefront'] as string), { headers })
    const storefront = await client.verify()
    return Response.json({ ...await client.importLibrary(), storefront }, { headers })
  } catch (cause) {
    if (cause instanceof StickerError) return Response.json({ code: cause.code, message: cause.message }, { status: cause.status, headers })
    return Response.json({ code: 'unavailable', message: 'Apple Music is temporarily unavailable.' }, { status: 503, headers })
  } finally { if (admitted) pending-- }
}
