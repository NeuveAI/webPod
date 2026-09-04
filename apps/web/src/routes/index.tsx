import { createFileRoute, redirect } from '@tanstack/react-router'

/** The public root is only an alias for the Apple-backed product surface. */
export const Route = createFileRoute('/')({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: '/_spike/device', search: {}, replace: true })
  },
})
