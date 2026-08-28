import type { ScreenMeshHandle, ScreenTransform } from '@webpod/device'
import type { Camera, WebGLRenderer } from 'three'

import type { Tier } from './capabilities'

/** Renderer and asset needs declared by a panel-pixel strategy. */
export interface PanelPixelRequirements {
  readonly renderer: 'webgl' | 'none'
  readonly materialVariant: string
  readonly shaderVariants: readonly string[]
  readonly textureSet: readonly string[]
}

/** Everything needed to join one real DOM panel to one device screen. */
export interface PanelPixelAttachment {
  readonly screen: ScreenMeshHandle
  readonly panelElement: HTMLElement
  readonly renderer: WebGLRenderer
  readonly camera: Camera
}

/**
 * Supplies panel pixels and native DOM interaction to a device screen.
 *
 * The interface names requirements as well as lifecycle operations so a later
 * overlay or flat-DOM strategy can bring a different material, shader set, or
 * renderer without changing `@webpod/panel` or `@webpod/device`. This slice
 * intentionally provides exactly one implementation.
 */
export interface PanelPixelSource {
  readonly tier: Tier
  readonly requires: PanelPixelRequirements
  attach(attachment: PanelPixelAttachment): void
  syncGeometry(transform: ScreenTransform): void
  detach(): void
}

/** T1's end-to-end requirements. One concrete set, not a variant registry. */
export const HTML_IN_CANVAS_REQUIREMENTS: PanelPixelRequirements = Object.freeze({
  renderer: 'webgl',
  materialVariant: 'html-texture-lcd',
  shaderVariants: Object.freeze(['lcd-scanline-subpixel']),
  textureSet: Object.freeze(['panel-dom']),
})
