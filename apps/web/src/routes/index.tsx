import { createFileRoute } from '@tanstack/react-router'
import { Panel, isPanelState } from '@webpod/panel'

function parseScale(value: unknown): 1 | 1.3 | 2 {
  if (value === 2 || value === '2') return 2
  if (value === 1.3 || value === '1.3') return 1.3
  return 1
}

function parseArtworkTone(value: unknown): 'pale' | 'dark' {
  return value === 'pale' ? 'pale' : 'dark'
}

function parseDensity(value: unknown): 'compact' | 'medium' | 'airy' | null {
  if (value === 'compact' || value === 'medium' || value === 'airy') return value
  return null
}

function parseActor(value: unknown): 'human' | 'agent' {
  return value === 'agent' ? 'agent' : 'human'
}

function parseFlag(value: unknown): boolean {
  return value === true || value === 1 || value === '1'
}

export const Route = createFileRoute('/')({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    state: isPanelState(search['state']) ? search['state'] : 'ready',
    scale: parseScale(search['scale']),
    art: parseArtworkTone(search['art']),
    density: parseDensity(search['density']),
    long: parseFlag(search['long']),
    actor: parseActor(search['actor']),
    downloaded: parseFlag(search['downloaded']),
  }),
  component: Home,
})

function Home() {
  const { state, scale, art, density, long, actor, downloaded } = Route.useSearch()
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
          <Panel colourway="dark" state={state} dynamicTypeScale={scale} artworkTone={art} density={density} longList={long} actor={actor} offlineDownloaded={downloaded} />
          <figcaption className="font-panel text-center text-xs font-semibold">Dark panel</figcaption>
        </figure>
        <figure className="grid gap-3 [zoom:2]">
          <Panel colourway="light" state={state} dynamicTypeScale={scale} artworkTone={art} density={density} longList={long} actor={actor} offlineDownloaded={downloaded} />
          <figcaption className="font-panel text-center text-xs font-semibold">Light panel</figcaption>
        </figure>
      </section>
    </main>
  )
}
