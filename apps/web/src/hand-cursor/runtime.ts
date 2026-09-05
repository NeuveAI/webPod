import { ACESFilmicToneMapping, DirectionalLight, Group, HemisphereLight, LoadingManager, OrthographicCamera, Scene, Vector3, WebGLRenderer } from 'three'
import { handInputAtom, handPoseAt, handSkinAtom, handStore, INITIAL_HAND_INPUT, usesNativeCursor } from './state'
import { HAND_MOTION, initialMotion, sampleMotion, smearAt } from './motion'
import { loadHandRig, type HandRig } from './rig'

/* ANIMATION STORYBOARD
 *   0ms  contact follows pointer exactly; target gesture changes
 *  85ms  fingers blend toward the new pose; wrist follows directional impulse
 *  48ms  fast movement holds stretched silhouette and two offset multiples
 * 113ms  smear has disappeared after the last fast sample
 * 450ms  settle completes; rendering sleeps until the next interaction
 */
const VIEW = { size: 192, span: 12, maxDpr: 2, settleMs: 450, idleAngle: -.20 }

/**
 * Own a single passive overlay. Input is never captured/prevented; player datasets
 * remain the authority. Hide native cursor only after a successful visible draw.
 * Every listener, observer, request and GPU object has a matching teardown.
 */
export function mountHandCursor(canvas: HTMLCanvasElement): () => void {
  const context = canvas.getContext('2d')
  if (!context) return () => {}
  const root = document.documentElement
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  const dpr = Math.min(VIEW.maxDpr, window.devicePixelRatio || 1)
  canvas.width = canvas.height = VIEW.size * dpr
  context.scale(dpr, dpr)
  let renderer: WebGLRenderer
  try {
    renderer = new WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(dpr)
    renderer.setSize(VIEW.size, VIEW.size, false)
    renderer.setClearColor(0, 0)
    renderer.toneMapping = ACESFilmicToneMapping
  } catch {
    canvas.dataset['handCursor'] = 'unavailable'
    return () => {}
  }
  const scene = new Scene()
  const camera = new OrthographicCamera(-VIEW.span / 2, VIEW.span / 2, VIEW.span / 2, -VIEW.span / 2, .1, 100)
  camera.position.z = 12
  scene.add(new HemisphereLight(0xffffff, 0x77798c, 2.3))
  const key = new DirectionalLight(0xfff5df, 3.5)
  key.position.set(-3, 5, 8)
  scene.add(key)
  const rim = new DirectionalLight(0xdde7ff, 1.8)
  rim.position.set(4, 1, 3)
  scene.add(rim)
  const anchor = new Group()
  const direction = new Group()
  const stretch = new Group()
  const hand = new Group()
  scene.add(anchor)
  anchor.add(direction)
  direction.add(stretch)
  stretch.add(hand)
  let rig: HandRig | null = null
  let disposed = false
  let failed = false
  let request = 0
  let loadGeneration = 0
  let loadingManager = new LoadingManager()
  let lastFrame = 0
  let lastWake = 0
  let tilt = 0
  let motion = initialMotion(0, 0, 0)
  const thumbPosition = new Vector3()

  const hide = () => {
    root.removeAttribute('data-hand-cursor-active')
    canvas.style.visibility = 'hidden'
  }
  const fail = () => {
    failed = true
    hide()
    canvas.dataset['handCursor'] = 'unavailable'
    cancelAnimationFrame(request)
    request = 0
  }
  const draw = (time: number) => {
    request = 0
    if (disposed || failed || !rig) return
    const input = handStore.get(handInputAtom)
    if (!input.visible || document.hidden) { hide(); return }
    const dt = Math.min(50, Math.max(0, time - lastFrame))
    lastFrame = time
    const target = document.elementFromPoint(input.x, input.y)
    if (usesNativeCursor(target)) { hide(); return }
    const pose = handPoseAt(target, input.down)
    if (pose !== input.pose) handStore.set(handInputAtom, { ...input, pose })
    const amount = input.reducedMotion ? 1 : 1 - Math.exp(-dt / HAND_MOTION.poseBlendMs)
    for (const [name, action] of rig.actions) {
      action.setEffectiveWeight(action.getEffectiveWeight() + ((name === pose ? 1 : 0) - action.getEffectiveWeight()) * amount)
    }
    rig.mixer.update(dt / 1000)
    const smear = input.reducedMotion ? 0 : smearAt(motion, time)
    const moving = time - input.time < 80
    const desiredTilt = input.reducedMotion ? 0 : moving ? Math.max(-HAND_MOTION.maxTilt, Math.min(HAND_MOTION.maxTilt, -motion.vx * .10)) : 0
    tilt += (desiredTilt - tilt) * (input.reducedMotion ? 1 : 1 - Math.exp(-dt / HAND_MOTION.followMs))
    // Stretch in screen movement direction, then restore the hand's orientation.
    direction.rotation.z = motion.angle
    stretch.scale.set(1 + smear * HAND_MOTION.maxStretch, 1 - smear * .13, 1)
    hand.rotation.z = VIEW.idleAngle + tilt - motion.angle
    const compression = input.down && pose === 'press' ? .94 : 1
    hand.scale.setScalar(compression)
    anchor.position.set(0, 0, 0)
    scene.updateMatrixWorld(true)
    rig.index.getWorldPosition(rig.contact)
    rig.thumb.getWorldPosition(thumbPosition)
    const pinchWeight = rig.actions.get('pinch')?.getEffectiveWeight() ?? 0
    const grabWeight = rig.actions.get('grab')?.getEffectiveWeight() ?? 0
    rig.contact.lerp(thumbPosition, (pinchWeight + grabWeight) * .5)
    anchor.position.set(-rig.contact.x, -rig.contact.y, 0)
    try {
      renderer.render(scene, camera)
      context.clearRect(0, 0, VIEW.size, VIEW.size)
      // Multiples are sparse drawings, never an accumulating framebuffer trail.
      const trail = smear * HAND_MOTION.maxTrailPx
      const dx = -Math.cos(motion.angle) * trail
      const dy = Math.sin(motion.angle) * trail
      if (smear > .06) {
        context.globalAlpha = smear * .12
        context.drawImage(renderer.domElement, dx, dy, VIEW.size, VIEW.size)
        context.globalAlpha = smear * .22
        context.drawImage(renderer.domElement, dx * .5, dy * .5, VIEW.size, VIEW.size)
      }
      context.globalAlpha = 1
      context.drawImage(renderer.domElement, 0, 0, VIEW.size, VIEW.size)
    } catch { fail(); return }
    canvas.style.transform = `translate3d(${input.x - VIEW.size / 2}px, ${input.y - VIEW.size / 2}px, 0)`
    canvas.style.visibility = 'visible'
    canvas.dataset['handCursor'] = 'ready'
    canvas.dataset['handPose'] = pose
    canvas.dataset['handSmear'] = smear.toFixed(3)
    canvas.dataset['handMotion'] = input.reducedMotion ? 'reduced' : 'full'
    root.setAttribute('data-hand-cursor-active', '')
    if (time - lastWake < VIEW.settleMs) request = requestAnimationFrame(draw)
  }
  const wake = () => {
    if (disposed || failed) return
    lastWake = performance.now()
    if (!request && rig) request = requestAnimationFrame(draw)
  }
  const update = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') { reset(); return }
    const previous = handStore.get(handInputAtom)
    const time = performance.now()
    const target = document.elementFromPoint(event.clientX, event.clientY)
    motion = previous.visible
      ? sampleMotion(motion, event.clientX, event.clientY, time)
      : initialMotion(event.clientX, event.clientY, time)
    const down = (event.buttons & 1) !== 0
    handStore.set(handInputAtom, {
      x: event.clientX, y: event.clientY, time, down,
      visible: !usesNativeCursor(target),
      reducedMotion: reduced.matches, pose: handPoseAt(target, down),
    })
    if (usesNativeCursor(target)) hide()
  }
  const reset = () => {
    handStore.set(handInputAtom, { ...handStore.get(handInputAtom), visible: false, down: false })
    motion = initialMotion(0, 0, 0)
    hide()
    cancelAnimationFrame(request)
    request = 0
  }
  const leave = (event: PointerEvent) => { if (!event.relatedTarget) reset() }
  const releaseCapture = () => {
    handStore.set(handInputAtom, { ...handStore.get(handInputAtom), down: false })
  }
  const keyboard = (event: KeyboardEvent) => { if (event.key === 'Tab') reset() }
  const preference = () => {
    handStore.set(handInputAtom, { ...handStore.get(handInputAtom), reducedMotion: reduced.matches })
    motion = initialMotion(motion.x, motion.y, performance.now())
  }
  const loadSkin = () => {
    const generation = ++loadGeneration
    loadingManager.abort()
    loadingManager = new LoadingManager()
    hide()
    failed = false
    canvas.dataset['handCursor'] = 'loading'
    if (rig) { hand.remove(rig.root); rig.dispose(); rig = null }
    void loadHandRig(handStore.get(handSkinAtom), loadingManager).then((loaded) => {
      if (disposed || generation !== loadGeneration) { loaded.dispose(); return }
      rig = loaded
      hand.add(loaded.root)
      canvas.dataset['handCursor'] = 'ready'
      wake()
    }).catch(() => { if (!disposed && generation === loadGeneration) fail() })
  }
  const unsubscribe = handStore.sub(handInputAtom, wake)
  const unsubscribeSkin = handStore.sub(handSkinAtom, loadSkin)
  const observer = new MutationObserver(wake)
  observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-orientation-grab', 'data-wp-cursor-control'] })
  const passive = { passive: true, capture: true }
  window.addEventListener('pointermove', update, passive)
  window.addEventListener('pointerdown', update, passive)
  window.addEventListener('pointerup', update, passive)
  window.addEventListener('pointercancel', reset, passive)
  window.addEventListener('lostpointercapture', releaseCapture, passive)
  window.addEventListener('pointerout', leave, passive)
  window.addEventListener('blur', reset)
  window.addEventListener('keydown', keyboard)
  window.addEventListener('scroll', wake, passive)
  window.addEventListener('resize', wake)
  document.addEventListener('visibilitychange', reset)
  reduced.addEventListener('change', preference)
  renderer.domElement.addEventListener('webglcontextlost', fail)
  loadSkin()
  return () => {
    disposed = true
    ++loadGeneration
    loadingManager.abort()
    hide()
    cancelAnimationFrame(request)
    unsubscribe()
    unsubscribeSkin()
    observer.disconnect()
    window.removeEventListener('pointermove', update, passive)
    window.removeEventListener('pointerdown', update, passive)
    window.removeEventListener('pointerup', update, passive)
    window.removeEventListener('pointercancel', reset, passive)
    window.removeEventListener('lostpointercapture', releaseCapture, passive)
    window.removeEventListener('pointerout', leave, passive)
    window.removeEventListener('blur', reset)
    window.removeEventListener('keydown', keyboard)
    window.removeEventListener('scroll', wake, passive)
    window.removeEventListener('resize', wake)
    document.removeEventListener('visibilitychange', reset)
    reduced.removeEventListener('change', preference)
    renderer.domElement.removeEventListener('webglcontextlost', fail)
    rig?.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
    handStore.set(handInputAtom, INITIAL_HAND_INPUT)
  }
}
