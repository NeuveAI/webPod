import { InteractionHaptics, mountWheelHaptics, cancelWheelHaptics } from './interaction-haptics'
import { bindAgentWheelControls, bindAgentControlPhysics, getAgentControlPhysics } from './agent-controls'
import { useThree } from '@react-three/fiber'
import {
  ClickWheelInputSurface,
  useControlPhysics,
  DEVICE_LAYOUT,
  DeviceCanvas,
  FRONT_DEVICE_ORIENTATION,
  type ClickWheelArcEnd,
  type ClickWheelArcSample,
  type ClickWheelCardinalButton,
  type ClickWheelCardinalEnd,
  type ClickWheelCardinalPress,
  type ClickWheelCardinalStart,
  type ClickWheelSelectEnd,
  type ClickWheelSelectStart,
  type Colourway,
  type DeviceOrientationGrabStart,
  type DeviceOrientation,
  type ScreenMeshHandle,
  type DeviceStickerScene,
  type DeviceMotionAuthority,
} from '@webpod/device'
import {
  acceptedExternalPressActionAtom,
  deviceStore,
  holdEngagedAtom,
  type DetentSource,
  pressActionAtom,
  returnToRootActionAtom,
  type DeviceStore,
} from '@webpod/state'
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

/** A lost context retains its Canvas for restoration, with an honest semantic status. */
const CONTEXT_RESTORATION_STYLE = {
  position: 'absolute', inset: 0, zIndex: 3, display: 'grid', placeItems: 'center',
  background: '#141820', color: '#eee9df', fontSize: 16, pointerEvents: 'none',
} as const

export interface CompositeDeviceProps {
  readonly motionAuthority?: DeviceMotionAuthority
  readonly stickerScene?: DeviceStickerScene
  readonly panel: ReactNode
  readonly colourway?: Colourway
  readonly className?: string
  readonly panelTone?: PanelOverlayTone
  readonly cameraFov?: number
  readonly cameraDistance?: number
  readonly cameraMobileFraming?: boolean
  readonly cameraSafePadding?: number
  readonly projectionDiagnostics?: boolean
  readonly orientation?: DeviceOrientation
  /** Ray-confirmed outer-shell grab seam for diagnostic free orientation. */
  readonly onOrientationGrabStart?: (start: DeviceOrientationGrabStart) => boolean
  /** Cursor affordance for a visible, ray-confirmed shell edge. */
  readonly onOrientationGrabHoverChange?: (grabbable: boolean) => void
  /** Explicit mounted-product seam for muting interaction SFX. */
  readonly interactionAudioEnabled?: boolean
  /** Provider-owned Play/Pause action; `true` confirms the press was accepted. */
  readonly onPlayPausePress?: () => boolean | Promise<boolean>
  /** Provider-owned transport action; `false` lets previous/next retain list paging. */
  readonly onTransportPress?: (button: 'play-pause' | 'next' | 'previous') => boolean | Promise<boolean>
}

/**
 * Renders one real DOM panel through the device's T1 screen material.
 *
 * The portal stays a React-owned DOM tree after Three reparents its host below
 * the canvas. No React component owns a duplicate copy of panel state.
 */
export function CompositeDevice({
  motionAuthority,
  stickerScene,
  panel,
  colourway = 'black',
  className,
  panelTone = 'dark',
  cameraFov,
  cameraDistance,
  cameraMobileFraming,
  cameraSafePadding,
  projectionDiagnostics = false,
  orientation = FRONT_DEVICE_ORIENTATION,
  onOrientationGrabStart,
  onOrientationGrabHoverChange,
  interactionAudioEnabled = true,
  onPlayPausePress,
  onTransportPress,
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
      onPlayPausePress={onPlayPausePress}
      onTransportPress={onTransportPress}
    >
      {({
        onArcStart,
        onArcMove,
        onArcEnd,
        onSelectStart,
        onSelectEnd,
        onCardinalStart,
        onCardinalEnd,
        onCardinalPress,
      }) => (
        <>
          {host !== null && tier.tier === 'T1' ? createPortal(panel, host) : null}
          {shouldMountCanvas ? (
            <DeviceCanvas
              motionAuthority={motionAuthority}
              stickerScene={stickerScene}
              colourway={colourway}
              cameraFov={cameraFov}
              cameraDistance={cameraDistance}
              cameraMobileFraming={cameraMobileFraming}
              cameraSafePadding={cameraSafePadding}
              projectionDiagnostics={projectionDiagnostics}
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
                onCardinalStart={onCardinalStart}
                onCardinalEnd={onCardinalEnd}
                onCardinalPress={onCardinalPress}
              />
            </DeviceCanvas>
          ) : null}
          {tier.contextLost ? (
            <div role="status" aria-live="polite" style={CONTEXT_RESTORATION_STYLE}>
              Restoring device view…
            </div>
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
  readonly onCardinalStart: (start: ClickWheelCardinalStart) => void
  readonly onCardinalEnd: (end: ClickWheelCardinalEnd) => void
  readonly onCardinalPress: (press: ClickWheelCardinalPress) => void
}

type CompositeInputBoundaryProps = {
  readonly children: (handlers: CompositeArcHandlers) => ReactNode
  readonly className?: string
  readonly 'data-composite-tier'?: string
  readonly 'data-composite-ready'?: boolean
  readonly createDependencies?: () => ClickWheelRuntimeDependencies
  readonly createAudioRuntime?: () => InteractionAudioRuntime
  readonly interactionAudioEnabled?: boolean
  readonly onPlayPausePress?: () => boolean | Promise<boolean>
  readonly onTransportPress?: (button: 'play-pause' | 'next' | 'previous') => boolean | Promise<boolean>
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
  onPlayPausePress,
  onTransportPress,
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
    controller.setTransportHandler(onTransportPress ?? (onPlayPausePress === undefined
      ? undefined
      : (button) => button === 'play-pause' ? onPlayPausePress() : false))
  }, [controller, onPlayPausePress, onTransportPress])

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
  private centerContactGeneration = 0
  private wheelContactGeneration = 0
  private humanArcActive = false
  private humanKeyActive = false
  private agentPressActive = false
  private lifetime = new AbortController()
  private agentOperation: AbortController | null = null
  private activeSelectPointerId: number | null = null
  private applicationFocus: HTMLElement | null = null
  private selection: ScopedGestureSelection | null = null
  private readonly haptics = new InteractionHaptics()
  private audio: InteractionAudioRuntime | null = null
  private audioRoot: HTMLDivElement | null = null
  private interactionAudioEnabled = true
  private onTransportPress: ((button: 'play-pause' | 'next' | 'previous') => boolean | Promise<boolean>) | undefined
  private attachmentGeneration = 0
  private readonly cardinalStartTimes = new Map<number, number>()
  private suppressedCardinalPointerId: number | null = null

  readonly handlers: CompositeArcHandlers = {
    onArcStart: (sample) => {
      this.humanArcActive = true
      this.wheelContactGeneration += 1
      this.agentOperation?.abort(new DOMException('Interrupted by human input.', 'AbortError'))
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
      if (this.store !== null) cancelWheelHaptics(this.store)
      this.humanArcActive = false
      try {
        this.runtime?.arcEnd(end)
      } finally {
        this.selection?.stop()
      }
      this.restoreApplicationFocus()
    },
    onSelectStart: (start) => {
      this.centerContactGeneration += 1
      this.agentOperation?.abort(new DOMException('Interrupted by human input.', 'AbortError'))
      if (this.activeSelectPointerId !== null) return
      this.activeSelectPointerId = start.pointerId
      if (start.pointerType === 'touch' && !this.store?.get(holdEngagedAtom)) this.haptics.trigger('press')
      this.audioButtonDown(
        pointerAudioContactId(start.pointerId, 'center'),
        'center',
        'pointer',
        start.timestampMs,
      )
      queueMicrotask(() => this.restoreApplicationFocus())
    },
    onSelectEnd: (end) => {
      if (this.activeSelectPointerId !== end.pointerId) return
      this.activeSelectPointerId = null
      if (end.reason !== 'release') this.haptics.cancel()
      this.audioButtonUp(
        pointerAudioContactId(end.pointerId, 'center'),
        end.timestampMs,
        end.reason,
      )
      if (end.reason === 'release') {
        this.store?.set(pressActionAtom, { button: 'center', source: 'human' })
      }
      this.restoreApplicationFocus()
    },
    onCardinalStart: (start) => {
      this.wheelContactGeneration += 1
      this.agentOperation?.abort(new DOMException('Interrupted by human input.', 'AbortError'))
      this.cardinalStartTimes.set(start.pointerId, start.timestampMs)
      if (start.pointerType === 'touch' && !this.store?.get(holdEngagedAtom)) this.haptics.trigger('press')
      this.audioButtonDown(
        pointerAudioContactId(start.pointerId, start.button),
        start.button,
        'pointer',
        start.timestampMs,
      )
    },
    onCardinalEnd: (end) => {
      if (end.reason !== 'release') this.haptics.cancel()
      this.audioButtonUp(
        pointerAudioContactId(end.pointerId, end.button),
        end.timestampMs,
        end.reason,
      )
      const startedAt = this.cardinalStartTimes.get(end.pointerId)
      this.cardinalStartTimes.delete(end.pointerId)
      if (end.accepted && end.button === 'menu' && startedAt !== undefined && end.timestampMs - startedAt >= 600) {
        this.store?.set(returnToRootActionAtom)
        this.suppressedCardinalPointerId = end.pointerId
      }
    },
    onCardinalPress: (press) => {
      if (this.suppressedCardinalPointerId === press.pointerId) {
        this.suppressedCardinalPointerId = null
        this.restoreApplicationFocus()
        return
      }
      this.dispatchPhysicalPress(press.button, pointerPressPath(press))
      this.restoreApplicationFocus()
    },
  }

  constructor(
    private readonly createDependencies: () => ClickWheelRuntimeDependencies,
    private readonly createAudioRuntime: () => InteractionAudioRuntime,
  ) {}

  attach(root: HTMLDivElement): () => void {
    this.lifetime = new AbortController()
    const generation = this.attachmentGeneration + 1
    this.attachmentGeneration = generation
    const runtimeDependencies = this.createDependencies()
    const runtime = createClickWheelRuntime(runtimeDependencies)
    const detachHaptics = this.haptics.mount()
    const detachWheelHaptics = mountWheelHaptics(runtimeDependencies.store)
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
    this.audioRoot = root
    const detachAgent = bindAgentWheelControls(runtimeDependencies.store, { press: (button, signal) => this.pressAsAgent(button, signal) })
    const detachWheel = attachCompositeWheelListener(root, runtime)
    const detachKeyboard = this.attachKeyboardControls(root)
    return () => {
      this.lifetime.abort()
      this.attachmentGeneration += 1
      audioAttached = false
      detachAgent()
      detachKeyboard()
      detachWheel()
      detachAudio()
      detachHaptics()
      detachWheelHaptics()
      audio.dispose()
      clearInteractionAudioDiagnostics(root)
      selection.dispose()
      runtime.dispose()
      if (this.runtime === runtime) this.runtime = null
      if (this.store === runtimeDependencies.store) this.store = null
      this.activeSelectPointerId = null
      this.humanArcActive = false
      this.humanKeyActive = false
      this.cardinalStartTimes.clear()
      this.suppressedCardinalPointerId = null
      if (this.selection === selection) this.selection = null
      if (this.audio === audio) this.audio = null
      if (this.audioRoot === root) this.audioRoot = null
    }
  }

  setInteractionAudioEnabled(enabled: boolean): void {
    this.interactionAudioEnabled = enabled
    this.audio?.setEnabled(enabled)
  }

  setTransportHandler(
    handler: ((button: 'play-pause' | 'next' | 'previous') => boolean | Promise<boolean>) | undefined,
  ): void {
    this.onTransportPress = handler
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

  private audioButtonDown(
    id: string,
    button: ClickWheelCardinalButton | 'center',
    source: 'pointer' | 'key' | 'agent',
    timestampMs: number,
  ): void {
    const audio = this.audio
    if (audio === null) return
    audio.buttonDown({ id, button, source, timestampMs })
    this.publishAudioSnapshot(audio)
  }

  private audioButtonUp(
    id: string,
    timestampMs: number,
    reason: ClickWheelSelectEnd['reason'] | 'blur' | 'hidden',
  ): void {
    const audio = this.audio
    if (audio === null) return
    audio.buttonUp({ id, timestampMs, reason })
    this.publishAudioSnapshot(audio)
  }

  private publishAudioSnapshot(audio: InteractionAudioRuntime): void {
    if (this.audio === audio && this.audioRoot !== null) {
      publishInteractionAudioDiagnostics(this.audioRoot, audio.snapshot())
    }
  }

  /** Shared semantic dispatch for pointer, keyboard and WebMCP input. */
  private dispatchPhysicalPress(
    button: ClickWheelCardinalButton | 'center',
    path: 'touch-arc' | 'mouse-arc' | 'key',
    source: DetentSource = 'human',
    signal?: AbortSignal,
  ): Promise<boolean> {
    const store = this.store
    if (store === null || store.get(holdEngagedAtom)) return Promise.resolve(false)
    signal?.throwIfAborted()
    if (button === 'menu' || button === 'center') {
      store.set(pressActionAtom, { button, source, path })
      return Promise.resolve(true)
    }
    const generation = this.attachmentGeneration
    const apply = (accepted: boolean): boolean => {
      if (generation !== this.attachmentGeneration || this.store !== store || signal?.aborted || store.get(holdEngagedAtom)) return false
      if (accepted) store.set(acceptedExternalPressActionAtom, { button, source, path })
      else if (button !== 'play-pause') store.set(pressActionAtom, { button, source, path })
      return accepted || button !== 'play-pause'
    }
    let result: boolean | Promise<boolean>
    try { result = this.onTransportPress?.(button) ?? false } catch { return Promise.resolve(false) }
    if (typeof result === 'boolean') return Promise.resolve(apply(result))
    return new Promise<boolean>((resolve) => {
      const abort = () => resolve(false)
      signal?.addEventListener('abort', abort, { once: true })
      void result.then((accepted) => { signal?.removeEventListener('abort', abort); resolve(apply(accepted)) }, () => { signal?.removeEventListener('abort', abort); resolve(false) })
    })
  }

  /** Visible button travel and contact SFX use the same physical owners as human input. */
  private async pressAsAgent(button: ClickWheelCardinalButton | 'center', signal: AbortSignal): Promise<boolean> {
    signal.throwIfAborted()
    const store = this.store
    if (store === null || store.get(holdEngagedAtom)) return false
    if (this.agentPressActive) throw new Error('A click-wheel press is already active.')
    if (this.hasHumanContact()) throw new Error('A human wheel contact is active.')
    this.agentPressActive = true
    const operation = new AbortController()
    this.agentOperation = operation
    signal = AbortSignal.any([signal, this.lifetime.signal, operation.signal, AbortSignal.timeout(30_000)])
    const physical = getAgentControlPhysics(store)
    const contactGeneration = button === 'center' ? ++this.centerContactGeneration : ++this.wheelContactGeneration
    const audioId = `agent:${button}`
    let released = false
    try {
      if (button === 'center') physical?.pressSelect()
      else physical?.pressWheel({ menu: 270, next: 0, 'play-pause': 90, previous: 180 }[button])
      this.audioButtonDown(audioId, button, 'agent', performance.now())
      await new Promise<void>((resolve, reject) => {
        const abort = () => { clearTimeout(timer); reject(signal.reason) }
        const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, 80)
        signal.addEventListener('abort', abort, { once: true })
      })
      signal.throwIfAborted()
      if (button === 'center') physical?.releaseSelect()
      else physical?.releaseWheel()
      this.audioButtonUp(audioId, performance.now(), 'release')
      released = true
      const accepted = await this.dispatchPhysicalPress(button, 'key', 'agent', signal)
      signal.throwIfAborted()
      return accepted
    } finally {
      if (!released) {
        if (contactGeneration === (button === 'center' ? this.centerContactGeneration : this.wheelContactGeneration)) {
          if (button === 'center') physical?.releaseSelect()
          else physical?.releaseWheel()
        }
        this.audioButtonUp(audioId, performance.now(), signal.aborted ? 'cancel' : 'release')
      }
      this.agentPressActive = false
      if (this.agentOperation === operation) this.agentOperation = null
    }
  }

  private hasHumanContact(): boolean {
    return this.humanArcActive || this.humanKeyActive || this.activeSelectPointerId !== null || this.cardinalStartTimes.size > 0
  }

  private attachKeyboardControls(root: HTMLDivElement): () => void {
    const ownerWindow = root.ownerDocument.defaultView ?? window
    let active: {
      readonly key: string
      readonly button: ClickWheelCardinalButton | 'center'
      readonly audioId: string
      readonly startedAt: number
    } | null = null
    const clear = () => {
      this.humanKeyActive = false
      active = null
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const button = physicalButtonForKey(event)
      if (
        button === null ||
        event.repeat ||
        active !== null ||
        !isApplicationKeyboardTarget(event.target, root)
      ) return
      this.agentOperation?.abort(new DOMException('Interrupted by human input.', 'AbortError'))
      const audioId = keyAudioContactId(event.key, button)
      active = { key: event.key, button, audioId, startedAt: event.timeStamp }
      this.humanKeyActive = true
      if (button === 'center') this.centerContactGeneration += 1
      event.preventDefault()
      if (button !== 'center') event.stopPropagation()
      this.audioButtonDown(audioId, button, 'key', event.timeStamp)
    }
    const onKeyUp = (event: KeyboardEvent) => {
      const current = active
      if (current === null || event.key !== current.key) return
      active = null
      this.humanKeyActive = false
      event.preventDefault()
      if (current.button !== 'center') event.stopPropagation()
      this.audioButtonUp(current.audioId, event.timeStamp, 'release')
      if (current.button === 'menu' && event.timeStamp - current.startedAt >= 600) {
        this.store?.set(returnToRootActionAtom)
      } else {
        this.dispatchPhysicalPress(current.button, 'key')
      }
      this.restoreApplicationFocus()
    }
    const onVisibilityChange = () => {
      if (root.ownerDocument.hidden) clear()
    }
    root.addEventListener('keydown', onKeyDown, { capture: true })
    root.addEventListener('keyup', onKeyUp, { capture: true })
    ownerWindow.addEventListener('blur', clear)
    root.ownerDocument.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      clear()
      root.removeEventListener('keydown', onKeyDown, { capture: true })
      root.removeEventListener('keyup', onKeyUp, { capture: true })
      ownerWindow.removeEventListener('blur', clear)
      root.ownerDocument.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }
}

function pointerPressPath(
  press: ClickWheelCardinalPress,
): 'touch-arc' | 'mouse-arc' {
  return press.pointerType === 'mouse' ? 'mouse-arc' : 'touch-arc'
}

function pointerAudioContactId(
  pointerId: number,
  button: ClickWheelCardinalButton | 'center',
): string {
  return `pointer:${pointerId}:${button}`
}

function keyAudioContactId(
  key: string,
  button: ClickWheelCardinalButton | 'center',
): string {
  return `key:${key}:${button}`
}

/** Keyboard equivalents for the five physical click-wheel buttons. */
export function physicalButtonForKey(
  event: Pick<KeyboardEvent, 'key' | 'altKey' | 'ctrlKey' | 'metaKey'>,
): ClickWheelCardinalButton | 'center' | null {
  if (event.altKey || event.ctrlKey || event.metaKey) return null
  if (event.key === 'Enter') return 'center'
  if (event.key === 'Escape' || event.key === 'Backspace') return 'menu'
  if (event.key === 'PageUp') return 'previous'
  if (event.key === 'PageDown') return 'next'
  if (event.key === ' ' || event.key === 'Spacebar') return 'play-pause'
  return null
}

function isApplicationKeyboardTarget(
  target: EventTarget | null,
  root: HTMLElement,
): boolean {
  return (
    target instanceof Element &&
    target.getAttribute('role') === 'application' &&
    root.contains(target)
  )
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
  onCardinalStart,
  onCardinalEnd,
  onCardinalPress,
}: {
  readonly coordinator: CompositeCoordinator
  readonly onArcStart: (sample: ClickWheelArcSample) => void
  readonly onArcMove: (sample: ClickWheelArcSample) => void
  readonly onArcEnd: (end: ClickWheelArcEnd) => void
  readonly onSelectStart: (start: ClickWheelSelectStart) => void
  readonly onSelectEnd: (end: ClickWheelSelectEnd) => void
  readonly onCardinalStart: (start: ClickWheelCardinalStart) => void
  readonly onCardinalEnd: (end: ClickWheelCardinalEnd) => void
  readonly onCardinalPress: (press: ClickWheelCardinalPress) => void
}) {
  const controlPhysics = useControlPhysics()
  useEffect(() => controlPhysics === null ? undefined : bindAgentControlPhysics(deviceStore, controlPhysics), [controlPhysics])
  const renderer = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)
  const scene = useThree((state) => state.scene)

  useEffect(() => {
    coordinator.setRenderContext({ renderer, camera, scene })
    return () => coordinator.clearRenderContext(renderer)
  }, [camera, coordinator, renderer, scene])

  // The screen handle publishes before its draw, including camera/viewport
  // changes. A React layout resync would repeat that same transform work.

  return (
    <ClickWheelInputSurface
      onArcStart={onArcStart}
      onArcMove={onArcMove}
      onArcEnd={onArcEnd}
      onSelectStart={onSelectStart}
      onSelectEnd={onSelectEnd}
      onCardinalStart={onCardinalStart}
      onCardinalEnd={onCardinalEnd}
      onCardinalPress={onCardinalPress}
    />
  )
}
