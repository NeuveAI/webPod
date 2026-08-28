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
 * ⚑ It is currently hardcoded to `dark`. Both colourways are defined at the
 * token layer and both survive to the built stylesheet, but there is no
 * switch yet, so light is not reachable in the running app. Whichever lane
 * owns the mode control drives this attribute from the store; it must not
 * become component state.
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
