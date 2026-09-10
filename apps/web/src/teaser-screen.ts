/** Real 272×204 Panel frames captured at 3×, preserving the production CSS. */
export const TEASER_SCREEN = { width: 816, height: 612 } as const
// Bump when regenerating frames so open tabs do not reuse older captures.
const FRAME_REVISION = 'playback-4'
export const TEASER_PLAYBACK_SECONDS = 21
const FRAME_URLS = [
  ...Array.from({ length: 4 }, (_, index) => `/teaser/menu-${index}.png?v=${FRAME_REVISION}`),
  ...Array.from({ length: TEASER_PLAYBACK_SECONDS }, (_, index) => `/teaser/playing-${index}.png?v=${FRAME_REVISION}`),
]
let frames: Promise<readonly HTMLImageElement[]> | null = null

/** Bounded, decoded image cache shared across pause/resume and route remounts. */
export function loadTeaserFrames(): Promise<readonly HTMLImageElement[]> {
  frames ??= Promise.all(FRAME_URLS.map(async (url) => {
    const image = new Image()
    image.src = url
    await image.decode()
    return image
  })).catch((error: unknown) => {
    frames = null
    throw error
  })
  return frames
}

/** Four menu selections lead into the canonical Now Playing progress frames. */
export function teaserFrameIndex(seconds: number): number {
  const phase = ((seconds % 24) + 24) % 24
  return phase < 3 ? Math.floor(phase / .75) : 4 + Math.floor(phase - 3)
}
