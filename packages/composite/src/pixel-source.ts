import type { ScreenMeshHandle, ScreenTransform } from '@webpod/device'
import type { Camera, WebGLRenderer } from 'three'

import type { Tier } from './capabilities'

/** Renderer and asset needs declared by a panel-pixel strategy. */
export type PanelPixelRenderer = 'webgl' | 'none'

export interface PanelPixelRequirements<Renderer extends PanelPixelRenderer = PanelPixelRenderer> {
  readonly renderer: Renderer
  readonly materialVariant: string
  readonly shaderVariants: readonly string[]
  readonly textureSet: readonly string[]
}

/** Everything needed to join one real DOM panel to one device screen. */
export interface DomPanelPixelAttachment {
  readonly kind: 'none'
  readonly panelElement: HTMLElement
}

export interface WebGlPanelPixelAttachment {
  readonly kind: 'webgl'
  readonly screen: ScreenMeshHandle
  readonly panelElement: HTMLElement
  readonly renderer: WebGLRenderer
  readonly camera: Camera
}

export type PanelPixelAttachment<Renderer extends PanelPixelRenderer = PanelPixelRenderer> =
  Renderer extends 'webgl' ? WebGlPanelPixelAttachment : DomPanelPixelAttachment

/**
 * Supplies panel pixels and native DOM interaction to a device screen.
 *
 * The interface names requirements as well as lifecycle operations so a later
 * overlay or flat-DOM strategy can bring a different material, shader set, or
 * renderer without changing `@webpod/panel` or `@webpod/device`. This slice
 * intentionally provides exactly one implementation.
 */
export interface PanelPixelSource<Renderer extends PanelPixelRenderer = PanelPixelRenderer> {
  readonly tier: Tier
  readonly requires: PanelPixelRequirements<Renderer>
  attach(attachment: PanelPixelAttachment<Renderer>): void
  syncGeometry(transform: ScreenTransform): void
  detach(): void
}

/** T1's end-to-end requirements. One concrete set, not a variant registry. */
export const HTML_IN_CANVAS_REQUIREMENTS: PanelPixelRequirements<'webgl'> = Object.freeze({
  renderer: 'webgl',
  materialVariant: 'html-texture-lcd',
  shaderVariants: Object.freeze(['lcd-scanline-subpixel']),
  textureSet: Object.freeze(['panel-dom']),
})
