import { createFileRoute } from '@tanstack/react-router'
import { DevicePage } from '../device-page'

/** Browser-only player; unsupported browsers retain actionable setup guidance. */
export const Route = createFileRoute('/webpod')({
  ssr: false,
  component: DevicePage,
})
