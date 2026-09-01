/**
 * `@webpod/composite` — the seam between the DOM panel and the WebGL screen mesh.
 *
 * Owns tier detection and the pixel-source strategy for that seam.
 *
 * Tier detection, the future-safe pixel-source seam, and the T1
 * `html-in-canvas` implementation live here. Nothing outside this package
 * should compare a tier value or call an experimental canvas upload API.
 */
export {
  getCapabilities,
  isCapabilityTierMasked,
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
export { CompositeDevice, type CompositeDeviceProps } from './CompositeDevice'
export {
  createPanelPixelSource,
  HtmlInCanvasPixelSource,
  type PanelOverlayTone,
} from './html-in-canvas'
export {
  MAX_INTERACTION_AUDIO_VOICES,
  MAX_PENDING_FEEDBACK_EVENTS,
  WHEEL_PITCH_JITTER,
  WHEEL_TICK_RATE_HZ,
  attachInteractionAudioRuntime,
  createInteractionAudioRuntime,
  type InteractionAudioActivationResult,
  type InteractionAudioBackend,
  type InteractionAudioBrowserTargets,
  type InteractionAudioDependencies,
  type InteractionAudioReason,
  type InteractionAudioResult,
  type InteractionAudioRuntime,
  type InteractionAudioSnapshot,
  type InteractionAudioVoice,
  type InteractionVoiceKind,
  type InteractionVoiceSpec,
} from './interaction-audio'
export { renderInteractionAudioPreviewWav } from './web-audio-backend'

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
