import { describe, expect, test } from 'bun:test'
import { createInteractionTelemetry, createMismatchTracker, orientationMismatch } from './interaction-telemetry'

describe('local interaction telemetry', () => {
  test('bounds history and copies observations before mutable owners change', () => {
    const trace = createInteractionTelemetry(3, () => 42)
    const detail = { orientation: { yawDeg: 0 } }
    trace.record('before', detail)
    detail.orientation.yawDeg = 180
    expect(trace.read().events[0]?.detail).toEqual({ orientation: { yawDeg: 0 } })
    for (let i = 0; i < 10; i++) trace.record('snapshot', { i })
    expect(trace.read()).toMatchObject({ totalEvents: 11, events: [{ sequence: 9 }, { sequence: 10 }, { sequence: 11 }] })
    const single = createInteractionTelemetry(1)
    single.record('one'); single.record('two')
    expect(single.read().events.map(e => e.kind)).toEqual(['two'])
  })
  test('preserves the first incident and following context after the ring rolls over', () => {
    const trace = createInteractionTelemetry(100)
    for (let i = 0; i < 100; i++) trace.record('before', { i })
    trace.record('state-mismatch', { yaw: 180 })
    for (let i = 0; i < 200; i++) trace.record('after', { i })
    expect(trace.read().events).toHaveLength(100)
    expect(trace.read().firstIncident).toHaveLength(120)
    expect(trace.read().firstIncident?.filter(e => e.kind === 'state-mismatch')).toHaveLength(1)
    trace.clear()
    expect(trace.read()).toMatchObject({ events: [], firstIncident: null })
  })
  test('ignores transient lag and rearms after recovery', () => {
    const detect = createMismatchTracker()
    expect(detect(true, 0)).toBe(false)
    expect(detect(true, 1499)).toBe(false)
    expect(detect(false, 1500)).toBe(false)
    expect(detect(true, 1600)).toBe(false)
    expect(detect(true, 3100)).toBe(true)
    expect(detect(true, 5100)).toBe(false)
    detect(false, 5200)
    expect(detect(true, 5300)).toBe(false)
    expect(detect(true, 6800)).toBe(true)
  })
  test('compares every committed axis and detects missing scene evidence', () => {
    expect(orientationMismatch([0, 180, 0], [0, 180, 0])).toBe(false)
    expect(orientationMismatch([0, 180, 0], [0, 0, 0])).toBe(true)
    expect(orientationMismatch([0, 180, 0], null)).toBe(true)
    expect(orientationMismatch([0, 180, 0], [0, NaN, 0])).toBe(true)
  })
})
