/// <reference types="vite/client" />
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import appCss from '../styles/app.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'webPod' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
})

/**
 * The document shell.
 *
 * `data-mode` is an attribute rather than a media query on purpose: the
 * colourway is a product variant, not a system preference (design system
 * LAW 5), so nothing here reads `prefers-color-scheme`.
 *
 * The environment stays dark for the comparison route; each independently
 * mountable panel carries its explicit colourway. This makes both polarities
 * reachable in one browser frame without introducing component-local state.
 */
function RootDocument({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en" data-mode="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
