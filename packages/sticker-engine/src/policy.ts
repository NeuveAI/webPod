import { STICKER_CATALOGUE, STICKER_GENRES, type StickerGenre } from '@webpod/stickers'

export const STICKER_POLICY_VERSION = 'v1'
export const LISTENING_THRESHOLDS_MS = [5, 15, 60, 180, 600].map((minutes) => minutes * 60_000)
export const MAX_OBSERVATION_GAP_MS = 30_000
export const MAX_CREDIT_PER_OBSERVATION_MS = 15_000
export function genreStickers(genre: StickerGenre) { return STICKER_CATALOGUE.filter((sticker) => sticker.genre === genre) }

/** Exact normalized Apple genre aliases. Unknown metadata remains unclassified. */
export function classifyGenre(names: readonly string[]): StickerGenre | null {
  const aliases: Readonly<Record<string, StickerGenre>> = {
    metal: 'metal', 'heavy metal': 'metal', 'death metal/black metal': 'metal',
    pop: 'pop', 'k-pop': 'pop', rock: 'rock', 'hard rock': 'rock',
    'hip-hop/rap': 'hip-hop', 'hip-hop': 'hip-hop', rap: 'hip-hop',
    'r&b/soul': 'rnb', 'r&b': 'rnb', soul: 'rnb',
    electronic: 'electronic', electronica: 'electronic', dance: 'electronic', house: 'electronic', techno: 'electronic',
    indie: 'indie', 'indie rock': 'indie', alternative: 'indie',
    jazz: 'jazz', classical: 'classical', country: 'country', reggae: 'reggae', latin: 'latin', 'pop latino': 'latin',
  }
  for (const name of names) { const key = name.trim().toLowerCase(); const genre = Object.hasOwn(aliases, key) ? aliases[key] : undefined; if (genre !== undefined) return genre }
  return null
}

export function strongestGenres(values: readonly { readonly catalogId: string; readonly genre: StickerGenre | null }[]): StickerGenre[] {
  const counts = new Map<StickerGenre, number>(); const seen = new Set<string>()
  for (const value of values) {
    if (seen.has(value.catalogId)) continue
    seen.add(value.catalogId)
    if (value.genre !== null) counts.set(value.genre, (counts.get(value.genre) ?? 0) + 1)
  }
  return [...counts].sort(([a, n], [b, m]) => m - n || STICKER_GENRES.indexOf(a) - STICKER_GENRES.indexOf(b)).slice(0, 3).map(([genre]) => genre)
}
