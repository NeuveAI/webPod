import { createFileRoute, redirect } from '@tanstack/react-router'

/** Legacy preview URLs always resolve to the one canonical product view. */
export const Route = createFileRoute('/_probe/composite')({
  ssr: false,
  beforeLoad: () => {
    throw redirect({
      to: '/_spike/device',
      search: {},
      replace: true,
    })
  },
})
