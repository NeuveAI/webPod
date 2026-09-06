import { createFileRoute } from '@tanstack/react-router'
import { stickerMethodNotAllowed, stickerRoute } from '../server/sticker-handler.server'

export const Route = createFileRoute('/api/stickers')({
  server: { handlers: {
      GET: ({ request, context }) => stickerRoute(request, context),
      HEAD: async ({ request, context }) => { const response = await stickerRoute(new Request(request, { method: 'GET' }), context); return new Response(null, { status: response.status, headers: response.headers }) },
      ANY: () => stickerMethodNotAllowed('GET, HEAD'),
  } },
})
