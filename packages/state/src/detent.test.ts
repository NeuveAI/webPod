import { describe, expect, test } from 'bun:test'

import { DETENT, IDLE_DETENT_ACCUMULATOR, VISIBLE_ROWS } from './contract'
import type { DetentAccumulator, DetentInput, DetentOutcome } from './contract'
import { coastStep, detent, endGesture } from './detent'

/** Threads a sequence of inputs through the reducer, collecting every outcome. */
function replay(
  inputs: readonly DetentInput[],
  from: DetentAccumulator = IDLE_DETENT_ACCUMULATOR,
  viewportRows = VISIBLE_ROWS.medium,
): { outcomes: readonly DetentOutcome[]; accumulator: DetentAccumulator } {
  let accumulator = from
  const outcomes: DetentOutcome[] = []
  for (const input of inputs) {
    const outcome = detent(accumulator, input, viewportRows)
    outcomes.push(outcome)
    accumulator = outcome.accumulator
  }
  return { outcomes, accumulator }
}

const totalRows = (outcomes: readonly DetentOutcome[]): number =>
  outcomes.reduce((sum, outcome) => sum + outcome.rowDelta, 0)

const totalDetents = (outcomes: readonly DetentOutcome[]): number =>
  outcomes.reduce((sum, outcome) => sum + outcome.detents, 0)

describe('keyboard path — one keydown is exactly one detent, always', () => {
  test('a single ArrowDown is one detent and one row', () => {
    const outcome = detent(IDLE_DETENT_ACCUMULATOR, {
      path: 'key',
      source: 'human',
      direction: 1,
      page: false,
      timestampMs: 0,
    }, VISIBLE_ROWS.medium)

    expect(outcome.detents).toBe(1)
    expect(outcome.rowDelta).toBe(1)
    expect(outcome.multiplier).toBe(1)
  })

  test('ArrowUp is one detent upward', () => {
    const outcome = detent(IDLE_DETENT_ACCUMULATOR, {
      path: 'key',
      source: 'human',
      direction: -1,
      page: false,
      timestampMs: 0,
    }, VISIBLE_ROWS.medium)

    expect(outcome.detents).toBe(-1)
    expect(outcome.rowDelta).toBe(-1)
  })

  test('three keydowns move exactly three rows — counted navigation', () => {
    const { outcomes } = replay(
      [0, 1, 2].map((i) => ({
        path: 'key' as const,
        source: 'human' as const,
        direction: 1 as const,
        page: false,
        timestampMs: i * 400,
      })),
    )

    expect(totalDetents(outcomes)).toBe(3)
    expect(totalRows(outcomes)).toBe(3)
  })

  test('NO acceleration, ever: 40 keydowns 5ms apart still move 40 rows', () => {
    // 5ms apart is far faster than any human or any OS auto-repeat, and far
    // over every arc-path acceleration threshold. The keyboard path must not
    // care. If this test ever goes green at anything but 40, counted
    // navigation is broken and P5 cannot use the device.
    const { outcomes } = replay(
      Array.from({ length: 40 }, (_, i) => ({
        path: 'key' as const,
        source: 'human' as const,
        direction: 1 as const,
        page: false,
        timestampMs: i * 5,
      })),
    )

    expect(totalRows(outcomes)).toBe(40)
    expect(outcomes.every((outcome) => outcome.multiplier === 1)).toBe(true)
    expect(outcomes.every((outcome) => Math.abs(outcome.detents) === 1)).toBe(true)
  })

  test('Shift+Arrow is still one detent, but one full viewport of rows', () => {
    // ⚑ Literal row counts, from 001 §3's density notation — 26px/8 rows,
    // 32px/6, 44px/4 — and from the lead's ruling that a page is one full
    // viewport rather than a flat 7. Asserting against `VISIBLE_ROWS[density]`
    // would compute both sides from the same symbol, so the test would move
    // with the bug and a flat 7 would land green.
    const cases = [
      { density: 'compact', rows: 8 },
      { density: 'medium', rows: 6 },
      { density: 'airy', rows: 4 },
    ] as const

    for (const { density, rows } of cases) {
      expect(VISIBLE_ROWS[density]).toBe(rows)

      const outcome = detent(
        IDLE_DETENT_ACCUMULATOR,
        {
          path: 'key',
          source: 'human',
          direction: 1,
          page: true,
          timestampMs: 0,
        },
        rows,
      )

      expect(outcome.detents).toBe(1)
      expect(outcome.rowDelta).toBe(rows)
      // A page is not acceleration: the device moved exactly as far as it was
      // told, it was simply told a viewport.
      expect(outcome.accelerated).toBe(false)
    }
  })

  test('a lone keypress announces immediately; auto-repeat falls back to a summary', () => {
    const first = detent(IDLE_DETENT_ACCUMULATOR, {
      path: 'key',
      source: 'human',
      direction: 1,
      page: false,
      timestampMs: 0,
    }, VISIBLE_ROWS.medium)
    expect(first.announce).toBe('immediate')

    const repeat = detent(first.accumulator, {
      path: 'key',
      source: 'human',
      direction: 1,
      page: false,
      timestampMs: 30,
    }, VISIBLE_ROWS.medium)
    expect(repeat.announce).toBe('debounced')

    const deliberate = detent(repeat.accumulator, {
      path: 'key',
      source: 'human',
      direction: 1,
      page: false,
      timestampMs: 900,
    }, VISIBLE_ROWS.medium)
    expect(deliberate.announce).toBe('immediate')
  })

  test('the keyboard path never fires a haptic — there is no hardware behind it', () => {
    const outcome = detent(IDLE_DETENT_ACCUMULATOR, {
      path: 'key',
      source: 'human',
      direction: 1,
      page: false,
      timestampMs: 0,
    }, VISIBLE_ROWS.medium)

    expect(outcome.hapticPulses).toBe(0)
    expect(outcome.clickerTicks).toBe(1)
  })
})

describe('touch arc path', () => {
  test('the first detent costs the dead zone, later detents cost 15 degrees', () => {
    const belowDeadZone = detent(IDLE_DETENT_ACCUMULATOR, {
      path: 'touch-arc',
      source: 'human',
      angleDeg: 17,
      timestampMs: 0,
    }, VISIBLE_ROWS.medium)
    expect(belowDeadZone.detents).toBe(0)

    const clearsDeadZone = detent(belowDeadZone.accumulator, {
      path: 'touch-arc',
      source: 'human',
      angleDeg: 1,
      timestampMs: 200,
    }, VISIBLE_ROWS.medium)
    expect(clearsDeadZone.detents).toBe(1)

    const nextDetent = detent(clearsDeadZone.accumulator, {
      path: 'touch-arc',
      source: 'human',
      angleDeg: 15,
      timestampMs: 400,
    }, VISIBLE_ROWS.medium)
    expect(nextDetent.detents).toBe(1)
  })

  test('a slow arc moves one row per detent', () => {
    // 15 degrees per 200ms is 75 deg/s, well under the first threshold.
    const { outcomes } = replay(
      Array.from({ length: 6 }, (_, i) => ({
        path: 'touch-arc' as const,
        source: 'human' as const,
        angleDeg: i === 0 ? 18 : 15,
        timestampMs: (i + 1) * 200,
      })),
    )

    expect(totalDetents(outcomes)).toBe(6)
    expect(totalRows(outcomes)).toBe(6)
  })

  test('a fast arc accelerates, and the multiplier is smoothed rather than jumping', () => {
    // 60 degrees per 60ms is 1000 deg/s — over the second threshold.
    const { outcomes } = replay(
      Array.from({ length: 5 }, (_, i) => ({
        path: 'touch-arc' as const,
        source: 'human' as const,
        angleDeg: 60,
        timestampMs: (i + 1) * 60,
      })),
    )

    const multipliers = outcomes.map((outcome) => outcome.multiplier)
    expect(multipliers.at(-1)).toBe(DETENT.rowsFaster)
    // The very first event must not already be at the top multiplier: with no
    // prior event there is no measured speed, so it starts slow and climbs.
    expect(multipliers[0]).toBe(DETENT.rowsSlow)
    expect(totalRows(outcomes)).toBeGreaterThan(totalDetents(outcomes))
  })

  test('reversing direction mid-gesture moves back, never forward', () => {
    const forward = replay([
      { path: 'touch-arc', source: 'human', angleDeg: 18, timestampMs: 100 },
      { path: 'touch-arc', source: 'human', angleDeg: 15, timestampMs: 300 },
    ])
    expect(totalDetents(forward.outcomes)).toBe(2)

    const back = detent(forward.accumulator, {
      path: 'touch-arc',
      source: 'human',
      angleDeg: -15,
      timestampMs: 500,
    }, VISIBLE_ROWS.medium)
    expect(back.detents).toBe(-1)
  })

  test('haptics stop above 12 detents per second, clicker does not', () => {
    // Four detents in one 40ms event is 100 detents/second.
    const primed = detent(IDLE_DETENT_ACCUMULATOR, {
      path: 'touch-arc',
      source: 'human',
      angleDeg: 18,
      timestampMs: 0,
    }, VISIBLE_ROWS.medium)
    const fast = detent(primed.accumulator, {
      path: 'touch-arc',
      source: 'human',
      angleDeg: 60,
      timestampMs: 40,
    }, VISIBLE_ROWS.medium)

    expect(fast.detentsPerSecond).toBeGreaterThan(DETENT.hapticSuppressAbovePerSec)
    expect(fast.hapticPulses).toBe(0)
    expect(fast.clickerTicks).toBe(Math.abs(fast.detents))
  })
})

describe('mouse arc path', () => {
  test('the dead zone is smaller than touch — a mouse is steadier than a thumb', () => {
    const outcome = detent(IDLE_DETENT_ACCUMULATOR, {
      path: 'mouse-arc',
      source: 'human',
      angleDeg: 13,
      timestampMs: 0,
    }, VISIBLE_ROWS.medium)

    expect(outcome.detents).toBe(1)
  })

  test('acceleration thresholds are 1.4x the touch ones', () => {
    // 300 deg/s clears the touch threshold (240) but not the mouse one (336).
    const speedDegPerSec = 300
    const arcInputs = (path: 'touch-arc' | 'mouse-arc'): readonly DetentInput[] =>
      Array.from({ length: 5 }, (_, i) => ({
        path,
        source: 'human' as const,
        angleDeg: speedDegPerSec * 0.1,
        timestampMs: (i + 1) * 100,
      }))

    const touch = replay(arcInputs('touch-arc'))
    const mouse = replay(arcInputs('mouse-arc'))

    expect(touch.outcomes.at(-1)?.multiplier).toBe(DETENT.rowsFast)
    expect(mouse.outcomes.at(-1)?.multiplier).toBe(DETENT.rowsSlow)
  })

  test('a mouse arc never fires haptics — the hardware is not there', () => {
    const outcome = detent(IDLE_DETENT_ACCUMULATOR, {
      path: 'mouse-arc',
      source: 'human',
      angleDeg: 20,
      timestampMs: 0,
    }, VISIBLE_ROWS.medium)

    expect(outcome.hapticPulses).toBe(0)
  })
})

describe('scroll path', () => {
  test('40 accumulated pixels is one detent, after a 24px dead zone', () => {
    const first = detent(IDLE_DETENT_ACCUMULATOR, {
      path: 'scroll',
      source: 'human',
      deltaY: 24,
      deltaMode: 0,
      viewportPx: 800,
      timestampMs: 0,
    }, VISIBLE_ROWS.medium)
    expect(first.detents).toBe(1)

    const second = detent(first.accumulator, {
      path: 'scroll',
      source: 'human',
      deltaY: 40,
      deltaMode: 0,
      viewportPx: 800,
      timestampMs: 16,
    }, VISIBLE_ROWS.medium)
    expect(second.detents).toBe(1)
  })

  test('no velocity multiplier, however fast the wheel is spun', () => {
    const { outcomes } = replay(
      Array.from({ length: 20 }, (_, i) => ({
        path: 'scroll' as const,
        source: 'human' as const,
        deltaY: 400,
        deltaMode: 0 as const,
        viewportPx: 800,
        timestampMs: i * 4,
      })),
    )

    expect(outcomes.every((outcome) => outcome.multiplier === 1)).toBe(true)
    expect(totalRows(outcomes)).toBe(totalDetents(outcomes))
  })

  test('line and page delta modes are normalised to pixels', () => {
    const lines = detent(IDLE_DETENT_ACCUMULATOR, {
      path: 'scroll',
      source: 'human',
      deltaY: 3,
      deltaMode: 1,
      viewportPx: 800,
      timestampMs: 0,
    }, VISIBLE_ROWS.medium)
    // 3 lines x 16px = 48px: clears the 24px dead zone and leaves 24px over.
    expect(lines.detents).toBe(1)

    const pages = detent(IDLE_DETENT_ACCUMULATOR, {
      path: 'scroll',
      source: 'human',
      deltaY: 1,
      deltaMode: 2,
      viewportPx: 800,
      timestampMs: 0,
    }, VISIBLE_ROWS.medium)
    // 800px: one dead zone plus (800-24)/40 whole detents.
    expect(pages.detents).toBe(1 + Math.floor((800 - DETENT.scrollDeadZonePx) / DETENT.scrollPxPerDetent))
  })

  test('residual under one detent is discarded, never rounded into a phantom', () => {
    const partial = detent(IDLE_DETENT_ACCUMULATOR, {
      path: 'scroll',
      source: 'human',
      deltaY: 20,
      deltaMode: 0,
      viewportPx: 800,
      timestampMs: 0,
    }, VISIBLE_ROWS.medium)
    expect(partial.detents).toBe(0)
    expect(partial.accumulator.residualPx).toBe(20)

    expect(endGesture(partial.accumulator)).toEqual(IDLE_DETENT_ACCUMULATOR)
  })
})

describe('direct path — the programmatic seam', () => {
  test('a requested count arrives exactly, with no acceleration', () => {
    const outcome = detent(IDLE_DETENT_ACCUMULATOR, {
      path: 'direct',
      source: 'agent',
      detents: 14,
      timestampMs: 0,
    }, VISIBLE_ROWS.medium)

    expect(outcome.detents).toBe(14)
    expect(outcome.rowDelta).toBe(14)
    expect(outcome.multiplier).toBe(1)
  })
})

describe('the silence rule, enforced at one call site', () => {
  const paths: readonly DetentInput[] = [
    { path: 'touch-arc', source: 'agent', angleDeg: 60, timestampMs: 0 },
    { path: 'mouse-arc', source: 'agent', angleDeg: 60, timestampMs: 0 },
    {
      path: 'scroll',
      source: 'agent',
      deltaY: 400,
      deltaMode: 0,
      viewportPx: 800,
      timestampMs: 0,
    },
    {
      path: 'key',
      source: 'agent',
      direction: 1,
      page: false,
      timestampMs: 0,
    },
    { path: 'direct', source: 'agent', detents: 14, timestampMs: 0 },
  ]

  test('agent movement is silent and still on every path — visible, never felt', () => {
    for (const input of paths) {
      const outcome = detent(IDLE_DETENT_ACCUMULATOR, input, VISIBLE_ROWS.medium)
      expect(outcome.silenced).toBe(true)
      expect(outcome.clickerTicks).toBe(0)
      expect(outcome.hapticPulses).toBe(0)
      // Silence is not stillness: the movement itself still happens, and the
      // human must be able to see it.
      expect(outcome.detents).not.toBe(0)
    }
  })

  test('system movement is silent too', () => {
    const outcome = detent(IDLE_DETENT_ACCUMULATOR, {
      path: 'direct',
      source: 'system',
      detents: 3,
      timestampMs: 0,
    }, VISIBLE_ROWS.medium)

    expect(outcome.silenced).toBe(true)
    expect(outcome.clickerTicks).toBe(0)
    expect(outcome.actor).toBe('system')
  })

  test('human movement clicks', () => {
    const outcome = detent(IDLE_DETENT_ACCUMULATOR, {
      path: 'touch-arc',
      source: 'human',
      angleDeg: 18,
      timestampMs: 0,
    }, VISIBLE_ROWS.medium)

    expect(outcome.silenced).toBe(false)
    expect(outcome.clickerTicks).toBe(1)
    expect(outcome.hapticPulses).toBe(1)
  })

  test('an agent moving the same distance as a hand moves exactly as far', () => {
    const asHuman = detent(IDLE_DETENT_ACCUMULATOR, {
      path: 'direct',
      source: 'human',
      detents: 9,
      timestampMs: 0,
    }, VISIBLE_ROWS.medium)
    const asAgent = detent(IDLE_DETENT_ACCUMULATOR, {
      path: 'direct',
      source: 'agent',
      detents: 9,
      timestampMs: 0,
    }, VISIBLE_ROWS.medium)

    expect(asAgent.rowDelta).toBe(asHuman.rowDelta)
    expect(asAgent.clickerTicks).toBe(0)
    expect(asHuman.clickerTicks).toBe(9)
  })
})

describe('the actor tag is derived, never accepted', () => {
  test('each human path names the limb that drove it', () => {
    expect(
      detent(IDLE_DETENT_ACCUMULATOR, {
        path: 'touch-arc',
        source: 'human',
        angleDeg: 18,
        timestampMs: 0,
      }, VISIBLE_ROWS.medium).actor,
    ).toBe('human:touch')

    expect(
      detent(IDLE_DETENT_ACCUMULATOR, {
        path: 'mouse-arc',
        source: 'human',
        angleDeg: 18,
        timestampMs: 0,
      }, VISIBLE_ROWS.medium).actor,
    ).toBe('human:mouse')

    expect(
      detent(IDLE_DETENT_ACCUMULATOR, {
        path: 'scroll',
        source: 'human',
        deltaY: 40,
        deltaMode: 0,
        viewportPx: 800,
        timestampMs: 0,
      }, VISIBLE_ROWS.medium).actor,
    ).toBe('human:mouse')

    expect(
      detent(IDLE_DETENT_ACCUMULATOR, {
        path: 'key',
        source: 'human',
        direction: 1,
        page: false,
        timestampMs: 0,
      }, VISIBLE_ROWS.medium).actor,
    ).toBe('human:key')
  })

  test('an agent driving a touch arc is still tagged as an agent', () => {
    // The path says how the movement was expressed; `source` says who asked
    // for it. A tool cannot become a hand by choosing a path.
    const outcome = detent(IDLE_DETENT_ACCUMULATOR, {
      path: 'touch-arc',
      source: 'agent',
      angleDeg: 60,
      timestampMs: 0,
      agentOrigin: 'example.test',
    }, VISIBLE_ROWS.medium)

    expect(outcome.actor).toBe('agent:example.test')
    expect(outcome.silenced).toBe(true)
  })

  test('an agent with no known origin is tagged unknown, not guessed at', () => {
    const outcome = detent(IDLE_DETENT_ACCUMULATOR, {
      path: 'direct',
      source: 'agent',
      detents: 1,
      timestampMs: 0,
    }, VISIBLE_ROWS.medium)

    expect(outcome.actor).toBe('agent:unknown')
  })
})

describe('gesture bookkeeping', () => {
  test('switching path mid-flight starts a new gesture rather than mixing units', () => {
    const arc = detent(IDLE_DETENT_ACCUMULATOR, {
      path: 'touch-arc',
      source: 'human',
      angleDeg: 17,
      timestampMs: 0,
    }, VISIBLE_ROWS.medium)
    expect(arc.accumulator.residualDeg).toBe(17)

    const scrolled = detent(arc.accumulator, {
      path: 'scroll',
      source: 'human',
      deltaY: 20,
      deltaMode: 0,
      viewportPx: 800,
      timestampMs: 50,
    }, VISIBLE_ROWS.medium)

    expect(scrolled.accumulator.path).toBe('scroll')
    expect(scrolled.accumulator.residualDeg).toBe(0)
    expect(scrolled.detents).toBe(0)
  })

  test('the reducer never mutates the accumulator it is handed', () => {
    const before = { ...IDLE_DETENT_ACCUMULATOR }
    detent(IDLE_DETENT_ACCUMULATOR, {
      path: 'touch-arc',
      source: 'human',
      angleDeg: 90,
      timestampMs: 0,
    }, VISIBLE_ROWS.medium)

    expect(IDLE_DETENT_ACCUMULATOR).toEqual(before)
  })
})

describe('the inertial coast (001 §4.4, Release row)', () => {
  /** Winds an arc gesture up to a release speed, in deg/s. */
  function windUp(speedDegPerSec: number): DetentAccumulator {
    const stepMs = 20
    const perStep = (speedDegPerSec * stepMs) / 1000
    const { accumulator } = replay(
      Array.from({ length: 6 }, (_, i) => ({
        path: 'touch-arc' as const,
        source: 'human' as const,
        angleDeg: perStep,
        timestampMs: (i + 1) * stepMs,
      })),
    )
    return accumulator
  }

  test('releasing a fast arc keeps the momentum instead of discarding it', () => {
    const wound = windUp(600)
    expect(wound.speedDegPerSec).toBeGreaterThan(DETENT.coastFloorDegPerSec)

    const released = endGesture(wound)

    expect(released.coasting).toBe(true)
    expect(released.speedDegPerSec).toBe(wound.speedDegPerSec)
    expect(released.direction).toBe(1)
    // Residual travel is still dropped — a coast is momentum, not a rounding.
    expect(released.residualDeg).toBe(0)
  })

  test('releasing below the floor stops dead', () => {
    const released = endGesture(windUp(30))
    expect(released.coasting).toBe(false)
    expect(released).toEqual(IDLE_DETENT_ACCUMULATOR)
  })

  test('there is no momentum in a keypress, a scroll or a tool call', () => {
    for (const input of [
      {
        path: 'key' as const,
        source: 'human' as const,
        direction: 1 as const,
        page: false,
        timestampMs: 0,
      },
      {
        path: 'scroll' as const,
        source: 'human' as const,
        deltaY: 400,
        deltaMode: 0 as const,
        viewportPx: 800,
        timestampMs: 0,
      },
      { path: 'direct' as const, source: 'human' as const, detents: 9, timestampMs: 0 },
    ]) {
      const outcome = detent(IDLE_DETENT_ACCUMULATOR, input, VISIBLE_ROWS.medium)
      expect(endGesture(outcome.accumulator).coasting).toBe(false)
    }
  })

  test('the coast fires detents, decays, and comes to rest below 60 deg/s', () => {
    let accumulator = endGesture(windUp(900))
    expect(accumulator.coasting).toBe(true)

    let frames = 0
    let detents = 0
    let lastSpeed = accumulator.speedDegPerSec

    while (accumulator.coasting && frames < 1000) {
      const outcome = coastStep(accumulator, 1 / 60)
      // Velocity only ever decreases.
      expect(outcome.accumulator.speedDegPerSec).toBeLessThanOrEqual(lastSpeed)
      lastSpeed = outcome.accumulator.speedDegPerSec
      detents += outcome.detents
      accumulator = outcome.accumulator
      frames += 1
    }

    expect(frames).toBeLessThan(1000)
    expect(detents).toBeGreaterThan(0)
    // It stops, rather than crawling forever at 0.94^n.
    expect(accumulator).toEqual(IDLE_DETENT_ACCUMULATOR)
  })

  test('a coast travels in the direction the gesture was going', () => {
    const stepMs = 20
    const { accumulator } = replay(
      Array.from({ length: 6 }, (_, i) => ({
        path: 'touch-arc' as const,
        source: 'human' as const,
        angleDeg: -12,
        timestampMs: (i + 1) * stepMs,
      })),
    )
    let coasting = endGesture(accumulator)
    expect(coasting.direction).toBe(-1)

    let net = 0
    while (coasting.coasting) {
      const outcome = coastStep(coasting, 1 / 60)
      net += outcome.detents
      coasting = outcome.accumulator
    }
    expect(net).toBeLessThan(0)
  })

  test('EVERY coasted detent still clicks — 001 §4.4 says so explicitly', () => {
    let accumulator = endGesture(windUp(900))
    let detents = 0
    let ticks = 0

    while (accumulator.coasting) {
      const outcome = coastStep(accumulator, 1 / 60)
      detents += Math.abs(outcome.detents)
      ticks += outcome.clickerTicks
      accumulator = outcome.accumulator
    }

    expect(detents).toBeGreaterThan(0)
    expect(ticks).toBe(detents)
  })

  test('an agent’s coast is silent, like everything else an agent does', () => {
    // An agent has no momentum, so this should never arise — but the silence
    // rule must not have a hole in it just because a path is unreachable
    // today. The coast reads `source` off the accumulator for exactly this.
    const stepMs = 20
    const { accumulator } = replay(
      Array.from({ length: 6 }, (_, i) => ({
        path: 'touch-arc' as const,
        source: 'agent' as const,
        angleDeg: 12,
        timestampMs: (i + 1) * stepMs,
      })),
    )
    let coasting = endGesture(accumulator)
    let detents = 0
    let ticks = 0
    let pulses = 0

    while (coasting.coasting) {
      const outcome = coastStep(coasting, 1 / 60)
      detents += Math.abs(outcome.detents)
      ticks += outcome.clickerTicks
      pulses += outcome.hapticPulses
      expect(outcome.silenced).toBe(true)
      coasting = outcome.accumulator
    }

    expect(detents).toBeGreaterThan(0)
    expect(ticks).toBe(0)
    expect(pulses).toBe(0)
  })

  test('a coast never announces per detent — the flick already scheduled one', () => {
    let accumulator = endGesture(windUp(900))
    while (accumulator.coasting) {
      const outcome = coastStep(accumulator, 1 / 60)
      expect(outcome.announce).toBe('debounced')
      accumulator = outcome.accumulator
    }
  })

  test('stepping a wheel that is not coasting is a no-op, not a resurrection', () => {
    const outcome = coastStep(IDLE_DETENT_ACCUMULATOR, 1 / 60)
    expect(outcome.detents).toBe(0)
    expect(outcome.rowDelta).toBe(0)
    expect(outcome.accumulator).toEqual(IDLE_DETENT_ACCUMULATOR)
  })
})

describe('accelerated says what multiplier cannot', () => {
  test('false for every keyboard event, including Shift', () => {
    for (const page of [false, true]) {
      const outcome = detent(
        IDLE_DETENT_ACCUMULATOR,
        { path: 'key', source: 'human', direction: 1, page, timestampMs: 0 },
        VISIBLE_ROWS.compact,
      )
      expect(outcome.accelerated).toBe(false)
    }
  })

  test('false on the scroll path however fast the wheel spins', () => {
    const { outcomes } = replay(
      Array.from({ length: 20 }, (_, i) => ({
        path: 'scroll' as const,
        source: 'human' as const,
        deltaY: 400,
        deltaMode: 0 as const,
        viewportPx: 800,
        timestampMs: i * 4,
      })),
    )
    expect(outcomes.every((outcome) => !outcome.accelerated)).toBe(true)
  })

  test('false for a programmatic movement of any size', () => {
    const outcome = detent(
      IDLE_DETENT_ACCUMULATOR,
      { path: 'direct', source: 'agent', detents: 200, timestampMs: 0 },
      VISIBLE_ROWS.medium,
    )
    expect(outcome.accelerated).toBe(false)
    expect(outcome.rowDelta).toBe(200)
  })

  test('true only when an arc went fast enough to be given extra rows', () => {
    const { outcomes } = replay(
      Array.from({ length: 5 }, (_, i) => ({
        path: 'touch-arc' as const,
        source: 'human' as const,
        angleDeg: 60,
        timestampMs: (i + 1) * 60,
      })),
    )
    expect(outcomes[0]?.accelerated).toBe(false)
    expect(outcomes.at(-1)?.accelerated).toBe(true)
    expect(outcomes.at(-1)?.multiplier).toBe(DETENT.rowsFaster)
  })
})
