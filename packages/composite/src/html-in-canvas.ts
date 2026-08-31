import type { ScreenTransform } from '@webpod/device'
import {
  HTMLTexture,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  PlaneGeometry,
  SRGBColorSpace,
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
 * Three's `HTMLTexture` owns the unstable WebGL upload call. Three's
 * `InteractionManager` owns the CSS `matrix3d` projection. This class owns
 * their shared lifetime and asks R3F for a frame only when DOM pixels or the
 * screen transform change.
 */
export class HtmlInCanvasPixelSource implements PanelPixelSource<'webgl'> {
  readonly tier = 'T1' as const
  readonly requires = HTML_IN_CANVAS_REQUIREMENTS

  private attachment: PanelPixelAttachment<'webgl'> | null = null
  private texture: HTMLTexture | null = null
  private material: MeshBasicMaterial | null = null
  private proxy: Mesh<PlaneGeometry, MeshBasicMaterial> | null = null
  private interactions: InteractionManager | null = null
  private unsubscribeTransform: (() => void) | null = null
  private mutationObserver: MutationObserver | null = null
  private resizeObserver: ResizeObserver | null = null
  private canvasResizeObserver: ResizeObserver | null = null
  private paintListener: EventListener | null = null
  private contrastQuery: MediaQueryList | null = null
  private contrastListener: ((event: MediaQueryListEvent) => void) | null = null
  private attachmentGeneration = 0
  private hasPaintRecord = false
  private scaledContent: HTMLElement | null = null
  private scaledContentTransform = ''
  private scaledContentTransformOrigin = ''
  private appliedRasterDensity: 1 | 2 | 3 | null = null

  constructor(private readonly tone: PanelOverlayTone) {}

  attach(attachment: PanelPixelAttachment<'webgl'>): void {
    this.detach()
    this.attachment = attachment
    const generation = this.attachmentGeneration

    const { panelElement, renderer, camera, screen } = attachment
    this.hasPaintRecord = false
    panelElement.style.overflow = 'hidden'
    panelElement.setAttribute('drawable', '')
    panelElement.dataset['pixelSource'] = 'html-in-canvas'

    const canvas = renderer.domElement
    canvas.setAttribute('layoutsubtree', 'true')
    canvas.appendChild(panelElement)
    const texture = new HTMLTexture(panelElement)
    texture.colorSpace = SRGBColorSpace
    texture.generateMipmaps = false
    // The panel is authored as a pixel grid and rasterized at the resolved
    // physical density. Linear sampling averages adjacent glyph and divider
    // pixels a second time after Chrome has rasterized them.
    texture.minFilter = NearestFilter
    texture.magFilter = NearestFilter
    const material = createLcdMaterial(
      texture,
      this.tone,
      panelElement.offsetWidth,
      panelElement.offsetHeight,
    )
    const geometry = new PlaneGeometry(screen.size.width, screen.size.height)
    const proxy = new Mesh(geometry, material)
    proxy.matrixAutoUpdate = false

    const interactions = new InteractionManager()
    interactions.connect(renderer, camera)
    interactions.add(proxy)

    this.texture = texture
    this.material = material
    this.proxy = proxy
    this.interactions = interactions

    const applyRasterDensity = (): boolean => {
      const content = panelElement.firstElementChild
      if (!(content instanceof HTMLElement)) return false
      const density = resolvePanelRasterDensity(renderer.getPixelRatio())
      if (this.scaledContent === content && this.appliedRasterDensity === density) return false
      if (this.scaledContent !== content) {
        this.restoreScaledContent()
        this.scaledContent = content
        this.scaledContentTransform = content.style.transform
        this.scaledContentTransformOrigin = content.style.transformOrigin
      }
      content.style.transformOrigin = 'top left'
      content.style.transform = density === 1 ? this.scaledContentTransform : `scale(${String(density)})`
      panelElement.style.width = `${screen.panel.width * density}px`
      panelElement.style.height = `${screen.panel.height * density}px`
      panelElement.dataset['rasterDensity'] = String(density)
      this.appliedRasterDensity = density
      return true
    }
    applyRasterDensity()

    this.unsubscribeTransform = screen.onTransformChange((transform) => {
      this.syncGeometry(transform)
    })

    const fitHostToContent = (): void => {
      applyRasterDensity()
      const content = panelElement.firstElementChild
      const contentWidth = content instanceof HTMLElement ? content.scrollWidth : 0
      const contentHeight = content instanceof HTMLElement ? content.scrollHeight : 0
      material.userData['wpWidth'] = Math.max(screen.panel.width, contentWidth)
      material.userData['wpHeight'] = Math.max(screen.panel.height, contentHeight)
    }
    const requestPixels = (): void => {
      if (this.attachmentGeneration !== generation || this.attachment !== attachment) return
      fitHostToContent()
      // Painting before Three reparents the element can emit a canvas paint
      // event that has no record for this panel. The first WebGL texture pass
      // performs that reparent and requests the authoritative paint itself.
      if (panelElement.parentNode === canvas && canRequestPaint(canvas)) canvas.requestPaint()
      if (this.hasPaintRecord) {
        texture.needsUpdate = true
        screen.invalidate()
      }
    }

    this.mutationObserver = new MutationObserver((records) => {
      // InteractionManager writes the host's transform. Treating that geometry
      // write as new panel pixels creates a requestPaint -> invalidate loop.
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
      fitHostToContent()
      material.needsUpdate = true
      this.syncGeometry(screen.readTransform())
      requestPixels()
    })
    this.resizeObserver.observe(panelElement)

    this.canvasResizeObserver = new ResizeObserver(() => {
      const rasterDensityChanged = applyRasterDensity()
      this.syncGeometry(screen.readTransform())
      if (rasterDensityChanged) requestPixels()
      screen.invalidate()
    })
    this.canvasResizeObserver.observe(canvas)

    this.paintListener = (event) => {
      if (this.attachmentGeneration !== generation || this.attachment !== attachment) return
      const changedElements = (event as CanvasPaintEvent).changedElements
      if (changedElements !== undefined && !changedElements.includes(panelElement)) return
      if (!this.hasPaintRecord) screen.setMaterial(material)
      this.hasPaintRecord = true
      texture.needsUpdate = true
      screen.invalidate()
    }
    canvas.addEventListener('paint', this.paintListener)

    this.contrastQuery = window.matchMedia('(prefers-contrast: more)')
    this.contrastListener = () => {
      material.userData['wpContrastMore'] = this.contrastQuery?.matches === true
      material.needsUpdate = true
      screen.invalidate()
    }
    this.contrastQuery.addEventListener('change', this.contrastListener)
    this.contrastListener(new MediaQueryListEvent('change', { matches: this.contrastQuery.matches }))

    this.syncGeometry(screen.readTransform())
    // The screen material stays detached until Chrome confirms the panel has
    // a paint record. This prevents Three from uploading an element that has
    // been adopted by the canvas but is not raster-ready yet.
    requestPixels()
  }

  syncGeometry(transform: ScreenTransform): void {
    const proxy = this.proxy
    const interactions = this.interactions
    if (proxy === null || interactions === null) return
    proxy.matrixWorld.copy(transform.worldMatrix)
    interactions.update()
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

    if (canvas !== null && this.paintListener !== null) {
      canvas.removeEventListener('paint', this.paintListener)
    }
    this.paintListener = null

    if (this.contrastQuery !== null && this.contrastListener !== null) {
      this.contrastQuery.removeEventListener('change', this.contrastListener)
    }
    this.contrastQuery = null
    this.contrastListener = null

    if (this.interactions !== null && this.proxy !== null) this.interactions.remove(this.proxy)
    this.interactions?.disconnect()
    this.interactions = null

    attachment?.screen.setMaterial(null)
    this.proxy?.geometry.dispose()
    this.proxy = null
    this.material?.dispose()
    this.material = null
    this.texture?.dispose()
    this.texture = null
    this.hasPaintRecord = false
    this.restoreScaledContent()

    if (panel !== null) {
      panel.style.removeProperty('position')
      panel.style.removeProperty('left')
      panel.style.removeProperty('top')
      panel.style.removeProperty('transform-origin')
      panel.style.removeProperty('transform')
      panel.style.removeProperty('width')
      panel.style.removeProperty('height')
      panel.style.removeProperty('overflow')
      panel.removeAttribute('drawable')
      delete panel.dataset['pixelSource']
      delete panel.dataset['rasterDensity']
      if (canvas?.contains(panel) === true) canvas.removeChild(panel)
    }

    this.attachment = null
  }

  private restoreScaledContent(): void {
    if (this.scaledContent !== null) {
      this.scaledContent.style.transform = this.scaledContentTransform
      this.scaledContent.style.transformOrigin = this.scaledContentTransformOrigin
    }
    this.scaledContent = null
    this.scaledContentTransform = ''
    this.scaledContentTransformOrigin = ''
    this.appliedRasterDensity = null
  }
}

export function resolvePanelRasterDensity(pixelRatio: number): 1 | 2 | 3 {
  if (!Number.isFinite(pixelRatio) || pixelRatio <= 1) return 1
  if (pixelRatio <= 2) return 2
  return 3
}

export function mutationAffectsPanelPixels(
  panelElement: HTMLElement,
  target: Node,
  attributeName: string | null,
): boolean {
  return !(target === panelElement && attributeName === 'style')
}

function createLcdMaterial(
  texture: HTMLTexture,
  tone: PanelOverlayTone,
  width: number,
  height: number,
): MeshBasicMaterial {
  const material = new MeshBasicMaterial({ map: texture, toneMapped: false })
  material.name = `webpod-lcd-${tone}`
  material.userData['wpWidth'] = positiveDimension(width)
  material.userData['wpHeight'] = positiveDimension(height)
  return material
}

function positiveDimension(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 1
}
