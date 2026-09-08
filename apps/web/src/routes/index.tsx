import { createFileRoute } from '@tanstack/react-router'
import { LandingPage } from '../browser-welcome'

/** Public introduction and browser setup, independent of the player route. */
export const Route = createFileRoute('/')({
  ssr: false,
  component: LandingPage,
})
