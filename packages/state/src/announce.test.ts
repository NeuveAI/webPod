/**
 * U13: a flick produces one announcement, not one per detent.
 *
 * The headline test drives thirty real detents through the real reducer and
 * the real store, with no fake timers and no mocks — the only thing supplied
 * is the clock, because a debounce that cannot be told what time it is cannot
 * be tested at all. If this file goes green with a count above one, a screen
 * reader user is being read a list of every row they scrolled past.
 */

import { describe, expect, test } from 'bun:test'

import {
  ANNOUNCE_DEBOUNCE_MS,
  IDLE_ANNOUNCER_STATE,
  VISIBLE_ROWS,
  agentActiveAtom,
  announcerAtom,
  liveRegionAtom,
} from './contract'
import type { Announcement, PanelRow, ScreenFrame, ScreenSnapshotSource } from './contract'
import { clearAnnouncer, describeMovement, flushAnnouncer, noteMovement } from './announce'
import {
  createDeviceStore,
  detentActionAtom,
  endGestureActionAtom,
  flushAnnouncementsActionAtom,
  pushScreenActionAtom,
  startAnnouncer,
} from './store'

function songFrame(count: number): ScreenFrame {
  const rows: readonly PanelRow[] = Array.from({ length: count }, (_, index) => ({
    index,
    label: `Song ${String(index + 1)}`,
    sublabel: 'Vienna Teng',
    glyphs: [],
    provenance: null,
  }))
  return {
    screenId: 'S09',
    title: 'Songs',
    density: 'compact',
    rows,
    highlightIndex: 0,
    windowStart: 0,
  }
}

function sourceAt(frame: ScreenFrame, highlightIndex: number): ScreenSnapshotSource {
  return { face: 'front', frame: { ...frame, highlightIndex }, agentActive: false }
}

describe('U13 — a flick announces once', () => {
  test('30 detents through the real store produce exactly ONE announcement', () => {
    const store = createDeviceStore()
    store.set(pushScreenActionAtom, songFrame(200))

    const spoken: Announcement[] = []
    const unsubscribe = store.sub(liveRegionAtom, () => {
      const announcement = store.get(liveRegionAtom)
      if (announcement !== null) spoken.push(announcement)
    })

    // A flick: 30 detents at 15 degrees each, 20ms apart. Fast enough to be
    // well into the acceleration curve, which is exactly the case where a
    // naive implementation floods the live region.
    for (let i = 0; i < 30; i += 1) {
      store.set(detentActionAtom, {
        path: 'touch-arc',
        source: 'human',
        angleDeg: i === 0 ? 18 : 15,
        timestampMs: i * 20,
      })
    }

    // Mid-flick, nothing has been said at all.
    expect(spoken).toHaveLength(0)

    // The motion stops. 350ms later, one sentence.
    const settledAt = 29 * 20 + ANNOUNCE_DEBOUNCE_MS
    store.set(endGestureActionAtom, settledAt)
    unsubscribe()

    expect(spoken).toHaveLength(1)
    expect(spoken[0]?.politeness).toBe('polite')
    expect(store.get(announcerAtom).emitted).toBe(1)
  })

  test('the one sentence names the row the flick settled on', () => {
    const store = createDeviceStore()
    store.set(pushScreenActionAtom, songFrame(200))

    for (let i = 0; i < 30; i += 1) {
      store.set(detentActionAtom, {
        path: 'touch-arc',
        source: 'human',
        angleDeg: i === 0 ? 18 : 15,
        timestampMs: i * 20,
      })
    }
    store.set(endGestureActionAtom, 29 * 20 + ANNOUNCE_DEBOUNCE_MS)

    const announcement = store.get(liveRegionAtom)
    const frame = store.get(announcerAtom)
    expect(frame.settling).toBeNull()
    expect(announcement?.text).toMatch(/^Row \d+ of 200\. Song \d+, Vienna Teng\.$/)
  })

  test('flushing repeatedly after a flick still says it once', () => {
    const store = createDeviceStore()
    store.set(pushScreenActionAtom, songFrame(200))

    for (let i = 0; i < 30; i += 1) {
      store.set(detentActionAtom, {
        path: 'touch-arc',
        source: 'human',
        angleDeg: i === 0 ? 18 : 15,
        timestampMs: i * 20,
      })
    }

    const settledAt = 29 * 20 + ANNOUNCE_DEBOUNCE_MS
    expect(store.set(flushAnnouncementsActionAtom, settledAt)).not.toBeNull()
    expect(store.set(flushAnnouncementsActionAtom, settledAt + 10)).toBeNull()
    expect(store.set(flushAnnouncementsActionAtom, settledAt + 5000)).toBeNull()
  })

  test('nothing is said before the debounce elapses', () => {
    const store = createDeviceStore()
    store.set(pushScreenActionAtom, songFrame(200))

    store.set(detentActionAtom, {
      path: 'touch-arc',
      source: 'human',
      angleDeg: 18,
      timestampMs: 0,
    })

    expect(store.set(flushAnnouncementsActionAtom, ANNOUNCE_DEBOUNCE_MS - 1)).toBeNull()
    expect(store.get(liveRegionAtom)).toBeNull()
    expect(store.set(flushAnnouncementsActionAtom, ANNOUNCE_DEBOUNCE_MS)).not.toBeNull()
  })

  test('a scroll flick behaves the same as a touch flick', () => {
    const store = createDeviceStore()
    store.set(pushScreenActionAtom, songFrame(200))

    let spoken = 0
    const unsubscribe = store.sub(liveRegionAtom, () => {
      spoken += 1
    })

    for (let i = 0; i < 30; i += 1) {
      store.set(detentActionAtom, {
        path: 'scroll',
        source: 'human',
        deltaY: 40,
        deltaMode: 0,
        viewportPx: 800,
        timestampMs: i * 16,
      })
    }
    expect(spoken).toBe(0)

    store.set(endGestureActionAtom, 29 * 16 + ANNOUNCE_DEBOUNCE_MS)
    unsubscribe()

    expect(spoken).toBe(1)
  })
})

describe('the keyboard announces immediately, because it is deterministic', () => {
  test('one keypress speaks at once, with no debounce', () => {
    const store = createDeviceStore()
    store.set(pushScreenActionAtom, songFrame(18))

    store.set(detentActionAtom, {
      path: 'key',
      source: 'human',
      direction: 1,
      page: false,
      pageRows: VISIBLE_ROWS.compact,
      timestampMs: 0,
    })

    expect(store.get(liveRegionAtom)?.text).toBe('Row 2 of 18. Song 2, Vienna Teng.')
    expect(store.get(announcerAtom).settling).toBeNull()
  })

  test('three counted presses speak three times — this is how P5 navigates', () => {
    const store = createDeviceStore()
    store.set(pushScreenActionAtom, songFrame(18))

    const spoken: string[] = []
    const unsubscribe = store.sub(liveRegionAtom, () => {
      const announcement = store.get(liveRegionAtom)
      if (announcement !== null) spoken.push(announcement.text)
    })

    for (const timestampMs of [0, 600, 1200]) {
      store.set(detentActionAtom, {
        path: 'key',
        source: 'human',
        direction: 1,
        page: false,
        pageRows: VISIBLE_ROWS.compact,
        timestampMs,
      })
    }
    unsubscribe()

    expect(spoken).toEqual([
      'Row 2 of 18. Song 2, Vienna Teng.',
      'Row 3 of 18. Song 3, Vienna Teng.',
      'Row 4 of 18. Song 4, Vienna Teng.',
    ])
  })

  test('a held key does not speak per repeat — it summarises when released', () => {
    const store = createDeviceStore()
    store.set(pushScreenActionAtom, songFrame(60))

    let spoken = 0
    const unsubscribe = store.sub(liveRegionAtom, () => {
      spoken += 1
    })

    // 30ms apart is OS auto-repeat, not thirty decisions.
    for (let i = 0; i < 20; i += 1) {
      store.set(detentActionAtom, {
        path: 'key',
        source: 'human',
        direction: 1,
        page: false,
        pageRows: VISIBLE_ROWS.compact,
        timestampMs: i * 30,
      })
    }

    // The very first press was deliberate and spoke; the repeats did not.
    expect(spoken).toBe(1)

    store.set(endGestureActionAtom, 19 * 30 + ANNOUNCE_DEBOUNCE_MS)
    unsubscribe()

    expect(spoken).toBe(2)
    expect(store.get(liveRegionAtom)?.text).toBe('Row 21 of 60. Song 21, Vienna Teng.')
  })

  test('a keypress interrupting a flick clears the flick’s stale summary', () => {
    const store = createDeviceStore()
    store.set(pushScreenActionAtom, songFrame(200))

    for (let i = 0; i < 10; i += 1) {
      store.set(detentActionAtom, {
        path: 'touch-arc',
        source: 'human',
        angleDeg: i === 0 ? 18 : 15,
        timestampMs: i * 20,
      })
    }
    expect(store.get(announcerAtom).settling).not.toBeNull()

    store.set(detentActionAtom, {
      path: 'key',
      source: 'human',
      direction: 1,
      page: false,
      pageRows: VISIBLE_ROWS.compact,
      timestampMs: 1000,
    })

    expect(store.get(announcerAtom).settling).toBeNull()
    // Nothing stale is left armed to speak later.
    expect(store.set(flushAnnouncementsActionAtom, 100000)).toBeNull()
  })
})

describe('the sentence', () => {
  test('a human hears position first, then the row', () => {
    const frame = songFrame(18)
    expect(describeMovement(sourceAt(frame, 3), 'human')).toBe(
      'Row 4 of 18. Song 4, Vienna Teng.',
    )
  })

  test('an agent movement names the actor first', () => {
    const frame = songFrame(42)
    expect(describeMovement(sourceAt(frame, 14), 'agent')).toBe(
      'Agent moved to row 15 of 42. Song 15, Vienna Teng.',
    )
  })

  test('a single-line row is read without a trailing comma', () => {
    const frame: ScreenFrame = {
      ...songFrame(3),
      rows: [{ index: 0, label: 'Playlists', sublabel: null, glyphs: [], provenance: null }],
    }
    expect(describeMovement({ face: 'front', frame, agentActive: false }, 'human')).toBe(
      'Row 1 of 1. Playlists.',
    )
  })

  test('an empty screen says so, rather than reading row zero of zero', () => {
    const frame: ScreenFrame = { ...songFrame(0), title: 'Playlists' }
    expect(describeMovement({ face: 'front', frame, agentActive: false }, 'human')).toBe(
      'Playlists. No items.',
    )
  })

  test('every announcement is polite — navigation never interrupts', () => {
    const store = createDeviceStore()
    store.set(pushScreenActionAtom, songFrame(18))
    store.set(agentActiveAtom, true)
    store.set(detentActionAtom, {
      path: 'direct',
      source: 'agent',
      detents: 4,
      timestampMs: 0,
    })
    store.set(flushAnnouncementsActionAtom, ANNOUNCE_DEBOUNCE_MS)

    expect(store.get(liveRegionAtom)?.politeness).toBe('polite')
    expect(store.get(liveRegionAtom)?.text).toBe('Agent moved to row 5 of 18. Song 5, Vienna Teng.')
  })

  test('the sequence number increments so two identical sentences are distinct', () => {
    const store = createDeviceStore()
    store.set(pushScreenActionAtom, songFrame(18))

    const press = (timestampMs: number): void => {
      store.set(detentActionAtom, {
        path: 'key',
        source: 'human',
        direction: 1,
        page: false,
        pageRows: VISIBLE_ROWS.compact,
        timestampMs,
      })
    }
    press(0)
    const first = store.get(liveRegionAtom)
    press(600)
    const second = store.get(liveRegionAtom)

    expect(second?.seq).toBe((first?.seq ?? 0) + 1)
  })
})

describe('the pure announcer', () => {
  test('noteMovement replaces the settling summary rather than queueing', () => {
    const frame = songFrame(50)
    let state = IDLE_ANNOUNCER_STATE
    for (let i = 0; i < 30; i += 1) {
      const noted = noteMovement(state, {
        snapshot: sourceAt(frame, i),
        urgency: 'debounced',
        source: 'human',
        atMs: i * 20,
      })
      expect(noted.announcement).toBeNull()
      state = noted.state
    }

    expect(state.emitted).toBe(0)
    expect(state.dueAtMs).toBe(29 * 20 + ANNOUNCE_DEBOUNCE_MS)
    expect(state.settling?.snapshot.frame.highlightIndex).toBe(29)

    const flushed = flushAnnouncer(state, 29 * 20 + ANNOUNCE_DEBOUNCE_MS)
    expect(flushed.announcement?.text).toBe('Row 30 of 50. Song 30, Vienna Teng.')
    expect(flushAnnouncer(flushed.state, 999999).announcement).toBeNull()
  })

  test('clearAnnouncer drops the settling summary but keeps the count', () => {
    const frame = songFrame(10)
    const noted = noteMovement(IDLE_ANNOUNCER_STATE, {
      snapshot: sourceAt(frame, 1),
      urgency: 'immediate',
      source: 'human',
      atMs: 0,
    })
    const cleared = clearAnnouncer(noted.state)

    expect(cleared.settling).toBeNull()
    expect(cleared.dueAtMs).toBeNull()
    expect(cleared.emitted).toBe(noted.state.emitted)
  })
})

describe('the driver — the one timer in the package', () => {
  test('a flick holds one timeout and speaks once when it stops', async () => {
    const store = createDeviceStore()
    store.set(pushScreenActionAtom, songFrame(200))

    let armed = 0
    let cleared = 0
    const stop = startAnnouncer(store, {
      setTimer: (callback, ms) => {
        armed += 1
        return setTimeout(callback, ms)
      },
      clearTimer: (handle) => {
        cleared += 1
        clearTimeout(handle)
      },
    })

    let spoken = 0
    const unsubscribe = store.sub(liveRegionAtom, () => {
      spoken += 1
    })

    const start = Date.now()
    for (let i = 0; i < 30; i += 1) {
      store.set(detentActionAtom, {
        path: 'touch-arc',
        source: 'human',
        angleDeg: i === 0 ? 18 : 15,
        timestampMs: start + i,
      })
    }

    await Bun.sleep(ANNOUNCE_DEBOUNCE_MS + 120)
    stop()
    unsubscribe()

    expect(spoken).toBe(1)
    // One timeout in flight at a time: every re-arm cancelled the previous.
    expect(armed - cleared).toBeLessThanOrEqual(1)
  })

  test('stopping the driver cancels the settling announcement', async () => {
    const store = createDeviceStore()
    store.set(pushScreenActionAtom, songFrame(20))
    const stop = startAnnouncer(store)

    store.set(detentActionAtom, {
      path: 'touch-arc',
      source: 'human',
      angleDeg: 18,
      timestampMs: Date.now(),
    })
    stop()

    await Bun.sleep(ANNOUNCE_DEBOUNCE_MS + 120)
    expect(store.get(liveRegionAtom)).toBeNull()
  })
})
