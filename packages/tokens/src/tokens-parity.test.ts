import { describe, expect, test } from 'bun:test'

import {
  BODY_CORNER_R,
  PANEL_H,
  PANEL_SCALE,
  PANEL_W,
  SELECT_R,
  WHEEL_R,
} from './geometry'
import {
  AGENT_ALPHA_PERSIST_MAX,
  GAMMA_A,
  GAMMA_W,
  HALO,
  REDUCED_TRANSPARENCY_SCALE,
  REPEATER_R,
  TRAIL,
} from './fx'

/**
 * `globals.css` and the typed exports hold the same numbers twice: the CSS half is
 * the verbatim §12.1 transcription, the TS half is what JS and SVG consumers read
 * (Tailwind tree-shakes `@theme`, which is why the TS half exists at all — D-020).
 *
 * Two copies with nothing binding them drift. This file is the binding: every
 * numeric custom property in the sheet either maps to a TS constant and must equal
 * it, or is listed as deliberately CSS-only. A new `--fx-*` or `--panel-*` added to
 * the sheet without a counterpart fails the completeness test at the bottom.
 */

const CSS = await Bun.file(new URL('./globals.css', import.meta.url)).text()

/**
 * Reads one custom property's declared value out of the token sheet.
 *
 * Deliberately naive: it takes the FIRST declaration, which is the `@theme` block,
 * because the mode-flipping `:root` / `[data-mode="dark"]` layer below redeclares
 * colours rather than these numbers. Unit suffixes (`px`, `deg`) are stripped, so
 * `115px` and `34deg` both come back as numbers.
 *
 * @throws if the property is absent, so a renamed token fails loudly rather than
 *   silently comparing `undefined`.
 */
function cssNumber(prop: string): number {
  const match = new RegExp(`--${prop}:\\s*([0-9.]+)\\s*(?:px|deg)?\\s*;`).exec(CSS)
  if (match?.[1] === undefined) throw new Error(`--${prop} not found in globals.css`)
  return Number(match[1])
}

/** Every custom property that must equal a TS constant, and the constant it must equal. */
const BOUND: ReadonlyArray<readonly [string, number]> = [
  ['fx-wheel-r', WHEEL_R],
  ['fx-select-r', SELECT_R],
  ['fx-halo-c', HALO.c],
  ['fx-halo-head', HALO.head],
  ['fx-halo-tail', HALO.tail],
  ['fx-halo-lead', HALO.lead],
  ['fx-halo-trail', HALO.trail],
  ['fx-halo-core', HALO.core],
  ['fx-halo-steps', HALO.steps],
  ['fx-halo-blur', HALO.blur],
  ['fx-halo-gap', HALO.gap],
  ['fx-agent-c', TRAIL.c],
  ['fx-agent-head', TRAIL.head],
  ['fx-agent-tail', TRAIL.tail],
  ['fx-agent-span', TRAIL.span],
  ['fx-agent-steps', TRAIL.steps],
  ['fx-agent-blur', TRAIL.blur],
  ['fx-agent-gap', TRAIL.gap],
  ['fx-repeater-r', REPEATER_R],
  ['fx-taper-gamma-w', GAMMA_W],
  ['fx-taper-gamma-a', GAMMA_A],
  ['fx-agent-alpha-persist-max', AGENT_ALPHA_PERSIST_MAX],
  ['fx-rt-scale-human', REDUCED_TRANSPARENCY_SCALE.human],
  ['fx-rt-scale-agent', REDUCED_TRANSPARENCY_SCALE.agent],
  ['panel-scale', PANEL_SCALE],
  ['panel-w', PANEL_W],
  ['panel-h', PANEL_H],
  ['radius-device', BODY_CORNER_R],
]

/**
 * Numeric `--fx-*` / `--panel-*` properties with no TS counterpart, and why.
 *
 * Anything not here and not in {@link BOUND} fails the completeness test — that is
 * how a newly added token gets noticed instead of quietly having one home.
 */
const CSS_ONLY: ReadonlyArray<readonly [string, string]> = [
  ['fx-peak-rotate', 'peak alpha for the rotate event; consumed only by the CSS keyframes'],
  ['fx-peak-press', 'peak alpha for the press event; consumed only by the CSS keyframes'],
]

describe('globals.css and the typed exports agree', () => {
  for (const [prop, tsValue] of BOUND) {
    test(`--${prop} equals its TS constant`, () => {
      expect(cssNumber(prop)).toBe(tsValue)
    })
  }

  test('every numeric --fx-* / --panel-* token is either bound or declared CSS-only', () => {
    // flatMap rather than map: the capture group is `string | undefined` under
    // noUncheckedIndexedAccess, and narrowing it here avoids a non-null assertion.
    const declared = [...CSS.matchAll(/--((?:fx|panel)-[a-z0-9-]+):\s*[0-9.]/g)].flatMap(
      (m) => (m[1] === undefined ? [] : [m[1]]),
    )
    const accounted = new Set([
      ...BOUND.map(([p]) => p),
      ...CSS_ONLY.map(([p]) => p),
    ])
    const unaccounted = [...new Set(declared)].filter((p) => !accounted.has(p))
    expect(unaccounted).toEqual([])
  })

  test('the sheet still declares every token the binding claims to cover', () => {
    // Guards the other direction: a token deleted from the CSS would otherwise make
    // the completeness test above pass by having nothing left to check.
    expect(BOUND.length).toBe(28)
    for (const [prop] of BOUND) expect(() => cssNumber(prop)).not.toThrow()
  })
})

describe('D-020 is applied to all three @theme blocks', () => {
  test('every @theme block is static, so nothing is tree-shaken out of the build', () => {
    const blocks = [...CSS.matchAll(/^@theme\b[^{]*\{/gm)].map((m) => m[0].trim())
    expect(blocks.length).toBe(3)
    for (const block of blocks) expect(block).toContain('static')
  })
})
