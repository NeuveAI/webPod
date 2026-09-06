/// <reference types="vite/client" />
import { HeadContent, Link, Scripts, createRootRoute } from '@tanstack/react-router'
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
  notFoundComponent: NotFound,
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

function NotFound() {
  return <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-stone-950 px-6 text-center text-stone-100">
    <p className="text-sm text-stone-400">404</p>
    <h1 className="text-2xl font-semibold">This page isn’t here.</h1>
    <p className="max-w-sm text-sm text-stone-300">Head back to your iPod to keep listening.</p>
    <Link to="/" className="mt-2 inline-flex min-h-11 items-center rounded-md bg-stone-100 px-4 py-2 text-sm font-medium text-stone-900 hover:bg-stone-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stone-100">Return to player</Link>
  </main>
}
