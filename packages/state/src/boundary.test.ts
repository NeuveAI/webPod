import { describe, expect, test } from 'bun:test'

import {
  DETENT,
  IDLE_ANNOUNCER_STATE,
  IDLE_DETENT_ACCUMULATOR,
  VISIBLE_ROWS,
  announcerAtom,
  bumpAtom,
  currentScreenAtom,
  detentAccumulatorAtom,
  interactionFeedbackAtom,
  liveRegionAtom,
} from './contract'
import type { PanelRow, ScreenFrame } from './contract'
import {
  coastActionAtom,
  detentActionAtom,
  endGestureActionAtom,
} from './store'
import { createDeviceStore } from './testing'

function listFrame(count: number, highlightIndex: number): ScreenFrame {
  const rows: readonly PanelRow[] = Array.from({ length: count }, (_, index) => ({
    index,
    label: `Row ${String(index + 1)}`,
    sublabel: null,
    glyphs: [],
    provenance: null,
  }))
  return {
    screenId: 'S09',
    title: 'Songs',
    density: 'medium',
    rows,
    highlightIndex,
    windowStart: Math.max(0, highlightIndex - VISIBLE_ROWS.medium + 1),
  }
}

function at(count: number, index: number): ReturnType<typeof createDeviceStore> {
  return createDeviceStore({ initialStack: [listFrame(count, index)] })
}

describe('exhausted list boundaries are authoritative wheel no-ops', () => {
  for (const [name, count] of [
    ['short', 3],
    ['one viewport', VISIBLE_ROWS.medium],
    ['long', 100],
  ] as const) {
    for (const edge of ['first', 'last'] as const) {
      test(`${name} list at its ${edge} row rejects repeated outward detents and accepts the first reversal`, () => {
        const exhaustedDirection = edge === 'first' ? -1 : 1
        const start = edge === 'first' ? 0 : count - 1
        const store = at(count, start)
        const before = store.get(currentScreenAtom)
        let feedbackNotifications = 0
        const unsubscribe = store.sub(interactionFeedbackAtom, () => {
          feedbackNotifications += 1
        })

        for (let attempt = 0; attempt < 6; attempt += 1) {
          const outcome = store.set(detentActionAtom, {
            path: 'direct',
            source: 'human',
            detents: exhaustedDirection * 3,
            timestampMs: attempt + 1,
          })
          expect(outcome.detents).toBe(0)
          expect(outcome.rowDelta).toBe(0)
          expect(outcome.clickerTicks).toBe(0)
          expect(outcome.hapticPulses).toBe(0)
          expect(outcome.detentsPerSecond).toBe(0)
          expect(outcome.accelerated).toBeFalse()
        }

        expect(store.get(currentScreenAtom)).toBe(before)
        expect(store.get(currentScreenAtom)?.highlightIndex).toBe(start)
        expect(store.get(currentScreenAtom)?.windowStart).toBe(before?.windowStart)
        expect(store.get(interactionFeedbackAtom)).toBeNull()
        expect(store.get(bumpAtom)).toBeNull()
        expect(store.get(liveRegionAtom)).toBeNull()
        expect(store.get(announcerAtom)).toEqual(IDLE_ANNOUNCER_STATE)
        expect(feedbackNotifications).toBe(0)

        const reverse = store.set(detentActionAtom, {
          path: 'direct',
          source: 'human',
          detents: -exhaustedDirection,
          timestampMs: 10,
        })
        unsubscribe()

        expect(reverse.detents).toBe(-exhaustedDirection)
        expect(reverse.rowDelta).toBe(-exhaustedDirection)
        expect(reverse.clickerTicks).toBe(1)
        expect(store.get(currentScreenAtom)?.highlightIndex).toBe(start - exhaustedDirection)
        expect(feedbackNotifications).toBe(1)
      })
    }
  }

  for (const edge of ['first', 'last'] as const) {
    test(`touch at the ${edge} row clears rejected residual and reverses on one ordinary detent`, () => {
      const exhaustedDirection = edge === 'first' ? -1 : 1
      const start = edge === 'first' ? 0 : 99
      const store = at(100, start)

      const rejected = store.set(detentActionAtom, {
        path: 'touch-arc',
        source: 'human',
        angleDeg: exhaustedDirection * 18,
        timestampMs: 10,
      })
      expect(rejected).toMatchObject({
        detents: 0,
        rowDelta: 0,
        clickerTicks: 0,
        hapticPulses: 0,
      })
      expect(rejected.accumulator).toMatchObject({
        armed: true,
        direction: 0,
        residualDeg: 0,
        speedDegPerSec: 0,
        recentMultipliers: [],
        coasting: false,
      })

      const reverse = store.set(detentActionAtom, {
        path: 'touch-arc',
        source: 'human',
        angleDeg: -exhaustedDirection * DETENT.arcDegPerDetent,
        timestampMs: 20,
      })
      expect(reverse).toMatchObject({
        detents: -exhaustedDirection,
        rowDelta: -exhaustedDirection,
        clickerTicks: 1,
        hapticPulses: 1,
      })
      expect(store.get(currentScreenAtom)?.highlightIndex).toBe(start - exhaustedDirection)
    })
  }

  test('an immediate key attempt at the first row neither speaks nor arms a stale announcement', () => {
    const store = at(20, 0)
    const rejected = store.set(detentActionAtom, {
      path: 'key',
      source: 'human',
      direction: -1,
      page: false,
      timestampMs: 1,
    })

    expect(rejected.detents).toBe(0)
    expect(store.get(liveRegionAtom)).toBeNull()
    expect(store.get(announcerAtom)).toEqual(IDLE_ANNOUNCER_STATE)

    store.set(detentActionAtom, {
      path: 'key',
      source: 'human',
      direction: 1,
      page: false,
      timestampMs: 2,
    })
    expect(store.get(liveRegionAtom)?.text).toContain('Row 2 of 20')
  })

  test('an accelerated event reports only the detent prefix accepted before the edge and drops its momentum', () => {
    const store = at(100, 95)
    store.set(detentAccumulatorAtom, {
      ...IDLE_DETENT_ACCUMULATOR,
      path: 'touch-arc',
      source: 'human',
      direction: 1,
      armed: true,
      speedDegPerSec: DETENT.maxAngularSpeedDegPerSec,
      recentMultipliers: [DETENT.rowsFaster, DETENT.rowsFaster, DETENT.rowsFaster],
      lastEventMs: 0,
    })

    const outcome = store.set(detentActionAtom, {
      path: 'touch-arc',
      source: 'human',
      angleDeg: 60,
      timestampMs: 10,
    })

    expect(store.get(currentScreenAtom)?.highlightIndex).toBe(99)
    expect(outcome.accelerated).toBeTrue()
    expect(outcome.multiplier).toBe(DETENT.rowsFaster)
    expect(outcome.rowDelta).toBe(4)
    expect(outcome.detents).toBe(1)
    expect(outcome.clickerTicks).toBe(1)
    expect(outcome.hapticPulses).toBe(1)
    expect(outcome.accumulator).toMatchObject({
      direction: 0,
      residualDeg: 0,
      speedDegPerSec: 0,
      coasting: false,
    })
    store.set(endGestureActionAtom)
    expect(store.get(detentAccumulatorAtom)).toEqual(IDLE_DETENT_ACCUMULATOR)
  })

  test('a mixed-multiplier coast counts the actual accepted prefix, not its final multiplier', () => {
    const store = at(100, 94)
    store.set(detentAccumulatorAtom, {
      ...IDLE_DETENT_ACCUMULATOR,
      path: 'touch-arc',
      source: 'human',
      direction: 1,
      armed: true,
      speedDegPerSec: 1_200,
      recentMultipliers: [DETENT.rowsFaster],
      coasting: true,
    })

    const outcome = store.set(coastActionAtom, 1 / 15)

    expect(store.get(currentScreenAtom)?.highlightIndex).toBe(99)
    expect(outcome.multiplier).toBe(DETENT.rowsFast)
    expect(outcome.rowDeltasByDetent).toEqual([5])
    expect(outcome.detents).toBe(1)
    expect(outcome.rowDelta).toBe(5)
    expect(outcome.clickerTicks).toBe(1)
    expect(outcome.hapticPulses).toBe(1)
    expect(outcome.accumulator.coasting).toBeFalse()
  })

  for (const edge of ['first', 'last'] as const) {
    test(`a coast aimed out of the ${edge} row stops in one frame without feedback or queued escape`, () => {
      const exhaustedDirection = edge === 'first' ? -1 : 1
      const start = edge === 'first' ? 0 : 99
      const store = at(100, start)
      store.set(detentAccumulatorAtom, {
        ...IDLE_DETENT_ACCUMULATOR,
        path: 'touch-arc',
        source: 'human',
        direction: exhaustedDirection,
        armed: true,
        residualDeg: exhaustedDirection * 14,
        speedDegPerSec: DETENT.maxAngularSpeedDegPerSec,
        recentMultipliers: [DETENT.rowsFaster],
        coasting: true,
      })

      const rejected = store.set(coastActionAtom, 1 / 15)
      expect(rejected).toMatchObject({
        detents: 0,
        rowDelta: 0,
        clickerTicks: 0,
        hapticPulses: 0,
      })
      expect(rejected.accumulator).toMatchObject({
        direction: 0,
        residualDeg: 0,
        speedDegPerSec: 0,
        coasting: false,
      })
      expect(store.get(interactionFeedbackAtom)).toBeNull()

      const reverse = store.set(detentActionAtom, {
        path: 'touch-arc',
        source: 'human',
        angleDeg: -exhaustedDirection * DETENT.arcDegPerDetent,
        timestampMs: 100,
      })
      expect(reverse.detents).toBe(-exhaustedDirection)
      expect(reverse.rowDelta).toBe(-exhaustedDirection)
      expect(store.get(currentScreenAtom)?.highlightIndex).toBe(start - exhaustedDirection)
    })
  }
})
