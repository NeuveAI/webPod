import { welcomeAction } from './browser-welcome-policy'
import { describe, expect, test } from 'bun:test'
import type { CapabilityReport } from '@webpod/composite'
import { browserWelcomeReason, previewYaw } from './browser-welcome-policy'

function report(overrides: Partial<CapabilityReport> = {}, environment: Partial<CapabilityReport['environment']> = {}): CapabilityReport {
  return {
    probedAt: '', requestPaint: false, layoutSubtreeReflects: false,
    webglEntryPoint: { available: false, name: null, arity: null, signature: null, verdict: '' },
    geometryApi: { generation: 'none', name: null, verdict: '' }, groups: [], tier: 'T3', capabilityTier: 'T3', tierReason: '',
    ...overrides,
    environment: { userAgent: 'Mozilla/5.0 Chrome/151.0.0.0 Safari/537.36', brands: [], chromiumMajor: 151,
      devicePixelRatio: 1, prefersReducedMotion: false, webgl1: true, webgl2: true, ...environment },
  }
}

describe('browser welcome policy', () => {
  test('observed API support wins over a stale presentation tier', () => {
    expect(browserWelcomeReason(report({ requestPaint: true, capabilityTier: 'T3' }))).toBeNull()
    expect(browserWelcomeReason(report({ requestPaint: false, capabilityTier: 'T1' }))).toBe('experiment')
  })
  test('available APIs bypass setup even for old and unrecognized browser versions', () => {
    expect(browserWelcomeReason(report({ capabilityTier: 'T1', requestPaint: true }, { chromiumMajor: 140 }))).toBeNull()
    expect(browserWelcomeReason(report({ capabilityTier: 'T1', requestPaint: true }, { userAgent: 'FutureBrowser/1', chromiumMajor: null }))).toBeNull()
  })
  test('a future Chrome version never implies that the experiment has shipped', () => {
    expect(browserWelcomeReason(report({}, { chromiumMajor: 200 }))).toBe('experiment')
  })
  test('older Chrome receives update guidance', () => {
    expect(browserWelcomeReason(report({}, { chromiumMajor: 148 }))).toBe('update')
  })
  test('unknown Chromium version can still receive feature-based guidance', () => {
    expect(browserWelcomeReason(report({}, { chromiumMajor: null }))).toBe('experiment')
  })
  test('Safari, Firefox, Chrome on iOS, and Android receive desktop browser guidance', () => {
    for (const userAgent of ['Version/26 Safari/605', 'Firefox/150', 'iPhone CriOS/151', 'Android Chrome/151.0']) {
      expect(browserWelcomeReason(report({}, { userAgent }))).toBe('browser')
    }
  })
  test('missing graphics takes priority over a flag that cannot fix it', () => {
    expect(browserWelcomeReason(report({}, { webgl2: false }))).toBe('graphics')
  })
  test('reduced motion is not misreported as a disabled experiment', () => {
    expect(browserWelcomeReason(report({ capabilityTier: 'T1', requestPaint: true }, { prefersReducedMotion: true }))).toBeNull()
    expect(browserWelcomeReason(report({}, { prefersReducedMotion: true }))).toBe('experiment')
  })
})

describe('preview turn storyboard', () => {
  test('holds both faces long enough to read the screen and see the stickers', () => {
    expect(previewYaw(0)).toBe(0)
    expect(previewYaw(6.9)).toBe(0)
    expect(previewYaw(11)).toBe(180)
    expect(previewYaw(16.9)).toBe(180)
    expect(previewYaw(21)).toBe(360)
  })
  test('returns to the same physical angle across the loop seam', () => {
    const radians = (seconds: number) => previewYaw(seconds) * Math.PI / 180
    expect(Math.cos(radians(24 - .00001))).toBeCloseTo(Math.cos(radians(24)), 8)
    expect(Math.sin(radians(24 - .00001))).toBeCloseTo(Math.sin(radians(24)), 8)
  })
  test('turns continuously forward and eases into each hold', () => {
    for (const [start, end] of [[7, 11], [17, 21]] as const) {
      expect(previewYaw(start + .001) - previewYaw(start)).toBeLessThan(.0001)
      expect(previewYaw(end) - previewYaw(end - .001)).toBeLessThan(.0001)
      expect(previewYaw(start + 2)).toBeCloseTo((previewYaw(start) + previewYaw(end)) / 2)
    }
  })
})

 test('landing action permits sign-in without setup and gates only authenticated play', () => {
   for (const ready of [false, true]) {
     expect(welcomeAction(false, false, ready)).toEqual({ kind: 'sign-in', label: 'Connect Apple Music', disabled: false })
     expect(welcomeAction(false, true, ready).disabled).toBe(true)
     expect(welcomeAction(true, false, ready)).toEqual({ kind: 'play', label: 'Lets get playing!', disabled: !ready })
   }
 })
