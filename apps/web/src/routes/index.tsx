import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <main className="text-ui-text-1 grid min-h-dvh place-items-center">
      <p className="font-panel text-panel-row">webPod</p>
    </main>
  )
}
