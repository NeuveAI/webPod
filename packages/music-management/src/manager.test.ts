import { afterEach, describe, expect, test } from 'bun:test'
import { createFixtureProvider, type MusicProvider, type PlaybackState, type ProgressTick, type QueueSnapshot, type Session } from '@webpod/providers'
import { musicManager, type MusicManager } from './manager'

const owned: MusicManager[] = []
afterEach(() => { for (const manager of owned.splice(0)) manager.dispose() })
function required<T>(value: T | undefined): T { if (value === undefined) throw new Error('Missing fixture value'); return value }
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (cause: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const flush = async () => { for (let n = 0; n < 8; n++) await Promise.resolve() }
function harness() {
  const fixture = createFixtureProvider()
  const tracks = fixture.catalog.tracks.slice(0, 3)
  let playback: PlaybackState = { ...fixture.playback, now: tracks[0] ?? null, status: 'paused', queueIndex: 0, queueTotal: null }
  let session = fixture.session
  const playbackListeners = new Set<(value: PlaybackState) => void>()
  const progressListeners = new Set<(value: ProgressTick) => void>()
  const sessionListeners = new Set<(value: Session | null) => void>()
  const calls: string[] = []
  const adapter: MusicProvider = {
    ...fixture,
    get playback() { return playback }, get session() { return session },
    onPlaybackChange(callback) { playbackListeners.add(callback); return () => { playbackListeners.delete(callback) } },
    onProgress(callback) { progressListeners.add(callback); return () => { progressListeners.delete(callback) } },
    onSessionChange(callback) { sessionListeners.add(callback); return () => { sessionListeners.delete(callback) } },
    async play() { calls.push('play') },
    async pause() { calls.push('pause'); emit({ status: 'paused' }) },
    async seek() { calls.push('seek') },
    async skip() { calls.push('skip') },
    async queueRead() { return { history: [], now: playback.now, next: tracks.slice(1) } },
    async queueAppend() { calls.push('append') },
  }
  const emit = (patch: Partial<PlaybackState>) => { playback = { ...playback, ...patch }; for (const listener of [...playbackListeners]) listener(playback) }
  const progress = (positionMs: number) => { playback = { ...playback, positionMs }; for (const listener of [...progressListeners]) listener({ positionMs, durationMs: playback.durationMs, interpolated: false }) }
  const silentSnapshot = (patch: Partial<PlaybackState>) => { playback = { ...playback, ...patch } }
  const changeAccount = () => { session = session ? { ...session, userIdentifier: 'new-account' } : null; for (const listener of [...sessionListeners]) listener(session) }
  const manager = () => { const result = musicManager(adapter); owned.push(result); return result }
  return { adapter, manager, tracks, emit, progress, silentSnapshot, changeAccount, calls, playbackListeners, progressListeners, sessionListeners }
}

describe('native snapshot reconciliation on progress', () => {
  test.each(['playing', 'paused', 'loading', 'error'] as const)('observes %s without a playback event or active intent', (status) => {
    const h = harness(); const manager = h.manager()
    h.silentSnapshot({ status, now: h.tracks[1] }); h.progress(4250)
    expect(manager.getSnapshot().intent).toBeNull()
    expect(manager.getSnapshot().playback).toMatchObject({ status, now: h.tracks[1], positionMs: 4250 })
  })

  test('clock-only updates do not emit transport events or refresh the queue repeatedly', async () => {
    const h = harness(); const manager = h.manager()
    let events = 0; let reads = 0
    h.adapter.queueRead = async () => { reads += 1; return { history: [], now: h.tracks[0] ?? null, next: [] } }
    manager.provider.onPlaybackChange(() => { events += 1 })
    h.silentSnapshot({ status: 'playing', queueIndex: null }); h.progress(250)
    await flush()
    const firstEvents = events
    for (let n = 2; n < 20; n++) h.progress(n * 250)
    await flush()
    expect(events).toBe(firstEvents)
    expect(reads).toBe(1)
    expect(manager.getSnapshot().playback.positionMs).toBe(4750)
  })

  test('silent stale selection metadata cannot settle a newer intent', async () => {
    const h = harness(); const manager = h.manager()
    await manager.provider.play({ kind: 'tracks', tracks: h.tracks, startIndex: 1 })
    h.silentSnapshot({ status: 'playing', now: h.tracks[0], queueIndex: 0 }); h.progress(1000)
    expect(manager.getSnapshot().intent).not.toBeNull()
    expect(manager.getSnapshot().playback).toMatchObject({ status: 'loading', now: h.tracks[1], positionMs: 0 })
    h.silentSnapshot({ now: h.tracks[1], queueIndex: 1 }); h.progress(1250)
    expect(manager.getSnapshot().intent).toBeNull()
    expect(manager.getSnapshot().playback).toMatchObject({ status: 'playing', now: h.tracks[1], positionMs: 1250 })
  })

  test('deactivation rejects retained progress callbacks', () => {
    const h = harness(); const manager = h.manager()
    const callbacks = [...h.progressListeners]
    manager.deactivate()
    h.silentSnapshot({ status: 'playing', now: h.tracks[1], positionMs: 2000 })
    for (const callback of callbacks) callback({ positionMs: 2000, durationMs: 10000, interpolated: false })
    expect(manager.getSnapshot().playback).toMatchObject({ status: 'idle', now: null, positionMs: 0 })
  })
})

describe('progressive playback continuation', () => {
  test('starts synchronously and appends only the suffix after native confirmation', async () => {
    const h = harness(); const manager = h.manager(); const tail = deferred<readonly typeof h.tracks[number][]>()
    const appended: string[] = []
    h.adapter.queueAppend = async (tracks) => { appended.push(...tracks.map((track) => track.catalogId)) }
    h.silentSnapshot({ status: 'loading', now: null, queueIndex: null })
    const started = manager.playProgressive({ kind: 'tracks', tracks: h.tracks.slice(0, 1) }, tail.promise)
    expect(h.calls).toEqual(['play'])
    await started; tail.resolve(h.tracks); await flush()
    expect(appended).toEqual([])
    h.emit({ status: 'playing', now: h.tracks[0], queueIndex: 0, positionMs: 0 })
    expect(manager.getSnapshot().playback.status).toBe('loading')
    h.progress(250); await flush()
    expect(appended).toEqual(h.tracks.slice(1).map((track) => track.catalogId))
    expect(manager.getSnapshot().playback.status).toBe('playing')
    expect(manager.getSnapshot().playback.queueTotal).toBeNull()
  })

  test.each(['new-play', 'pause', 'queue-mutation', 'deactivate'] as const)('%s cancels delayed continuation', async (action) => {
    const h = harness(); const manager = h.manager(); const tail = deferred<readonly typeof h.tracks[number][]>()
    const appended: string[] = []
    h.adapter.queueAppend = async (tracks) => { appended.push(...tracks.map((track) => track.catalogId)) }
    await manager.playProgressive({ kind: 'tracks', tracks: h.tracks.slice(0, 1) }, tail.promise)
    h.emit({ status: 'playing', now: h.tracks[0], queueIndex: 0, positionMs: 250 })
    if (action === 'new-play') await manager.provider.play({ kind: 'tracks', tracks: h.tracks, startIndex: 1 })
    else if (action === 'pause') await manager.provider.pause()
    else if (action === 'queue-mutation') await manager.provider.queueAppend([])
    else manager.deactivate()
    tail.resolve(h.tracks); await flush()
    expect(appended).toEqual([])
  })

  test('new selection during one remote append prevents the remaining suffix', async () => {
    const h = harness(); const manager = h.manager(); const append = deferred<void>()
    const appended: string[] = []
    h.adapter.queueAppend = async (tracks) => { appended.push(...tracks.map((track) => track.catalogId)); await append.promise }
    await manager.playProgressive({ kind: 'tracks', tracks: h.tracks.slice(0, 1) }, Promise.resolve(h.tracks))
    h.emit({ status: 'playing', now: h.tracks[0], queueIndex: 0, positionMs: 250 }); await flush()
    expect(appended).toEqual([required(h.tracks[1]).catalogId])
    await manager.provider.play({ kind: 'tracks', tracks: h.tracks, startIndex: 2 })
    append.resolve(); await flush()
    expect(appended).toEqual([required(h.tracks[1]).catalogId])
    expect(manager.getSnapshot().playback.now).toBe(required(h.tracks[2]))
  })

  test('tail failure leaves the confirmed prefix playing', async () => {
    const h = harness(); const manager = h.manager(); const tail = deferred<readonly typeof h.tracks[number][]>()
    await manager.playProgressive({ kind: 'tracks', tracks: h.tracks.slice(0, 1) }, tail.promise)
    h.emit({ status: 'playing', now: h.tracks[0], queueIndex: 0, positionMs: 250 })
    tail.reject(new Error('Unrelated remaining page failed')); await flush()
    expect(manager.getSnapshot().playback).toMatchObject({ status: 'playing', now: h.tracks[0], positionMs: 250 })
  })

  test('foreground seek runs between suffix appends', async () => {
    const h = harness(); const manager = h.manager(); const firstAppend = deferred<void>(); const order: string[] = []
    h.adapter.queueAppend = async (tracks) => { order.push(`append:${required(tracks[0]).catalogId}`); if (order.length === 1) await firstAppend.promise }
    h.adapter.seek = async () => { order.push('seek') }
    await manager.playProgressive({ kind: 'tracks', tracks: h.tracks.slice(0, 1) }, Promise.resolve(h.tracks))
    h.emit({ status: 'playing', now: h.tracks[0], queueIndex: 0, positionMs: 250 }); await flush()
    const seek = manager.provider.seek(500)
    firstAppend.resolve(); await seek; await flush()
    expect(order).toEqual([`append:${required(h.tracks[1]).catalogId}`, 'seek', `append:${required(h.tracks[2]).catalogId}`])
  })

  test('a reordered completion is not appended to a different prefix', async () => {
    const h = harness(); const manager = h.manager(); let appends = 0
    h.adapter.queueAppend = async () => { appends += 1 }
    await manager.playProgressive({ kind: 'tracks', tracks: h.tracks.slice(0, 1) }, Promise.resolve([...h.tracks].reverse()))
    h.emit({ status: 'playing', now: h.tracks[0], queueIndex: 0, positionMs: 250 }); await flush()
    expect(appends).toBe(0)
  })
})

describe('shared music ownership without React', () => {
  test('selection occurrence and total are synchronous; A/B/A cannot be confirmed by old A', async () => {
    const h = harness(); const a = required(h.tracks[0]); const b = required(h.tracks[1])
    const gate = deferred<void>(); h.adapter.play = () => gate.promise
    const manager = h.manager()
    const playing = manager.provider.play({ kind: 'tracks', tracks: [a, b, a], startIndex: 2 })
    expect(manager.getSnapshot().playback).toMatchObject({ now: a, queueIndex: 2, queueTotal: 3, status: 'loading' })
    h.emit({ now: a, queueIndex: 0, status: 'playing', positionMs: 1000 })
    expect(manager.getSnapshot().intent?.index).toBe(2)
    gate.resolve(); await playing
    expect(manager.getSnapshot().intent).not.toBeNull()
    h.emit({ now: a, queueIndex: 2, status: 'playing', positionMs: 1000 })
    expect(manager.getSnapshot().intent).toBeNull()
    expect(manager.getSnapshot().playback).toMatchObject({ queueIndex: 2, queueTotal: 3 })
  })

  for (const failure of [false, true]) test(`late A ${failure ? 'rejection' : 'success'} cannot replace B`, async () => {
    const h = harness(); const gate = deferred<void>(); let calls = 0
    h.adapter.play = () => ++calls === 1 ? gate.promise : Promise.resolve()
    const manager = h.manager()
    const first = manager.provider.play({ kind: 'tracks', tracks: h.tracks, startIndex: 0 }).catch(() => undefined)
    await manager.provider.play({ kind: 'tracks', tracks: h.tracks, startIndex: 1 })
    h.emit({ now: h.tracks[1], queueIndex: 1, status: 'playing', positionMs: 250 })
    if (failure) gate.reject(new Error('old failure')); else gate.resolve()
    await first
    expect(manager.getSnapshot().playback.now).toBe(required(h.tracks[1]))
    expect(manager.getSnapshot().playback.status).toBe('playing')
  })

  test('progress-only adapter settles selection without a mounted progress consumer', async () => {
    const h = harness(); h.emit({ status: 'stopped', now: null }); const manager = h.manager()
    await manager.provider.play({ kind: 'tracks', tracks: h.tracks, startIndex: 0 })
    h.emit({ status: 'playing', now: h.tracks[0], queueIndex: 0, positionMs: 0 })
    expect(manager.getSnapshot().intent).not.toBeNull()
    h.progress(250)
    expect(manager.getSnapshot().intent).toBeNull()
    expect(manager.getSnapshot().playback.positionMs).toBe(250)
    expect(h.progressListeners.size).toBe(1)
  })

  test('late same-track observation does not strand queue refresh in loading', async () => {
    const h = harness(); const gate = deferred<QueueSnapshot>(); h.adapter.queueRead = () => gate.promise
    const manager = h.manager(); const reading = manager.refreshQueue()
    h.emit({ positionMs: 200 })
    gate.resolve({ history: [], now: required(h.tracks[0]), next: [required(h.tracks[1])] }); await reading
    expect(manager.getSnapshot().queue.status).toBe('ready')
    expect(manager.getSnapshot().playback.queueTotal).toBeNull()
  })

  test('old queue completion cannot overwrite a newly selected list', async () => {
    const h = harness(); const gate = deferred<QueueSnapshot>(); h.adapter.queueRead = () => gate.promise
    const manager = h.manager(); const reading = manager.refreshQueue().catch(() => undefined)
    await manager.provider.play({ kind: 'tracks', tracks: h.tracks, startIndex: 2 })
    gate.resolve({ history: [], now: required(h.tracks[0]), next: [] }); await reading
    expect(manager.getSnapshot().playback).toMatchObject({ queueIndex: 2, queueTotal: 3 })
  })

  for (const invalidation of ['new-selection', 'deactivate', 'dispose', 'account'] as const) test(`pending seek cannot resume after ${invalidation}`, async () => {
    const h = harness(); const gate = deferred<void>(); h.adapter.seek = () => { h.calls.push('seek'); return gate.promise }
    const manager = h.manager(); const seeking = manager.commitSeek(2000).catch(() => undefined)
    await flush(); expect(h.calls).toEqual(['seek'])
    if (invalidation === 'new-selection') await manager.provider.play({ kind: 'tracks', tracks: h.tracks, startIndex: 1 })
    else if (invalidation === 'deactivate') manager.deactivate()
    else if (invalidation === 'dispose') manager.dispose()
    else h.changeAccount()
    const before = h.calls.length; gate.resolve(); await seeking
    expect(h.calls.length).toBe(before)
  })

  test('paused seek resumes once; rejected seek neither resumes nor poisons successor', async () => {
    const h = harness(); const manager = h.manager()
    await manager.commitSeek(2000)
    expect(h.calls).toEqual(['seek', 'play'])
    h.adapter.seek = async () => { throw new Error('seek failed') }
    await expect(manager.commitSeek(3000)).rejects.toThrow('seek failed')
    expect(h.calls).toEqual(['seek', 'play'])
    h.adapter.seek = async () => { h.calls.push('recovered') }
    await manager.provider.seek(4000)
    expect(h.calls.at(-1)).toBe('recovered')
  })

  test('invalid list target changes neither intent nor queued work', async () => {
    const h = harness(); const manager = h.manager()
    const seeking = manager.provider.seek(10)
    await expect(manager.provider.play({ kind: 'tracks', tracks: h.tracks, startIndex: 99 })).rejects.toThrow('outside')
    await seeking
    expect(h.calls).toEqual(['seek'])
    expect(manager.getSnapshot().intent).toBeNull()
  })

  test('pending skip never crosses a new selection', async () => {
    const h = harness(); h.emit({ status: 'loading' }); const manager = h.manager()
    const skipping = manager.provider.skip('next').catch(() => undefined); await flush()
    await manager.provider.play({ kind: 'tracks', tracks: h.tracks, startIndex: 2 })
    h.emit({ status: 'playing', now: h.tracks[2], queueIndex: 2, positionMs: 250 }); await skipping
    expect(h.calls).toEqual(['play'])
  })

  test('logout suspends native callbacks before the remote request settles', async () => {
    const h = harness(); const gate = deferred<void>(); h.adapter.unauthorize = () => gate.promise
    const manager = h.manager(); const signingOut = manager.provider.unauthorize()
    h.emit({ status: 'playing', now: h.tracks[1] }); h.progress(500)
    expect(manager.getSnapshot().playback.now).toBeNull()
    gate.resolve(); await signingOut
    h.emit({ status: 'playing', now: h.tracks[2] })
    expect(manager.getSnapshot().playback.now).toBeNull()
  })

  test('dispose releases listeners and progress driver', () => {
    const h = harness(); const manager = h.manager()
    expect(h.playbackListeners.size).toBe(1); expect(h.progressListeners.size).toBe(1)
    manager.dispose()
    expect(h.playbackListeners.size).toBe(0); expect(h.progressListeners.size).toBe(0); expect(h.sessionListeners.size).toBe(0)
  })
})

test('shuffle and partial append failure invalidate ordered occurrence and total', async () => {
  const h = harness(); h.emit({ now: null, status: 'stopped' }); const manager = h.manager()
  await manager.provider.play({ kind: 'tracks', tracks: h.tracks, startIndex: 1 })
  h.emit({ now: h.tracks[1], queueIndex: 1, status: 'playing', positionMs: 250 })
  h.emit({ shuffle: 'songs' })
  expect(manager.getSnapshot().playback).toMatchObject({ queueIndex: null, queueTotal: null })
  h.emit({ shuffle: 'off' })
  expect(manager.getSnapshot().playback.queueTotal).toBe(3)
  h.adapter.queueAppend = async () => { throw new Error('partial append') }
  await expect(manager.provider.queueAppend([required(h.tracks[0])])).rejects.toThrow('partial append')
  expect(manager.getSnapshot().playback).toMatchObject({ queueIndex: null, queueTotal: null })
})

test('late callbacks from a retired account cannot repopulate a reactivated manager', () => {
  const h = harness(); const manager = h.manager()
  const oldCallback = required([...h.playbackListeners][0])
  manager.deactivate()
  expect(h.playbackListeners.size).toBe(0)
  expect(h.progressListeners.size).toBe(0)
  h.changeAccount(); manager.activate()
  const before = manager.getSnapshot().playback
  oldCallback({ ...before, now: required(h.tracks[2]), status: 'playing' })
  expect(manager.getSnapshot().playback).toBe(before)
  expect(h.playbackListeners.size).toBe(1)
})

test('independent facade callers share seek ordering and pause admission without React', async () => {
  const h = harness(); const gate = deferred<void>(); h.adapter.seek = () => { h.calls.push('seek:start'); return gate.promise.then(() => { h.calls.push('seek:end') }) }
  const manager = h.manager(); const tool = musicManager(h.adapter).provider; const wheel = musicManager(manager.provider).provider
  expect(tool).toBe(wheel)
  const seeking = tool.seek(2000).catch(() => undefined); await flush()
  await wheel.pause()
  gate.resolve(); await seeking
  expect(h.calls).toEqual(['seek:start', 'pause', 'seek:end'])
  expect(manager.getSnapshot().playback.status).toBe('paused')
})

test('fully observable queues recover counters after append and refresh on tool-selected replacement', async () => {
  const adapter = createFixtureProvider(); const manager = musicManager(adapter); owned.push(manager)
  const tracks = adapter.catalog.tracks.slice(0, 5)
  await manager.provider.play({ kind: 'tracks', tracks: tracks.slice(0, 3), startIndex: 1 })
  adapter.tick(250); await flush(); await manager.refreshQueue()
  expect(manager.getSnapshot().playback.queueTotal).toBe(3)
  await manager.provider.queueAppend([required(tracks[3])])
  expect(manager.getSnapshot().playback.queueTotal).toBe(4)
  expect(manager.getSnapshot().queue.items).toHaveLength(4)
  await manager.provider.play({ kind: 'tracks', tracks: tracks.slice(3), startIndex: 0 })
  adapter.tick(250); await flush()
  expect(manager.getSnapshot().queue.items.map((track) => track.key)).toEqual(tracks.slice(3).map((track) => track.key))
  expect(manager.getSnapshot().playback.queueTotal).toBe(2)
})

test('managed logout notifies session subscribers once and fences native playback', async () => {
  const adapter = createFixtureProvider(); const manager = musicManager(adapter); owned.push(manager)
  const sessions: (Session | null)[] = []
  manager.provider.onSessionChange((session) => { sessions.push(session) })
  await manager.provider.unauthorize()
  expect(sessions).toEqual([null])
  expect(manager.getSnapshot().playback.now).toBeNull()
})

test('station rejection exits loading and does not poison later selection', async () => {
  const h = harness(); h.adapter.stationStart = async () => { throw new Error('Station unavailable') }
  const manager = h.manager()
  await expect(manager.provider.stationStart({ type: 'track', ref: 'song' })).rejects.toThrow('Station unavailable')
  expect(manager.getSnapshot().playback.status).toBe('error')
  await manager.provider.play({ kind: 'tracks', tracks: h.tracks, startIndex: 1 })
  expect(manager.getSnapshot().playback).toMatchObject({ status: 'loading', queueIndex: 1 })
})

test('progressive source mutation cannot change an already accepted playback target', async () => {
  const h = harness(); const gate = deferred<void>(); let submitted: readonly unknown[] = []
  h.adapter.play = async (target) => { await gate.promise; submitted = target?.kind === 'tracks' ? target.tracks : [] }
  const manager = h.manager(); const source = h.tracks.slice(0, 2)
  const playing = manager.provider.play({ kind: 'tracks', tracks: source, startIndex: 1 })
  source.push(required(h.tracks[2]))
  gate.resolve(); await playing
  expect(submitted).toHaveLength(2)
  const intent = manager.getSnapshot().intent
  expect(intent?.target.kind === 'tracks' ? intent.target.tracks.length : 0).toBe(2)
  expect(manager.getSnapshot().playback.queueTotal).toBe(2)
})

test('pause does not strand an in-flight same-context queue read', async () => {
  const h = harness(); const gate = deferred<QueueSnapshot>(); h.adapter.queueRead = () => gate.promise
  const manager = h.manager(); const reading = manager.refreshQueue()
  await manager.provider.pause()
  gate.resolve({ history: [], now: required(h.tracks[0]), next: [] })
  await reading
  expect(manager.getSnapshot().queue.status).toBe('ready')
})

for (const mutation of ['remove', 'reorder'] as const) test(`complete queue ${mutation} recovers and new target hides old items while pending`, async () => {
  const adapter = createFixtureProvider(); const manager = musicManager(adapter); owned.push(manager)
  const tracks = adapter.catalog.tracks.slice(0, 4)
  await manager.provider.play({ kind: 'tracks', tracks: tracks.slice(0, 3), startIndex: 0 })
  adapter.tick(250); await manager.refreshQueue()
  if (mutation === 'remove') await manager.provider.queueRemove([1])
  else await manager.provider.queueReorder(1, 2)
  expect(manager.getSnapshot().playback.queueTotal).toBe(mutation === 'remove' ? 2 : 3)
  const gate = deferred<void>(); adapter.play = () => gate.promise
  const playing = manager.provider.play({ kind: 'tracks', tracks: tracks.slice(2), startIndex: 1 })
  expect(manager.getSnapshot().queue).toEqual({ status: 'loading', items: [], currentIndex: -1 })
  expect(manager.getSnapshot().playback.queueTotal).toBe(2)
  gate.resolve(); await playing
})
