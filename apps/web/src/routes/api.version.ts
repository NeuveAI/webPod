import { createFileRoute } from '@tanstack/react-router'
import { APP_BUILD_ID } from '../build-identity'

export const Route = createFileRoute('/api/version')({
  server: { handlers: {
    GET: () => Response.json({ buildId: APP_BUILD_ID }, { headers: {
      'cache-control': 'no-store',
      'cdn-cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    } }),
  } },
})
