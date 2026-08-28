import { createFileRoute } from '@tanstack/react-router'
import { Panel, type PanelState } from '../../../../packages/panel/src'

const STATES: readonly PanelState[] = [
  'ready',
  'loading',
  'empty',
  'error',
  'offline',
  'permission-denied',
  'agent-active',
  'success-confirmation',
]

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>) => ({
    state: STATES.includes(search['state'] as PanelState) ? search['state'] as PanelState : 'ready',
    scale: search['scale'] === '2' ? 2 : 1,
  }),
  component: Home,
})

function Home() {
  const { state, scale } = Route.useSearch()
  return (
    <main className="min-h-dvh bg-[var(--room-1)] px-6 py-10 text-[var(--room-ink)]">
      <header className="mx-auto mb-8 max-w-3xl text-center">
        <p className="font-panel text-xs font-semibold uppercase tracking-[0.18em] text-[var(--room-ink-2)]">
          Panel DOM preview
        </p>
        <h1 className="font-panel mt-2 text-2xl font-bold">The same device state, in both colourways</h1>
        <p className="font-panel mt-2 text-sm text-[var(--room-ink-2)]">
          Focus either panel. Arrow keys move one row; Enter opens Albums, plays a track, then cycles Volume, Scrub, and Rate. Backspace returns.
        </p>
      </header>
      <section className="mx-auto flex max-w-7xl flex-wrap items-start justify-center gap-6" aria-label="Panel colourway comparison">
        <figure className="grid gap-3 [zoom:2]">
          <Panel colourway="dark" state={state} dynamicTypeScale={scale} />
          <figcaption className="font-panel text-center text-xs font-semibold">Dark panel</figcaption>
        </figure>
        <figure className="grid gap-3 [zoom:2]">
          <Panel colourway="light" state={state} dynamicTypeScale={scale} />
          <figcaption className="font-panel text-center text-xs font-semibold">Light panel</figcaption>
        </figure>
      </section>
    </main>
  )
}
