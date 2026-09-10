import { atom, createStore } from 'jotai/vanilla'
import type { MusicProvider, PlaybackState, PlayTarget, ProgressTick, QueueSnapshot, Session, TrackRef } from '@webpod/providers'

/** Accepted application intent is distinct from native audible playback. */
export interface PlaybackIntent {
  readonly generation: number
  readonly target: PlayTarget
  readonly track: TrackRef | null
  readonly index: number | null
  readonly status: 'pending' | 'resolved' | 'rejected'
}
export interface ManagedQueue {
  readonly status: 'idle' | 'loading' | 'ready' | 'error'
  readonly items: readonly TrackRef[]
  readonly currentIndex: number
}
export interface MusicSnapshot {
  readonly playback: PlaybackState
  readonly intent: PlaybackIntent | null
  readonly queue: ManagedQueue
}
const emptyQueue: ManagedQueue = { status: 'idle', items: [], currentIndex: -1 }
const sameTrack = (a: TrackRef | null, b: TrackRef | null): boolean => a !== null && b !== null && (a.key === b.key || a.provider === b.provider && a.catalogId === b.catalogId)
/** Progress can carry a newer native snapshot even when no transport event fired. */
const sameTransport = (a: PlaybackState, b: PlaybackState): boolean => a.status === b.status
  && (a.now === null && b.now === null || sameTrack(a.now, b.now))
  && a.now?.title === b.now?.title && a.now?.artistName === b.now?.artistName
  && a.queueIndex === b.queueIndex && a.queueTotal === b.queueTotal
  && a.shuffle === b.shuffle && a.repeat === b.repeat && a.volume0to100 === b.volume0to100
const sessionKey = (session: Session | null): string | null => session === null ? null : `${session.status}:${session.userIdentifier}`
const cancelled = (): Error => new Error('Playback transport context was superseded')

/** One account-scoped coordinator shared by controls, list selection and tools. */
export interface MusicManager {
  readonly provider: MusicProvider
  getSnapshot(): MusicSnapshot
  subscribe(listener: () => void): () => void
  commitSeek(positionMs: number): Promise<void>
  toggle(fallback: readonly TrackRef[]): Promise<void>
  refreshQueue(): Promise<QueueSnapshot>
  /** Starts the visible prefix in the gesture stack; extends only its still-current confirmed queue. */
  playProgressive(target: Extract<PlayTarget, { readonly kind: 'tracks' }>, completion: Promise<readonly TrackRef[]>): Promise<void>
  /** Invalidates work before an outgoing provider becomes invisible. Reusable after activation. */
  deactivate(): void
  activate(): void
  /** Permanently detaches native observers and invalidates pending work. */
  dispose(): void
}
const managers = new WeakMap<MusicProvider, MusicManager>()

/** Returns the unique manager for either an adapter or its already managed facade. */
export function musicManager(adapter: MusicProvider): MusicManager {
  const existing = managers.get(adapter)
  if (existing) return existing
  const store = createStore()
  const stateAtom = atom<MusicSnapshot>({ playback: adapter.playback, intent: null, queue: emptyQueue })
  let observedTransport = adapter.playback
  let active = true
  let disposed = false
  let epoch = 0
  let generation = 0
  let readSequence = 0
  let queueRevision = 0
  let account = sessionKey(adapter.session)
  let context: readonly TrackRef[] = []
  let contextValid = false
  let counts = new Map<string, number>()
  let uniqueIndices = new Map<string, number>()
  let pendingStarts = 0
  let pauseRequested = false
  let requestedPlaying: boolean | null = null
  let ordered: Promise<void> = Promise.resolve()
  const playbackListeners = new Set<(state: PlaybackState) => void>()
  const progressListeners = new Set<(tick: ProgressTick) => void>()
  const sessionListeners = new Set<(session: Session | null) => void>()
  const waiters = new Set<() => void>()
  let stopProgress: (() => void) | null = null
  const get = (): MusicSnapshot => store.get(stateAtom)
  const publish = (next: MusicSnapshot, emit = true): void => {
    store.set(stateAtom, next)
    if (emit) for (const callback of playbackListeners) callback(next.playback)
    for (const inspect of [...waiters]) inspect()
  }
  const check = (selectedEpoch: number, selectedGeneration?: number): void => {
    if (disposed || !active || epoch !== selectedEpoch || selectedGeneration !== undefined && generation !== selectedGeneration) throw cancelled()
  }
  const clear = (): void => {
    epoch += 1; generation += 1; readSequence += 1
    context = []; contextValid = false; counts.clear(); uniqueIndices.clear(); requestedPlaying = null; pauseRequested = false
    ordered = Promise.resolve()
    publish({ playback: { ...get().playback, now: null, status: 'idle', positionMs: 0, durationMs: 0, queueIndex: null, queueTotal: null }, intent: null, queue: emptyQueue })
  }
  const invalidateContext = (): void => {
    contextValid = false
    if (adapter.playback.queueTotal === undefined) { context = []; counts.clear(); uniqueIndices.clear() }
    publish({ ...get(), playback: { ...get().playback, queueIndex: null, queueTotal: null } })
  }
  const totalFor = (value: PlaybackState): number | null | undefined => {
    if (contextValid && context.length > 0 && value.shuffle === 'off') return context.length
    if (context.length > 0 || value.shuffle !== 'off') return null
    return value.queueTotal
  }
  const observe = (value: PlaybackState): void => {
    if (!active || disposed) return
    if (pauseRequested && (value.status === 'playing' || value.status === 'loading')) return
    observedTransport = value
    const current = get()
    const intent = current.intent
    if (intent && value.status === 'error') {
      publish({ ...current, intent: { ...intent, status: 'rejected' }, playback: { ...current.playback, status: 'error' } })
      return
    }
    if (intent && intent.status !== 'rejected') {
      const matches = intent.track === null ? value.now !== null : sameTrack(value.now, intent.track)
      const occurrenceMatches = intent.index === null || value.queueIndex === intent.index || value.queueIndex === null && (counts.get(intent.track?.catalogId ?? '') ?? 0) === 1
      if (!matches || !occurrenceMatches) return
      const started = value.status === 'playing' && value.positionMs > 0
      const stopped = value.status === 'paused' || value.status === 'stopped'
      if (!started && !stopped && value.status !== 'error') {
        if (intent.track === null && value.now) publish({ ...current, playback: { ...current.playback, now: value.now, durationMs: value.durationMs } })
        return
      }
    }
    if (contextValid && value.now && !counts.has(value.now.catalogId)) { contextValid = false; context = []; counts.clear() }
    const previous = current.playback
    publish({ ...current, intent: null, playback: { ...value, queueIndex: context.length > 0 && (!contextValid || value.shuffle !== 'off') ? null : value.queueIndex ?? (value.now && counts.get(value.now.catalogId) === 1 ? uniqueIndices.get(value.now.catalogId) ?? null : null), queueTotal: totalFor(value) } })
    if (intent !== null || previous.now?.key !== value.now?.key || previous.queueIndex !== value.queueIndex) void refreshQueue().catch(() => undefined)
  }
  let sessionLease = 0
  let stopPlayback: (() => void) | null = null
  let stopSession: (() => void) | null = null
  const bind = (withSession = true): void => {
    const boundEpoch = epoch
    stopPlayback = adapter.onPlaybackChange((value) => { if (epoch === boundEpoch) observe(value) })
    if (!withSession) return
    const lease = ++sessionLease
    stopSession = adapter.onSessionChange((value) => {
      if (lease !== sessionLease || !active || disposed) return
      const nextAccount = sessionKey(value)
      if (nextAccount !== account) {
        account = nextAccount
        stopPlayback?.(); stopProgress?.(); stopProgress = null
        clear(); bind(false); startProgress()
      }
      for (const callback of sessionListeners) callback(value)
    })
  }
  const startProgress = (): void => {
    if (stopProgress || !active || disposed) return
    const boundEpoch = epoch
    stopProgress = adapter.onProgress((tick) => {
      if (!active || disposed || boundEpoch !== epoch) return
      // O(1): selection occurrence counts are indexed once on play, never per tick.
      const native = adapter.playback
      if (get().intent || !sameTransport(observedTransport, native)) observe(native)
      if (get().intent) return
      const current = get()
      publish({ ...current, playback: { ...current.playback, positionMs: tick.positionMs, durationMs: tick.durationMs } }, false)
      for (const callback of progressListeners) callback(tick)
    })
  }
  function refreshQueue(): Promise<QueueSnapshot> {
    const selectedEpoch = epoch; const selectedRead = ++readSequence
    try { check(selectedEpoch) } catch (error) { return Promise.reject(error) }
    if (!adapter.supports('queueRead')) return Promise.resolve({ history: [], now: null, next: [] })
    publish({ ...get(), queue: { ...get().queue, status: 'loading' } }, false)
    return adapter.queueRead().then((snapshot) => {
      check(selectedEpoch)
      if (selectedRead !== readSequence) return snapshot
      const items = [...snapshot.history, ...(snapshot.now ? [snapshot.now] : []), ...snapshot.next]
      const current = get()
      const total = totalFor({ ...current.playback, queueTotal: adapter.playback.queueTotal })
      const index = current.playback.queueIndex ?? (total === undefined && snapshot.now ? snapshot.history.length : null)
      publish({ ...current, queue: { status: 'ready', items, currentIndex: snapshot.now ? snapshot.history.length : -1 }, playback: { ...current.playback, queueTotal: total === undefined ? items.length || null : total, queueIndex: index } })
      return snapshot
    }, (error: unknown) => {
      if (active && !disposed && selectedEpoch === epoch && selectedRead === readSequence) publish({ ...get(), queue: { ...get().queue, status: 'error' } }, false)
      throw error
    })
  }
  /** Ordered non-superseding work cannot outlive the selection that admitted it. */
  const enqueue = (work: (guard: () => void) => Promise<void>): Promise<void> => {
    const selectedEpoch = epoch; const selectedGeneration = generation
    const next = ordered.catch(() => undefined).then(async () => { check(selectedEpoch, selectedGeneration); await work(() => check(selectedEpoch, selectedGeneration)); check(selectedEpoch, selectedGeneration) })
    ordered = next.catch(() => undefined)
    return next
  }
  const mutateQueue = (work: (guard: () => void) => Promise<void>): Promise<void> => {
    queueRevision += 1
    for (const inspect of [...waiters]) inspect()
    return enqueue(work)
  }
  const waitUntilReady = (): Promise<void> => {
    const selectedEpoch = epoch; const selectedGeneration = generation
    return new Promise((resolve, reject) => {
      const inspect = (): void => {
        try {
          check(selectedEpoch, selectedGeneration)
          if (adapter.playback.status === 'loading') return
          waiters.delete(inspect)
          if (!adapter.playback.now || adapter.playback.status === 'error') reject(new Error('Playback is unavailable'))
          else resolve()
        } catch (error) { waiters.delete(inspect); reject(error) }
      }
      waiters.add(inspect); inspect()
    })
  }
  /** New target and pause supersede outstanding native confirmation immediately. */
  const play = (target?: PlayTarget): Promise<void> => {
    const selectedEpoch = epoch
    try { check(selectedEpoch) } catch (error) { return Promise.reject(error) }
    if (target?.kind === 'tracks') {
      const index = target.startIndex ?? 0
      if (!Number.isInteger(index) || index < 0 || index >= target.tracks.length) return Promise.reject(new RangeError('Playback selection is outside the track list'))
    }
    target = target?.kind === 'tracks' ? { ...target, tracks: [...target.tracks] } : target
    const selectedGeneration = ++generation
    pauseRequested = false
    readSequence += 1; requestedPlaying = true; ordered = Promise.resolve()
    if (target) {
      const index = target.kind === 'tracks' ? target.startIndex ?? 0 : null
      context = target.kind === 'tracks' ? [...target.tracks] : []
      contextValid = context.length > 0
      counts = new Map(); uniqueIndices = new Map()
      for (const [index, track] of context.entries()) {
        counts.set(track.catalogId, (counts.get(track.catalogId) ?? 0) + 1)
        uniqueIndices.set(track.catalogId, index)
      }
      const track = index === null ? null : context[index] ?? null
      publish({ ...get(), queue: { status: 'loading', items: [], currentIndex: -1 }, intent: { generation: selectedGeneration, target, track, index, status: 'pending' }, playback: { ...get().playback, status: 'loading', now: track, queueIndex: index, queueTotal: context.length || null, positionMs: 0, durationMs: track?.durationMs ?? 0 } })
    }
    // Invoke synchronously: Spotify activateElement must remain in the trusted gesture stack.
    let operation: Promise<void>
    pendingStarts += 1
    try { operation = adapter.play(target) } catch (error) { operation = Promise.reject(error) }
    return operation.then(async () => {
      if (active && !disposed && epoch === selectedEpoch && generation !== selectedGeneration && pauseRequested) await adapter.pause()
      check(selectedEpoch, selectedGeneration)
      const intent = get().intent
      if (intent?.generation === selectedGeneration) publish({ ...get(), intent: { ...intent, status: 'resolved' } })
      observe(adapter.playback)
    }, (error: unknown) => {
      if (active && !disposed && epoch === selectedEpoch && generation === selectedGeneration) {
        const intent = get().intent
        publish({ ...get(), intent: intent ? { ...intent, status: 'rejected' } : null, playback: { ...get().playback, status: 'error' } })
      }
      throw error
    }).finally(() => { pendingStarts -= 1; if (pendingStarts === 0) pauseRequested = false; if (generation === selectedGeneration) requestedPlaying = null })
  }
  const pause = (): Promise<void> => {
    const selectedEpoch = epoch
    try { check(selectedEpoch) } catch (error) { return Promise.reject(error) }
    const selectedGeneration = ++generation
    pauseRequested = true; requestedPlaying = false; ordered = Promise.resolve()
    publish({ ...get(), intent: null })
    const operation = adapter.pause().then(() => { check(selectedEpoch, selectedGeneration); observe(adapter.playback) }).finally(() => { if (pendingStarts === 0) pauseRequested = false; if (generation === selectedGeneration) requestedPlaying = null })
    ordered = operation.catch(() => undefined)
    return operation
  }
  const provider: MusicProvider = {
    ...adapter,
    get session() { return adapter.session },
    get playback() {
      const current = get()
      const native = adapter.playback
      return current.intent === null && active && current.playback.status === 'playing' && native.status === 'playing' && sameTrack(current.playback.now, native.now)
        ? { ...current.playback, positionMs: native.positionMs, durationMs: native.durationMs }
        : current.playback
    },
    onSessionChange(callback) { sessionListeners.add(callback); return () => { sessionListeners.delete(callback) } },
    onPlaybackChange(callback) { playbackListeners.add(callback); return () => { playbackListeners.delete(callback) } },
    onProgress(callback) { progressListeners.add(callback); return () => { progressListeners.delete(callback) } },
    play, pause,
    skip: (direction, count) => enqueue(async (guard) => { await waitUntilReady(); guard(); publish({ ...get(), intent: null }); await adapter.skip(direction, count); guard(); observe(adapter.playback) }),
    seek: (ms) => enqueue(async (guard) => { await adapter.seek(ms); guard(); observe(adapter.playback) }),
    setVolume: (level) => enqueue(async (guard) => { await adapter.setVolume(level); guard(); observe(adapter.playback) }),
    setShuffle: (mode) => enqueue(async (guard) => { await adapter.setShuffle(mode); guard(); observe(adapter.playback) }),
    setRepeat: (mode) => enqueue(async (guard) => { await adapter.setRepeat(mode); guard(); observe(adapter.playback) }),
    queueRead: refreshQueue,
    queueAppend: (tracks) => mutateQueue(async (guard) => { if (!adapter.supports('queueAppend')) return adapter.queueAppend(tracks); if (tracks.length > 0) invalidateContext(); await adapter.queueAppend(tracks); guard(); observe(adapter.playback); await refreshQueue() }),
    queueInsertNext: (tracks) => mutateQueue(async (guard) => { if (!adapter.supports('queueInsertNext')) return adapter.queueInsertNext(tracks); if (tracks.length > 0) invalidateContext(); await adapter.queueInsertNext(tracks); guard(); observe(adapter.playback); await refreshQueue() }),
    queueRemove: (positions) => mutateQueue(async (guard) => { await adapter.queueRemove(positions); guard(); invalidateContext(); await refreshQueue() }),
    queueReorder: (from, to) => mutateQueue(async (guard) => { await adapter.queueReorder(from, to); guard(); invalidateContext(); await refreshQueue() }),
    async stationStart(seed) {
      const selectedEpoch = epoch
      check(selectedEpoch)
      const selectedGeneration = ++generation
      pauseRequested = false; requestedPlaying = true; ordered = Promise.resolve()
      context = []; contextValid = false; counts.clear(); readSequence += 1
      publish({ ...get(), intent: null, playback: { ...get().playback, status: 'loading', queueIndex: null, queueTotal: null } })
      try {
        const station = await adapter.stationStart(seed)
        check(selectedEpoch, selectedGeneration)
        observe(adapter.playback)
        return station
      } catch (error) {
        if (active && !disposed && epoch === selectedEpoch && generation === selectedGeneration) publish({ ...get(), playback: { ...get().playback, status: 'error' } })
        throw error
      } finally { if (generation === selectedGeneration) requestedPlaying = null }
    },
    async unauthorize() {
      manager.deactivate()
      const selectedEpoch = epoch
      try { await adapter.unauthorize() } catch (error) {
        if (!disposed && epoch === selectedEpoch) manager.activate()
        throw error
      }
      if (!disposed && epoch === selectedEpoch) {
        account = sessionKey(adapter.session)
        for (const callback of sessionListeners) callback(adapter.session)
      }
    },
  }
  const manager: MusicManager = {
    provider, getSnapshot: get, subscribe: (listener) => store.sub(stateAtom, listener), refreshQueue,
    playProgressive(target, completion) {
      const prefix = [...target.tracks]
      const started = play({ ...target, tracks: prefix })
      const selectedEpoch = epoch; const selectedGeneration = generation; const selectedQueueRevision = queueRevision
      const guard = (): void => {
        check(selectedEpoch, selectedGeneration)
        if (queueRevision !== selectedQueueRevision) throw cancelled()
      }
      void Promise.all([started, completion]).then(async ([, complete]) => {
        guard()
        if (!adapter.supports('queueAppend') || complete.length <= prefix.length || !prefix.every((track, index) => sameTrack(track, complete[index] ?? null))) return
        const tail = complete.slice(prefix.length)
        // Command acceptance is insufficient: wait until the matching selection
        // has actually started, or was confirmed paused by the native provider.
        await new Promise<void>((resolve, reject) => {
          const inspect = (): void => {
            try {
              guard()
              const snapshot = get()
              if (snapshot.playback.status === 'error') throw new Error('Playback is unavailable')
              if (snapshot.intent !== null || snapshot.playback.status === 'loading') return
              if (!contextValid) throw cancelled()
              waiters.delete(inspect); resolve()
            } catch (error) { waiters.delete(inspect); reject(error) }
          }
          waiters.add(inspect); inspect()
        })
        let invalidated = false
        try {
          for (const track of tail) {
            await enqueue(async () => {
              guard()
              // Appending can partially succeed and native queue snapshots may
              // be incomplete. Stop claiming the original ordered total.
              if (!invalidated) { invalidateContext(); invalidated = true }
              // One accepted remote request cannot be undone. Single-item calls
              // let supersession prevent every remaining append in the suffix.
              await adapter.queueAppend([track])
              guard()
            })
            // Re-enter the command queue for each item so foreground seek,
            // volume and skip commands can run between remote appends.
          }
        } finally {
          guard()
          if (invalidated) await enqueue(async () => {
            guard()
            observe(adapter.playback)
            await refreshQueue()
          })
        }
      }).catch(() => { /* Failed/stale tail loading must not stop the audible prefix. */ })
      return started
    },
    commitSeek: (ms) => enqueue(async (guard) => { const resume = get().playback.status === 'paused'; await adapter.seek(ms); guard(); if (resume) { pauseRequested = false; await adapter.play(); guard() } observe(adapter.playback) }),
    toggle: (fallback) => {
      if (requestedPlaying === null && get().intent === null) observe(adapter.playback)
      return (requestedPlaying ?? (get().playback.status === 'playing' || get().playback.status === 'loading')) ? pause() : play(get().playback.now ? undefined : { kind: 'tracks', tracks: fallback, startIndex: 0 })
    },
    deactivate() {
      if (active && adapter.session?.status === 'authorized' && adapter.supports('transport')) void adapter.pause().catch(() => undefined)
      active = false; sessionLease += 1; stopPlayback?.(); stopSession?.(); stopPlayback = null; stopSession = null; stopProgress?.(); stopProgress = null; clear() },
    activate() { if (disposed) throw cancelled(); if (active) return; active = true; account = sessionKey(adapter.session); bind(); observe(adapter.playback); startProgress() },
    dispose() { if (disposed) return; manager.deactivate(); active = false; disposed = true; stopPlayback?.(); stopSession?.(); stopProgress?.(); stopProgress = null; clear(); playbackListeners.clear(); progressListeners.clear(); sessionListeners.clear(); managers.delete(adapter); managers.delete(provider) },
  }
  bind(); startProgress()
  managers.set(adapter, manager); managers.set(provider, manager)
  return manager
}

/** Application-facing provider; every production control receives this same facade. */
export const manageMusic = (adapter: MusicProvider): MusicProvider => musicManager(adapter).provider
