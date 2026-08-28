import { describe, expect, test } from 'bun:test'

import { arityOf, resolveTier, type Tier, type TierFacts } from './capabilities'

describe('resolveTier', () => {
  const cases: ReadonlyArray<{
    readonly facts: TierFacts
    readonly tier: Tier
    readonly reasonIncludes: string
  }> = [
    {
      facts: { webgl: false, requestPaint: false, prefersReducedMotion: false },
      tier: 'T4',
      reasonIncludes: 'No WebGL context',
    },
    {
      facts: { webgl: false, requestPaint: true, prefersReducedMotion: false },
      tier: 'T4',
      reasonIncludes: 'No WebGL context',
    },
    {
      facts: { webgl: true, requestPaint: false, prefersReducedMotion: false },
      tier: 'T3',
      reasonIncludes: "'requestPaint' in HTMLCanvasElement.prototype is false",
    },
    {
      facts: { webgl: true, requestPaint: true, prefersReducedMotion: false },
      tier: 'T1',
      reasonIncludes: "'requestPaint' in HTMLCanvasElement.prototype is true",
    },
    {
      facts: { webgl: false, requestPaint: false, prefersReducedMotion: true },
      tier: 'T4',
      reasonIncludes: 'prefers-reduced-motion: reduce',
    },
    {
      facts: { webgl: false, requestPaint: true, prefersReducedMotion: true },
      tier: 'T4',
      reasonIncludes: 'prefers-reduced-motion: reduce',
    },
    {
      facts: { webgl: true, requestPaint: false, prefersReducedMotion: true },
      tier: 'T4',
      reasonIncludes: 'prefers-reduced-motion: reduce',
    },
    {
      facts: { webgl: true, requestPaint: true, prefersReducedMotion: true },
      tier: 'T4',
      reasonIncludes: 'prefers-reduced-motion: reduce',
    },
  ]

  for (const { facts, tier, reasonIncludes } of cases) {
    test(`${JSON.stringify(facts)} resolves ${tier}`, () => {
      const result = resolveTier(facts)
      expect(result.tier).toBe(tier)
      expect(result.reason).toContain(reasonIncludes)
    })
  }

  test('never manufactures the uninstalled polyfill tier', () => {
    const resolved = cases.map(({ facts }) => resolveTier(facts).tier)
    expect(resolved).not.toContain('T2')
  })
})

describe('arityOf', () => {
  test('reads the declared arity of an own data-property function', () => {
    const target = Object.defineProperty({}, 'requestPaint', {
      value: function requestPaint(dirty: unknown) {
        void dirty
      },
    })
    expect(arityOf(target, 'requestPaint')).toBe(1)
  })

  test('walks to an inherited data-property function descriptor', () => {
    const prototype = Object.defineProperty({}, 'texElementImage2D', {
      value: function texElementImage2D(
        target: unknown,
        internalFormat: unknown,
        element: unknown,
      ) {
        void target
        void internalFormat
        void element
      },
    })
    const target = Object.create(prototype) as object
    expect(arityOf(target, 'texElementImage2D')).toBe(3)
  })

  test('does not invoke an own IDL-style getter that throws Illegal invocation', () => {
    let getterCalls = 0
    const target = Object.defineProperty({}, 'layoutSubtree', {
      get() {
        getterCalls += 1
        throw new TypeError('Illegal invocation')
      },
    })

    expect(arityOf(target, 'layoutSubtree')).toBeNull()
    expect(getterCalls).toBe(0)
  })

  test('does not invoke an inherited IDL-style getter', () => {
    let getterCalls = 0
    const prototype = Object.defineProperty({}, 'onpaint', {
      get() {
        getterCalls += 1
        throw new TypeError('Illegal invocation')
      },
    })
    const target = Object.create(prototype) as object

    expect(arityOf(target, 'onpaint')).toBeNull()
    expect(getterCalls).toBe(0)
  })

  test('returns null for a missing descriptor and for non-functions', () => {
    const target = Object.defineProperty({}, 'layoutSubtree', { value: true })
    expect(arityOf(target, 'layoutSubtree')).toBeNull()
    expect(arityOf(target, 'missing')).toBeNull()
  })
})
