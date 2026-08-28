import { createFileRoute } from '@tanstack/react-router'
import { ARTWORK_PROXY_PATH, handleArtworkRequest } from '@webpod/server-core'

// TanStack's generator requires a literal route id. This compile-time
// assignment still binds that literal to the provider-owned contract.
const artworkRouteContract: '/artwork' = ARTWORK_PROXY_PATH

export const Route = createFileRoute('/artwork')({
  server: {
    handlers: {
      GET: ({ request }) => handleArtworkRequest(request),
    },
  },
})

void artworkRouteContract
