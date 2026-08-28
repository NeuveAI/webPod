/**
 * The gates for values and rules that are **rulings**, not derivations.
 *
 * ⚑ Why this file exists, stated plainly so it is not deleted as duplication:
 * a constant asserted only through itself is not asserted. A test that writes
 * `expect(outcome.rowDelta).toBe(VISIBLE_ROWS[density])` computes both sides
 * from one symbol, so changing that symbol moves the test with the bug and the
 * suite stays green. A review demonstrated this on this package: replacing the
 * per-density page sizes with a flat `7` — the exact value the lead had ruled
 * against — left 93 of 93 tests passing, and so did cutting the announcement
 * debounce from 350ms to 50ms.
 *
 * So: where a number is a **decision** rather than something derived, it is
 * asserted here against a literal transcribed from the source, with the source
 * cited. Falsify any constant below and something in this file goes red.
 *
 * The arc geometry is deliberately *not* repeated here — `detent.test.ts`
 * already gates it by feeding literal degrees and asserting literal detent
 * counts, which is the same property arrived at by a better route.
 */

import { describe, expect, test } from 'bun:test'

import {
  AIRY_FORCING_TYPE_SCALE,
  ANNOUNCE_DEBOUNCE_MS,
  DETENT,
  IDLE_DETENT_ACCUMULATOR,
  KEY_REPEAT_WINDOW_MS,
  ROW_HEIGHT_PX,
  VISIBLE_ROWS,
  bumpAtom,
  densityOverrideAtom,
  dynamicTypeScaleAtom,
  currentScreenAtom,
  effectiveDensityAtom,
  highlightIndexAtom,
  screenSnapshotAtom,
  visibleRowCountAtom,
} from './contract'
import type { PanelRow, ScreenFrame } from './contract'
import { coastStep, detent, endGesture } from './detent'
import {
  createDeviceStore,
  detentActionAtom,
  popScreenActionAtom,
  pressActionAtom,
  pushScreenActionAtom,
  setDensityActionAtom,
  setDynamicTypeScaleActionAtom,
} from './store'

function listFrame(count: number, density: ScreenFrame['density']): ScreenFrame {
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
    density,
    rows,
    highlightIndex: 0,
    windowStart: 0,
  }
}

describe('density is 8 / 6 / 4, and a page is one viewport', () => {
  test('the row counts are literally 8, 6 and 4 (001 §3)', () => {
    // 001 §3: "compact 26px rows / 8 visible / 13px text; medium 32px / 6 /
    // 15px; airy 44px / 4 / 17px". Not a flat 7 — 001 §4.4's "7 rows (one
    // page)" contradicts §4.3 and §4.6, and the lead ruled for the viewport
    // reading. This is that ruling, in a form that cannot silently revert.
    expect(VISIBLE_ROWS.compact).toBe(8)
    expect(VISIBLE_ROWS.medium).toBe(6)
    expect(VISIBLE_ROWS.airy).toBe(4)
  })

  test('the row heights are literally 26, 32 and 44 (001 §3)', () => {
    expect(ROW_HEIGHT_PX.compact).toBe(26)
    expect(ROW_HEIGHT_PX.medium).toBe(32)
    expect(ROW_HEIGHT_PX.airy).toBe(44)
  })

  test('no density pages by 7', () => {
    // The specific value that was ruled against, named so a reader knows why
    // this assertion is here rather than folded into the one above.
    for (const density of ['compact', 'medium', 'airy'] as const) {
      expect(VISIBLE_ROWS[density]).not.toBe(7)
    }
  })

  test('Shift+Arrow moves 8 rows on a compact screen, through the store', () => {
    // ⚑ The store supplies the page size; the caller cannot. This is the
    // orphan-row failure the ruling exists to prevent: a flat 7 on an 8-row
    // viewport leaves one row the human can page past but never land on.
    const store = createDeviceStore()
    store.set(pushScreenActionAtom, listFrame(100, 'compact'))

    store.set(detentActionAtom, {
      path: 'key',
      source: 'human',
      direction: 1,
      page: true,
      timestampMs: 0,
    })

    expect(store.get(visibleRowCountAtom)).toBe(8)
    expect(store.get(highlightIndexAtom)).toBe(8)
  })

  test('Shift+Arrow moves 4 rows on an airy screen, through the store', () => {
    const store = createDeviceStore()
    store.set(pushScreenActionAtom, listFrame(100, 'airy'))

    store.set(detentActionAtom, {
      path: 'key',
      source: 'human',
      direction: 1,
      page: true,
      timestampMs: 0,
    })

    expect(store.get(highlightIndexAtom)).toBe(4)
  })

  test('the reducer cannot be handed a page size at all', () => {
    // The strongest available form: `pageRows` was a field on the key event
    // and a caller could pass any number. It is now a parameter of the reducer
    // call, which the store supplies from the density it owns. This test
    // documents the shape; the type system enforces it.
    const outcome = detent(
      IDLE_DETENT_ACCUMULATOR,
      { path: 'key', source: 'human', direction: 1, page: true, timestampMs: 0 },
      VISIBLE_ROWS.compact,
    )
    expect(outcome.rowDelta).toBe(8)
    expect(outcome.detents).toBe(1)
  })
})

describe('the announcement debounce is 350ms', () => {
  test('literally 350 (001 §4.4, gate U13)', () => {
    // "Detent settles debounced to one aria-live=polite at 350ms."
    expect(ANNOUNCE_DEBOUNCE_MS).toBe(350)
  })

  test('the auto-repeat window is literally 250ms', () => {
    // Not from 001 — 001 says a keypress announces immediately and is
    // "debounced only during auto-repeat" without saying how a repeat is
    // recognised. 250 sits below every OS auto-repeat *delay* and far above
    // every repeat *interval*. Gated because it is an invented value, which is
    // exactly the kind most likely to be edited without noticing.
    expect(KEY_REPEAT_WINDOW_MS).toBe(250)
  })
})

describe('the detent constants that are rulings', () => {
  test('D-063 leaves no high-rate haptic policy in the wheel constants', () => {
    expect('hapticSuppressAbovePerSec' in DETENT).toBe(false)
  })

  test('the coast decays at 0.94 per frame and stops below 21 deg/s (§9.4)', () => {
    // design-system §9.4: "ω *= 0.940 at 60fps ... Stop when |ω| < 0.35
    // °/frame (≈21 °/s)". 0.35 x 60fps = 21. §14.1's frame-budget table
    // repeats the same 0.35°/frame for when the wheel's render loop
    // terminates, so two design-system sections agree.
    expect(DETENT.coastDecayPerFrame).toBe(0.94)
    expect(DETENT.coastFloorDegPerSec).toBe(21)
    expect(DETENT.arcDegPerDetent).toBe(15)

    // pm-spec §4.4's superseded figure (D-063).
    expect(DETENT.coastFloorDegPerSec).not.toBe(60)

    // And it really is 0.35 deg/frame at the reference rate, which is the form
    // both design-system sections state it in.
    expect(DETENT.coastFloorDegPerSec / DETENT.coastReferenceFps).toBeCloseTo(0.35, 10)
  })

  test('acceleration is 1, 4 and 12 rows per detent (design-system §9.4)', () => {
    // ⚑ §9.4, *The wheel inertia and detent model*: "×1 below 720 °/s, ×4 at
    // 720–1080, ×12 above 1080". pm-spec §4.4's table says ×1/×3/×7 at
    // 240/540; D-063 rules that §9.4 governs, because acceleration physics is
    // its subject and §4.4's aside. The rejected values are named here so a
    // reader knows this assertion settles a conflict rather than restating a
    // number.
    expect(DETENT.rowsSlow).toBe(1)
    expect(DETENT.rowsFast).toBe(4)
    expect(DETENT.rowsFaster).toBe(12)

    expect(DETENT.rowsFast).not.toBe(3)
    expect(DETENT.rowsFaster).not.toBe(7)
  })

  test('the fast-scroll thresholds are 720 and 1080 deg/s (design-system §9.4)', () => {
    expect(DETENT.fastThresholdDegPerSec).toBe(720)
    expect(DETENT.fasterThresholdDegPerSec).toBe(1080)

    // pm-spec §4.4's superseded pair.
    expect(DETENT.fastThresholdDegPerSec).not.toBe(240)
    expect(DETENT.fasterThresholdDegPerSec).not.toBe(540)
  })

  test('Dynamic Type forces airy at 130% (001 §15.0 U11)', () => {
    expect(AIRY_FORCING_TYPE_SCALE).toBe(1.3)
  })
})

describe('the density setting is not inert', () => {
  test('by default a screen renders at the density it prefers', () => {
    const store = createDeviceStore()
    store.set(pushScreenActionAtom, listFrame(100, 'compact'))

    expect(store.get(effectiveDensityAtom)).toBe('compact')
    expect(store.get(visibleRowCountAtom)).toBe(8)
  })

  test('setting the override moves the viewport, the page size and the snapshot', () => {
    // The measured regression: this used to leave `visibleRowCount` at 8 with
    // no error, no type failure and no test — the row height and the window
    // size then disagree, which is a row you can never scroll to.
    const store = createDeviceStore()
    store.set(pushScreenActionAtom, listFrame(100, 'compact'))

    store.set(setDensityActionAtom, 'airy')

    expect(store.get(effectiveDensityAtom)).toBe('airy')
    expect(store.get(visibleRowCountAtom)).toBe(4)
    expect(store.get(screenSnapshotAtom)?.density).toBe('airy')
    expect(store.get(screenSnapshotAtom)?.rows).toHaveLength(4)
  })

  test('Dynamic Type at 130% forces airy over the human’s own setting', () => {
    const store = createDeviceStore()
    store.set(pushScreenActionAtom, listFrame(100, 'compact'))
    store.set(setDensityActionAtom, 'compact')
    store.set(setDynamicTypeScaleActionAtom, 1.3)

    expect(store.get(effectiveDensityAtom)).toBe('airy')
    expect(store.get(visibleRowCountAtom)).toBe(4)
  })

  test('just below 130% it does not', () => {
    const store = createDeviceStore()
    store.set(pushScreenActionAtom, listFrame(100, 'compact'))
    store.set(setDynamicTypeScaleActionAtom, 1.29)

    expect(store.get(effectiveDensityAtom)).toBe('compact')
  })

  test('paging follows the effective density, not the frame’s preference', () => {
    const store = createDeviceStore()
    store.set(pushScreenActionAtom, listFrame(100, 'compact'))
    store.set(setDensityActionAtom, 'airy')

    store.set(detentActionAtom, {
      path: 'key',
      source: 'human',
      direction: 1,
      page: true,
      timestampMs: 0,
    })

    expect(store.get(highlightIndexAtom)).toBe(4)
  })
})

describe('R2 — one clock stamps every published time', () => {
  /** A device whose clock reads a value no caller would ever pass by accident. */
  function pinnedDevice(): ReturnType<typeof createDeviceStore> {
    return createDeviceStore({ now: () => 500_000 })
  }

  test('a wheel bump is stamped from the device clock', () => {
    const store = pinnedDevice()
    store.set(pushScreenActionAtom, listFrame(3, 'compact'))
    // Push into the top of the list so the movement clamps and bumps.
    store.set(detentActionAtom, {
      path: 'direct',
      source: 'human',
      detents: -5,
      timestampMs: 1_700_000_000_000,
    })

    expect(store.get(bumpAtom)?.at).toBe(500_000)
  })

  test('a Menu bump at the root is stamped from the device clock', () => {
    const store = pinnedDevice()
    store.set(popScreenActionAtom)
    expect(store.get(bumpAtom)?.at).toBe(500_000)
  })

  test('a transport bump is stamped from the device clock', () => {
    const store = pinnedDevice()
    store.set(pushScreenActionAtom, listFrame(3, 'compact'))
    store.set(pressActionAtom, { button: 'next', source: 'human' })

    expect(store.get(bumpAtom)?.at).toBe(500_000)
  })

  test('all three writers agree, whatever a caller passes', () => {
    // ⚑ The defect this replaces: `bump.at` read 500000 from the wheel and
    // 1.7e12 from Menu and the transport, on one device, in one field, chosen
    // by which control the human touched. A consumer ageing a bump with
    // `now - bump.at` would have got a sane number for one and a nonsense one
    // for the others.
    const store = pinnedDevice()
    store.set(pushScreenActionAtom, listFrame(3, 'compact'))
    const stamps: Array<number | undefined> = []

    store.set(detentActionAtom, {
      path: 'direct',
      source: 'human',
      detents: -5,
      timestampMs: 1_700_000_000_000,
    })
    stamps.push(store.get(bumpAtom)?.at)

    store.set(pressActionAtom, { button: 'next', source: 'human' })
    stamps.push(store.get(bumpAtom)?.at)

    store.set(popScreenActionAtom)
    stamps.push(store.get(bumpAtom)?.at)

    expect(stamps).toEqual([500_000, 500_000, 500_000])
  })

  test('the bump sequence still increments, so two identical bumps are distinct', () => {
    const store = pinnedDevice()
    const seqs = [
      store.set(popScreenActionAtom)?.seq,
      store.set(popScreenActionAtom)?.seq,
      store.set(popScreenActionAtom)?.seq,
    ]
    expect(seqs).toEqual([1, 2, 3])
  })
})

describe('R3 — the density route that half-worked is now unconstructible', () => {
  function scrolledDevice(): ReturnType<typeof createDeviceStore> {
    const store = createDeviceStore()
    store.set(pushScreenActionAtom, listFrame(100, 'compact'))
    // Walk the highlight down to row 60 so the window is well away from zero.
    store.set(detentActionAtom, {
      path: 'direct',
      source: 'human',
      detents: 60,
      timestampMs: 0,
    })
    return store
  }

  /** The absolute row indices currently on the glass. */
  function windowRows(store: ReturnType<typeof createDeviceStore>): number[] {
    return (store.get(screenSnapshotAtom)?.rows ?? []).map((row) => row.index)
  }

  test('the highlight stays inside the window when density changes', () => {
    // ⚑ The measured regression: highlight on row 60, window at rows 53–56 —
    // the highlighted row not among the rows rendered. That is the "row you
    // can never scroll to" the density work exists to prevent, and it was
    // reachable through the route a doc comment recommended.
    const store = scrolledDevice()
    expect(store.get(highlightIndexAtom)).toBe(60)

    store.set(setDensityActionAtom, 'airy')

    const rows = windowRows(store)
    expect(rows).toHaveLength(4)
    expect(rows).toContain(60)
    expect(rows).toEqual([57, 58, 59, 60])
  })

  test('and when Dynamic Type forces airy', () => {
    const store = scrolledDevice()
    store.set(setDynamicTypeScaleActionAtom, 1.3)

    const rows = windowRows(store)
    expect(rows).toHaveLength(4)
    expect(rows).toContain(60)
  })

  test('every frame on the stack is re-clamped, not just the visible one', () => {
    // A screen the human returns to with `Menu` must be as valid as the one
    // they are looking at, or the list is empty on the way back down.
    const store = scrolledDevice()
    store.set(pushScreenActionAtom, listFrame(20, 'compact'))
    store.set(setDensityActionAtom, 'airy')
    store.set(popScreenActionAtom)

    const rows = windowRows(store)
    expect(rows).toContain(store.get(highlightIndexAtom))
  })

  test('the bare write does not typecheck, and this is why it must not', () => {
    // ⚑ The enforcement is the type, and this test is the proof of it: `tsc`
    // reports an *unused* `@ts-expect-error` as an error, so this file
    // compiling at all establishes that each directive suppressed a real one.
    // Nothing here needs to throw — read-only is a compile-time view of the
    // same atom, so the write below succeeds at runtime. That is precisely the
    // point: it succeeds, and leaves the device wrong. Invariant recorded in
    // decisions/w2.md §8; these are the only two directives in the package.
    const store = scrolledDevice()
    expect(store.get(highlightIndexAtom)).toBe(60)

    // @ts-expect-error densityOverrideAtom is published read-only; use setDensityActionAtom
    store.set(densityOverrideAtom, 'airy')

    // Derived readers moved, exactly as the old comment claimed.
    expect(store.get(effectiveDensityAtom)).toBe('airy')
    expect(store.get(visibleRowCountAtom)).toBe(4)

    // And the window did not, because it is stored rather than derived. The
    // highlighted row is not on the glass.
    expect(windowRows(store)).toEqual([53, 54, 55, 56])
    expect(windowRows(store)).not.toContain(60)
  })

  test('the Dynamic Type bare write does not typecheck either', () => {
    const store = scrolledDevice()

    // @ts-expect-error dynamicTypeScaleAtom is published read-only; use setDynamicTypeScaleActionAtom
    store.set(dynamicTypeScaleAtom, 1.3)

    expect(store.get(effectiveDensityAtom)).toBe('airy')
    expect(windowRows(store)).not.toContain(60)
  })

  test('but reading them still works, because they are legitimate state', () => {
    const store = createDeviceStore()
    expect(store.get(densityOverrideAtom)).toBeNull()
    expect(store.get(dynamicTypeScaleAtom)).toBe(1)

    store.set(setDensityActionAtom, 'medium')
    store.set(setDynamicTypeScaleActionAtom, 1.1)

    expect(store.get(densityOverrideAtom)).toBe('medium')
    expect(store.get(dynamicTypeScaleAtom)).toBe(1.1)
  })
})

describe('D-063 — the §9.4 fast-scroll curve, behaviourally', () => {
  /** Runs an arc at a steady angular speed and returns the settled multiplier. */
  function multiplierAt(speedDegPerSec: number, path: 'touch-arc' | 'mouse-arc'): number {
    const stepMs = 20
    let accumulator = IDLE_DETENT_ACCUMULATOR
    let multiplier = 1
    for (let i = 0; i < 8; i += 1) {
      const outcome = detent(
        accumulator,
        {
          path,
          source: 'human',
          angleDeg: (speedDegPerSec * stepMs) / 1000,
          timestampMs: (i + 1) * stepMs,
        },
        VISIBLE_ROWS.medium,
        { totalRows: 500 },
      )
      accumulator = outcome.accumulator
      multiplier = outcome.multiplier
    }
    return multiplier
  }

  test('below 720 deg/s a detent is one row', () => {
    expect(multiplierAt(300, 'touch-arc')).toBe(1)
    expect(multiplierAt(700, 'touch-arc')).toBe(1)
  })

  test('between 720 and 1080 deg/s a detent is four rows', () => {
    expect(multiplierAt(800, 'touch-arc')).toBe(4)
    expect(multiplierAt(1000, 'touch-arc')).toBe(4)
  })

  test('above 1080 deg/s a detent is twelve rows', () => {
    expect(multiplierAt(1500, 'touch-arc')).toBe(12)
    expect(multiplierAt(3000, 'touch-arc')).toBe(12)
  })

  test('the superseded pm-spec tiers are not reachable at any speed', () => {
    // ⚑ 3 and 7 were §4.4's multipliers. If either turns up, the ruling has
    // been quietly reverted.
    for (const speed of [100, 239, 241, 500, 539, 541, 719, 721, 1079, 1081, 5000]) {
      expect([1, 4, 12]).toContain(multiplierAt(speed, 'touch-arc'))
    }
  })

  test('a mouse arc needs 1.4x the speed, per pm-spec §4.4 which §9.4 does not cover', () => {
    // §9.4 is silent on input path, and §4.4's per-path adjustment is its own
    // subject, so it survives the ruling and applies to the new thresholds.
    expect(multiplierAt(900, 'touch-arc')).toBe(4)
    expect(multiplierAt(900, 'mouse-arc')).toBe(1)
    expect(multiplierAt(1100, 'mouse-arc')).toBe(4)
  })
})

describe('D-063 — fast-scroll needs a long list, not just a fast thumb', () => {
  /** Runs a very fast arc through a list of `totalRows` and returns the multiplier. */
  function multiplierOnList(totalRows: number, speedDegPerSec = 3000): number {
    const stepMs = 20
    let accumulator = IDLE_DETENT_ACCUMULATOR
    let multiplier = 1
    for (let i = 0; i < 8; i += 1) {
      const outcome = detent(
        accumulator,
        {
          path: 'touch-arc',
          source: 'human',
          angleDeg: (speedDegPerSec * stepMs) / 1000,
          timestampMs: (i + 1) * stepMs,
        },
        VISIBLE_ROWS.medium,
        { totalRows },
      )
      accumulator = outcome.accumulator
      multiplier = outcome.multiplier
    }
    return multiplier
  }

  test('the threshold is literally 40 rows (design-system §9.4)', () => {
    // "Engages when |ω| > 720 °/s AND the list exceeds 40 items." pm-spec §4.4
    // has no such precondition at all.
    expect(DETENT.fastScrollMinRows).toBe(40)
  })

  test('a 39-row list cannot fast-scroll at ANY angular speed', () => {
    // ⚑ The failure without this: a twelve-row menu enters fast-scroll on a
    // brisk flick and jumps four rows per detent through a list four rows
    // long. Swept rather than sampled, because "at any speed" is the claim.
    for (const speed of [100, 500, 719, 721, 900, 1079, 1081, 2000, 5000, 50_000]) {
      expect(multiplierOnList(39, speed)).toBe(1)
    }
  })

  test('exactly 40 rows is still too short — the spec says *exceeds* 40', () => {
    expect(multiplierOnList(40)).toBe(1)
  })

  test('41 rows is long enough', () => {
    expect(multiplierOnList(41)).toBe(12)
  })

  test('the main menu cannot fast-scroll, however hard it is flicked', () => {
    // The real case this protects: the root menu is eight rows.
    const store = createDeviceStore()
    const rows = store.get(currentScreenAtom)?.rows.length ?? 0
    expect(rows).toBeLessThan(DETENT.fastScrollMinRows)

    for (let i = 0; i < 8; i += 1) {
      const outcome = store.set(detentActionAtom, {
        path: 'touch-arc',
        source: 'human',
        angleDeg: 60,
        timestampMs: (i + 1) * 20,
      })
      expect(outcome.multiplier).toBe(1)
      expect(outcome.accelerated).toBe(false)
    }
  })

  test('a long list reached through the store does fast-scroll', () => {
    const store = createDeviceStore()
    store.set(pushScreenActionAtom, listFrame(500, 'compact'))

    let accelerated = false
    for (let i = 0; i < 8; i += 1) {
      const outcome = store.set(detentActionAtom, {
        path: 'touch-arc',
        source: 'human',
        angleDeg: 60,
        timestampMs: (i + 1) * 20,
      })
      accelerated = accelerated || outcome.accelerated
    }
    expect(accelerated).toBe(true)
  })

  test('omitting the list length disables fast-scroll, which is the safe way to be wrong', () => {
    const stepMs = 20
    let accumulator = IDLE_DETENT_ACCUMULATOR
    let multiplier = 1
    for (let i = 0; i < 8; i += 1) {
      const outcome = detent(
        accumulator,
        { path: 'touch-arc', source: 'human', angleDeg: 60, timestampMs: (i + 1) * stepMs },
        VISIBLE_ROWS.medium,
      )
      accumulator = outcome.accumulator
      multiplier = outcome.multiplier
    }
    expect(multiplier).toBe(1)
  })
})

describe('D-063 — angular velocity is clamped at 1440 deg/s', () => {
  test('the ceiling is literally 1440 (design-system §9.4)', () => {
    // Four revolutions a second. pm-spec §4.4 sets no ceiling at all.
    expect(DETENT.maxAngularSpeedDegPerSec).toBe(1440)
  })

  test('an absurd spin is recorded at the ceiling, not above it', () => {
    // 3600 degrees in 10ms is 360,000 deg/s — a thousand revolutions a second,
    // which a trackpad fling or a synthetic event can genuinely produce.
    const first = detent(
      IDLE_DETENT_ACCUMULATOR,
      { path: 'touch-arc', source: 'human', angleDeg: 18, timestampMs: 0 },
      VISIBLE_ROWS.medium,
      { totalRows: 500 },
    )
    const spun = detent(
      first.accumulator,
      { path: 'touch-arc', source: 'human', angleDeg: 3600, timestampMs: 10 },
      VISIBLE_ROWS.medium,
      { totalRows: 500 },
    )

    expect(spun.accumulator.speedDegPerSec).toBe(1440)
  })

  test('the clamp bounds the coast too, so a fling cannot glide forever', () => {
    // The velocity the coast starts from is the clamped one, so the longest
    // possible glide is bounded rather than proportional to how hard the
    // event said the thumb moved.
    let accumulator = IDLE_DETENT_ACCUMULATOR
    for (let i = 0; i < 4; i += 1) {
      accumulator = detent(
        accumulator,
        {
          path: 'touch-arc',
          source: 'human',
          angleDeg: 3600,
          timestampMs: (i + 1) * 10,
        },
        VISIBLE_ROWS.medium,
        { totalRows: 500 },
      ).accumulator
    }

    let coasting = endGesture(accumulator)
    expect(coasting.speedDegPerSec).toBe(1440)

    let detents = 0
    let frames = 0
    while (coasting.coasting && frames < 10_000) {
      const outcome = coastStep(coasting, 1 / 60, { totalRows: 500 })
      detents += Math.abs(outcome.detents)
      coasting = outcome.accumulator
      frames += 1
    }

    // Bounded, and bounded by the ceiling rather than by the input: the total
    // travel is (1440 - 21) / λ degrees, which is under one and a half
    // revolutions of the wheel.
    expect(detents).toBeLessThan(40)
    expect(detents).toBeGreaterThan(0)
  })

  test('ordinary speeds are untouched by the clamp', () => {
    const outcome = detent(
      detent(
        IDLE_DETENT_ACCUMULATOR,
        { path: 'touch-arc', source: 'human', angleDeg: 18, timestampMs: 0 },
        VISIBLE_ROWS.medium,
        { totalRows: 500 },
      ).accumulator,
      { path: 'touch-arc', source: 'human', angleDeg: 18, timestampMs: 20 },
      VISIBLE_ROWS.medium,
      { totalRows: 500 },
    )

    expect(outcome.accumulator.speedDegPerSec).toBe(900)
  })
})

describe('D-063 — detent hysteresis stops a resting thumb chattering', () => {
  test('the hysteresis is literally 1.8 degrees (design-system §9.4)', () => {
    // "Detent threshold hysteresis ±1.8°". pm-spec §4.4 does not mention it.
    expect(DETENT.reversalHysteresisDeg).toBe(1.8)
  })

  test('a thumb jittering across a boundary fires nothing', () => {
    // ⚑ The failure without this: a hand held still near a threshold crosses
    // it on tremor alone, so the highlight oscillates and the clicker
    // machine-guns while nobody is moving. Here the thumb advances one detent
    // and then shakes by ±15° — exactly one detent's worth each way, which
    // without hysteresis fires every single time.
    let accumulator = detent(
      IDLE_DETENT_ACCUMULATOR,
      { path: 'touch-arc', source: 'human', angleDeg: 18, timestampMs: 0 },
      VISIBLE_ROWS.medium,
      { totalRows: 500 },
    ).accumulator

    let fired = 0
    for (let i = 0; i < 20; i += 1) {
      const outcome = detent(
        accumulator,
        {
          path: 'touch-arc',
          source: 'human',
          angleDeg: i % 2 === 0 ? -15 : 15,
          timestampMs: 20 + i * 20,
        },
        VISIBLE_ROWS.medium,
        { totalRows: 500 },
      )
      fired += Math.abs(outcome.detents)
      accumulator = outcome.accumulator
    }

    expect(fired).toBe(0)
  })

  test('a deliberate reversal still works, it just costs 1.8 degrees more', () => {
    let accumulator = detent(
      IDLE_DETENT_ACCUMULATOR,
      { path: 'touch-arc', source: 'human', angleDeg: 18, timestampMs: 0 },
      VISIBLE_ROWS.medium,
      { totalRows: 500 },
    ).accumulator

    const short = detent(
      accumulator,
      { path: 'touch-arc', source: 'human', angleDeg: -16.7, timestampMs: 20 },
      VISIBLE_ROWS.medium,
      { totalRows: 500 },
    )
    expect(short.detents).toBe(0)

    accumulator = detent(
      accumulator,
      { path: 'touch-arc', source: 'human', angleDeg: -16.8, timestampMs: 20 },
      VISIBLE_ROWS.medium,
      { totalRows: 500 },
    ).accumulator
    expect(accumulator.direction).toBe(-1)
  })

  test('continuing in the same direction is never charged the extra', () => {
    // Hysteresis must not tax ordinary scrolling: 10 detents forward is 10
    // detents forward, at 15 degrees each.
    const outcomes: number[] = []
    let accumulator = IDLE_DETENT_ACCUMULATOR
    for (let i = 0; i < 11; i += 1) {
      const outcome = detent(
        accumulator,
        {
          path: 'touch-arc',
          source: 'human',
          angleDeg: i === 0 ? 18 : 15,
          timestampMs: (i + 1) * 200,
        },
        VISIBLE_ROWS.medium,
        { totalRows: 500 },
      )
      outcomes.push(outcome.detents)
      accumulator = outcome.accumulator
    }

    expect(outcomes.reduce((a, b) => a + b, 0)).toBe(11)
  })

  test('the keyboard is untouched by it — a reversal is still one detent', () => {
    // ⚑ 001's non-negotiable: one keydown is one row, always. Hysteresis is an
    // arc-geometry rule and must not reach a path that has no geometry.
    let accumulator = IDLE_DETENT_ACCUMULATOR
    let net = 0
    for (const direction of [1, 1, -1, 1, -1, -1, 1] as const) {
      const outcome = detent(
        accumulator,
        { path: 'key', source: 'human', direction, page: false, timestampMs: 0 },
        VISIBLE_ROWS.medium,
        { totalRows: 500 },
      )
      expect(Math.abs(outcome.detents)).toBe(1)
      net += outcome.rowDelta
      accumulator = outcome.accumulator
    }
    expect(net).toBe(1)
  })
})

describe('D-063 — the coast floor, behaviourally', () => {
  /** Releases an arc at `speed` deg/s and counts frames to rest at 60fps. */
  function framesToRest(speedDegPerSec: number): number {
    const stepMs = 20
    let accumulator = IDLE_DETENT_ACCUMULATOR
    for (let i = 0; i < 6; i += 1) {
      accumulator = detent(
        accumulator,
        {
          path: 'touch-arc',
          source: 'human',
          angleDeg: (speedDegPerSec * stepMs) / 1000,
          timestampMs: (i + 1) * stepMs,
        },
        VISIBLE_ROWS.medium,
        { totalRows: 500 },
      ).accumulator
    }

    let coasting = endGesture(accumulator)
    let frames = 0
    while (coasting.coasting && frames < 100_000) {
      coasting = coastStep(coasting, 1 / 60, { totalRows: 500 }).accumulator
      frames += 1
    }
    return frames
  }

  test('a 1000 deg/s release glides for 63 frames, not 46', () => {
    // ⚑ The behavioural half of the floor change, and the discriminator that a
    // constant assertion alone cannot give: at pm-spec §4.4's 60°/s the same
    // release stopped after 46 frames — the figure the previous round's review
    // measured and verified independently. At §9.4's 21°/s it runs to 63. The
    // glide is materially longer, which is the point of the ruling.
    expect(framesToRest(1000)).toBe(63)

    // Computed from the spec's own numbers rather than from the code's, so
    // this does not merely restate the implementation.
    const independently = Math.ceil(Math.log(21 / 1000) / Math.log(0.94))
    expect(framesToRest(1000)).toBe(independently)
  })

  test('a harder release glides longer still, and stays bounded by the clamp', () => {
    // The ceiling caps how long any glide can be: 1440°/s is the fastest
    // velocity the reducer will record, so this is the longest coast possible.
    const longest = framesToRest(5000)
    expect(longest).toBe(Math.ceil(Math.log(21 / 1440) / Math.log(0.94)))
    expect(longest).toBeGreaterThan(framesToRest(1000))
  })

  test('the state layer and the render loop stop on the same condition', () => {
    // design-system §14.1's frame-budget table terminates the wheel's render
    // loop at "inertia ‖ω‖ < 0.35°/frame" — the same figure §9.4 gives for the
    // coast. Expressed here in §14.1's units so a drift in either shows up.
    expect(DETENT.coastFloorDegPerSec / DETENT.coastReferenceFps).toBeCloseTo(0.35, 10)
  })
})
