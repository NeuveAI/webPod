import { describe, expect, test } from 'bun:test'
import type { ScreenMeshHandle } from '@webpod/device'
import { renderToString } from 'react-dom/server'
import type { Camera, WebGLRenderer } from 'three'

import { CompositeDevice } from './CompositeDevice'
import { CompositeCoordinator } from './coordinator'
import type { PanelPixelAttachment, PanelPixelSource } from './pixel-source'

type SourceRecord = {
  readonly source: PanelPixelSource<'webgl'>
  readonly attachments: PanelPixelAttachment<'webgl'>[]
  detachCount: number
  syncCount: number
}

describe('CompositeDevice public boundary', () => {
  test('renders on the server without touching document', () => {
    const html = renderToString(<CompositeDevice panel={<p>Panel</p>} />)
    expect(html).toContain('data-composite-tier="T4"')
    expect(html).toContain('data-composite-ready="false"')
    expect(html).toContain('contain:layout size paint')
    expect(html).toContain('min-inline-size:0')
    expect(html).toContain('overflow:clip')
    expect(html).not.toContain('Panel')
  })
})

describe('CompositeCoordinator lifecycle', () => {
  test('replaces renderer and camera without retaining a detached source', () => {
    const records: SourceRecord[] = []
    const coordinator = makeCoordinator(records)
    const screen = makeScreen()
    const first = makeContext()
    const secondRenderer = makeContext()
    const secondCamera = { ...secondRenderer, renderer: first.renderer }

    coordinator.setPanel({} as HTMLElement)
    coordinator.setScreen(screen)
    coordinator.setRenderContext(first)
    expect(records).toHaveLength(1)

    coordinator.setRenderContext(secondRenderer)
    expect(records[0]?.detachCount).toBe(1)
    expect(records).toHaveLength(2)
    expect(records[1]?.attachments[0]?.renderer).toBe(secondRenderer.renderer)

    coordinator.setRenderContext(secondCamera)
    expect(records[1]?.detachCount).toBe(1)
    expect(records).toHaveLength(3)
    expect(records[2]?.attachments[0]?.camera).toBe(secondCamera.camera)
  })

  test('resyncs geometry without polling', () => {
    const records: SourceRecord[] = []
    const coordinator = makeCoordinator(records)
    coordinator.setPanel({} as HTMLElement)
    coordinator.setScreen(makeScreen())
    coordinator.setRenderContext(makeContext())
    coordinator.resyncGeometry()
    expect(records[0]?.syncCount).toBe(1)
  })

  test('context loss detaches and restore attaches once', () => {
    const records: SourceRecord[] = []
    let lost = 0
    let restored = 0
    const coordinator = makeCoordinator(records, {
      markContextLost: () => { lost += 1 },
      refreshTier: () => { restored += 1 },
    })
    const context = makeContext()
    coordinator.setPanel({} as HTMLElement)
    coordinator.setScreen(makeScreen())
    coordinator.setRenderContext(context)

    context.canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
    expect(lost).toBe(1)
    expect(records[0]?.detachCount).toBe(1)
    context.canvas.dispatchEvent(new Event('webglcontextrestored'))
    expect(restored).toBe(1)
    expect(records).toHaveLength(2)
  })

  test('cleans a source whose attach fails and can retry', () => {
    let calls = 0
    const records: SourceRecord[] = []
    const coordinator = new CompositeCoordinator('dark', () => {
      calls += 1
      const record = makeSourceRecord()
      records.push(record)
      if (calls === 1) {
        record.source.attach = () => { throw new Error('attach failed') }
      }
      return record.source
    }, { markContextLost() {}, refreshTier() {} })
    coordinator.setPanel({} as HTMLElement)
    coordinator.setScreen(makeScreen())
    const context = makeContext()
    expect(() => coordinator.setRenderContext(context)).toThrow('attach failed')
    expect(records[0]?.detachCount).toBe(1)
    coordinator.setRenderContext(context)
    expect(records).toHaveLength(2)
  })

  test('repeated clear, reattach, and dispose are idempotent', () => {
    const records: SourceRecord[] = []
    const coordinator = makeCoordinator(records)
    const first = makeContext()
    const second = makeContext()
    coordinator.setPanel({} as HTMLElement)
    coordinator.setScreen(makeScreen())
    coordinator.setRenderContext(first)
    coordinator.clearRenderContext(first.renderer)
    coordinator.clearRenderContext(first.renderer)
    coordinator.setRenderContext(second)
    coordinator.dispose()
    coordinator.dispose()

    expect(records).toHaveLength(2)
    expect(records.map((record) => record.detachCount)).toEqual([1, 1])
  })
})

function makeCoordinator(records: SourceRecord[], lifecycle = {
  markContextLost() {},
  refreshTier() {},
}): CompositeCoordinator {
  return new CompositeCoordinator('dark', () => {
    const record = makeSourceRecord()
    records.push(record)
    return record.source
  }, lifecycle)
}

function makeSourceRecord(): SourceRecord {
  const record: SourceRecord = {
    attachments: [],
    detachCount: 0,
    syncCount: 0,
    source: undefined as never,
  }
  const source: PanelPixelSource<'webgl'> = {
    tier: 'T1',
    requires: {
      renderer: 'webgl',
      materialVariant: 'test',
      shaderVariants: [],
      textureSet: [],
    },
    attach(attachment) { record.attachments.push(attachment) },
    syncGeometry() { record.syncCount += 1 },
    detach() { record.detachCount += 1 },
  }
  Object.assign(record, { source })
  return record
}

function makeContext() {
  const canvas = new EventTarget() as HTMLCanvasElement
  const renderer = { domElement: canvas } as WebGLRenderer
  const camera = {} as Camera
  return { renderer, camera, canvas }
}

function makeScreen(): ScreenMeshHandle {
  return {
    panel: { width: 320, height: 240, scale: 0.85 },
    size: { width: 272, height: 204 },
    readTransform: () => ({}) as ReturnType<ScreenMeshHandle['readTransform']>,
    onTransformChange: () => () => undefined,
    setMaterial() {},
    invalidate() {},
  }
}
