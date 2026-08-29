import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import {
  detentAccumulatorAtom,
  deviceStore,
  highlightIndexAtom,
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
import type { ClickWheelArcEnd, ClickWheelArcSample } from '@webpod/device'

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
