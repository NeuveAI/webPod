import { createFileRoute } from '@tanstack/react-router'
import { APPLE_DEVELOPER_TOKEN_PATH } from '@webpod/server-core'

import { appleTokenRoute } from '../server/sticker-handler.server'

const routeContract: '/api/apple/developer-token' = APPLE_DEVELOPER_TOKEN_PATH

export const Route = createFileRoute('/api/apple/developer-token')({
  server: { handlers: { GET: ({ request, context }) => appleTokenRoute(request, context) } },
})

void routeContract
