import type { ScreenMeshHandle } from '@webpod/device'
import type { Camera, Scene, WebGLRenderer } from 'three'

import { createPanelPixelSource, type PanelOverlayTone } from './html-in-canvas'
import type { PanelPixelSource } from './pixel-source'
import { markCompositeContextLost, refreshCompositeTier } from './tier-store'

export type RenderContext = {
  readonly renderer: WebGLRenderer
  readonly camera: Camera
  readonly scene: Scene
}
type PixelSourceFactory = (tone: PanelOverlayTone) => PanelPixelSource<'webgl'>
type CompositeLifecycle = {
  readonly markContextLost: () => void
  readonly refreshTier: () => unknown
}

const DEFAULT_LIFECYCLE: CompositeLifecycle = {
  markContextLost: markCompositeContextLost,
  refreshTier: refreshCompositeTier,
}

export class CompositeCoordinator {
  private panel: HTMLElement | null = null
  private screen: ScreenMeshHandle | null = null
  private context: RenderContext | null = null
  private source: PanelPixelSource<'webgl'> | null = null
  private contextLostListener: ((event: Event) => void) | null = null
  private contextRestoredListener: (() => void) | null = null
  private suspended = false

  constructor(
    private readonly tone: PanelOverlayTone,
    private readonly createSource: PixelSourceFactory = createPanelPixelSource,
    private readonly lifecycle: CompositeLifecycle = DEFAULT_LIFECYCLE,
  ) {}

  setPanel(panel: HTMLElement): void {
    this.panel = panel
    this.reconcile()
  }

  setScreen(screen: ScreenMeshHandle): void {
    if (this.source !== null) return
    this.screen = screen
    this.reconcile()
  }

  setRenderContext(context: RenderContext): void {
    const changed = this.context?.renderer !== context.renderer || this.context?.camera !== context.camera
    if (!changed) {
      this.reconcile()
      return
    }
    this.source?.detach()
    this.source = null
    this.removeContextListeners()
    this.context = context
    this.installContextListeners(context.renderer.domElement)
    this.reconcile()
  }

  resyncGeometry(): void {
    if (this.source === null || this.screen === null) return
    this.source.syncGeometry(this.screen.readTransform())
  }

  clearRenderContext(renderer: WebGLRenderer): void {
    if (this.context?.renderer !== renderer) return
    this.source?.detach()
    this.source = null
    this.removeContextListeners()
    clearCompositeSourceDiagnostics(renderer.domElement)
    this.context = null
  }

  dispose(): void {
    this.source?.detach()
    this.source = null
    if (this.context !== null) clearCompositeSourceDiagnostics(this.context.renderer.domElement)
    this.removeContextListeners()
    this.panel = null
    this.screen = null
    this.context = null
  }

  private reconcile(): void {
    if (
      this.suspended ||
      this.source !== null ||
      this.panel === null ||
      this.screen === null ||
      this.context === null
    ) return
    const source = this.createSource(this.tone)
    this.context.renderer.domElement.dataset['wpCompositeSourceState'] = 'attaching'
    delete this.context.renderer.domElement.dataset['wpCompositeSourceError']
    try {
      source.attach({
        kind: 'webgl',
        panelElement: this.panel,
        screen: this.screen,
        renderer: this.context.renderer,
        camera: this.context.camera,
        scene: this.context.scene,
      })
      this.context.renderer.domElement.dataset['wpCompositeSourceState'] = 'attached'
      this.source = source
    } catch (error) {
      this.context.renderer.domElement.dataset['wpCompositeSourceState'] = 'attach-error'
      this.context.renderer.domElement.dataset['wpCompositeSourceError'] =
        error instanceof Error ? error.message : String(error)
      source.detach()
      throw error
    }
  }

  private installContextListeners(canvas: HTMLCanvasElement): void {
    if (this.contextLostListener !== null) return
    this.contextLostListener = (event) => {
      event.preventDefault()
      this.source?.detach()
      this.source = null
      this.suspended = true
      this.lifecycle.markContextLost()
    }
    this.contextRestoredListener = () => {
      this.lifecycle.refreshTier()
      this.suspended = false
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

function clearCompositeSourceDiagnostics(canvas: HTMLCanvasElement): void {
  delete canvas.dataset['wpCompositeSourceState']
  delete canvas.dataset['wpCompositeSourceError']
}
