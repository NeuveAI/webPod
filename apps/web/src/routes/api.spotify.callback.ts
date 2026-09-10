import { createFileRoute } from '@tanstack/react-router'
import { spotifyRoute } from '@webpod/server-core/spotify'

export const Route = createFileRoute('/api/spotify/callback')({
  server: { handlers: { GET: ({ request }) => spotifyRoute(request, 'callback') } },
})
