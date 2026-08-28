import { useThree } from '@react-three/fiber'
import { DeviceCanvas, type Colourway, type ScreenMeshHandle } from '@webpod/device'
import { useCallback, useEffect, useLayoutEffect, useMemo, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Camera, WebGLRenderer } from 'three'

import { createPanelPixelSource, type PanelOverlayTone } from './html-in-canvas'
import type { PanelPixelSource } from './pixel-source'
import {
  markCompositeContextLost,
  refreshCompositeTier,
} from './tier-store'

export interface CompositeDeviceProps {
  readonly panel: ReactNode
  readonly colourway?: Colourway
  readonly className?: string
  readonly panelTone?: PanelOverlayTone
}

type RenderContext = { readonly renderer: WebGLRenderer; readonly camera: Camera }

/**
 * Renders one real DOM panel through the device's T1 screen material.
 *
 * The portal stays a React-owned DOM tree after Three reparents its host below
 * the canvas. No React component owns a duplicate copy of panel state.
 */
export function CompositeDevice({
  panel,
  colourway = 'black',
  className,
  panelTone = 'dark',
}: CompositeDeviceProps) {
  const host = useMemo(() => createPanelHost(), [])
  const coordinator = useMemo(() => new CompositeCoordinator(panelTone), [panelTone])

  useLayoutEffect(() => {
    coordinator.setPanel(host)
    return () => coordinator.dispose()
  }, [coordinator, host])

  const onScreenMeshReady = useCallback(
    (screen: ScreenMeshHandle) => coordinator.setScreen(screen),
    [coordinator],
  )

  return (
    <div className={className} data-composite-tier="T1">
      {createPortal(panel, host)}
      <DeviceCanvas colourway={colourway} onScreenMeshReady={onScreenMeshReady}>
        <CompositeSceneBridge coordinator={coordinator} />
      </DeviceCanvas>
    </div>
  )
}

function createPanelHost(): HTMLDivElement {
  const host = document.createElement('div')
  host.className = 'wp-composite-panel-host'
  host.setAttribute('aria-label', 'Composited iPod display')
  return host
}

function CompositeSceneBridge({ coordinator }: { readonly coordinator: CompositeCoordinator }) {
  const renderer = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)

  useEffect(() => {
    coordinator.setRenderContext({ renderer, camera })
    return () => coordinator.clearRenderContext(renderer)
  }, [camera, coordinator, renderer])

  return null
}

class CompositeCoordinator {
  private panel: HTMLElement | null = null
  private screen: ScreenMeshHandle | null = null
  private context: RenderContext | null = null
  private source: PanelPixelSource | null = null
  private contextLostListener: ((event: Event) => void) | null = null
  private contextRestoredListener: (() => void) | null = null

  constructor(private readonly tone: PanelOverlayTone) {}

  setPanel(panel: HTMLElement): void {
    this.panel = panel
    this.reconcile()
  }

  setScreen(screen: ScreenMeshHandle): void {
    // R3F may replay a callback ref in development and the device creates a
    // fresh handle for that same mesh each time. Replacing an active handle
    // would detach the material that caused the callback and form a loop.
    // There is no stable mesh identity or disposal signal on the boundary, so
    // an active attachment deliberately keeps the first live handle.
    if (this.source !== null) return
    this.screen = screen
    this.reconcile()
  }

  setRenderContext(context: RenderContext): void {
    if (this.context?.renderer !== context.renderer) {
      this.source?.detach()
      this.removeContextListeners()
    }
    this.context = context
    this.installContextListeners(context.renderer.domElement)
    this.reconcile()
  }

  clearRenderContext(renderer: WebGLRenderer): void {
    if (this.context?.renderer !== renderer) return
    this.source?.detach()
    this.source = null
    this.removeContextListeners()
    this.context = null
  }

  dispose(): void {
    this.source?.detach()
    this.source = null
    this.removeContextListeners()
    this.panel = null
    this.screen = null
    this.context = null
  }

  private reconcile(): void {
    if (this.source !== null || this.panel === null || this.screen === null || this.context === null) return
    const source = createPanelPixelSource(this.tone)
    source.attach({
      panelElement: this.panel,
      screen: this.screen,
      renderer: this.context.renderer,
      camera: this.context.camera,
    })
    this.source = source
  }

  private installContextListeners(canvas: HTMLCanvasElement): void {
    if (this.contextLostListener !== null) return
    this.contextLostListener = (event) => {
      event.preventDefault()
      this.source?.detach()
      this.source = null
      markCompositeContextLost()
    }
    this.contextRestoredListener = () => {
      refreshCompositeTier()
      this.reconcile()
    }
    canvas.addEventListener('webglcontextlost', this.contextLostListener)
    canvas.addEventListener('webglcontextrestored', this.contextRestoredListener)
  }

  private removeContextListeners(): void {
    const canvas = this.context?.renderer.domElement
    if (canvas !== undefined && this.contextLostListener !== null) {
      canvas.removeEventListener('webglcontextlost', this.contextLostListener)
    }
    if (canvas !== undefined && this.contextRestoredListener !== null) {
      canvas.removeEventListener('webglcontextrestored', this.contextRestoredListener)
    }
    this.contextLostListener = null
    this.contextRestoredListener = null
  }
}
