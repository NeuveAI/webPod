import { createFileRoute } from '@tanstack/react-router'
import { Panel, isPanelState } from '@webpod/panel'
import { fixtureNavigationSource, fixtureProvider } from '@webpod/panel/fixtures'
import { createFixtureProvider, type MusicProvider } from '@webpod/providers'

const pendingPlayback = new Promise<void>(() => undefined)
const startingProvider: MusicProvider = {
  ...fixtureProvider,
  get playback() {
    return {
      ...fixtureProvider.playback,
      status: 'loading',
      now: null,
      queueIndex: null,
      positionMs: 0,
      durationMs: 0,
    }
  },
  onPlaybackChange() { return () => undefined },
  onProgress() { return () => undefined },
  async prepare() {},
  play() { return pendingPlayback },
}

function createProgressSnapshotProvider(percent: 0 | 35 | 100): MusicProvider {
  const provider = createFixtureProvider()
  return {
    ...provider,
    get playback() { return provider.playback },
    async play(target) {
      await provider.play(target)
      await provider.seek(Math.round(provider.playback.durationMs * (percent / 100)))
      await provider.pause()
    },
  }
}

const progressSnapshotProviders = {
  0: createProgressSnapshotProvider(0),
  35: createProgressSnapshotProvider(35),
  100: createProgressSnapshotProvider(100),
} as const

function parseScale(value: unknown): 1 | 1.3 | 2 {
  if (value === 2 || value === '2') return 2
  if (value === 1.3 || value === '1.3') return 1.3
  return 1
}

function parseArtworkTone(value: unknown): 'pale' | 'dark' | null {
  return value === 'pale' || value === 'dark' ? value : null
}

function parseDensity(value: unknown): 'compact' | 'medium' | 'airy' | null {
  return value === 'compact' || value === 'medium' || value === 'airy' ? value : null
}

const parseFlag = (value: unknown): boolean => value === true || value === 1 || value === '1'

function parseProgressSnapshot(value: unknown): 0 | 35 | 100 | null {
  if (value === 0 || value === '0') return 0
  if (value === 35 || value === '35') return 35
  if (value === 100 || value === '100') return 100
  return null
}

export const Route = createFileRoute('/')({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    state: isPanelState(search['state']) ? search['state'] : 'ready',
    scale: parseScale(search['scale']),
    art: parseArtworkTone(search['art']),
    density: parseDensity(search['density']),
    long: parseFlag(search['long']),
    actor: search['actor'] === 'agent' ? 'agent' as const : 'human' as const,
    playback: search['playback'] === 'starting' ? 'starting' as const : 'normal' as const,
    progress: parseProgressSnapshot(search['progress']),
  }),
  component: PanelFixtureRoute,
})

function PanelFixtureRoute() {
  const { state, scale, art, density, long, actor, playback, progress } = Route.useSearch()
  const provider = playback === 'starting'
    ? startingProvider
    : progress === null
      ? fixtureProvider
      : progressSnapshotProviders[progress]
  return (
    <main className="min-h-dvh bg-[var(--room-1)] px-6 py-10 text-[var(--room-ink)]" data-fixture-playback={playback} data-fixture-progress={progress ?? 'live'}>
      <section className="mx-auto flex max-w-7xl flex-wrap items-start justify-center gap-6" aria-label="Panel colourway comparison">
        {(['dark', 'light'] as const).map((colourway) => (
          <figure className="grid gap-3 [zoom:2]" key={colourway}>
            <Panel colourway={colourway} state={state} dynamicTypeScale={scale} artworkTone={art} density={density} longList={long} actor={actor} provider={provider} navigationSource={fixtureNavigationSource} />
            <figcaption className="font-panel text-center text-xs font-semibold">{colourway === 'dark' ? 'Dark' : 'Light'} panel</figcaption>
          </figure>
        ))}
      </section>
    </main>
  )
}
