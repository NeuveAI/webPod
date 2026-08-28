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

    store.set(densityOverrideAtom, 'airy')

    expect(store.get(effectiveDensityAtom)).toBe('airy')
    expect(store.get(visibleRowCountAtom)).toBe(4)
    expect(store.get(screenSnapshotAtom)?.density).toBe('airy')
    expect(store.get(screenSnapshotAtom)?.rows).toHaveLength(4)
  })

  test('Dynamic Type at 130% forces airy over the human’s own setting', () => {
    const store = createDeviceStore()
    store.set(pushScreenActionAtom, listFrame(100, 'compact'))
    store.set(densityOverrideAtom, 'compact')
    store.set(dynamicTypeScaleAtom, 1.3)

    expect(store.get(effectiveDensityAtom)).toBe('airy')
    expect(store.get(visibleRowCountAtom)).toBe(4)
  })

  test('just below 130% it does not', () => {
    const store = createDeviceStore()
    store.set(pushScreenActionAtom, listFrame(100, 'compact'))
    store.set(dynamicTypeScaleAtom, 1.29)

    expect(store.get(effectiveDensityAtom)).toBe('compact')
  })

  test('paging follows the effective density, not the frame’s preference', () => {
    const store = createDeviceStore()
    store.set(pushScreenActionAtom, listFrame(100, 'compact'))
    store.set(densityOverrideAtom, 'airy')

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
