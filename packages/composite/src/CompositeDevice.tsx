import { useThree } from '@react-three/fiber'
import { DeviceCanvas, type Colourway, type ScreenMeshHandle } from '@webpod/device'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
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
    <div className={className} data-composite-tier={tier.tier} data-composite-ready={host !== null}>
      {host !== null && tier.tier === 'T1' ? createPortal(panel, host) : null}
      {shouldMountCanvas ? (
        <DeviceCanvas
          colourway={colourway}
          cameraFov={cameraFov}
          onScreenMeshReady={onScreenMeshReady}
        >
          <CompositeSceneBridge coordinator={coordinator} />
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
}: {
  readonly coordinator: CompositeCoordinator
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

  return null
}
