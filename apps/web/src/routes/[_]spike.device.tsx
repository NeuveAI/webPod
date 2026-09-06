import { createFileRoute } from '@tanstack/react-router'
import { DevicePage } from '../device-page'
export { PlaybackDiagnostics, PreviewControls } from '../device-page'

/** The legacy diagnostic surface remains development-only; / owns the product. */
export const Route = createFileRoute('/_spike/device')({
  ssr: false,
  component: () => import.meta.env.DEV ? <DevicePage /> : <main>Not available.</main>,
})
