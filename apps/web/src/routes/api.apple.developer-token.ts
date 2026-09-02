import { createFileRoute } from '@tanstack/react-router'
import { APPLE_DEVELOPER_TOKEN_PATH, handleAppleDeveloperTokenRequest } from '@webpod/server-core'

const routeContract: '/api/apple/developer-token' = APPLE_DEVELOPER_TOKEN_PATH

export const Route = createFileRoute('/api/apple/developer-token')({
  server: { handlers: { GET: ({ request }) => handleAppleDeveloperTokenRequest(request) } },
})

void routeContract
