/**
 * The fixture catalogue — the data every screen renders from on day one.
 *
 * Four albums, forty-two tracks, four artists, two playlists, three stations,
 * plus the genre and composer facets S10 and S11 browse. It is deliberately
 * *realistic* rather than minimal: a library of `Album 1` / `Track 1` makes
 * every list look correct at every width, which is precisely how a truncation
 * bug, a mis-set line height or a wrong sort survives to production. Real
 * titles have long ones, short ones, punctuation, an accent and a track that
 * shares a word with an artist name.
 *
 * Keys are minted per catalogue instance, never hardcoded. A test that depends
 * on a literal key value is testing the fixture rather than the code, and
 * §14.5's whole point is that the key is opaque.
 */

import { mintLocalKey } from '../identity.ts'
import type {
  AlbumRef,
  ArtistRef,
  ComposerRef,
  GenreRef,
  PlaylistRef,
  StationRef,
  TrackRef,
} from '../identity.ts'

/** Artwork for the fixture, sized on request like Apple's template form. */
function artworkFor(slug: string) {
  // Same-origin by construction. Nothing serves this path yet — the artwork
  // proxy is `packages/server-core`'s and lands later — so the panel renders
  // its placeholder. That is the honest day-one state and not a bug to chase.
  return { kind: 'template', template: `/artwork-source/${slug}/{w}x{h}.png` } as const
}

/** One album's worth of source data, before keys are minted. */
interface AlbumSeed {
  readonly slug: string
  readonly title: string
  readonly artistName: string
  readonly releaseYear: number
  readonly genre: string
  readonly composer: string
  /** `[title, durationMs, isrc]` per track, in album order. */
  readonly tracks: readonly (readonly [string, number, string])[]
}

const ALBUM_SEEDS: readonly AlbumSeed[] = [
  {
    slug: 'the-fray',
    title: 'The Fray',
    artistName: 'The Fray',
    releaseYear: 2009,
    genre: 'Alternative',
    composer: 'Isaac Slade',
    tracks: [
      ['Syndicate', 226_000, 'USSM10900001'],
      ['Absolute', 228_000, 'USSM10900002'],
      ['You Found Me', 242_000, 'USSM10900003'],
      ['Say When', 249_000, 'USSM10900004'],
      ['Never Say Never', 254_000, 'USSM10900005'],
      ['Where the Story Ends', 231_000, 'USSM10900006'],
      ['Enough for Now', 213_000, 'USSM10900007'],
      ['Ungodly Hour', 249_000, 'USSM10900008'],
      ['Heartless', 236_000, 'USSM10900009'],
      ['We Build Then We Break', 218_000, 'USSM10900010'],
      ['Happiness', 275_000, 'USSM10900011'],
    ],
  },
  {
    slug: 'aims',
    title: 'Aims',
    artistName: 'Vienna Teng',
    releaseYear: 2013,
    genre: 'Singer-Songwriter',
    composer: 'Vienna Teng',
    tracks: [
      ['Level Up', 260_000, 'USA2P1300001'],
      ['In the 99', 251_000, 'USA2P1300002'],
      ['Landsailor', 296_000, 'USA2P1300003'],
      ['Close to Home', 229_000, 'USA2P1300004'],
      ['Hymn of Acxiom', 289_000, 'USA2P1300005'],
      ['Copenhagen', 233_000, 'USA2P1300006'],
      ['Never Look Away', 253_000, 'USA2P1300007'],
      ['Oh Mama No', 205_000, 'USA2P1300008'],
      ['Flyweight Love', 224_000, 'USA2P1300009'],
      ['The Breaking Light', 268_000, 'USA2P1300010'],
      ['Goodnight New York', 241_000, 'USA2P1300011'],
    ],
  },
  {
    slug: 'rumours',
    title: 'Rumours',
    artistName: 'Fleetwood Mac',
    releaseYear: 1977,
    genre: 'Rock',
    composer: 'Christine McVie',
    tracks: [
      ['Second Hand News', 173_000, 'USWB10200001'],
      ['Dreams', 257_000, 'USWB10200002'],
      ['Never Going Back Again', 134_000, 'USWB10200003'],
      ["Don't Stop", 191_000, 'USWB10200004'],
      ['Go Your Own Way', 223_000, 'USWB10200005'],
      ['Songbird', 200_000, 'USWB10200006'],
      ['The Chain', 270_000, 'USWB10200007'],
      ['You Make Loving Fun', 211_000, 'USWB10200008'],
      ["I Don't Want to Know", 194_000, 'USWB10200009'],
      ['Oh Daddy', 234_000, 'USWB10200010'],
      ['Gold Dust Woman', 291_000, 'USWB10200011'],
    ],
  },
  {
    slug: 'for-emma-forever-ago',
    title: 'For Emma, Forever Ago',
    artistName: 'Bon Iver',
    releaseYear: 2007,
    genre: 'Indie Folk',
    composer: 'Justin Vernon',
    tracks: [
      ['Flume', 219_000, 'USJAY0700001'],
      ['Lump Sum', 202_000, 'USJAY0700002'],
      ['Skinny Love', 238_000, 'USJAY0700003'],
      ['The Wolves (Act I and II)', 322_000, 'USJAY0700004'],
      ['Blindsided', 302_000, 'USJAY0700005'],
      ['Creature Fear', 190_000, 'USJAY0700006'],
      ['Team', 92_000, 'USJAY0700007'],
      ['For Emma', 199_000, 'USJAY0700008'],
      ['re: Stacks', 396_000, 'USJAY0700009'],
    ],
  },
]

/** Everything the fixture provider can browse, with keys already minted. */
export interface FixtureCatalog {
  readonly tracks: readonly TrackRef[]
  readonly albums: readonly AlbumRef[]
  readonly artists: readonly ArtistRef[]
  readonly playlists: readonly PlaylistRef[]
  readonly stations: readonly StationRef[]
  readonly genres: readonly GenreRef[]
  readonly composers: readonly ComposerRef[]
  /** Album key → its tracks, in album order. */
  readonly tracksByAlbum: ReadonlyMap<string, readonly TrackRef[]>
  /** Playlist key → its tracks, in playlist order. */
  readonly tracksByPlaylist: ReadonlyMap<string, readonly TrackRef[]>
}

/**
 * Builds a fresh catalogue with newly minted keys.
 *
 * Call it once per provider instance. Two catalogues built from the same seeds
 * have the same titles and different keys, which is the correct model: two
 * libraries that happen to hold the same record are not the same library.
 */
export function createFixtureCatalog(): FixtureCatalog {
  const tracks: TrackRef[] = []
  const albums: AlbumRef[] = []
  const artists: ArtistRef[] = []
  const genres: GenreRef[] = []
  const composers: ComposerRef[] = []
  const tracksByAlbum = new Map<string, readonly TrackRef[]>()

  const artistByName = new Map<string, ArtistRef>()
  const genreByName = new Map<string, GenreRef>()
  const composerByName = new Map<string, ComposerRef>()

  for (const seed of ALBUM_SEEDS) {
    let artist = artistByName.get(seed.artistName)
    if (artist === undefined) {
      artist = {
        kind: 'artist',
        key: mintLocalKey(),
        provider: 'fixture',
        catalogId: `ar.${seed.slug}`,
        name: seed.artistName,
        artwork: artworkFor(seed.slug),
      }
      artistByName.set(seed.artistName, artist)
      artists.push(artist)
    }

    if (!genreByName.has(seed.genre)) {
      const genre: GenreRef = {
        kind: 'genre',
        key: mintLocalKey(),
        provider: 'fixture',
        catalogId: `ge.${seed.genre.toLowerCase().replace(/\W+/g, '-')}`,
        name: seed.genre,
      }
      genreByName.set(seed.genre, genre)
      genres.push(genre)
    }

    if (!composerByName.has(seed.composer)) {
      const composer: ComposerRef = {
        kind: 'composer',
        key: mintLocalKey(),
        provider: 'fixture',
        catalogId: `co.${seed.composer.toLowerCase().replace(/\W+/g, '-')}`,
        name: seed.composer,
      }
      composerByName.set(seed.composer, composer)
      composers.push(composer)
    }

    const album: AlbumRef = {
      kind: 'album',
      key: mintLocalKey(),
      provider: 'fixture',
      catalogId: `al.${seed.slug}`,
      title: seed.title,
      artistName: seed.artistName,
      trackCount: seed.tracks.length,
      releaseYear: seed.releaseYear,
      artwork: artworkFor(seed.slug),
    }
    albums.push(album)

    const albumTracks: TrackRef[] = seed.tracks.map(([title, durationMs, isrc], index) => ({
      kind: 'track',
      key: mintLocalKey(),
      provider: 'fixture',
      catalogId: `so.${seed.slug}.${String(index + 1)}`,
      isrc,
      title,
      artistName: seed.artistName,
      albumName: seed.title,
      durationMs,
      artwork: artworkFor(seed.slug),
      playable: true,
    }))

    tracksByAlbum.set(album.key, albumTracks)
    tracks.push(...albumTracks)
  }

  const byTitle = (title: string): TrackRef => {
    const found = tracks.find((t) => t.title === title)
    if (found === undefined) throw new Error(`fixture catalogue has no track titled ${title}`)
    return found
  }

  const playlistSeeds: readonly { name: string; description: string; titles: readonly string[] }[] = [
    {
      name: 'Late shift',
      description: 'For the quiet end of a long one.',
      titles: ['Hymn of Acxiom', 'Songbird', 're: Stacks', 'The Breaking Light', 'For Emma', 'Enough for Now'],
    },
    {
      name: 'Long drive',
      description: 'Nothing under three minutes.',
      titles: ['Go Your Own Way', 'The Chain', 'Level Up', 'You Found Me', 'Blindsided', 'Dreams', 'Landsailor'],
    },
  ]

  const playlists: PlaylistRef[] = []
  const tracksByPlaylist = new Map<string, readonly TrackRef[]>()

  for (const seed of playlistSeeds) {
    const playlistTracks = seed.titles.map(byTitle)
    const playlist: PlaylistRef = {
      kind: 'playlist',
      key: mintLocalKey(),
      provider: 'fixture',
      catalogId: `pl.${seed.name.toLowerCase().replace(/\W+/g, '-')}`,
      name: seed.name,
      description: seed.description,
      trackCount: playlistTracks.length,
      editable: true,
    }
    playlists.push(playlist)
    tracksByPlaylist.set(playlist.key, playlistTracks)
  }

  const stations: readonly StationRef[] = [
    {
      kind: 'station',
      key: mintLocalKey(),
      provider: 'fixture',
      catalogId: 'ra.indie-folk',
      name: 'Indie Folk Station',
      live: false,
      artwork: artworkFor('for-emma-forever-ago'),
    },
    {
      kind: 'station',
      key: mintLocalKey(),
      provider: 'fixture',
      catalogId: 'ra.classic-rock',
      name: 'Classic Rock Station',
      live: false,
      artwork: artworkFor('rumours'),
    },
    {
      kind: 'station',
      key: mintLocalKey(),
      provider: 'fixture',
      catalogId: 'ra.the-signal',
      name: 'The Signal',
      live: true,
      artwork: artworkFor('the-fray'),
    },
  ]

  return { tracks, albums, artists, playlists, stations, genres, composers, tracksByAlbum, tracksByPlaylist }
}
