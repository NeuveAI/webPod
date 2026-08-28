import type { ScreenTransform } from '@webpod/device'
import {
  HTMLTexture,
  Mesh,
  MeshBasicMaterial,
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

function canRequestPaint(canvas: HTMLCanvasElement): canvas is RequestPaintCanvas {
  return 'requestPaint' in canvas && typeof Reflect.get(canvas, 'requestPaint') === 'function'
}

/** A T1-only factory. Tier selection remains inside this package. */
export function createPanelPixelSource(tone: PanelOverlayTone): PanelPixelSource {
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
export class HtmlInCanvasPixelSource implements PanelPixelSource {
  readonly tier = 'T1' as const
  readonly requires = HTML_IN_CANVAS_REQUIREMENTS

  private attachment: PanelPixelAttachment | null = null
  private texture: HTMLTexture | null = null
  private material: MeshBasicMaterial | null = null
  private proxy: Mesh<PlaneGeometry, MeshBasicMaterial> | null = null
  private interactions: InteractionManager | null = null
  private unsubscribeTransform: (() => void) | null = null
  private mutationObserver: MutationObserver | null = null
  private resizeObserver: ResizeObserver | null = null
  private paintListener: EventListener | null = null
  private contrastQuery: MediaQueryList | null = null
  private contrastListener: ((event: MediaQueryListEvent) => void) | null = null

  constructor(private readonly tone: PanelOverlayTone) {}

  attach(attachment: PanelPixelAttachment): void {
    this.detach()
    this.attachment = attachment

    const { panelElement, renderer, camera, screen } = attachment
    panelElement.style.width = `${screen.panel.width}px`
    panelElement.style.height = `${screen.panel.height}px`
    panelElement.style.overflow = 'hidden'
    panelElement.setAttribute('drawable', '')
    panelElement.dataset['pixelSource'] = 'html-in-canvas'

    const texture = new HTMLTexture(panelElement)
    texture.colorSpace = SRGBColorSpace
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

    screen.setMaterial(material)
    this.unsubscribeTransform = screen.onTransformChange((transform) => {
      this.syncGeometry(transform)
    })

    const canvas = renderer.domElement
    const requestPixels = (): void => {
      texture.needsUpdate = true
      if (canRequestPaint(canvas)) canvas.requestPaint()
      screen.invalidate()
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
      material.userData['wpWidth'] = panelElement.offsetWidth
      material.userData['wpHeight'] = panelElement.offsetHeight
      material.needsUpdate = true
      this.syncGeometry(screen.readTransform())
      requestPixels()
    })
    this.resizeObserver.observe(panelElement)

    this.paintListener = () => {
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
    requestPixels()
    // `attach` can run during the canvas's first commit. `invalidate()` is a
    // flag, not an immediate render; repeat it after the commit so the first
    // HTMLTexture upload cannot be swallowed by the frame already in flight.
    queueMicrotask(requestPixels)
  }

  syncGeometry(transform: ScreenTransform): void {
    const proxy = this.proxy
    const interactions = this.interactions
    if (proxy === null || interactions === null) return
    proxy.matrixWorld.copy(transform.worldMatrix)
    interactions.update()
  }

  detach(): void {
    const attachment = this.attachment
    const panel = attachment?.panelElement ?? null
    const canvas = attachment?.renderer.domElement ?? null

    this.unsubscribeTransform?.()
    this.unsubscribeTransform = null
    this.mutationObserver?.disconnect()
    this.mutationObserver = null
    this.resizeObserver?.disconnect()
    this.resizeObserver = null

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
      if (canvas?.contains(panel) === true) canvas.removeChild(panel)
    }

    this.attachment = null
  }
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
  material.userData['wpContrastMore'] = false
  material.userData['wpWidth'] = width
  material.userData['wpHeight'] = height
  material.customProgramCacheKey = () =>
    `webpod-lcd-${tone}-${String(material.userData['wpContrastMore'])}-${String(material.userData['wpWidth'])}x${String(material.userData['wpHeight'])}`
  material.onBeforeCompile = (shader) => {
    const textureWidth = positiveDimension(material.userData['wpWidth'])
    const textureHeight = positiveDimension(material.userData['wpHeight'])
    const textureSize = `vec2(${textureWidth.toFixed(1)}, ${textureHeight.toFixed(1)})`
    const scanlineColor = tone === 'dark' ? 'vec3(1.0)' : 'vec3(0.0588, 0.0902, 0.1647)'
    const scanlineMix = tone === 'dark' ? '0.03' : '0.03'
    const effectsEnabled = material.userData['wpContrastMore'] === true ? '0.0' : '1.0'
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
      vec2 wpPanelPixel = vMapUv * ${textureSize};
      float wpScanline = step(1.0, mod(floor(wpPanelPixel.y), 3.0));
      vec3 wpTriad = vec3(
        1.0 - 0.02 * step(1.0, mod(floor(wpPanelPixel.x), 3.0)),
        1.0 - 0.02 * step(1.0, mod(floor(wpPanelPixel.x + 2.0), 3.0)),
        1.0 - 0.02 * step(1.0, mod(floor(wpPanelPixel.x + 1.0), 3.0))
      );
      diffuseColor.rgb *= mix(vec3(1.0), wpTriad, ${effectsEnabled});
      diffuseColor.rgb = mix(diffuseColor.rgb, ${scanlineColor}, wpScanline * ${scanlineMix} * ${effectsEnabled});`,
    )
  }
  return material
}

function positiveDimension(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 1
}
