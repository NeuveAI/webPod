import { createFileRoute } from '@tanstack/react-router'
import { stickerMethodNotAllowed, stickerRoute } from '../server/sticker-handler.server'

export const Route = createFileRoute('/api/stickers/placements')({
  server: { handlers: {
      PUT: ({ request, context }) => stickerRoute(request, context),
      ANY: () => stickerMethodNotAllowed('PUT'),
  } },
})
