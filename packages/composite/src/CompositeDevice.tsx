import { useThree } from '@react-three/fiber'
import {
  ClickWheelInputSurface,
  DEVICE_LAYOUT,
  DeviceCanvas,
  type ClickWheelArcEnd,
  type ClickWheelArcSample,
  type Colourway,
  type ScreenMeshHandle,
} from '@webpod/device'
import { deviceStore } from '@webpod/state'
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
  subscribeCompositeTier,
} from './tier-store'
import {
  attachCompositeWheelListener,
  browserClickWheelRuntimeDependencies,
  createClickWheelRuntime,
  type ClickWheelRuntime,
  type ClickWheelRuntimeDependencies,
} from './click-wheel-runtime'

export interface CompositeDeviceProps {
  readonly panel: ReactNode
  readonly colourway?: Colourway
  readonly className?: string
  readonly panelTone?: PanelOverlayTone
  readonly cameraFov?: number
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
}: CompositeDeviceProps) {
  const canUseDom = useSyncExternalStore(subscribeToClientRuntime, readClientRuntime, readServerRuntime)
  const tier = useSyncExternalStore(
    subscribeCompositeTier,
    getCompositeTierSnapshot,
    readServerTier,
  )
  const host = useMemo(() => (canUseDom ? createPanelHost() : null), [canUseDom])
  const coordinator = useMemo(() => new CompositeCoordinator(panelTone), [panelTone])
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
    >
      {({ onArcStart, onArcMove, onArcEnd }) => (
        <>
          {host !== null && tier.tier === 'T1' ? createPortal(panel, host) : null}
          {shouldMountCanvas ? (
            <DeviceCanvas
              colourway={colourway}
              cameraFov={cameraFov}
              onScreenMeshReady={onScreenMeshReady}
            >
              <CompositeSceneBridge
                coordinator={coordinator}
                onArcStart={onArcStart}
                onArcMove={onArcMove}
                onArcEnd={onArcEnd}
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
}

type CompositeInputBoundaryProps = {
  readonly children: (handlers: CompositeArcHandlers) => ReactNode
  readonly className?: string
  readonly 'data-composite-tier'?: string
  readonly 'data-composite-ready'?: boolean
  readonly createDependencies?: () => ClickWheelRuntimeDependencies
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
}: CompositeInputBoundaryProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const controller = useMemo(
    () => new CompositeInputController(createDependencies),
    [createDependencies],
  )

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
  private applicationFocus: HTMLElement | null = null

  readonly handlers: CompositeArcHandlers = {
    onArcStart: (sample) => {
      this.runtime?.arcStart(sample)
      queueMicrotask(() => this.restoreApplicationFocus())
    },
    onArcMove: (sample) => this.runtime?.arcMove(sample),
    onArcEnd: (end) => {
      this.runtime?.arcEnd(end)
      this.restoreApplicationFocus()
    },
  }

  constructor(private readonly createDependencies: () => ClickWheelRuntimeDependencies) {}

  attach(root: HTMLDivElement): () => void {
    const runtime = createClickWheelRuntime(this.createDependencies())
    this.runtime = runtime
    const detachWheel = attachCompositeWheelListener(root, runtime)
    return () => {
      detachWheel()
      runtime.dispose()
      if (this.runtime === runtime) this.runtime = null
    }
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

function defaultRuntimeDependencies(): ClickWheelRuntimeDependencies {
  return browserClickWheelRuntimeDependencies(deviceStore, DEVICE_LAYOUT.screen.height)
}

const SERVER_TIER = Object.freeze({
  tier: 'T4',
  reason: 'Server rendering has no browser canvas. The client resolves the composite tier after hydration.',
  report: null,
  contextLost: false,
} as const)

function subscribeToClientRuntime(): () => void {
  return () => undefined
}

function readClientRuntime(): boolean {
  return typeof document !== 'undefined'
}

function readServerRuntime(): boolean {
  return false
}

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
}: {
  readonly coordinator: CompositeCoordinator
  readonly onArcStart: (sample: ClickWheelArcSample) => void
  readonly onArcMove: (sample: ClickWheelArcSample) => void
  readonly onArcEnd: (end: ClickWheelArcEnd) => void
}) {
  const renderer = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)
  const width = useThree((state) => state.size.width)
  const height = useThree((state) => state.size.height)
  void width
  void height

  useEffect(() => {
    coordinator.setRenderContext({ renderer, camera })
    return () => coordinator.clearRenderContext(renderer)
  }, [camera, coordinator, renderer])

  useLayoutEffect(() => {
    coordinator.resyncGeometry()
  })

  return (
    <ClickWheelInputSurface
      onArcStart={onArcStart}
      onArcMove={onArcMove}
      onArcEnd={onArcEnd}
    />
  )
}
