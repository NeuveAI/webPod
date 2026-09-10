import { createFileRoute } from '@tanstack/react-router'
import { spotifyRoute } from '@webpod/server-core/spotify'

export const Route = createFileRoute('/api/spotify/logout')({
  server: { handlers: { POST: ({ request }) => spotifyRoute(request, 'logout') } },
})
