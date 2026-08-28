/**
 * `@webpod/composite` — the seam between the DOM panel and the WebGL screen mesh.
 *
 * Owns tier detection and the pixel-source strategy for that seam.
 *
 * W6.0 has landed tier detection only. The `PanelPixelSource` strategy
 * interface (W6.1) and the T1 `html-in-canvas` implementation (W6.2) are
 * not here yet; nothing outside this package should compare a tier value.
 */
export {
  getCapabilities,
  probeCapabilities,
  resolveTier,
  HTML_IN_CANVAS_FLAG,
} from './capabilities'

export {
  HTML_IN_CANVAS_REQUIREMENTS,
  type PanelPixelAttachment,
  type PanelPixelRequirements,
  type PanelPixelSource,
} from './pixel-source'
export {
  getCompositeTierSnapshot,
  markCompositeContextLost,
  refreshCompositeTier,
  subscribeCompositeTier,
  type CompositeTierSnapshot,
} from './tier-store'

export type {
  CapabilityReport,
  EnvironmentReport,
  GeometryApi,
  GeometryApiGeneration,
  ProbeGroup,
  ProbeResult,
  Tier,
  TierFacts,
  WebGLEntryPoint,
} from './capabilities'
