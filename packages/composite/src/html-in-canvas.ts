import type { ScreenTransform } from '@webpod/device'
import {
  CanvasTexture,
  MeshBasicMaterial,
  LinearFilter,
  SRGBColorSpace,
} from 'three'

import { getCompositeTierSnapshot } from './tier-store'
import {
  HTML_IN_CANVAS_REQUIREMENTS,
  type PanelPixelAttachment,
  type PanelPixelSource,
} from './pixel-source'

export type PanelOverlayTone = 'dark' | 'light'

type RequestPaintCanvas = HTMLCanvasElement & { requestPaint(): void }
type PaintAwareCanvas = RequestPaintCanvas & { onpaint: ((event: Event) => void) | null }
type CanvasPaintEvent = Event & { readonly changedElements?: readonly Element[] }
type DrawElementOptions = { readonly preserveElementGeometry?: boolean }
type DrawElementContext = CanvasRenderingContext2D & {
  drawElementImage(
    element: Element,
    sx: number,
    sy: number,
    sWidth: number,
    sHeight: number,
    dx: number,
    dy: number,
    dWidth: number,
    dHeight: number,
    options?: DrawElementOptions,
  ): void
}

function canRequestPaint(canvas: HTMLCanvasElement): canvas is RequestPaintCanvas {
  return 'requestPaint' in canvas && typeof Reflect.get(canvas, 'requestPaint') === 'function'
}

/** A T1-only factory. Tier selection remains inside this package. */
export function createPanelPixelSource(tone: PanelOverlayTone): PanelPixelSource<'webgl'> {
  const snapshot = getCompositeTierSnapshot()
  if (snapshot.tier !== 'T1') {
    throw new Error(`T1 html-in-canvas is unavailable: ${snapshot.reason}`)
  }
  return new HtmlInCanvasPixelSource(tone)
}

/**
 * The sole pixel strategy in this slice.
 *
 * The visible screen stays a WebGL material, but the DOM→pixel bridge happens
 * through a dedicated offscreen 2D html-in-canvas raster canvas. That keeps
 * the authored panel on the native 320×240 LCD grid instead of letting the
 * WebGL upload path blur a second scaled copy.
 */
export class HtmlInCanvasPixelSource implements PanelPixelSource<'webgl'> {
  readonly tier = 'T1' as const
  readonly requires = HTML_IN_CANVAS_REQUIREMENTS

  private attachment: PanelPixelAttachment<'webgl'> | null = null
  private captureViewport: HTMLDivElement | null = null
  private texture: CanvasTexture | null = null
  private material: MeshBasicMaterial | null = null
  private rasterCanvas: RequestPaintCanvas | null = null
  private unsubscribeTransform: (() => void) | null = null
  private mutationObserver: MutationObserver | null = null
  private resizeObserver: ResizeObserver | null = null
  private resolutionCleanup: (() => void) | null = null
  private paintListener: EventListener | null = null
  private attachmentGeneration = 0
  private hasPaintRecord = false

  constructor(private readonly tone: PanelOverlayTone) {}

  attach(attachment: PanelPixelAttachment<'webgl'>): void {
    this.detach()
    this.attachment = attachment
    const generation = this.attachmentGeneration
    const { panelElement, renderer, screen } = attachment

    const rasterCanvas = document.createElement('canvas')
    if (!canRequestPaint(rasterCanvas)) {
      throw new Error('T1 html-in-canvas canvas cannot requestPaint()')
    }
    rasterCanvas.className = 'wp-composite-raster-canvas'
    rasterCanvas.setAttribute('layoutsubtree', 'true')
    rasterCanvas.setAttribute('aria-hidden', 'true')
    rasterCanvas.style.position = 'fixed'
    rasterCanvas.style.insetInlineStart = '0'
    rasterCanvas.style.insetBlockStart = '0'
    rasterCanvas.style.opacity = '0.001'
    rasterCanvas.style.pointerEvents = 'none'
    rasterCanvas.style.zIndex = '-1'
    rasterCanvas.style.contain = 'layout style paint size'

    panelElement.style.position = 'absolute'
    panelElement.style.insetInlineStart = '0'
    panelElement.style.insetBlockStart = '0'
    panelElement.style.transformOrigin = 'top left'
    panelElement.style.display = 'block'
    panelElement.style.overflow = 'hidden'
    panelElement.setAttribute('drawable', '')
    panelElement.dataset['pixelSource'] = 'html-in-canvas'

    const captureViewport = document.createElement('div')
    captureViewport.className = 'wp-composite-raster-viewport'
    captureViewport.style.position = 'absolute'
    captureViewport.style.insetInlineStart = '0'
    captureViewport.style.insetBlockStart = '0'
    captureViewport.style.display = 'block'
    captureViewport.style.overflow = 'hidden'
    captureViewport.setAttribute('drawable', '')

    panelElement.ownerDocument.body.appendChild(rasterCanvas)
    rasterCanvas.appendChild(captureViewport)
    captureViewport.appendChild(panelElement)

    const rasterContext = getDrawElementContext(rasterCanvas)
    if (rasterContext === null) {
      throw new Error('T1 html-in-canvas 2D drawElementImage() is unavailable')
    }
    rasterContext.imageSmoothingEnabled = false

    const texture = new CanvasTexture(rasterCanvas)
    texture.colorSpace = SRGBColorSpace
    texture.generateMipmaps = false
    texture.minFilter = LinearFilter
    texture.magFilter = LinearFilter
    texture.name = `webpod-lcd-${this.tone}-texture`

    const material = new MeshBasicMaterial({ map: texture, toneMapped: false })
    material.name = `webpod-lcd-${this.tone}`

    this.rasterCanvas = rasterCanvas
    this.captureViewport = captureViewport
    this.texture = texture
    this.material = material
    this.hasPaintRecord = false

    const fitRasterCanvasToPanel = (): {
      readonly changed: boolean
      readonly surfaceWidth: number
      readonly surfaceHeight: number
    } => {
      const content = resolveRasterContent(panelElement)
      const { width: contentWidth, height: contentHeight } = measurePanelElement(content)
      const density = resolvePanelRasterDensity(
        Math.max(window.devicePixelRatio, renderer.getPixelRatio()),
      )
      const rasterFrame = resolvePanelRasterFrame(
        contentWidth,
        contentHeight,
        density,
        screen.panel.scale,
      )
      const surfaceWidth = Math.max(1, Math.round(rasterFrame.width / density))
      const surfaceHeight = Math.max(1, Math.round(rasterFrame.height / density))
      const scaleX = surfaceWidth / Math.max(1, contentWidth)
      const scaleY = surfaceHeight / Math.max(1, contentHeight)
      rasterCanvas.style.width = `${String(surfaceWidth)}px`
      rasterCanvas.style.height = `${String(surfaceHeight)}px`
      captureViewport.style.width = `${String(surfaceWidth)}px`
      captureViewport.style.height = `${String(surfaceHeight)}px`
      panelElement.style.width = `${String(contentWidth)}px`
      panelElement.style.height = `${String(contentHeight)}px`
      panelElement.style.transform = `scale(${String(scaleX)}, ${String(scaleY)})`
      renderer.domElement.dataset['wpRasterDensity'] = String(density)
      renderer.domElement.dataset['wpRasterPixelWidth'] = String(rasterFrame.width)
      renderer.domElement.dataset['wpRasterPixelHeight'] = String(rasterFrame.height)
      const changed =
        rasterCanvas.width !== rasterFrame.width ||
        rasterCanvas.height !== rasterFrame.height
      if (changed) {
        rasterCanvas.width = rasterFrame.width
        rasterCanvas.height = rasterFrame.height
        rasterContext.imageSmoothingEnabled = false
      }
      return { changed, surfaceWidth, surfaceHeight }
    }

    const requestPixels = (): void => {
      if (this.attachmentGeneration !== generation || this.attachment !== attachment) return
      fitRasterCanvasToPanel()
      renderer.domElement.dataset['wpCompositeSourceState'] = this.hasPaintRecord
        ? 'repaint-requested'
        : 'snapshot-requested'
      rasterCanvas.requestPaint()
    }

    this.mutationObserver = new MutationObserver((records) => {
      const pixelsChanged = records.some((record) =>
        mutationAffectsPanelPixels(panelElement, record.target, record.attributeName),
      )
      if (pixelsChanged) requestPixels()
    })
    this.mutationObserver.observe(panelElement, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    })

    this.resizeObserver = new ResizeObserver(() => {
      fitRasterCanvasToPanel()
      requestPixels()
    })
    this.resizeObserver.observe(panelElement)
    const initialContent = resolveRasterContent(panelElement)
    if (initialContent !== panelElement) this.resizeObserver.observe(initialContent)

    this.resolutionCleanup = subscribeBrowserPixelRatio(() => {
      fitRasterCanvasToPanel()
      requestPixels()
    })
    this.unsubscribeTransform = screen.onTransformChange((transform) => {
      this.syncGeometry(transform)
    })

    this.paintListener = (event) => {
      if (this.attachmentGeneration !== generation || this.attachment !== attachment) return
      const changedElements = (event as CanvasPaintEvent).changedElements
      if (!paintTouchesPanel(captureViewport, changedElements)) return
      const frame = fitRasterCanvasToPanel()
      rasterContext.clearRect(0, 0, rasterCanvas.width, rasterCanvas.height)
      try {
        rasterContext.drawElementImage(
          captureViewport,
          0,
          0,
          frame.surfaceWidth,
          frame.surfaceHeight,
          0,
          0,
          rasterCanvas.width,
          rasterCanvas.height,
          { preserveElementGeometry: true },
        )
      } catch (error) {
        if (!this.hasPaintRecord) {
          renderer.domElement.dataset['wpCompositeSourceState'] = 'snapshot-awaiting-paint'
          requestAnimationFrame(() => {
            if (this.attachmentGeneration === generation && this.attachment === attachment) {
              requestPixels()
            }
          })
          return
        }
        throw error
      }
      if (!this.hasPaintRecord) screen.setMaterial(material)
      this.hasPaintRecord = true
      renderer.domElement.dataset['wpCompositeSourceState'] = 'painted'
      texture.needsUpdate = true
      screen.invalidate()
    }
    ;(rasterCanvas as PaintAwareCanvas).onpaint = this.paintListener

    requestPixels()
    requestAnimationFrame(() => {
      if (this.attachmentGeneration === generation && this.attachment === attachment) {
        requestPixels()
      }
    })
    this.syncGeometry(screen.readTransform())
  }

  syncGeometry(transform: ScreenTransform): void {
    const canvas = this.attachment?.renderer.domElement
    if (canvas === undefined) return
    const corners = transform.viewport.corners
    const xs = [
      corners.topLeft.x,
      corners.topRight.x,
      corners.bottomRight.x,
      corners.bottomLeft.x,
    ]
    const ys = [
      corners.topLeft.y,
      corners.topRight.y,
      corners.bottomRight.y,
      corners.bottomLeft.y,
    ]
    const left = Math.min(...xs)
    const top = Math.min(...ys)
    const right = Math.max(...xs)
    const bottom = Math.max(...ys)
    canvas.dataset['wpScreenClipLeft'] = String(left)
    canvas.dataset['wpScreenClipTop'] = String(top)
    canvas.dataset['wpScreenClipWidth'] = String(right - left)
    canvas.dataset['wpScreenClipHeight'] = String(bottom - top)
  }

  detach(): void {
    this.attachmentGeneration += 1
    const attachment = this.attachment
    const panel = attachment?.panelElement ?? null
    const canvas = attachment?.renderer.domElement ?? null
    const rasterCanvas = this.rasterCanvas
    const captureViewport = this.captureViewport

    this.unsubscribeTransform?.()
    this.unsubscribeTransform = null
    this.mutationObserver?.disconnect()
    this.mutationObserver = null
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    this.resolutionCleanup?.()
    this.resolutionCleanup = null

    if (rasterCanvas !== null) {
      ;(rasterCanvas as PaintAwareCanvas).onpaint = null
    }
    this.paintListener = null

    attachment?.screen.setMaterial(null)
    this.material?.dispose()
    this.material = null
    this.texture?.dispose()
    this.texture = null
    this.rasterCanvas = null
    this.captureViewport = null
    this.hasPaintRecord = false

    if (panel !== null) {
      panel.style.removeProperty('position')
      panel.style.removeProperty('inset-inline-start')
      panel.style.removeProperty('inset-block-start')
      panel.style.removeProperty('transform-origin')
      panel.style.removeProperty('transform')
      panel.style.removeProperty('display')
      panel.style.removeProperty('width')
      panel.style.removeProperty('height')
      panel.style.removeProperty('overflow')
      panel.removeAttribute('drawable')
      delete panel.dataset['pixelSource']
      if (captureViewport?.contains(panel) === true) captureViewport.removeChild(panel)
    }

    if (captureViewport !== null) {
      captureViewport.removeAttribute('drawable')
    }
    if (rasterCanvas?.isConnected === true) rasterCanvas.remove()

    if (canvas !== null) {
      delete canvas.dataset['wpRasterDensity']
      delete canvas.dataset['wpRasterPixelWidth']
      delete canvas.dataset['wpRasterPixelHeight']
      delete canvas.dataset['wpScreenClipLeft']
      delete canvas.dataset['wpScreenClipTop']
      delete canvas.dataset['wpScreenClipWidth']
      delete canvas.dataset['wpScreenClipHeight']
      delete canvas.dataset['wpCompositeSourceState']
      delete canvas.dataset['wpCompositeSourceError']
    }

    this.attachment = null
  }
}

export function resolvePanelRasterDensity(pixelRatio: number): 1 | 2 | 3 {
  if (!Number.isFinite(pixelRatio) || pixelRatio <= 1) return 1
  if (pixelRatio <= 2) return 2
  return 3
}

export function resolvePanelRasterFrame(
  contentWidth: number,
  contentHeight: number,
  density: 1 | 2 | 3,
  panelScale: number,
): { readonly width: number; readonly height: number; readonly scale: number } {
  const scale = density / positiveScale(panelScale)
  return {
    width: Math.max(1, Math.round(contentWidth * scale)),
    height: Math.max(1, Math.round(contentHeight * scale)),
    scale,
  }
}

export function mutationAffectsPanelPixels(
  panelElement: HTMLElement,
  target: Node,
  attributeName: string | null,
): boolean {
  return !(target === panelElement && attributeName === 'style')
}

function getDrawElementContext(canvas: HTMLCanvasElement): DrawElementContext | null {
  const context = canvas.getContext('2d', { alpha: true, willReadFrequently: true })
  if (context === null) return null
  const drawElementImage = Reflect.get(context, 'drawElementImage')
  return typeof drawElementImage === 'function'
    ? (context as DrawElementContext)
    : null
}

function resolveRasterContent(panelElement: HTMLElement): HTMLElement {
  return panelElement.firstElementChild instanceof HTMLElement
    ? panelElement.firstElementChild
    : panelElement
}

function measurePanelElement(element: HTMLElement): { readonly width: number; readonly height: number } {
  return {
    width: positiveDimension(element.scrollWidth || element.offsetWidth),
    height: positiveDimension(element.scrollHeight || element.offsetHeight),
  }
}

function paintTouchesPanel(
  sourceElement: HTMLElement,
  changedElements: readonly Element[] | undefined,
): boolean {
  if (changedElements === undefined || changedElements.length === 0) return true
  return changedElements.some(
    (element) => element === sourceElement || sourceElement.contains(element),
  )
}

function subscribeBrowserPixelRatio(listener: () => void): () => void {
  let resolution = window.matchMedia(`(resolution: ${String(window.devicePixelRatio)}dppx)`)
  const onChange = (): void => {
    resolution.removeEventListener('change', onChange)
    resolution = window.matchMedia(`(resolution: ${String(window.devicePixelRatio)}dppx)`)
    resolution.addEventListener('change', onChange)
    listener()
  }
  resolution.addEventListener('change', onChange)
  window.visualViewport?.addEventListener('resize', listener)
  return () => {
    resolution.removeEventListener('change', onChange)
    window.visualViewport?.removeEventListener('resize', listener)
  }
}

function positiveDimension(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : 1
}

function positiveScale(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1
}
