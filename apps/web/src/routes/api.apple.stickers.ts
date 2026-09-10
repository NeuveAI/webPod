import { createFileRoute } from '@tanstack/react-router'
import { stickerMethodNotAllowed, appleStickerRoute } from '../server/sticker-handler.server'

export const Route = createFileRoute('/api/apple/stickers')({
  server: { handlers: {
    POST: ({ request, context }) => appleStickerRoute(request, context),
    ANY: () => stickerMethodNotAllowed('POST'),
  } },
})
