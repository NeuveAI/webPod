import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { readFileSync } from 'node:fs'
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
  InteractionAudioButtonDown,
  InteractionAudioButtonUp,
  InteractionAudioResult,
  InteractionAudioRuntime,
} from './interaction-audio'
import type {
  ClickWheelArcEnd,
  ClickWheelArcSample,
  ClickWheelCardinalEnd,
  ClickWheelCardinalPress,
  ClickWheelCardinalStart,
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
    const buttonDowns: InteractionAudioButtonDown[] = []
    const buttonUps: InteractionAudioButtonUp[] = []
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
      buttonDown(contact) {
        buttonDowns.push(contact)
        return { ...scheduled, requested: 2, scheduled: 2 }
      },
      buttonUp(contact) {
        buttonUps.push(contact)
        return scheduled
      },
      setEnabled() {},
      interrupt: async () => undefined,
      snapshot: () => ({
        lifecycle: 'running',
        enabled: true,
        activeVoices: 0,
        activeButtonContacts: 0,
        reservedButtonReleases: 0,
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
    expect(buttonDowns).toHaveLength(1)
    expect(buttonUps).toEqual([
      { id: 'pointer:40:center', timestampMs: 112, reason: 'cancel' },
    ])

    selectStart({ pointerId: 41, pointerType: 'mouse', timestampMs: 120 })
    selectEnd({ pointerId: 41, timestampMs: 132, reason: 'release' })
    selectEnd({ pointerId: 41, timestampMs: 133, reason: 'release' })
    expect(buttonDowns.map(({ id }) => id)).toEqual([
      'pointer:40:center',
      'pointer:41:center',
    ])
    expect(buttonUps.at(-1)).toEqual({
      id: 'pointer:41:center',
      timestampMs: 132,
      reason: 'release',
    })
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

  test('all four cardinal sectors publish one accepted feedback event', async () => {
    const environment = makeEnvironment()
    const consumed: InteractionFeedbackEvent[] = []
    const mounted: {
      cardinalStart: ((start: ClickWheelCardinalStart) => void) | null
      cardinalEnd: ((end: ClickWheelCardinalEnd) => void) | null
      cardinalPress: ((press: ClickWheelCardinalPress) => void) | null
    } = { cardinalStart: null, cardinalEnd: null, cardinalPress: null }
    const contacts = {
      downs: [] as InteractionAudioButtonDown[],
      ups: [] as InteractionAudioButtonUp[],
    }
    const audio = recordingAudio(consumed, true, contacts)
    seedSingletonScreen()

    await act(async () => {
      root.render(
        <CompositeInputBoundary
          createDependencies={() => environment.dependencies}
          createAudioRuntime={() => audio}
          onPlayPausePress={() => true}
        >
          {(handlers) => {
            mounted.cardinalStart = handlers.onCardinalStart
            mounted.cardinalEnd = handlers.onCardinalEnd
            mounted.cardinalPress = handlers.onCardinalPress
            return <div role="application" tabIndex={0}>Cardinal panel</div>
          }}
        </CompositeInputBoundary>,
      )
    })
    const press = mounted.cardinalPress
    const start = mounted.cardinalStart
    const end = mounted.cardinalEnd
    if (press === null || start === null || end === null) {
      throw new Error('Cardinal bridge did not mount')
    }

    const presses = [
      { pointerId: 301, pointerType: 'mouse', button: 'menu' },
      { pointerId: 302, pointerType: 'touch', button: 'previous' },
      { pointerId: 303, pointerType: 'pen', button: 'next' },
      { pointerId: 304, pointerType: 'touch', button: 'play-pause' },
    ] as const
    for (const [index, contact] of presses.entries()) {
      const timestampMs = index * 100
      start({ ...contact, timestampMs })
      end({
        ...contact,
        timestampMs: timestampMs + 60,
        reason: 'release',
        accepted: true,
      })
      press({ ...contact, timestampMs: timestampMs + 60 })
    }
    await act(async () => Promise.resolve())

    expect(consumed.map((event) =>
      event.control === 'press' ? event.button : event.control,
    )).toEqual(['menu', 'previous', 'next', 'play-pause'])
    expect(consumed.map(({ actor }) => actor)).toEqual([
      'human:mouse',
      'human:touch',
      'human:touch',
      'human:touch',
    ])
    expect(consumed.every(({ clickerTicks }) => clickerTicks === 1)).toBeTrue()
    expect(contacts.downs.map(({ button }) => button)).toEqual([
      'menu', 'previous', 'next', 'play-pause',
    ])
    expect(contacts.ups.map(({ timestampMs }) => timestampMs)).toEqual([
      60, 160, 260, 360,
    ])
  })

  test('rejected Play/Pause, mute and raw DOM click never enter audio', async () => {
    const environment = makeEnvironment()
    const consumed: InteractionFeedbackEvent[] = []
    const mounted: {
      cardinalPress: ((press: ClickWheelCardinalPress) => void) | null
    } = { cardinalPress: null }
    const audio = recordingAudio(consumed, false)

    await act(async () => {
      root.render(
        <CompositeInputBoundary
          createDependencies={() => environment.dependencies}
          createAudioRuntime={() => audio}
          interactionAudioEnabled={false}
          onPlayPausePress={() => false}
        >
          {(handlers) => {
            mounted.cardinalPress = handlers.onCardinalPress
            return <div role="application" tabIndex={0}>Muted panel</div>
          }}
        </CompositeInputBoundary>,
      )
    })
    const press = mounted.cardinalPress
    const application = container.querySelector<HTMLElement>('[role="application"]')
    if (press === null || application === null) throw new Error('Muted bridge did not mount')
    press({
      pointerId: 310,
      pointerType: 'mouse',
      button: 'play-pause',
      timestampMs: 1,
    })
    application.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await act(async () => Promise.resolve())
    expect(consumed).toHaveLength(0)
  })

  test('cardinal semantics have no raw DOM click wiring to double-fire', () => {
    const composite = readFileSync(new URL('./CompositeDevice.tsx', import.meta.url), 'utf8')
    const device = readFileSync(
      new URL('../../device/src/click-wheel-input.tsx', import.meta.url),
      'utf8',
    )
    const rawClickBinding = /(?:addEventListener\s*\(\s*['"]click['"]|onClick\s*=)/

    expect(composite).not.toMatch(rawClickBinding)
    expect(device).not.toMatch(rawClickBinding)
  })

  test('keyboard physical semantics fire on release once and cancel on blur', async () => {
    const environment = makeEnvironment()
    const consumed: InteractionFeedbackEvent[] = []
    const contacts = {
      downs: [] as InteractionAudioButtonDown[],
      ups: [] as InteractionAudioButtonUp[],
    }
    let playPauseActions = 0
    const audio = recordingAudio(consumed, true, contacts)
    seedSingletonScreen()

    await act(async () => {
      root.render(
        <CompositeInputBoundary
          createDependencies={() => environment.dependencies}
          createAudioRuntime={() => audio}
          onPlayPausePress={() => {
            playPauseActions += 1
            return true
          }}
        >
          {() => <div role="application" tabIndex={0}>Keyboard panel</div>}
        </CompositeInputBoundary>,
      )
    })
    const application = container.querySelector<HTMLElement>('[role="application"]')
    if (application === null) throw new Error('Keyboard bridge did not mount')
    application.focus()

    for (const key of ['Escape', 'PageUp', 'PageDown', ' ', 'Enter']) {
      application.dispatchEvent(new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
      }))
      application.dispatchEvent(new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
        repeat: true,
      }))
      application.dispatchEvent(new KeyboardEvent('keyup', {
        key,
        bubbles: true,
        cancelable: true,
      }))
    }
    await act(async () => Promise.resolve())

    expect(consumed.map((event) =>
      event.control === 'press' ? event.button : event.control,
    )).toEqual(['menu', 'previous', 'next', 'play-pause', 'center'])
    expect(consumed.every(({ actor }) => actor === 'human:key')).toBeTrue()
    expect(playPauseActions).toBe(1)
    expect(contacts.downs.map(({ button }) => button)).toEqual([
      'menu', 'previous', 'next', 'play-pause', 'center',
    ])
    expect(contacts.ups).toHaveLength(5)

    application.dispatchEvent(new KeyboardEvent('keydown', {
      key: ' ',
      bubbles: true,
      cancelable: true,
    }))
    window.dispatchEvent(new Event('blur'))
    application.dispatchEvent(new KeyboardEvent('keyup', {
      key: ' ',
      bubbles: true,
      cancelable: true,
    }))
    await act(async () => Promise.resolve())
    expect(playPauseActions).toBe(1)
    expect(consumed).toHaveLength(5)
    expect(contacts.downs).toHaveLength(6)
    expect(contacts.ups).toHaveLength(5)
  })

  test('multiple mounted public boundaries consume one feedback sequence once', async () => {
    const firstEnvironment = makeEnvironment()
    const secondEnvironment = makeEnvironment()
    const consumed: InteractionFeedbackEvent[] = []
    const createAudio = (): InteractionAudioRuntime => ({
      activate: async () => ({ status: 'running', reason: 'running' }),
      consume(event) {
        consumed.push(event)
        return {
          status: 'scheduled',
          reason: 'scheduled',
          requested: event.clickerTicks,
          scheduled: event.clickerTicks,
          dropped: 0,
        }
      },
      buttonDown: () => ({
        status: 'scheduled',
        reason: 'scheduled',
        requested: 2,
        scheduled: 2,
        dropped: 0,
      }),
      buttonUp: () => ({
        status: 'scheduled',
        reason: 'scheduled',
        requested: 1,
        scheduled: 1,
        dropped: 0,
      }),
      setEnabled() {},
      interrupt: async () => undefined,
      snapshot: () => ({
        lifecycle: 'running',
        enabled: true,
        activeVoices: 0,
        activeButtonContacts: 0,
        reservedButtonReleases: 0,
        pendingEvents: 0,
        scheduledTotal: consumed.length,
        droppedTotal: 0,
        lastResult: null,
      }),
      dispose() {},
    })

    await act(async () => {
      root.render(
        <>
          <CompositeInputBoundary
            createDependencies={() => firstEnvironment.dependencies}
            createAudioRuntime={createAudio}
          >
            {() => <div>First device</div>}
          </CompositeInputBoundary>
          <CompositeInputBoundary
            createDependencies={() => secondEnvironment.dependencies}
            createAudioRuntime={createAudio}
          >
            {() => <div>Second device</div>}
          </CompositeInputBoundary>
        </>,
      )
    })

    deviceStore.set(pressActionAtom, { button: 'center', source: 'human' })

    expect(consumed).toHaveLength(1)
  })

  test('the mounted mute prop reaches the runtime without constructing settings UI', async () => {
    const environment = makeEnvironment()
    const enabledValues: boolean[] = []
    const audio: InteractionAudioRuntime = {
      activate: async () => ({ status: 'running', reason: 'running' }),
      consume: () => ({
        status: 'silent',
        reason: 'disabled',
        requested: 1,
        scheduled: 0,
        dropped: 1,
      }),
      buttonDown: () => ({
        status: 'silent',
        reason: 'disabled',
        requested: 2,
        scheduled: 0,
        dropped: 2,
      }),
      buttonUp: () => ({
        status: 'silent',
        reason: 'disabled',
        requested: 1,
        scheduled: 0,
        dropped: 1,
      }),
      setEnabled(enabled) {
        enabledValues.push(enabled)
      },
      interrupt: async () => undefined,
      snapshot: () => ({
        lifecycle: 'locked',
        enabled: enabledValues.at(-1) ?? true,
        activeVoices: 0,
        activeButtonContacts: 0,
        reservedButtonReleases: 0,
        pendingEvents: 0,
        scheduledTotal: 0,
        droppedTotal: 0,
        lastResult: null,
      }),
      dispose() {},
    }

    await act(async () => {
      root.render(
        <CompositeInputBoundary
          interactionAudioEnabled={false}
          createDependencies={() => environment.dependencies}
          createAudioRuntime={() => audio}
        >
          {() => <div>Muted device</div>}
        </CompositeInputBoundary>,
      )
    })
    expect(enabledValues).toEqual([false])

    await act(async () => {
      root.render(
        <CompositeInputBoundary
          interactionAudioEnabled
          createDependencies={() => environment.dependencies}
          createAudioRuntime={() => audio}
        >
          {() => <div>Unmuted device</div>}
        </CompositeInputBoundary>,
      )
    })
    expect(enabledValues).toEqual([false, true])
  })
})

class FakeTarget implements RuntimeEventTarget {
  addEventListener(): void {}
  removeEventListener(): void {}
}

class FakeReducedMotion extends FakeTarget implements ReducedMotionQuery {
  matches = false
}

function recordingAudio(
  consumed: InteractionFeedbackEvent[],
  initiallyEnabled: boolean,
  contacts?: {
    readonly downs: InteractionAudioButtonDown[]
    readonly ups: InteractionAudioButtonUp[]
  },
): InteractionAudioRuntime {
  let enabled = initiallyEnabled
  return {
    activate: async () => ({ status: 'running', reason: 'running' }),
    consume(event) {
      consumed.push(event)
      return {
        status: 'scheduled',
        reason: 'scheduled',
        requested: event.clickerTicks,
        scheduled: event.clickerTicks,
        dropped: 0,
      }
    },
    buttonDown: (contact) => {
      contacts?.downs.push(contact)
      return {
      status: enabled ? 'scheduled' : 'silent',
      reason: enabled ? 'scheduled' : 'disabled',
      requested: 2,
      scheduled: enabled ? 2 : 0,
      dropped: enabled ? 0 : 2,
      }
    },
    buttonUp: (contact) => {
      contacts?.ups.push(contact)
      return {
      status: enabled ? 'scheduled' : 'silent',
      reason: enabled ? 'scheduled' : 'disabled',
      requested: 1,
      scheduled: enabled ? 1 : 0,
      dropped: enabled ? 0 : 1,
      }
    },
    setEnabled(next) {
      enabled = next
    },
    interrupt: async () => undefined,
    snapshot: () => ({
      lifecycle: 'running',
      enabled,
      activeVoices: 0,
      activeButtonContacts: 0,
      reservedButtonReleases: 0,
      pendingEvents: 0,
      scheduledTotal: consumed.length,
      droppedTotal: 0,
      lastResult: null,
    }),
    dispose() {},
  }
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
