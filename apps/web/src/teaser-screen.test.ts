import { describe, expect, it } from 'bun:test'
import { teaserFrameIndex, TEASER_PLAYBACK_SECONDS } from './teaser-screen'

describe('landing playback timeline', () => {
  it('advances one playback second per elapsed second without skipping frames', () => {
    for (let second = 0; second < TEASER_PLAYBACK_SECONDS; second++) {
      expect(teaserFrameIndex(3 + second)).toBe(4 + second)
      expect(teaserFrameIndex(3 + second + .99)).toBe(4 + second)
    }
  })

  it('cycles through the menu before restarting playback', () => {
    expect([0, .75, 1.5, 2.25].map(teaserFrameIndex)).toEqual([0, 1, 2, 3])
    expect(teaserFrameIndex(23.99)).toBe(24)
    expect(teaserFrameIndex(24)).toBe(0)
    expect(teaserFrameIndex(27)).toBe(4)
  })
})
