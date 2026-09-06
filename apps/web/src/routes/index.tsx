import { createFileRoute } from '@tanstack/react-router'
import { DevicePage } from '../device-page'

/** Browser-only physical renderer; Start owns the canonical product route. */
export const Route = createFileRoute('/')({
  ssr: false,
  component: DevicePage,
})
