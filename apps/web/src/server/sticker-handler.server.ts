import { handleAppleDeveloperTokenRequest } from '@webpod/server-core'
import type { createLiveStickerServer } from '@webpod/server-core/stickers'
import { getStickerServer } from './sticker-runtime.server'

export interface StickerRequestContext {
  readonly stickerServer?: Pick<ReturnType<typeof createLiveStickerServer>, 'handle'>
  readonly appleTokenOptions?: Parameters<typeof handleAppleDeveloperTokenRequest>[1]
}
declare module '@tanstack/react-router' { interface Register { server: { requestContext: StickerRequestContext } } }

/** Trusted Start request context is an explicit factory seam for transport integration tests.
 * HTTP body, headers and URLs cannot supply this service. */
export async function stickerRoute(request: Request, context: StickerRequestContext = {}): Promise<Response> {
  try { return await (context.stickerServer ?? getStickerServer()).handle(request) }
  catch { return Response.json({ code: 'unavailable', message: 'Your sticker collection is temporarily unavailable.' }, { status: 503, headers: { 'cache-control': 'no-store' } }) }
}
export function stickerMethodNotAllowed(allow: string): Response {
  return Response.json({ code: 'method_not_allowed', message: 'This sticker action is unavailable.' }, { status: 405, headers: { allow, 'cache-control': 'no-store' } })
}

/** The existing signer options remain a trusted server-only dependency, never HTTP input. */
export function appleTokenRoute(request: Request, context: StickerRequestContext = {}): Promise<Response> {
  return handleAppleDeveloperTokenRequest(request, context.appleTokenOptions)
}
