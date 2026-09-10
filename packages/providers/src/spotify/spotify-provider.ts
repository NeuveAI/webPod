/// <reference types="spotify-web-playback-sdk" />
import { z } from 'zod'
import type { MusicProvider } from '../provider'
import type { PlaybackState, ProgressTick, Session } from '../domain'
import type { AlbumRef, TrackRef } from '../identity'
import { createStubProvider } from '../stub'
import { SPOTIFY_SUPPORTS, SPOTIFY_UNSUPPORTED_REASONS } from './matrix'
import { createSpotifyApi, pageSchema, recordSchema } from './api'

let sdkLoading: Promise<void> | null = null
/** Loads the official SDK once, on Spotify selection only; failures remain retryable. */
function loadSdk(): Promise<void> {
  if (window.Spotify) return Promise.resolve()
  if (sdkLoading) return sdkLoading
  sdkLoading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    const timer = setTimeout(() => {
      script.remove()
      sdkLoading = null
      reject(
        new Error('Spotify player took too long to load. Please try again.'),
      )
    }, 20000)
    window.onSpotifyWebPlaybackSDKReady = () => {
      clearTimeout(timer)
      resolve()
    }
    script.src = 'https://sdk.scdn.co/spotify-player.js'
    script.onerror = () => {
      clearTimeout(timer)
      script.remove()
      sdkLoading = null
      reject(new Error('Could not load the Spotify player.'))
    }
    document.head.append(script)
  })
  return sdkLoading
}

/** Spotify library and Connect playback adapter. The server owns OAuth and refresh credentials. */
export function createSpotifyProvider(): MusicProvider {
  const api = createSpotifyApi()
  const relationshipCursors = new Map<string, { readonly owner: string; readonly generation: number; readonly path: string }>()
  /** Opaque, bounded cursors cannot be replayed against a different relationship. */
  const relationshipPage = async (owner: string, path: string, options: import('../provider').RelationshipPageOptions, maximum: number) => {
    if (!Number.isInteger(options.limit) || options.limit < 1) throw new Error('Invalid relationship page limit')
    const cursor = options.cursor === undefined ? undefined : relationshipCursors.get(options.cursor)
    if (options.cursor !== undefined && (cursor?.owner !== owner || cursor.generation !== lifecycle)) throw new Error('Invalid Spotify relationship cursor')
    const generation = lifecycle
    const url = new URL(cursor?.path ?? path, 'https://api.spotify.com/v1/')
    url.searchParams.set('limit', String(Math.min(maximum, options.limit)))
    const page = pageSchema.parse(await api.request(url.href, 'GET', undefined, 'json', options))
    if (generation !== lifecycle) throw new DOMException('Account changed', 'AbortError')
    let next: string | null = null
    if (page.next !== null) {
      const nextUrl = new URL(page.next, 'https://api.spotify.com/v1/')
      if (nextUrl.origin !== url.origin || nextUrl.pathname !== url.pathname || nextUrl.href === url.href) throw new Error('Invalid Spotify relationship continuation')
      next = crypto.randomUUID()
      relationshipCursors.set(next, { owner, generation, path: nextUrl.href })
      if (relationshipCursors.size > 512) { const oldest = relationshipCursors.keys().next().value; if (oldest !== undefined) relationshipCursors.delete(oldest) }
    }
    return { ...page, next }
  }
  let session: Session | null = null
  let lifecycle = 0
  let player: Spotify.Player | null = null
  let device: string | null = null
  let connecting: Promise<void> | null = null
  let state: PlaybackState = {
    status: 'idle',
    now: null,
    queueIndex: null,
    positionMs: 0,
    durationMs: 0,
    volume0to100: 70,
    shuffle: 'off',
    repeat: 'off',
  }
  let changedAt = Date.now()
  let submittedTracks: readonly TrackRef[] = []
  let submittedIndex: number | null = null
  let currentUid: string | null = null
  let playGeneration = 0
  let observationRevision = 0
  let pollPending = false
  let progressTicks = 0
  const sessions = new Set<(s: Session | null) => void>()
  const playback = new Set<(s: PlaybackState) => void>()
  const progress = new Set<(p: ProgressTick) => void>()
  let timer: ReturnType<typeof setInterval> | null = null
  const publish = (next: PlaybackState) => {
    state = next
    changedAt = Date.now()
    for (const cb of playback) cb(state)
  }
  const position = () =>
    Math.min(
      state.durationMs,
      state.positionMs +
        (state.status === 'playing' ? Date.now() - changedAt : 0),
    )
  const sdkTrack = (track: Spotify.Track): TrackRef | null => {
    if (!track.id || track.type !== 'track') return null
    const artists = track.artists.map((artist) => ({
      ...artist,
      id: artist.uri.split(':').at(-1) ?? '',
    }))
    const originalId = track.linked_from?.id
    const selected = submittedTracks.find(
      (ref) => ref.catalogId === track.id || ref.catalogId === originalId,
    )
    const mapped = api.track({
      ...track,
      album: {
        ...track.album,
        id: track.album.uri.split(':').at(-1) ?? '',
        artists,
      },
      artists,
    })
    // Spotify may play a market-specific replacement. Preserve the selected identity
    // using its explicit linked_from relationship, never a title/artist guess.
    return selected
      ? { ...mapped, key: selected.key, catalogId: selected.catalogId }
      : mapped
  }

  function observe(value: Spotify.PlaybackState | null): void {
    observationRevision += 1
    if (!value) {
      publish({ ...state, status: 'stopped' })
      return
    }
    const sdkNow = value.track_window.current_track
    const now = sdkNow ? sdkTrack(sdkNow) : null
    let queueIndex: number | null = null
    if (now && submittedTracks.length) {
      const matches = (index: number) =>
        submittedTracks[index]?.catalogId === now.catalogId
      const previousIndex = state.queueIndex
      if (submittedIndex !== null && matches(submittedIndex)) {
        queueIndex = submittedIndex
        submittedIndex = null
      } else if (
        previousIndex !== null &&
        sdkNow?.uid === currentUid &&
        matches(previousIndex)
      ) {
        queueIndex = previousIndex
      } else {
        const indices = submittedTracks.flatMap((track, index) =>
          track.catalogId === now.catalogId ? [index] : [],
        )
        if (indices.length === 1) queueIndex = indices[0] ?? null
        // A changed SDK occurrence UID plus the preceding window identifies an
        // adjacent duplicate, whereas title/ID alone cannot distinguish repeats.
        else if (
          previousIndex !== null &&
          sdkNow?.uid !== currentUid &&
          value.track_window.previous_tracks?.at(-1)?.uid === currentUid &&
          matches(previousIndex + 1)
        )
          queueIndex = previousIndex + 1
      }
    }
    currentUid = sdkNow?.uid ?? null
    publish({
      ...state,
      status: value.loading ? 'loading' : value.paused ? 'paused' : 'playing',
      now,
      queueIndex,
      positionMs: value.position,
      durationMs: value.duration,
      shuffle: value.shuffle ? 'songs' : 'off',
      repeat:
        value.repeat_mode === 1
          ? 'all'
          : value.repeat_mode === 2
            ? 'one'
            : 'off',
    })
  }

  /** Reconcile missed SDK events without adding Web API polling or overlapping reads. */
  async function reconcilePlayback(): Promise<void> {
    if (!player || !device || pollPending) return
    const observedPlayer = player
    const revision = observationRevision
    pollPending = true
    try {
      const observed = await observedPlayer.getCurrentState()
      if (player === observedPlayer && revision === observationRevision)
        observe(observed)
    } catch {
      /* A later SDK event or read can recover a transient failure. */
    } finally {
      pollPending = false
    }
  }

  async function connect() {
    if (device && player) return
    if (connecting) return connecting
    const generation = lifecycle
    connecting = (async () => {
      await loadSdk()
      if (generation !== lifecycle)
        throw new Error('Spotify connection was cancelled.')
      await new Promise<void>((resolve, reject) => {
        player?.disconnect()
        const next = new window.Spotify.Player({
          name: 'webPod',
          volume: state.volume0to100 / 100,
          getOAuthToken: (cb) => {
            void api
              .accessToken()
              .then((token) => {
                if (token) cb(token)
                else reject(new Error('Please sign in to Spotify again.'))
              })
              .catch(() =>
                reject(new Error('Spotify session could not be refreshed.')),
              )
          },
        })
        player = next
        const timeout = setTimeout(() => {
          next.disconnect()
          device = null
          reject(new Error('Spotify player did not connect. Please try again.'))
        }, 25000)
        const fail = (message: string) => {
          clearTimeout(timeout)
          publish({ ...state, status: 'error' })
          reject(new Error(message))
        }
        next.addListener('ready', ({ device_id }) => {
          if (generation !== lifecycle) {
            clearTimeout(timeout)
            next.disconnect()
            reject(new Error('Spotify connection was cancelled.'))
            return
          }
          device = device_id
          clearTimeout(timeout)
          resolve()
        })
        next.addListener('not_ready', () => {
          device = null
          publish({ ...state, status: 'stopped' })
        })
        next.addListener('initialization_error', () =>
          fail('This browser could not initialize Spotify playback.'),
        )
        next.addListener('authentication_error', () =>
          fail('Spotify session expired. Please sign in again.'),
        )
        next.addListener('account_error', () => {
          if (session) {
            session = { ...session, canPlay: false }
            for (const cb of sessions) cb(session)
          }
          fail('Spotify Premium is required to play music.')
        })
        next.addListener('playback_error', () =>
          publish({ ...state, status: 'error' }),
        )
        next.addListener('player_state_changed', observe)
        void next
          .connect()
          .then((ok) => {
            if (!ok) fail('Spotify could not connect this player.')
          })
          .catch(() => fail('Spotify could not connect this player.'))
      })
    })().finally(() => {
      connecting = null
    })
    return connecting
  }
  const id = (value: string) => encodeURIComponent(value)
  const uri = (ref: { kind: string; catalogId: string }) =>
    `spotify:${ref.kind}:${ref.catalogId}`
  const cursors = new Map<string, string>()
  async function listing(path: string) {
    return pageSchema.parse(await api.request(path))
  }
  async function all(path: string): Promise<unknown[]> {
    const items: unknown[] = []
    const seen = new Set<string>()
    let next: string | null = path
    while (next) {
      if (seen.has(next) || seen.size > 1000)
        throw new Error('Spotify pagination did not terminate')
      seen.add(next)
      const page = await listing(next)
      items.push(...page.items)
      next = page.next
    }
    return items
  }
  const base = createStubProvider({
    id: 'spotify',
    displayName: 'Spotify',
    supports: SPOTIFY_SUPPORTS,
    unsupportedReasons: SPOTIFY_UNSUPPORTED_REASONS,
  })
  const provider: MusicProvider = {
    ...base,
    get session() {
      return session
    },
    get playback() {
      // The panel and tools reread this snapshot on progress notifications.
      // Keep the SDK anchor unchanged so interpolation never compounds.
      return { ...state, positionMs: position(), queueTotal: null }
    },
    async configure() {
      const generation = lifecycle
      const access = await api.accessToken()
      if (!access || generation !== lifecycle) return
      const user = z
        .object({ id: z.string(), product: z.string().optional() })
        .parse(await api.request('me'))
      if (generation !== lifecycle) return
      session = {
        provider: 'spotify',
        status: 'authorized',
        userIdentifier: user.id,
        storefront: null,
        canPlay: user.product === undefined || user.product === 'premium',
        expiresAt: null,
      }
      for (const cb of sessions) cb(session)
      if (session.canPlay) await connect()
    },
    async authorize() {
      window.location.assign('/api/spotify/login')
      throw new Error('Redirecting to Spotify')
    },
    async unauthorize() {
      const response = await fetch('/api/spotify/logout', { method: 'POST' })
      if (!response.ok)
        throw new Error('Could not sign out of Spotify. Please try again.')
      lifecycle += 1
      player?.disconnect()
      player = null
      device = null
      api.clear()
      session = null
      cursors.clear(); relationshipCursors.clear()
      submittedTracks = []
      submittedIndex = null
      currentUid = null
      observationRevision += 1
      publish({
        ...state,
        status: 'idle',
        now: null,
        positionMs: 0,
        durationMs: 0,
      })
      for (const cb of sessions) cb(null)
    },
    onSessionChange(cb) {
      sessions.add(cb)
      return () => {
        sessions.delete(cb)
      }
    },
    onPlaybackChange(cb) {
      playback.add(cb)
      return () => {
        playback.delete(cb)
      }
    },
    onProgress(cb) {
      progress.add(cb)
      timer ??= setInterval(() => {
        if (++progressTicks % 8 === 0) void reconcilePlayback()
        for (const listener of progress)
          listener({
            positionMs: position(),
            durationMs: state.durationMs,
            interpolated: true,
          })
      }, 250)
      return () => {
        progress.delete(cb)
        if (!progress.size && timer) {
          clearInterval(timer)
          timer = null
        }
      }
    },
    async libraryList(kind, cursor, options) {
      const paths = {
        playlists: 'me/playlists?limit=50',
        albums: 'me/albums?limit=50',
        songs: 'me/tracks?limit=50',
        artists: 'me/following?type=artist&limit=50',
      }
      if (kind === 'genres' || kind === 'composers')
        return { items: [], next: null, total: 0 }
      if (cursor && cursors.get(cursor) !== kind)
        throw new Error('Invalid Spotify library cursor')
      const url = new URL(cursor ?? paths[kind], 'https://api.spotify.com/v1/')
      url.searchParams.set('limit', String(Math.min(50, Math.max(1, options?.limit ?? 50))))
      const raw = await api.request(url.href, 'GET', undefined, 'json', options)
      const page = pageSchema.parse(
        kind === 'artists' ? recordSchema.parse(raw)['artists'] : raw,
      )
      if (page.next) cursors.set(page.next, kind)
      const items = kind === 'playlists'
        ? api.playlists(page.items, session?.userIdentifier ?? null)
        : page.items
        .filter((v) => v !== null)
        .map((v) =>
          kind === 'songs'
            ? api.track(recordSchema.parse(v)['track'])
            : kind === 'albums'
              ? api.album(recordSchema.parse(v)['album'])
              : api.artist(v),
        )
      return { items, next: page.next, total: page.total ?? null }
    },
    async relatedTracksPage(ref, options) {
      const page = await relationshipPage(`${ref.kind}:${ref.catalogId}`, ref.kind === 'album' ? `albums/${id(ref.catalogId)}/tracks` : `playlists/${id(ref.catalogId)}/items`, options, 50)
      const items = page.items.flatMap((value) => {
        if (value === null) return []
        const item = ref.kind === 'playlist' ? (recordSchema.parse(value)['item'] ?? recordSchema.parse(value)['track']) : value
        if (!item) return []
        const parsed = recordSchema.parse(item)
        if (parsed['type'] === 'episode' || parsed['is_local'] === true || !parsed['id']) return []
        const track = api.track(item)
        return [ref.kind === 'album' ? { ...track, albumName: ref.title, artwork: ref.artwork } : track]
      })
      return { items, next: page.next, total: page.total ?? null }
    },
    async relatedAlbumsPage(ref, options) {
      const page = await relationshipPage(`artist:${ref.catalogId}`, `artists/${id(ref.catalogId)}/albums?include_groups=album,single`, options, 10)
      return { items: page.items.map(api.album), next: page.next, total: page.total ?? null }
    },
    async relatedTracks(ref) {
      const values = await all(
        ref.kind === 'album'
          ? `albums/${id(ref.catalogId)}/tracks?limit=50`
          : `playlists/${id(ref.catalogId)}/items?limit=50`,
      )
      return values.flatMap((value) => {
        const item =
          ref.kind === 'playlist'
            ? (recordSchema.parse(value)['item'] ??
              recordSchema.parse(value)['track'])
            : value
        if (!item) return []
        const parsed = recordSchema.parse(item)
        if (
          parsed['type'] === 'episode' ||
          parsed['is_local'] === true ||
          !parsed['id']
        )
          return []
        const track = api.track(item)
        // Album-track responses omit the album object; keep the known parent
        // metadata available before the SDK reports its current track.
        return [ref.kind === 'album' ? { ...track, albumName: ref.title, artwork: ref.artwork } : track]
      })
    },
    async relatedAlbums(ref, options) {
      const albums = new Map<string, AlbumRef>()
      const seen = new Set<string>()
      let next: string | null = `artists/${id(ref.catalogId)}/albums?limit=10&include_groups=album,single`
      while (next) {
        options?.signal?.throwIfAborted()
        if (seen.has(next) || seen.size >= 1000) throw new Error('Spotify pagination did not terminate')
        seen.add(next)
        const page = await listing(next)
        options?.signal?.throwIfAborted()
        for (const item of page.items) { const album = api.album(item); albums.set(album.catalogId, album) }
        options?.onPage?.([...albums.values()])
        next = page.next
      }
      return [...albums.values()]
    },
    async search(query) {
      if (query.scope === 'library') {
        const kinds = ['songs', 'albums', 'artists', 'playlists'] as const
        const pages = await Promise.all(
          kinds.map(async (kind) => {
            const items = []
            let cursor: string | undefined
            do {
              const page = await provider.libraryList(kind, cursor)
              items.push(...page.items)
              cursor = page.next ?? undefined
            } while (cursor)
            return items
          }),
        )
        const matches = pages
          .flat()
          .filter((v) =>
            ('title' in v ? v.title : v.name)
              .toLowerCase()
              .includes(query.term.toLowerCase()),
          )
        return {
          tracks: matches.filter((v) => v.kind === 'track'),
          albums: matches.filter((v) => v.kind === 'album'),
          artists: matches.filter((v) => v.kind === 'artist'),
          playlists: matches.filter((v) => v.kind === 'playlist'),
          stations: [],
          next: null,
        }
      }
      const types = query.kinds.filter((k) =>
        ['track', 'album', 'artist', 'playlist'].includes(k),
      )
      if (!types.length)
        return {
          tracks: [],
          albums: [],
          artists: [],
          playlists: [],
          stations: [],
          next: null,
        }
      const raw = recordSchema.parse(
        await api.request(
          `search?${new URLSearchParams({ q: query.term, type: types.join(','), limit: String(Math.min(query.limit ?? 10, 10)) })}`,
        ),
      )
      const items = (kind: string) =>
        raw[kind]
          ? pageSchema.parse(raw[kind]).items.filter((v) => v !== null)
          : []
      return {
        tracks: items('tracks').map(api.track),
        albums: items('albums').map(api.album),
        artists: items('artists').map(api.artist),
        playlists: api.playlists(items('playlists'), session?.userIdentifier ?? null),
        stations: [],
        next: null,
      }
    },
    async prepare() {},
    async play(target) {
      const selectedPlay = ++playGeneration
      const selectedLifecycle = lifecycle
      const isCurrent = () => selectedPlay === playGeneration && selectedLifecycle === lifecycle
      // Start activation in the gesture stack before awaiting Connect readiness.
      const activation = player?.activateElement()
      await activation
      if (!isCurrent()) return
      await connect()
      if (!isCurrent()) return
      if (!device || !player) throw new Error('Spotify player is not ready.')
      if (session?.canPlay === false)
        throw new Error('Spotify Premium is required to play music.')
      if (!target && state.now === null) return
      if (!target) {
        await api.command(`me/player/play?device_id=${id(device)}`, 'PUT')
        return
      }
      if (target.kind === 'station')
        throw new Error('Spotify does not offer radio.')
      const body =
        target.kind === 'tracks'
          ? {
              uris: target.tracks.map(uri),
              offset: { position: target.startIndex ?? 0 },
            }
          : {
              context_uri: uri(
                target.kind === 'album' ? target.album : target.playlist,
              ),
            }
      if (target.kind === 'tracks' && !target.tracks.length) return
      submittedTracks = target.kind === 'tracks' ? target.tracks : []
      submittedIndex =
        target.kind === 'tracks' ? (target.startIndex ?? 0) : null
      currentUid = null
      observationRevision += 1
      publish({ ...state, status: 'loading', queueIndex: null })
      try {
        await api.command(`me/player/play?device_id=${id(device)}`, 'PUT', body)
      } catch (cause) {
        if (isCurrent()) publish({ ...state, status: 'error' })
        throw cause
      }
    },
    async pause() {
      playGeneration += 1
      if (player && device) await player.pause()
    },
    async skip(direction, count = 1) {
      if (!player) return
      if (direction === 'previous' && position() > 3000) {
        await player.seek(0)
        return
      }
      observationRevision += 1
      for (let n = 0; n < Math.min(100, Math.max(1, count)); n++)
        await (direction === 'next'
          ? player.nextTrack()
          : player.previousTrack())
      await reconcilePlayback()
    },
    async seek(ms) {
      if (player) {
        const next = Math.max(0, Math.min(state.durationMs, ms))
        await player.seek(next)
        publish({ ...state, positionMs: next })
      }
    },
    async setVolume(level) {
      const volume = Math.min(100, Math.max(0, level))
      if (player) await player.setVolume(volume / 100)
      publish({ ...state, positionMs: position(), volume0to100: volume })
    },
    async setShuffle(mode) {
      if (mode === 'albums')
        throw new Error('Spotify supports song shuffle only.')
      await connect()
      await api.command(
        `me/player/shuffle?state=${mode !== 'off'}&device_id=${id(device ?? '')}`,
        'PUT',
      )
      publish({ ...state, positionMs: position(), shuffle: mode })
    },
    async setRepeat(mode) {
      await connect()
      await api.command(
        `me/player/repeat?state=${mode === 'one' ? 'track' : mode === 'all' ? 'context' : 'off'}&device_id=${id(device ?? '')}`,
        'PUT',
      )
      publish({ ...state, positionMs: position(), repeat: mode })
    },
    async queueRead() {
      const raw = z
        .object({ currently_playing: z.unknown(), queue: z.array(z.unknown()) })
        .parse(await api.request('me/player/queue'))
      const isTrack = (value: unknown): boolean => recordSchema.safeParse(value).data?.['type'] === 'track'
      return {
        now: isTrack(raw.currently_playing) ? api.track(raw.currently_playing) : null,
        next: raw.queue.filter(isTrack).map(api.track),
        history: [],
      }
    },
    async queueAppend(tracks) {
      await connect()
      for (const track of tracks)
        await api.command(
          `me/player/queue?uri=${id(uri(track))}&device_id=${id(device ?? '')}`,
          'POST',
        )
    },
    async libraryAdd(ref) {
      await api.request(`me/library?uris=${id(uri(ref))}`, 'PUT')
    },
    async libraryRemove(ref) {
      await api.request(`me/library?uris=${id(uri(ref))}`, 'DELETE')
    },
    async saveToggle(ref, saved) {
      await (saved ? provider.libraryAdd(ref) : provider.libraryRemove(ref))
    },
    async playlistCreate(input) {
      const raw = await api.request('me/playlists', 'POST', {
        name: input.name,
        description: input.description ?? '',
        public: false,
      })
      const ref = api.playlist(raw, session?.userIdentifier ?? null)
      if (input.tracks?.length)
        await provider.playlistAddTracks(ref, input.tracks)
      return ref
    },
    async playlistAddTracks(ref, tracks) {
      for (let i = 0; i < tracks.length; i += 100)
        await api.request(`playlists/${id(ref.catalogId)}/items`, 'POST', {
          uris: tracks.slice(i, i + 100).map(uri),
        })
    },
    async playlistRemoveTracks(ref, positions) {
      const path = `playlists/${id(ref.catalogId)}`
      const before = z
        .object({ snapshot_id: z.string() })
        .parse(await api.request(path))
      const items = await all(`${path}/items?limit=50`)
      const after = z
        .object({ snapshot_id: z.string() })
        .parse(await api.request(path))
      if (before.snapshot_id !== after.snapshot_id)
        throw new Error('Playlist changed. Refresh and try again.')
      const removals = positions.map((position) => {
        if (!Number.isInteger(position) || position < 0)
          throw new Error('Invalid playlist position')
        const entry = recordSchema.parse(items[position])
        const track = z
          .object({ uri: z.string() })
          .parse(entry['item'] ?? entry['track'])
        return { uri: track.uri, positions: [position] }
      })
      await api.request(`${path}/items`, 'DELETE', {
        snapshot_id: after.snapshot_id,
        items: removals,
      })
    },
    async playlistReorder(ref, from, to, count = 1) {
      await api.request(`playlists/${id(ref.catalogId)}/items`, 'PUT', {
        range_start: from,
        insert_before: to,
        range_length: count,
      })
    },
  }
  return provider
}
