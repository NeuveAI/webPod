import handler, { createServerEntry } from '@tanstack/react-start/server-entry'
export { disposeStickerServer } from './server/sticker-runtime.server'

export default createServerEntry({ fetch: async (request, options) => {
  const response = await handler.fetch(request, options)
  if (!response.headers.get('content-type')?.includes('text/html')) return response
  // HTML must consult the deployment again; fingerprinted assets remain reusable.
  const headers = new Headers(response.headers)
  headers.set('cache-control', 'no-cache, max-age=0, must-revalidate')
  headers.set('cdn-cache-control', 'no-store')
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
} })
