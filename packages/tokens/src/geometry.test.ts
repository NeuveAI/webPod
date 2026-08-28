import { describe, expect, test } from 'bun:test'

import {
  BODY_CORNER_R,
  BODY_H,
  BODY_W,
  LABEL_BAND_INNER_R,
  LABEL_BAND_OUTER_R,
  PANEL_H,
  PANEL_SCALE,
  PANEL_W,
  RECESS_SHADOW_REACH_R,
  SELECT_LIP_R,
  SELECT_R,
  WHEEL_R,
  WHEEL_TO_BODY_RATIO,
} from './geometry'
import { AGENT_ALPHA_PERSIST_MAX, HALO, REPEATER_R, TRAIL } from './fx'

const to3dp = (n: number): number => Number(n.toFixed(3))
// §12.0's tiling table quotes step arcs and the trail fraction to 2dp, so the
// assertions against it round the same way rather than inventing precision.
const to2dp = (n: number): number => Number(n.toFixed(2))

describe('R5 geometry table', () => {
  test('matches the design system §12.0 values', () => {
    expect(WHEEL_R).toBe(115)
    expect(BODY_W).toBe(330)
    expect(BODY_H).toBe(552)
    expect(SELECT_R).toBe(42)
    expect(SELECT_LIP_R).toBe(46)
    expect(LABEL_BAND_INNER_R).toBe(77)
    expect(LABEL_BAND_OUTER_R).toBe(79)
    expect(RECESS_SHADOW_REACH_R).toBe(104)
    expect(BODY_CORNER_R).toBe(33)
    expect(PANEL_W).toBe(272)
    expect(PANEL_H).toBe(204)
    expect(PANEL_SCALE).toBe(0.85)
  })

  test('wheel diameter over body width is 0.697 to 3dp', () => {
    expect(to3dp(WHEEL_TO_BODY_RATIO)).toBe(0.697)
  })

  test('panel scale is exactly 17/20, so both panel dimensions stay integral', () => {
    expect(PANEL_SCALE).toBe(17 / 20)
    expect(Number.isInteger(PANEL_W * PANEL_SCALE * (20 / 17))).toBe(true)
  })

  test('the label band is innerR + ringW x 0.493, not x 0.57', () => {
    const ringW = WHEEL_R - SELECT_R
    const band = SELECT_R + ringW * 0.493
    expect(band).toBeGreaterThanOrEqual(LABEL_BAND_INNER_R)
    expect(band).toBeLessThanOrEqual(LABEL_BAND_OUTER_R)
    // The superseded §7.3 multiplier would land outside the measured band.
    expect(SELECT_R + ringW * 0.57).toBeGreaterThan(LABEL_BAND_OUTER_R)
  })
})

describe('FX orbit clearances', () => {
  test('the halo centreline straddles the rim at wheelR + 1', () => {
    expect(HALO.c).toBe(WHEEL_R + 1)
  })

  test('the halo inner edge clears the recess shadow by 1px', () => {
    expect(HALO.c - HALO.head / 2).toBe(RECESS_SHADOW_REACH_R + 1)
  })

  test('the agent trail sits at 0.660 x wheelR', () => {
    expect(to2dp(TRAIL.c / WHEEL_R)).toBe(0.66)
    expect(TRAIL.c).toBe(76)
  })

  test('the agent trail inner edge clears the Select lip by 7px', () => {
    expect(TRAIL.c - TRAIL.head / 2).toBe(SELECT_LIP_R + 7)
  })

  test('the agent trail outer edge stays 5px inside the recess shadow reach', () => {
    expect(TRAIL.c + TRAIL.head / 2).toBe(RECESS_SHADOW_REACH_R - 5)
  })

  test('the agent head span contains the printed labels, as §8.5 intends', () => {
    expect(TRAIL.c - TRAIL.head / 2).toBeLessThan(LABEL_BAND_INNER_R)
    expect(TRAIL.c + TRAIL.head / 2).toBeGreaterThan(LABEL_BAND_OUTER_R)
  })

  test('the repeater clears the halo outer edge by 16px', () => {
    expect(REPEATER_R).toBe(HALO.c + HALO.head / 2 + 16)
  })
})

describe('attribution channel 2 — continuity', () => {
  test('the human halo blur clears the 0.5 x step seam threshold', () => {
    const stepArc = (((HALO.lead + HALO.trail) * Math.PI) / 180) * HALO.c / HALO.steps
    expect(to2dp(stepArc)).toBe(8.1)
    expect(HALO.blur).toBeGreaterThanOrEqual(0.5 * stepArc)
  })

  test('the agent trail blur is deliberately below it, so the slats stay discrete', () => {
    const stepArc = ((TRAIL.span * Math.PI) / 180) * TRAIL.c / TRAIL.steps
    expect(to2dp(stepArc)).toBe(8.25)
    expect(TRAIL.blur).toBeLessThan(0.5 * stepArc)
    expect(to3dp(TRAIL.blur / stepArc)).toBe(0.218)
  })

  test('the two blurs must not converge', () => {
    expect(HALO.blur / TRAIL.blur).toBeGreaterThan(2)
  })
})

describe('guards', () => {
  test('persistent agent alpha is capped where the labels still clear 3:1', () => {
    expect(AGENT_ALPHA_PERSIST_MAX).toBe(0.18)
  })
})
