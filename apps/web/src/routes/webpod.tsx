import { createFileRoute } from '@tanstack/react-router'
import { DevicePage } from '../device-page'

/** Browser-only player; unsupported browsers retain actionable setup guidance. */
export const Route = createFileRoute('/webpod')({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { renderBackend?: 'worker' | 'webgl' } => ({
    ...(search['renderBackend'] === 'worker' || search['renderBackend'] === 'webgl' ? { renderBackend: search['renderBackend'] } : {}),
  }),
  component: DevicePage,
})
