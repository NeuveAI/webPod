import { useThree } from '@react-three/fiber'
import {
  ClickWheelInputSurface,
  DEVICE_LAYOUT,
  DeviceCanvas,
  FRONT_DEVICE_ORIENTATION,
  type ClickWheelArcEnd,
  type ClickWheelArcSample,
  type ClickWheelSelectEnd,
  type ClickWheelSelectStart,
  type Colourway,
  type DeviceOrientationGrabStart,
  type DeviceOrientation,
  type ScreenMeshHandle,
} from '@webpod/device'
import { deviceStore, pressActionAtom, type DeviceStore } from '@webpod/state'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type FocusEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { CompositeCoordinator } from './coordinator'
import type { PanelOverlayTone } from './html-in-canvas'
import {
  getCompositeTierSnapshot,
  refreshCompositeTier,
  subscribeCompositeTier,
} from './tier-store'
import {
  attachCompositeWheelListener,
  browserClickWheelRuntimeDependencies,
  createClickWheelRuntime,
  type ClickWheelRuntime,
  type ClickWheelRuntimeDependencies,
} from './click-wheel-runtime'
import { ScopedGestureSelection } from './gesture-selection'
import {
  attachInteractionAudioRuntime,
  createInteractionAudioRuntime,
  type InteractionAudioRuntime,
  type InteractionAudioSnapshot,
} from './interaction-audio'
import { createBrowserInteractionAudioBackend } from './web-audio-backend'

export interface CompositeDeviceProps {
  readonly panel: ReactNode
  readonly colourway?: Colourway
  readonly className?: string
  readonly panelTone?: PanelOverlayTone
  readonly cameraFov?: number
  readonly cameraDistance?: number
  readonly cameraSafePadding?: number
  readonly orientation?: DeviceOrientation
  /** Ray-confirmed outer-shell grab seam for diagnostic free orientation. */
  readonly onOrientationGrabStart?: (start: DeviceOrientationGrabStart) => boolean
  /** Cursor affordance for a visible, ray-confirmed shell edge. */
  readonly onOrientationGrabHoverChange?: (grabbable: boolean) => void
  /** Explicit mounted-product seam for muting interaction SFX. */
  readonly interactionAudioEnabled?: boolean
}

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
  cameraFov,
  cameraDistance,
  cameraSafePadding,
  orientation = FRONT_DEVICE_ORIENTATION,
  onOrientationGrabStart,
  onOrientationGrabHoverChange,
  interactionAudioEnabled = true,
}: CompositeDeviceProps) {
  const canUseDom = typeof document !== 'undefined'
  const tier = useSyncExternalStore(
    subscribeCompositeTier,
    getCompositeTierSnapshot,
    readServerTier,
  )
  const host = useMemo(() => (canUseDom ? createPanelHost() : null), [canUseDom])
  const coordinator = useMemo(() => new CompositeCoordinator(panelTone), [panelTone])
  useEffect(() => {
    if (!canUseDom) return
    refreshCompositeTier()
  }, [canUseDom])
  useLayoutEffect(() => {
    if (host === null) return
    coordinator.setPanel(host)
    return () => coordinator.dispose()
  }, [coordinator, host])

  const onScreenMeshReady = useCallback(
    (screen: ScreenMeshHandle) => coordinator.setScreen(screen),
    [coordinator],
  )
  const shouldMountCanvas = host !== null && (tier.tier === 'T1' || tier.contextLost)

  return (
    <CompositeInputBoundary
      className={className}
      data-composite-tier={tier.tier}
      data-composite-ready={host !== null}
      interactionAudioEnabled={interactionAudioEnabled}
    >
      {({ onArcStart, onArcMove, onArcEnd, onSelectStart, onSelectEnd }) => (
        <>
          {host !== null && tier.tier === 'T1' ? createPortal(panel, host) : null}
          {shouldMountCanvas ? (
            <DeviceCanvas
              colourway={colourway}
              cameraFov={cameraFov}
              cameraDistance={cameraDistance}
              cameraSafePadding={cameraSafePadding}
              orientation={orientation}
              onOrientationGrabStart={onOrientationGrabStart}
              onOrientationGrabHoverChange={onOrientationGrabHoverChange}
              onScreenMeshReady={onScreenMeshReady}
            >
              <CompositeSceneBridge
                coordinator={coordinator}
                onArcStart={onArcStart}
                onArcMove={onArcMove}
                onArcEnd={onArcEnd}
                onSelectStart={onSelectStart}
                onSelectEnd={onSelectEnd}
              />
            </DeviceCanvas>
          ) : null}
        </>
      )}
    </CompositeInputBoundary>
  )
}

type CompositeArcHandlers = {
  readonly onArcStart: (sample: ClickWheelArcSample) => void
  readonly onArcMove: (sample: ClickWheelArcSample) => void
  readonly onArcEnd: (end: ClickWheelArcEnd) => void
  readonly onSelectStart: (start: ClickWheelSelectStart) => void
  readonly onSelectEnd: (end: ClickWheelSelectEnd) => void
}

type CompositeInputBoundaryProps = {
  readonly children: (handlers: CompositeArcHandlers) => ReactNode
  readonly className?: string
  readonly 'data-composite-tier'?: string
  readonly 'data-composite-ready'?: boolean
  readonly createDependencies?: () => ClickWheelRuntimeDependencies
  readonly createAudioRuntime?: () => InteractionAudioRuntime
  readonly interactionAudioEnabled?: boolean
}

/**
 * Owns the mounted browser bridge from the R3F annulus to the singleton store.
 * It remembers the panel application focus because pointer capture moves focus
 * to the canvas in Blink; release and cancellation restore keyboard navigation.
 */
export function CompositeInputBoundary({
  children,
  className,
  'data-composite-tier': tier,
  'data-composite-ready': ready,
  createDependencies = defaultRuntimeDependencies,
  createAudioRuntime = defaultInteractionAudioRuntime,
  interactionAudioEnabled = true,
}: CompositeInputBoundaryProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const controller = useMemo(
    () => new CompositeInputController(createDependencies, createAudioRuntime),
    [createAudioRuntime, createDependencies],
  )

  useEffect(() => {
    controller.setInteractionAudioEnabled(interactionAudioEnabled)
  }, [controller, interactionAudioEnabled])

  useEffect(() => {
    const root = rootRef.current
    if (root === null) return
    return controller.attach(root)
  }, [controller])

  const onFocusCapture = useCallback((event: FocusEvent<HTMLDivElement>) => {
    controller.rememberApplicationFocus(event.target, event.currentTarget)
  }, [controller])

  return (
    <div
      ref={rootRef}
      className={className}
      data-composite-tier={tier}
      data-composite-ready={ready}
      onFocusCapture={onFocusCapture}
      style={{
        boxSizing: 'border-box',
        contain: 'layout size paint',
        inlineSize: '100%',
        maxInlineSize: '100%',
        minInlineSize: 0,
        overflow: 'clip',
        touchAction: 'none',
        overscrollBehavior: 'contain',
      }}
    >
      {children(controller.handlers)}
    </div>
  )
}

class CompositeInputController {
  private runtime: ClickWheelRuntime | null = null
  private store: DeviceStore | null = null
  private activeSelectPointerId: number | null = null
  private applicationFocus: HTMLElement | null = null
  private selection: ScopedGestureSelection | null = null
  private audio: InteractionAudioRuntime | null = null
  private interactionAudioEnabled = true

  readonly handlers: CompositeArcHandlers = {
    onArcStart: (sample) => {
      this.selection?.start()
      try {
        this.runtime?.arcStart(sample)
      } catch (error) {
        this.selection?.stop()
        throw error
      }
      queueMicrotask(() => this.restoreApplicationFocus())
    },
    onArcMove: (sample) => this.runtime?.arcMove(sample),
    onArcEnd: (end) => {
      try {
        this.runtime?.arcEnd(end)
      } finally {
        this.selection?.stop()
      }
      this.restoreApplicationFocus()
    },
    onSelectStart: (start) => {
      if (this.activeSelectPointerId !== null) return
      this.activeSelectPointerId = start.pointerId
      queueMicrotask(() => this.restoreApplicationFocus())
    },
    onSelectEnd: (end) => {
      if (this.activeSelectPointerId !== end.pointerId) return
      this.activeSelectPointerId = null
      if (end.reason === 'release') {
        this.store?.set(pressActionAtom, { button: 'center', source: 'human' })
      }
      this.restoreApplicationFocus()
    },
  }

  constructor(
    private readonly createDependencies: () => ClickWheelRuntimeDependencies,
    private readonly createAudioRuntime: () => InteractionAudioRuntime,
  ) {}

  attach(root: HTMLDivElement): () => void {
    const runtimeDependencies = this.createDependencies()
    const runtime = createClickWheelRuntime(runtimeDependencies)
    const audio = this.createAudioRuntime()
    audio.setEnabled(this.interactionAudioEnabled)
    const ownerWindow = root.ownerDocument.defaultView ?? window
    let audioAttached = true
    const detachAudio = attachInteractionAudioRuntime(audio, runtimeDependencies.store, {
      root,
      documentTarget: root.ownerDocument,
      windowTarget: ownerWindow,
      onSnapshot: (snapshot) => {
        if (audioAttached) publishInteractionAudioDiagnostics(root, snapshot)
      },
    })
    const selection = new ScopedGestureSelection(root, root.ownerDocument, ownerWindow)
    this.runtime = runtime
    this.store = runtimeDependencies.store
    this.selection = selection
    this.audio = audio
    const detachWheel = attachCompositeWheelListener(root, runtime)
    return () => {
      audioAttached = false
      detachWheel()
      detachAudio()
      audio.dispose()
      clearInteractionAudioDiagnostics(root)
      selection.dispose()
      runtime.dispose()
      if (this.runtime === runtime) this.runtime = null
      if (this.store === runtimeDependencies.store) this.store = null
      this.activeSelectPointerId = null
      if (this.selection === selection) this.selection = null
      if (this.audio === audio) this.audio = null
    }
  }

  setInteractionAudioEnabled(enabled: boolean): void {
    this.interactionAudioEnabled = enabled
    this.audio?.setEnabled(enabled)
  }

  rememberApplicationFocus(target: HTMLElement, root: HTMLDivElement): void {
    const application = target.closest<HTMLElement>('[role="application"]')
    if (application !== null && root.contains(application)) this.applicationFocus = application
  }

  private restoreApplicationFocus(): void {
    if (this.applicationFocus?.isConnected === true) {
      this.applicationFocus.focus({ preventScroll: true })
    }
  }
}

function publishInteractionAudioDiagnostics(
  root: HTMLElement,
  snapshot: InteractionAudioSnapshot,
): void {
  root.dataset['wpAudioLifecycle'] = snapshot.lifecycle
  root.dataset['wpAudioScheduledTotal'] = String(snapshot.scheduledTotal)
  root.dataset['wpAudioDroppedTotal'] = String(snapshot.droppedTotal)
  const result = snapshot.lastResult
  if (result === null) {
    delete root.dataset['wpAudioLastResult']
  } else {
    root.dataset['wpAudioLastResult'] = [
      result.status,
      result.reason,
      `${result.scheduled}/${result.requested}`,
    ].join(':')
  }
}

function clearInteractionAudioDiagnostics(root: HTMLElement): void {
  delete root.dataset['wpAudioLifecycle']
  delete root.dataset['wpAudioScheduledTotal']
  delete root.dataset['wpAudioDroppedTotal']
  delete root.dataset['wpAudioLastResult']
}

function defaultRuntimeDependencies(): ClickWheelRuntimeDependencies {
  return browserClickWheelRuntimeDependencies(deviceStore, DEVICE_LAYOUT.screen.height)
}

function defaultInteractionAudioRuntime(): InteractionAudioRuntime {
  return createInteractionAudioRuntime({
    createBackend: createBrowserInteractionAudioBackend,
  })
}

const SERVER_TIER = Object.freeze({
  tier: 'T4',
  reason: 'Server rendering has no browser canvas. The client resolves the composite tier after hydration.',
  report: null,
  contextLost: false,
} as const)

function readServerTier() {
  return SERVER_TIER
}

function createPanelHost(): HTMLDivElement {
  const host = document.createElement('div')
  host.className = 'wp-composite-panel-host'
  return host
}

function CompositeSceneBridge({
  coordinator,
  onArcStart,
  onArcMove,
  onArcEnd,
  onSelectStart,
  onSelectEnd,
}: {
  readonly coordinator: CompositeCoordinator
  readonly onArcStart: (sample: ClickWheelArcSample) => void
  readonly onArcMove: (sample: ClickWheelArcSample) => void
  readonly onArcEnd: (end: ClickWheelArcEnd) => void
  readonly onSelectStart: (start: ClickWheelSelectStart) => void
  readonly onSelectEnd: (end: ClickWheelSelectEnd) => void
}) {
  const renderer = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)
  const scene = useThree((state) => state.scene)
  const width = useThree((state) => state.size.width)
  const height = useThree((state) => state.size.height)
  void width
  void height

  useEffect(() => {
    coordinator.setRenderContext({ renderer, camera, scene })
    return () => coordinator.clearRenderContext(renderer)
  }, [camera, coordinator, renderer, scene])

  useLayoutEffect(() => {
    coordinator.resyncGeometry()
  })

  return (
    <ClickWheelInputSurface
      onArcStart={onArcStart}
      onArcMove={onArcMove}
      onArcEnd={onArcEnd}
      onSelectStart={onSelectStart}
      onSelectEnd={onSelectEnd}
    />
  )
}
