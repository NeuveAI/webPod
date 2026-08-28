import { createRouter } from '@tanstack/react-router'

import { routeTree } from './routeTree.gen'

/**
 * Builds the router for both the server render and the client hydration.
 *
 * TanStack Start calls this once per request on the server and once on the
 * client, so it must stay free of module-level mutable state: two routers
 * created from the same module must not share anything a request could
 * write to.
 */
export function getRouter() {
  return createRouter({
    routeTree,
    defaultPreload: 'intent',
    scrollRestoration: true,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
