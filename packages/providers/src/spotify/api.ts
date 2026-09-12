import { z } from 'zod'
import {
  mintLocalKey,
  type LocalKey,
  type TrackRef,
  type AlbumRef,
  type ArtistRef,
  type PlaylistRef,
} from '../identity'
const images = z
  .array(
    z.object({
      url: z.string(),
      width: z.number().nullish(),
      height: z.number().nullish(),
    }),
  )
  .nullish()
const artistSchema = z.object({ id: z.string(), name: z.string(), images })
const albumSchema = z.object({
  id: z.string(),
  name: z.string(),
  artists: z.array(artistSchema),
  images,
  total_tracks: z.number().default(0),
})
const trackSchema = z.object({
  id: z.string(),
  name: z.string(),
  artists: z.array(artistSchema),
  duration_ms: z.number(),
  album: albumSchema.optional(),
  is_playable: z.boolean().optional(),
  is_local: z.boolean().optional(),
})
const playlistSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  images,
  owner: z.object({ id: z.string() }).optional(),
  items: z.object({ total: z.number() }).optional(),
  tracks: z.object({ total: z.number() }).optional(),
})
export const pageSchema = z.object({
  items: z.array(z.unknown()),
  next: z.string().nullable(),
  total: z.number().optional(),
})
export const recordSchema = z.record(z.string(), z.unknown())
const tokenSchema = z.object({ accessToken: z.string(), expiresAt: z.number() })

/** Owns the short-lived access token in memory and deduplicates refresh requests. */
export function createSpotifyApi() {
  let token: z.infer<typeof tokenSchema> | null = null
  let refreshing: Promise<string | null> | null = null
  const keys = new Map<string, LocalKey>()
  const key = (kind: string, id: string) => {
    const cacheKey = `${kind}:${id}`
    let result = keys.get(cacheKey)
    if (!result) {
      result = mintLocalKey()
      keys.set(cacheKey, result)
    }
    return result
  }
  async function accessToken(): Promise<string | null> {
    if (token && token.expiresAt > Date.now() + 60000) return token.accessToken
    if (refreshing) return refreshing
    refreshing = (async () => {
      const response = await fetch('/api/spotify/token', { method: 'POST' })
      if (response.status === 401) {
        token = null
        return null
      }
      if (!response.ok)
        throw new Error(
          'Spotify session could not be restored. Please sign in again.',
        )
      token = tokenSchema.parse(await response.json())
      return token.accessToken
    })().finally(() => {
      refreshing = null
    })
    return refreshing
  }
  async function request(
    path: string,
    method = 'GET',
    body?: object,
    responseKind: 'json' | 'acknowledgement' = 'json',
    options?: { readonly signal?: AbortSignal; readonly priority?: 'low' | 'high' },
  ): Promise<unknown> {
    const url = new URL(path, 'https://api.spotify.com/v1/')
    if (
      url.origin !== 'https://api.spotify.com' ||
      !url.pathname.startsWith('/v1/')
    )
      throw new Error('Invalid Spotify pagination URL')
    for (let attempt = 0; attempt < 2; attempt++) {
      const access = await accessToken()
      if (!access)
        throw new Error('Your Spotify session expired. Please sign in again.')
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${access}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: options?.signal === undefined ? AbortSignal.timeout(15000) : AbortSignal.any([options.signal, AbortSignal.timeout(15000)]),
        priority: options?.priority,
      })
      if (response.status === 401 && attempt === 0) {
        token = null
        continue
      }
      if (!response.ok)
        throw new Error(
          response.status === 403
            ? 'Spotify denied this action. Check Premium and the app’s allowed users.'
            : response.status === 429
              ? 'Spotify is busy. Please try again shortly.'
              : `Spotify request failed (${response.status}). Please try again.`,
        )
      if (
        responseKind === 'acknowledgement' ||
        response.status === 204 ||
        response.headers.get('content-length') === '0'
      )
        return null
      const text = await response.text()
      return text ? JSON.parse(text) : null
    }
    throw new Error('Your Spotify session expired. Please sign in again.')
  }
  const art = (value: z.infer<typeof images>) => {
    const sizes = (value ?? []).map((image) => ({
      url: image.url,
      w: image.width ?? 640,
      h: image.height ?? 640,
    })).filter((image) => image.url.length > 0 && image.w > 0 && image.h > 0)
    return sizes.length === 0 ? undefined : { kind: 'fixed' as const, sizes }
  }
  function track(value: unknown): TrackRef {
    const v = trackSchema.parse(value)
    return {
      kind: 'track',
      key: key('track', v.id),
      provider: 'spotify',
      catalogId: v.id,
      title: v.name,
      artistName: v.artists.map((a) => a.name).join(', '),
      durationMs: v.duration_ms,
      playable: v.is_playable !== false && !v.is_local,
      ...(v.album
        ? { albumName: v.album.name, artwork: art(v.album.images) }
        : {}),
    }
  }
  function album(value: unknown): AlbumRef {
    const v = albumSchema.parse(value)
    return {
      kind: 'album',
      key: key('album', v.id),
      provider: 'spotify',
      catalogId: v.id,
      title: v.name,
      artistName: v.artists.map((a) => a.name).join(', '),
      trackCount: v.total_tracks,
      artwork: art(v.images),
    }
  }
  function artist(value: unknown): ArtistRef {
    const v = artistSchema.parse(value)
    return {
      kind: 'artist',
      key: key('artist', v.id),
      provider: 'spotify',
      catalogId: v.id,
      name: v.name,
      artwork: art(v.images),
    }
  }
  function playlist(value: unknown, user: string | null): PlaylistRef {
    return playlistRef(playlistSchema.parse(value), user)
  }
  function playlistRef(v: z.infer<typeof playlistSchema>, user: string | null): PlaylistRef {
    return {
      kind: 'playlist',
      key: key('playlist', v.id),
      provider: 'spotify',
      catalogId: v.id,
      name: v.name,
      trackCount: v.items?.total ?? v.tracks?.total ?? 0,
      editable: v.owner?.id === user,
      artwork: art(v.images),
    }
  }
  function playlists(values: unknown[], user: string | null): PlaylistRef[] {
    return values.flatMap((value) => {
      const parsed = playlistSchema.safeParse(value)
      return parsed.success ? [playlistRef(parsed.data, user)] : []
    })
  }
  return {
    accessToken,
    request,
    /** Void commands are confirmed by HTTP status; successful acknowledgement bodies are opaque. */
    async command(path: string, method: string, body?: object): Promise<void> {
      await request(path, method, body, 'acknowledgement')
    },
    track,
    album,
    artist,
    playlist,
    playlists,
    clear: () => {
      token = null
      keys.clear()
    },
  }
}
