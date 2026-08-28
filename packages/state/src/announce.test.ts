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

/**
 * A device whose clock the test drives.
 *
 * ⚑ One clock, supplied once, governing the whole device — the reducer's
 * gesture timing, the announcer's due time and the driver's wake-up all read
 * it. That is the point: a test cannot accidentally put the debounce on a
 * different scale from the movements, because there is nowhere to put a second
 * clock.
 */
function fakeClockDevice(): {
  store: ReturnType<typeof createDeviceStore>
  advance: (ms: number) => void
  now: () => number
} {
  let t = 0
  const store = createDeviceStore({ now: () => t })
  return { store, advance: (ms) => { t += ms }, now: () => t }
}

function sourceAt(frame: ScreenFrame, highlightIndex: number): ScreenSnapshotSource {
  return {
    face: 'front',
    frame: { ...frame, highlightIndex },
    density: frame.density,
    agentActive: false,
  }
}

describe('U13 — a flick announces once', () => {
  /** Drives a 30-detent flick, advancing the device clock with it. */
  function flick(
    device: ReturnType<typeof fakeClockDevice>,
    path: 'touch-arc' | 'scroll' = 'touch-arc',
    stepMs = 20,
  ): void {
    for (let i = 0; i < 30; i += 1) {
      device.advance(stepMs)
      if (path === 'touch-arc') {
        device.store.set(detentActionAtom, {
          path: 'touch-arc',
          source: 'human',
          angleDeg: i === 0 ? 18 : 15,
          timestampMs: device.now(),
        })
      } else {
        device.store.set(detentActionAtom, {
          path: 'scroll',
          source: 'human',
          deltaY: 40,
          deltaMode: 0,
          viewportPx: 800,
          timestampMs: device.now(),
        })
      }
    }
  }

  test('30 detents through the real store produce exactly ONE announcement', () => {
    const device = fakeClockDevice()
    device.store.set(pushScreenActionAtom, songFrame(200))

    const spoken: Announcement[] = []
    const unsubscribe = device.store.sub(liveRegionAtom, () => {
      const announcement = device.store.get(liveRegionAtom)
      if (announcement !== null) spoken.push(announcement)
    })

    flick(device)

    // Mid-flick, nothing has been said at all.
    expect(spoken).toHaveLength(0)

    // The motion stops. 350ms later, one sentence.
    device.advance(ANNOUNCE_DEBOUNCE_MS)
    device.store.set(endGestureActionAtom)
    unsubscribe()

    expect(spoken).toHaveLength(1)
    expect(spoken[0]?.politeness).toBe('polite')
    expect(device.store.get(announcerAtom).emitted).toBe(1)
  })

  test('the one sentence names the row the flick settled on', () => {
    const device = fakeClockDevice()
    device.store.set(pushScreenActionAtom, songFrame(200))
    flick(device)
    device.advance(ANNOUNCE_DEBOUNCE_MS)
    device.store.set(endGestureActionAtom)

    expect(device.store.get(announcerAtom).settling).toBeNull()
    expect(device.store.get(liveRegionAtom)?.text).toMatch(
      /^Row \d+ of 200\. Song \d+, Vienna Teng\.$/,
    )
  })

  test('flushing repeatedly after a flick still says it once', () => {
    const device = fakeClockDevice()
    device.store.set(pushScreenActionAtom, songFrame(200))
    flick(device)

    device.advance(ANNOUNCE_DEBOUNCE_MS)
    expect(device.store.set(flushAnnouncementsActionAtom)).not.toBeNull()
    device.advance(10)
    expect(device.store.set(flushAnnouncementsActionAtom)).toBeNull()
    device.advance(5000)
    expect(device.store.set(flushAnnouncementsActionAtom)).toBeNull()
  })

  test('the debounce is 350ms — not 349, and not a symbol that can move', () => {
    // ⚑ Literal, from 001 §4.4 and gate U13: "debounced to one
    // aria-live=polite at 350ms". Every other assertion in this file computes
    // the boundary from ANNOUNCE_DEBOUNCE_MS, which means they would all still
    // pass if the constant were changed to 50 — the tests would move with the
    // bug. This one does not.
    expect(ANNOUNCE_DEBOUNCE_MS).toBe(350)

    const device = fakeClockDevice()
    device.store.set(pushScreenActionAtom, songFrame(200))

    device.advance(1)
    device.store.set(detentActionAtom, {
      path: 'touch-arc',
      source: 'human',
      angleDeg: 18,
      timestampMs: device.now(),
    })

    device.advance(349)
    expect(device.store.set(flushAnnouncementsActionAtom)).toBeNull()
    device.advance(1)
    expect(device.store.set(flushAnnouncementsActionAtom)).not.toBeNull()
  })

  test('a scroll flick behaves the same as a touch flick', () => {
    const device = fakeClockDevice()
    device.store.set(pushScreenActionAtom, songFrame(200))

    let spoken = 0
    const unsubscribe = device.store.sub(liveRegionAtom, () => {
      spoken += 1
    })

    flick(device, 'scroll', 16)
    expect(spoken).toBe(0)

    device.advance(ANNOUNCE_DEBOUNCE_MS)
    device.store.set(endGestureActionAtom)
    unsubscribe()

    expect(spoken).toBe(1)
  })
})

describe('MAJOR 1 — there is one clock, so the browser case cannot diverge', () => {
  test('performance.now-scale timestamps still announce once', () => {
    // The regression, exactly as the reviewer drove it: the idiomatic browser
    // value for `timestampMs` is `event.timeStamp`, which sits on the
    // performance.now origin (~1e4) while the old driver clock was Date.now
    // (~1.8e12). Every due time looked long past and a 30-detent flick
    // announced 30 times. Nothing compares those two scales any more.
    const store = createDeviceStore({ now: () => Date.now() })
    store.set(pushScreenActionAtom, songFrame(200))

    let spoken = 0
    const unsubscribe = store.sub(liveRegionAtom, () => {
      spoken += 1
    })

    const browserOrigin = 12_345.678
    for (let i = 0; i < 30; i += 1) {
      store.set(detentActionAtom, {
        path: 'touch-arc',
        source: 'human',
        angleDeg: i === 0 ? 18 : 15,
        timestampMs: browserOrigin + i * 20,
      })
    }
    unsubscribe()

    expect(spoken).toBe(0)
    expect(store.get(announcerAtom).settling).not.toBeNull()
  })

  test('the announcer ignores caller timestamps entirely', () => {
    // A caller reporting times from the far future cannot bring the
    // announcement forward, and one reporting the far past cannot delay it.
    for (const absurd of [0, -1e9, 1e15]) {
      const device = fakeClockDevice()
      device.store.set(pushScreenActionAtom, songFrame(50))
      device.store.set(detentActionAtom, {
        path: 'direct',
        source: 'human',
        detents: 3,
        timestampMs: absurd,
      })

      device.advance(349)
      expect(device.store.set(flushAnnouncementsActionAtom)).toBeNull()
      device.advance(1)
      expect(device.store.set(flushAnnouncementsActionAtom)).not.toBeNull()
    }
  })
})

describe('the keyboard announces immediately, because it is deterministic', () => {
  const arrow = (device: ReturnType<typeof fakeClockDevice>): void => {
    device.store.set(detentActionAtom, {
      path: 'key',
      source: 'human',
      direction: 1,
      page: false,
      timestampMs: device.now(),
    })
  }

  test('one keypress speaks at once, with no debounce', () => {
    const device = fakeClockDevice()
    device.store.set(pushScreenActionAtom, songFrame(18))
    arrow(device)

    expect(device.store.get(liveRegionAtom)?.text).toBe('Row 2 of 18. Song 2, Vienna Teng.')
    expect(device.store.get(announcerAtom).settling).toBeNull()
  })

  test('three counted presses speak three times — this is how P5 navigates', () => {
    const device = fakeClockDevice()
    device.store.set(pushScreenActionAtom, songFrame(18))

    const spoken: string[] = []
    const unsubscribe = device.store.sub(liveRegionAtom, () => {
      const announcement = device.store.get(liveRegionAtom)
      if (announcement !== null) spoken.push(announcement.text)
    })

    for (let i = 0; i < 3; i += 1) {
      device.advance(600)
      arrow(device)
    }
    unsubscribe()

    expect(spoken).toEqual([
      'Row 2 of 18. Song 2, Vienna Teng.',
      'Row 3 of 18. Song 3, Vienna Teng.',
      'Row 4 of 18. Song 4, Vienna Teng.',
    ])
  })

  test('a held key does not speak per repeat — it summarises when released', () => {
    const device = fakeClockDevice()
    device.store.set(pushScreenActionAtom, songFrame(60))

    let spoken = 0
    const unsubscribe = device.store.sub(liveRegionAtom, () => {
      spoken += 1
    })

    // 30ms apart is OS auto-repeat, not twenty decisions.
    for (let i = 0; i < 20; i += 1) {
      device.advance(30)
      arrow(device)
    }

    // The very first press was deliberate and spoke; the repeats did not.
    expect(spoken).toBe(1)

    device.advance(ANNOUNCE_DEBOUNCE_MS)
    device.store.set(endGestureActionAtom)
    unsubscribe()

    expect(spoken).toBe(2)
    expect(device.store.get(liveRegionAtom)?.text).toBe('Row 21 of 60. Song 21, Vienna Teng.')
  })

  test('a keypress interrupting a flick clears the flick\u2019s stale summary', () => {
    const device = fakeClockDevice()
    device.store.set(pushScreenActionAtom, songFrame(200))

    for (let i = 0; i < 10; i += 1) {
      device.advance(20)
      device.store.set(detentActionAtom, {
        path: 'touch-arc',
        source: 'human',
        angleDeg: i === 0 ? 18 : 15,
        timestampMs: device.now(),
      })
    }
    expect(device.store.get(announcerAtom).settling).not.toBeNull()

    device.advance(1000)
    arrow(device)

    expect(device.store.get(announcerAtom).settling).toBeNull()
    // Nothing stale is left armed to speak later.
    device.advance(100000)
    expect(device.store.set(flushAnnouncementsActionAtom)).toBeNull()
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
    expect(describeMovement({ face: 'front', frame, density: frame.density, agentActive: false }, 'human')).toBe(
      'Row 1 of 1. Playlists.',
    )
  })

  test('an empty screen says so, rather than reading row zero of zero', () => {
    const frame: ScreenFrame = { ...songFrame(0), title: 'Playlists' }
    expect(describeMovement({ face: 'front', frame, density: frame.density, agentActive: false }, 'human')).toBe(
      'Playlists. No items.',
    )
  })

  test('every announcement is polite — navigation never interrupts', () => {
    const device = fakeClockDevice()
    device.store.set(pushScreenActionAtom, songFrame(18))
    device.store.set(agentActiveAtom, true)
    device.store.set(detentActionAtom, {
      path: 'direct',
      source: 'agent',
      detents: 4,
      timestampMs: 0,
    })
    device.advance(ANNOUNCE_DEBOUNCE_MS)
    device.store.set(flushAnnouncementsActionAtom)

    expect(device.store.get(liveRegionAtom)?.politeness).toBe('polite')
    expect(device.store.get(liveRegionAtom)?.text).toBe(
      'Agent moved to row 5 of 18. Song 5, Vienna Teng.',
    )
  })

  test('the sequence number increments so two identical sentences are distinct', () => {
    const device = fakeClockDevice()
    device.store.set(pushScreenActionAtom, songFrame(18))

    const press = (): void => {
      device.advance(600)
      device.store.set(detentActionAtom, {
        path: 'key',
        source: 'human',
        direction: 1,
        page: false,
        timestampMs: device.now(),
      })
    }
    press()
    const first = device.store.get(liveRegionAtom)
    press()
    const second = device.store.get(liveRegionAtom)

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
  /**
   * Waits until `settled()` is true, or gives up after a generous deadline.
   *
   * ⚑ Polling rather than a fixed `Bun.sleep(350 + margin)`. These two tests
   * are the only ones in the package on a real clock and a real timer, and a
   * fixed sleep asserts that the OS scheduled a timer within a chosen margin —
   * which is a claim about the machine, not about this code. Under enough load
   * that claim fails, and a gate that goes red when the CI box is busy teaches
   * people to re-run it rather than to read it. The deadline is long enough
   * that exceeding it means the timer never fired at all, which is the thing
   * actually worth failing on.
   */
  async function waitFor(settled: () => boolean, deadlineMs = 5_000): Promise<void> {
    const startedAt = Date.now()
    while (!settled() && Date.now() - startedAt < deadlineMs) {
      await Bun.sleep(5)
    }
  }

  test('a flick holds one timeout and speaks once when it stops', async () => {
    const store = createDeviceStore()
    store.set(pushScreenActionAtom, songFrame(200))

    let armed = 0
    let cleared = 0
    let fired = 0
    const stop = startAnnouncer(store, {
      setTimer: (callback, ms) => {
        armed += 1
        return setTimeout(() => {
          fired += 1
          callback()
        }, ms)
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

    // Real clock, real timer, and timestamps on the browser's own scale — the
    // combination that used to announce thirty times.
    for (let i = 0; i < 30; i += 1) {
      store.set(detentActionAtom, {
        path: 'touch-arc',
        source: 'human',
        angleDeg: i === 0 ? 18 : 15,
        timestampMs: 12_345 + i,
      })
    }

    await waitFor(() => spoken > 0)
    // A further quiet period, to catch a second announcement arriving late —
    // "exactly one" is the claim, and one-so-far is not it.
    await Bun.sleep(ANNOUNCE_DEBOUNCE_MS)
    stop()
    unsubscribe()

    expect(spoken).toBe(1)

    // One timeout in flight at a time. ⚑ A fired timer counts: it is neither
    // outstanding nor cleared, so `armed - cleared` alone is not the number in
    // flight. An earlier version asserted that and went red under load —
    // correctly reporting a difference of 2, because a timer that fires a
    // fraction early re-arms rather than dropping the announcement, which is
    // exactly the behaviour the round-1 Minor 3 fix added. The driver was
    // right and the assertion was wrong.
    expect(armed - cleared - fired).toBeLessThanOrEqual(1)

    // And an early fire must not have spoken twice on the way through.
    expect(fired).toBeGreaterThanOrEqual(1)
  })

  test('stopping the driver cancels the settling announcement', async () => {
    const store = createDeviceStore()
    store.set(pushScreenActionAtom, songFrame(20))
    const stop = startAnnouncer(store)

    store.set(detentActionAtom, {
      path: 'touch-arc',
      source: 'human',
      angleDeg: 18,
      timestampMs: 12_345,
    })
    stop()

    // Nothing to poll for here — the assertion is that nothing happens — so
    // this one waits a fixed, generous multiple of the debounce. A timer that
    // was going to fire has had four windows in which to do it.
    await Bun.sleep(ANNOUNCE_DEBOUNCE_MS * 4)
    expect(store.get(liveRegionAtom)).toBeNull()
  })
})

describe('MINOR 3 — a timer that fires early must not strand the announcement', () => {
  test('a flush that says nothing re-arms instead of going quiet forever', () => {
    // `flushAnnouncer` returns the SAME state object when the due time has not
    // arrived. Setting an atom to the value it already holds is a no-op to
    // jotai, so the driver's subscription does not fire — and the timer
    // callback has already cleared its own handle. Without an explicit re-arm,
    // nothing is armed and nothing ever will be: the settling summary is
    // dropped in silence, which is the exact failure this module exists to
    // prevent.
    //
    // Reachable once the clock is `performance.now()`, which browsers
    // deliberately coarsen — reading back a value a fraction below the due
    // time is ordinary there.
    let t = 0
    const store = createDeviceStore({ now: () => t })
    store.set(pushScreenActionAtom, songFrame(20))

    const armedTimers: Array<() => void> = []
    const stop = startAnnouncer(store, {
      setTimer: (callback) => {
        armedTimers.push(callback)
        return armedTimers.length
      },
      clearTimer: () => {},
    })

    store.set(detentActionAtom, {
      path: 'touch-arc',
      source: 'human',
      angleDeg: 18,
      timestampMs: 0,
    })

    // Due at 350. The timer fires with the clock reading 349 — one tick early.
    t = 349
    const firstFire = armedTimers.at(-1)
    expect(firstFire).toBeDefined()
    firstFire?.()
    expect(store.get(liveRegionAtom)).toBeNull()

    // It must have re-armed. Time passes; the new timer fires; it speaks.
    const rearmed = armedTimers.at(-1)
    expect(rearmed).toBeDefined()
    expect(armedTimers.length).toBeGreaterThan(1)

    t = 350
    rearmed?.()
    expect(store.get(liveRegionAtom)?.text).toBe('Row 2 of 20. Song 2, Vienna Teng.')

    stop()
  })

  test('a driver clock that never reaches the due time does not spin forever', () => {
    // The re-arm must be driven by the timer, not by a loop: each early fire
    // schedules exactly one more, and nothing recurses.
    const t = 0
    const store = createDeviceStore({ now: () => t })
    store.set(pushScreenActionAtom, songFrame(20))

    let armedCount = 0
    const stop = startAnnouncer(store, {
      setTimer: () => {
        armedCount += 1
        return armedCount
      },
      clearTimer: () => {},
    })

    store.set(detentActionAtom, {
      path: 'touch-arc',
      source: 'human',
      angleDeg: 18,
      timestampMs: 0,
    })

    expect(armedCount).toBeLessThan(5)
    stop()
  })
})

describe('the silence rule has one definition, not two copies', () => {
  test('the predicate is a shared function rather than a repeated expression', async () => {
    const { spawn } = await import('bun')
    const proc = spawn(
      // `--include` matters: without it this also reads editor backups and
      // scratch copies, which are not the package.
      ['grep', '-rn', '--include=*.ts', "source !== 'human'", 'src'],
      { cwd: `${import.meta.dir}/..`, stdout: 'pipe', stderr: 'pipe' },
    )
    const output = await new Response(proc.stdout).text()
    await proc.exited

    const definitions = output
      .split('\n')
      .filter((line) => line.trim() !== '')
      .filter((line) => !line.includes('.test.ts'))

    // Exactly one: `isSilenced` in silence.ts. The detent reducer and the
    // press handler are two *callers* of the rule, which is fine; two copies
    // of the rule would not be, because the whole design argument for the seam
    // is that there is one place to change it.
    expect(definitions).toHaveLength(1)
    expect(definitions[0]).toContain('silence.ts')
  })
})
