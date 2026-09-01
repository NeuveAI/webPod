import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import {
  detentAccumulatorAtom,
  deviceStore,
  highlightIndexAtom,
  pressActionAtom,
  type InteractionFeedbackEvent,
  type PanelRow,
  type ScreenFrame,
  pushScreenActionAtom,
  resetStackActionAtom,
} from '@webpod/state'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import {
  CompositeInputBoundary,
} from './CompositeDevice'
import type {
  ClickWheelRuntimeDependencies,
  ReducedMotionQuery,
  RuntimeEventTarget,
} from './click-wheel-runtime'
import type {
  InteractionAudioResult,
  InteractionAudioRuntime,
} from './interaction-audio'
import type {
  ClickWheelArcEnd,
  ClickWheelArcSample,
  ClickWheelSelectEnd,
  ClickWheelSelectStart,
} from '@webpod/device'

GlobalRegistrator.register()
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true })

describe('mounted composite input boundary', () => {
  let container: HTMLDivElement
  let root: Root

  beforeAll(() => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterAll(async () => {
    await act(async () => root.unmount())
    container.remove()
    GlobalRegistrator.unregister()
  })

  test('production arc callbacks move the singleton store and restore application focus', async () => {
    const environment = makeEnvironment()
    const mounted: { handlers: {
      onArcStart(sample: ClickWheelArcSample): void
      onArcMove(sample: ClickWheelArcSample): void
      onArcEnd(end: ClickWheelArcEnd): void
    } | null } = { handlers: null }
    seedSingletonScreen()

    await act(async () => {
      root.render(
        <CompositeInputBoundary createDependencies={() => environment.dependencies}>
          {(nextHandlers) => {
            mounted.handlers = nextHandlers
            return <div role="application" tabIndex={0}>Panel</div>
          }}
        </CompositeInputBoundary>,
      )
    })

    const application = container.querySelector<HTMLElement>('[role="application"]')
    const handlers = mounted.handlers
    if (application === null || handlers === null) throw new Error('Boundary did not mount')
    application.focus()
    expect(document.activeElement).toBe(application)

    handlers.onArcStart({ pointerId: 7, pointerType: 'mouse', angleDeg: 0, timestampMs: 0 })
    document.body.focus()
    handlers.onArcMove({ pointerId: 7, pointerType: 'mouse', angleDeg: 90, timestampMs: 100 })
    handlers.onArcEnd({ pointerId: 7, timestampMs: 100, reason: 'cancel' })

    expect(deviceStore.get(highlightIndexAtom)).toBeGreaterThan(0)
    expect(deviceStore.get(detentAccumulatorAtom).path).toBeNull()
    expect(document.activeElement).toBe(application)
  })

  test('selection suppression is gesture-scoped and restores prior outside ranges', async () => {
    const environment = makeEnvironment()
    const mounted: { handlers: {
      onArcStart(sample: ClickWheelArcSample): void
      onArcMove(sample: ClickWheelArcSample): void
      onArcEnd(end: ClickWheelArcEnd): void
    } | null } = { handlers: null }
    const outside = document.createElement('p')
    outside.textContent = 'Outside text remains selectable'
    document.body.append(outside)

    await act(async () => {
      root.render(
        <CompositeInputBoundary createDependencies={() => environment.dependencies}>
          {(nextHandlers) => {
            mounted.handlers = nextHandlers
            return <div role="application">Selectable panel text</div>
          }}
        </CompositeInputBoundary>,
      )
    })

    const boundary = container.firstElementChild
    const panel = container.querySelector<HTMLElement>('[role="application"]')
    const handlers = mounted.handlers
    const outsideText = outside.firstChild
    const panelText = panel?.firstChild
    if (
      !(boundary instanceof HTMLElement) ||
      panel === null ||
      handlers === null ||
      outsideText === null ||
      panelText === null ||
      panelText === undefined
    ) throw new Error('Selection fixture did not mount')

    const selection = document.getSelection()
    if (selection === null) throw new Error('Selection API unavailable')
    const prior = document.createRange()
    prior.setStart(outsideText, 0)
    prior.setEnd(outsideText, 7)
    selection.removeAllRanges()
    selection.addRange(prior)

    handlers.onArcStart({ pointerId: 8, pointerType: 'mouse', angleDeg: 0, timestampMs: 0 })
    expect(boundary.dataset['wpWheelGesture']).toBe('active')
    expect(boundary.style.userSelect).toBe('none')

    const selectInside = new Event('selectstart', { bubbles: true, cancelable: true })
    panel.dispatchEvent(selectInside)
    expect(selectInside.defaultPrevented).toBeTrue()
    const selectOutside = new Event('selectstart', { bubbles: true, cancelable: true })
    outside.dispatchEvent(selectOutside)
    expect(selectOutside.defaultPrevented).toBeFalse()

    const accidental = document.createRange()
    accidental.selectNodeContents(panelText)
    selection.removeAllRanges()
    selection.addRange(accidental)
    document.dispatchEvent(new Event('selectionchange'))
    expect(selection.toString()).toBe('Outside')

    handlers.onArcEnd({ pointerId: 8, timestampMs: 20, reason: 'cancel' })
    expect(boundary.dataset['wpWheelGesture']).toBeUndefined()
    expect(boundary.style.userSelect).toBe('')
    const after = new Event('selectstart', { bubbles: true, cancelable: true })
    panel.dispatchEvent(after)
    expect(after.defaultPrevented).toBeFalse()

    handlers.onArcStart({ pointerId: 9, pointerType: 'touch', angleDeg: 0, timestampMs: 30 })
    window.dispatchEvent(new Event('blur'))
    expect(boundary.dataset['wpWheelGesture']).toBeUndefined()
    expect(boundary.style.userSelect).toBe('')
    outside.remove()
    selection.removeAllRanges()
  })

  test('the mounted boundary consumes the store feedback stream once and disposes audio', async () => {
    const environment = makeEnvironment()
    const consumed: InteractionFeedbackEvent[] = []
    const mounted: {
      selectStart: ((start: ClickWheelSelectStart) => void) | null
      selectEnd: ((end: ClickWheelSelectEnd) => void) | null
    } = { selectStart: null, selectEnd: null }
    let disposals = 0
    const scheduled: InteractionAudioResult = {
      status: 'scheduled',
      reason: 'scheduled',
      requested: 1,
      scheduled: 1,
      dropped: 0,
    }
    const audio: InteractionAudioRuntime = {
      activate: async () => ({ status: 'running', reason: 'running' }),
      consume(event) {
        consumed.push(event)
        return scheduled
      },
      setEnabled() {},
      interrupt: async () => undefined,
      snapshot: () => ({
        lifecycle: 'running',
        enabled: true,
        activeVoices: 0,
        pendingEvents: 0,
        scheduledTotal: consumed.length,
        droppedTotal: 0,
        lastResult: consumed.length === 0 ? null : scheduled,
      }),
      dispose() {
        disposals += 1
      },
    }

    await act(async () => {
      root.render(
        <CompositeInputBoundary
          createDependencies={() => environment.dependencies}
          createAudioRuntime={() => audio}
        >
          {(handlers) => {
            mounted.selectStart = handlers.onSelectStart
            mounted.selectEnd = handlers.onSelectEnd
            return <div role="application">Audio panel</div>
          }}
        </CompositeInputBoundary>,
      )
    })

    const selectStart = mounted.selectStart
    const selectEnd = mounted.selectEnd
    const boundary = container.firstElementChild
    if (
      selectStart === null ||
      selectEnd === null ||
      !(boundary instanceof HTMLElement)
    ) throw new Error('Select bridge did not mount')
    expect(boundary.dataset['wpAudioLifecycle']).toBe('running')
    expect(boundary.dataset['wpAudioScheduledTotal']).toBe('0')
    selectStart({ pointerId: 40, pointerType: 'mouse', timestampMs: 100 })
    selectEnd({ pointerId: 40, timestampMs: 112, reason: 'cancel' })
    expect(consumed).toHaveLength(0)

    selectStart({ pointerId: 41, pointerType: 'mouse', timestampMs: 120 })
    selectEnd({ pointerId: 41, timestampMs: 132, reason: 'release' })
    selectEnd({ pointerId: 41, timestampMs: 133, reason: 'release' })
    expect(consumed).toHaveLength(1)
    expect(consumed[0]).toMatchObject({
      control: 'press',
      origin: 'press',
      button: 'center',
      clickerTicks: 1,
      silenced: false,
      actor: 'human:touch',
    })
    expect(boundary.dataset['wpAudioScheduledTotal']).toBe('1')
    expect(boundary.dataset['wpAudioLastResult']).toBe('scheduled:scheduled:1/1')

    await act(async () => root.render(<div>Detached</div>))
    expect(boundary.dataset['wpAudioLifecycle']).toBeUndefined()
    deviceStore.set(pressActionAtom, { button: 'center', source: 'human' })
    expect(consumed).toHaveLength(1)
    expect(disposals).toBe(1)
  })
})

class FakeTarget implements RuntimeEventTarget {
  addEventListener(): void {}
  removeEventListener(): void {}
}

class FakeReducedMotion extends FakeTarget implements ReducedMotionQuery {
  matches = false
}

function makeEnvironment() {
  const target = new FakeTarget()
  const reducedMotion = new FakeReducedMotion()
  const dependencies: ClickWheelRuntimeDependencies = {
    store: deviceStore,
    viewportPx: 204,
    requestFrame: () => 1,
    cancelFrame: () => undefined,
    setTimer: () => 1,
    clearTimer: () => undefined,
    reducedMotion,
    documentTarget: Object.assign(target, { hidden: false }),
    windowTarget: target,
  }
  return { dependencies }
}

function seedSingletonScreen(): void {
  deviceStore.set(resetStackActionAtom, [])
  const rows: readonly PanelRow[] = Array.from({ length: 80 }, (_, index) => ({
    index,
    label: `Row ${String(index + 1)}`,
    sublabel: null,
    glyphs: [],
    provenance: null,
  }))
  const frame: ScreenFrame = {
    screenId: 'S09',
    title: 'Mounted composite test',
    rows,
    highlightIndex: 0,
    windowStart: 0,
    density: 'medium',
  }
  deviceStore.set(pushScreenActionAtom, frame)
}
