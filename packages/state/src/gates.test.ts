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
  effectiveDensityAtom,
  highlightIndexAtom,
  screenSnapshotAtom,
  visibleRowCountAtom,
} from './contract'
import type { PanelRow, ScreenFrame } from './contract'
import { detent } from './detent'
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
  test('haptics stop above 12 detents per second (001 §4.9)', () => {
    expect(DETENT.hapticSuppressAbovePerSec).toBe(12)
  })

  test('the coast decays at 0.94 per frame and stops below 60 deg/s (001 §4.4)', () => {
    // "remaining angular velocity decays at 0.94/frame, firing a detent every
    // 15° until |ω| < 60°/s."
    expect(DETENT.coastDecayPerFrame).toBe(0.94)
    expect(DETENT.coastFloorDegPerSec).toBe(60)
    expect(DETENT.arcDegPerDetent).toBe(15)
  })

  test('acceleration is 1, 3 and 7 rows per detent (001 §4.4)', () => {
    expect(DETENT.rowsSlow).toBe(1)
    expect(DETENT.rowsFast).toBe(3)
    expect(DETENT.rowsFaster).toBe(7)
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
