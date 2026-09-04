import type { ScreenTransform } from '@webpod/device'
import {
  HTMLTexture,
  Mesh,
  MeshBasicMaterial,
  LinearFilter,
  PlaneGeometry,
  SRGBColorSpace,
  ShaderChunk,
} from 'three'
import { InteractionManager } from 'three/addons/interaction/InteractionManager.js'

import { getCompositeTierSnapshot } from './tier-store'
import {
  HTML_IN_CANVAS_REQUIREMENTS,
  type PanelPixelAttachment,
  type PanelPixelSource,
} from './pixel-source'

export type PanelOverlayTone = 'dark' | 'light'

type RequestPaintCanvas = HTMLCanvasElement & { requestPaint(): void }
type CanvasPaintEvent = Event & { readonly changedElements?: readonly Element[] }

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
 * The panel remains the one live, interactive DOM tree below the WebGL canvas.
 * Three's HTMLTexture owns the experimental upload, while InteractionManager
 * writes the same element's CSS matrix3d so native hit testing, focus and
 * accessibility geometry follow the physical screen.
 */
export class HtmlInCanvasPixelSource implements PanelPixelSource<'webgl'> {
  readonly tier = 'T1' as const
  readonly requires = HTML_IN_CANVAS_REQUIREMENTS

  private attachment: PanelPixelAttachment<'webgl'> | null = null
  private texture: HTMLTexture | null = null
  private material: MeshBasicMaterial | null = null
  private proxy: Mesh<PlaneGeometry, MeshBasicMaterial> | null = null
  private interactions: InteractionManager | null = null
  private scaledContent: HTMLElement | null = null
  private unsubscribeTransform: (() => void) | null = null
  private mutationObserver: MutationObserver | null = null
  private resizeObserver: ResizeObserver | null = null
  private canvasResizeObserver: ResizeObserver | null = null
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

    const canvas = renderer.domElement
    if (!canRequestPaint(canvas)) {
      throw new Error('T1 html-in-canvas canvas cannot requestPaint()')
    }

    panelElement.style.position = 'absolute'
    panelElement.style.left = '0'
    panelElement.style.top = '0'
    panelElement.style.transformOrigin = 'top left'
    panelElement.style.display = 'block'
    panelElement.style.overflow = 'hidden'
    panelElement.setAttribute('drawable', '')
    panelElement.dataset['pixelSource'] = 'html-in-canvas'

    canvas.setAttribute('layoutsubtree', 'true')
    canvas.appendChild(panelElement)

    const texture = new HTMLTexture(panelElement)
    texture.colorSpace = SRGBColorSpace
    texture.generateMipmaps = false
    texture.minFilter = LinearFilter
    texture.magFilter = LinearFilter
    texture.name = `webpod-lcd-${this.tone}-texture`

    const material = createHtmlTextureMaterial(texture)
    material.name = `webpod-lcd-${this.tone}`
    const proxy = new Mesh(
      new PlaneGeometry(screen.size.width, screen.size.height),
      material,
    )
    proxy.matrixAutoUpdate = false
    proxy.frustumCulled = false
    const interactions = new InteractionManager()
    interactions.connect(renderer, attachment.camera)
    interactions.add(proxy)

    this.texture = texture
    this.material = material
    this.proxy = proxy
    this.interactions = interactions
    this.hasPaintRecord = false

    const fitPanelToNativeGrid = (): void => {
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
      panelElement.style.width = `${String(screen.panel.width)}px`
      panelElement.style.height = `${String(screen.panel.height)}px`
      if (content.style.transformOrigin !== 'left top') {
        content.style.transformOrigin = 'top left'
      }
      const scale =
        `scale(${String(screen.panel.width / contentWidth)}, ${String(screen.panel.height / contentHeight)})`
      if (content.style.transform !== scale) content.style.transform = scale
      this.scaledContent = content
      canvas.dataset['wpRasterDensity'] = String(density)
      canvas.dataset['wpRasterPixelWidth'] = String(rasterFrame.width)
      canvas.dataset['wpRasterPixelHeight'] = String(rasterFrame.height)
    }

    const requestPixels = (): void => {
      if (this.attachmentGeneration !== generation || this.attachment !== attachment) return
      fitPanelToNativeGrid()
      canvas.dataset['wpCompositeSourceState'] = this.hasPaintRecord
        ? 'repaint-requested'
        : 'snapshot-requested'
      canvas.requestPaint()
      if (this.hasPaintRecord) {
        texture.needsUpdate = true
        screen.invalidate()
      }
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
      fitPanelToNativeGrid()
      requestPixels()
    })
    this.resizeObserver.observe(panelElement)
    const initialContent = resolveRasterContent(panelElement)
    if (initialContent !== panelElement) this.resizeObserver.observe(initialContent)

    this.canvasResizeObserver = new ResizeObserver(() => {
      this.syncGeometry(screen.readTransform())
      screen.invalidate()
    })
    this.canvasResizeObserver.observe(canvas)

    this.resolutionCleanup = subscribeBrowserPixelRatio(() => {
      fitPanelToNativeGrid()
      requestPixels()
    })
    this.unsubscribeTransform = screen.onTransformChange((transform) => {
      this.syncGeometry(transform)
    })

    this.paintListener = (event) => {
      if (this.attachmentGeneration !== generation || this.attachment !== attachment) return
      const changedElements = (event as CanvasPaintEvent).changedElements
      if (!paintTouchesPanel(panelElement, changedElements)) return
      fitPanelToNativeGrid()
      if (!this.hasPaintRecord) screen.setMaterial(material)
      this.hasPaintRecord = true
      canvas.dataset['wpCompositeSourceState'] = 'painted'
      delete canvas.dataset['wpCompositeSourceError']
      texture.needsUpdate = true
      screen.invalidate()
    }
    canvas.addEventListener('paint', this.paintListener)

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
    const proxy = this.proxy
    const interactions = this.interactions
    if (canvas === undefined || proxy === null || interactions === null) return
    proxy.matrixWorld.copy(transform.worldMatrix)
    interactions.update()
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

    this.unsubscribeTransform?.()
    this.unsubscribeTransform = null
    this.mutationObserver?.disconnect()
    this.mutationObserver = null
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    this.canvasResizeObserver?.disconnect()
    this.canvasResizeObserver = null
    this.resolutionCleanup?.()
    this.resolutionCleanup = null

    if (canvas !== null && this.paintListener !== null) {
      canvas.removeEventListener('paint', this.paintListener)
    }
    this.paintListener = null

    attachment?.screen.setMaterial(null)
    if (this.interactions !== null && this.proxy !== null) {
      this.interactions.remove(this.proxy)
    }
    this.interactions?.disconnect()
    this.interactions = null
    this.proxy?.geometry.dispose()
    this.proxy = null
    this.material?.dispose()
    this.material = null
    this.texture?.dispose()
    this.texture = null
    this.hasPaintRecord = false

    if (this.scaledContent !== null) {
      this.scaledContent.style.removeProperty('transform-origin')
      this.scaledContent.style.removeProperty('transform')
    }
    this.scaledContent = null

    if (panel !== null) {
      panel.style.removeProperty('position')
      panel.style.removeProperty('left')
      panel.style.removeProperty('top')
      panel.style.removeProperty('transform-origin')
      panel.style.removeProperty('transform')
      panel.style.removeProperty('display')
      panel.style.removeProperty('width')
      panel.style.removeProperty('height')
      panel.style.removeProperty('overflow')
      panel.removeAttribute('drawable')
      delete panel.dataset['pixelSource']
      if (canvas?.contains(panel) === true) canvas.removeChild(panel)
    }

    if (canvas !== null) {
      canvas.removeAttribute('layoutsubtree')
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

/**
 * Decode HTMLTexture's sRGB pixels exactly once before the renderer encodes output.
 * Three 0.185 uploads this experimental texture as RGBA8 (WebGLTextures), so its
 * SRGBColorSpace tag cannot trigger the hardware decode used by ordinary maps.
 * Reuse Three's own transfer function, scoped to this material and map sample.
 * The pinned-upload regression test must change when upstream adopts sRGB storage.
 */
export function createHtmlTextureMaterial(texture: HTMLTexture): MeshBasicMaterial {
  const material = new MeshBasicMaterial({ map: texture, toneMapped: false })
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      ShaderChunk.map_fragment.replace('#ifdef DECODE_VIDEO_TEXTURE', '#if 1 // HTMLTexture RGBA8 requires sRGB decode'),
    )
  }
  material.customProgramCacheKey = () => 'webpod-htmltexture-rgba8-srgb-v1'
  return material
}
