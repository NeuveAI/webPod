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
  const rootRef = useRef<HTMLDivElement>(null)
  const runtimeRef = useRef<ClickWheelRuntime | null>(null)

  useLayoutEffect(() => {
    if (host === null) return
    coordinator.setPanel(host)
    return () => coordinator.dispose()
  }, [coordinator, host])

  useEffect(() => {
    const root = rootRef.current
    if (root === null) return
    const runtime = createClickWheelRuntime(
      browserClickWheelRuntimeDependencies(deviceStore, DEVICE_LAYOUT.screen.height),
    )
    runtimeRef.current = runtime

    const detachWheel = attachCompositeWheelListener(root, runtime)

    return () => {
      detachWheel()
      runtime.dispose()
      if (runtimeRef.current === runtime) runtimeRef.current = null
    }
  }, [])

  const onArcStart = useCallback((sample: ClickWheelArcSample) => {
    runtimeRef.current?.arcStart(sample)
  }, [])
  const onArcMove = useCallback((sample: ClickWheelArcSample) => {
    runtimeRef.current?.arcMove(sample)
  }, [])
  const onArcEnd = useCallback((end: ClickWheelArcEnd) => {
    runtimeRef.current?.arcEnd(end)
  }, [])

  const onScreenMeshReady = useCallback(
    (screen: ScreenMeshHandle) => coordinator.setScreen(screen),
    [coordinator],
  )
  const shouldMountCanvas = host !== null && (tier.tier === 'T1' || tier.contextLost)

  return (
    <div
      ref={rootRef}
      className={className}
      data-composite-tier={tier.tier}
      data-composite-ready={host !== null}
      style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
    >
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
    </div>
  )
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
