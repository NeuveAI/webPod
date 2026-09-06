import { createFileRoute } from '@tanstack/react-router'
import { stickerMethodNotAllowed, stickerRoute } from '../server/sticker-handler.server'

export const Route = createFileRoute('/api/stickers/session')({
  server: { handlers: {
      POST: ({ request, context }) => stickerRoute(request, context),
      DELETE: ({ request, context }) => stickerRoute(request, context),
      ANY: () => stickerMethodNotAllowed('POST, DELETE'),
  } },
})
