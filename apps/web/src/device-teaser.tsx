import { useFrame, useThree } from '@react-three/fiber'
import { DeviceCanvas, DEVICE_MODEL_NAME, DEVICE_CONTENT_NAME, DEFAULT_DEVICE_ENVELOPE, DEFAULT_LIGHT_RIG, type LightRigParams, deviceOrientationToRotation, type ScreenMeshHandle, type DeviceStickerScene } from '@webpod/device'
import { STICKER_CATALOGUE } from '@webpod/stickers'
import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { CanvasTexture, MeshBasicMaterial, SRGBColorSpace, LinearMipmapLinearFilter, Euler, Matrix4, Vector3 } from 'three'
import { previewYaw } from './browser-welcome-policy'
import { loadTeaserFrames, teaserFrameIndex, TEASER_SCREEN } from './teaser-screen'
import { mountTeaserEntrance } from './teaser-entrance'

/* ANIMATION STORYBOARD (24 seconds, looping)
 *  0–7s   Browse the demo library, then show Now Playing.
 *  7–11s  Ease around to the steel back.
 * 11–17s  Hold on the sticker collection.
 * 17–21s  Continue the turn to the front.
 * 21–24s  Rest on the screen before the next loop.
 * Hidden tabs and Pause stop the clock; reduced motion keeps a still front view.
 */
const FRONT = { pitchDeg: 0, yawDeg: 0, rollDeg: 0 } as const
// A narrower grazing key and side strip reveal the crown and polished seam.
// Keep the broad fill subdued so the black face retains its depth.
const PREVIEW_LIGHT_RIG: LightRigParams = {
  ...DEFAULT_LIGHT_RIG,
  key: { ...DEFAULT_LIGHT_RIG.key, viewerAzimuthDeg: 62, emitter: { width: 260, height: 820 } },
  kick: { ...DEFAULT_LIGHT_RIG.kick, powerRatio: .18 },
  rim: { ...DEFAULT_LIGHT_RIG.rim, position: [-390, 110, 120], powerRatio: .36, emitter: { width: 90, height: 760 } },
}
const PREVIEW_STICKERS: DeviceStickerScene = {
  assets: STICKER_CATALOGUE.filter((art) => ['PW-A01', 'PW-B01', 'PW-A05'].includes(art.id)),
  placements: [
    { stickerId: 'PW-A01', surface: 'back', x: .36, y: .29, width: .54, rotationDeg: -14 },
    { stickerId: 'PW-B01', surface: 'back', x: .66, y: .50, width: .46, rotationDeg: 12 },
    { stickerId: 'PW-A05', surface: 'back', x: .37, y: .73, width: .48, rotationDeg: -8 },
  ],
  pack: null,
}
const SCREEN = TEASER_SCREEN

/** Read-only model showcase. No provider, player state, or experimental DOM APIs. */
export function DeviceTeaser({ paused, reducedMotion }: { readonly paused: boolean; readonly reducedMotion: boolean }) {
  const entrance = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (entrance.current) return mountTeaserEntrance(entrance.current)
    return undefined
  }, [])
  const screen = useRef<ScreenMeshHandle | null>(null)
  const onScreenMeshReady = useCallback((handle: ScreenMeshHandle) => { screen.current = handle }, [])
  return <div ref={entrance} className="webpod-teaser" data-teaser-entrance="waiting"><DeviceCanvas colourway="black" orientation={FRONT} lightRig={PREVIEW_LIGHT_RIG} cameraSafePadding={16}
    dpr={[1, 2]} stickerScene={PREVIEW_STICKERS} onScreenMeshReady={onScreenMeshReady}>
    <TeaserEdgeAlignment />
    <TeaserAnimation screen={screen} paused={paused} reducedMotion={reducedMotion} />
  </DeviceCanvas></div>
}

/** Align copy to the resting device, recalculating after camera/viewport changes.
 * Use a fixed front pose so the text stays still while the preview turns.
 */
function TeaserEdgeAlignment() {
  const previous = useRef('')
  const scratch = useRef({
    rotation: new Matrix4().makeRotationFromEuler(new Euler(...deviceOrientationToRotation(FRONT))),
    transform: new Matrix4(),
    point: new Vector3(),
  })
  useFrame(({ scene, camera, gl, size }) => {
    const content = scene.getObjectByName(DEVICE_CONTENT_NAME)
    const showcase = gl.domElement.closest<HTMLElement>('.webpod-welcome__showcase')
    if (!content || !showcase) return
    const key = `${size.width}:${size.height}:${camera.projectionMatrix.elements.join(',')}:${camera.position.toArray().join(',')}`
    if (previous.current === key) return
    previous.current = key
    content.updateMatrix()
    camera.updateMatrixWorld()
    const { rotation, transform, point } = scratch.current
    transform.multiplyMatrices(rotation, content.matrix)
    let top = Infinity
    let bottom = -Infinity
    const { min, max } = DEFAULT_DEVICE_ENVELOPE
    for (const x of [min[0], max[0]]) {
      for (const y of [min[1], max[1]]) {
        for (const z of [min[2], max[2]]) {
          point.set(x, y, z).applyMatrix4(transform).project(camera)
          top = Math.min(top, (1 - point.y) * size.height / 2)
          bottom = Math.max(bottom, (1 - point.y) * size.height / 2)
        }
      }
    }
    showcase.style.setProperty('--device-top', `${Math.max(0, top)}px`)
    showcase.style.setProperty('--device-bottom-inset', `${Math.max(0, size.height - bottom)}px`)
  })
  return null
}

function TeaserAnimation({ screen, paused, reducedMotion }: {
  readonly screen: RefObject<ScreenMeshHandle | null>; readonly paused: boolean; readonly reducedMotion: boolean
}) {
  const scene = useThree((state) => state.scene)
  const renderer = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)
  const invalidate = useThree((state) => state.invalidate)
  const elapsed = useRef(0)

  useEffect(() => {
    const model = scene.getObjectByName(DEVICE_MODEL_NAME)
    const handle = screen.current
    if (model === undefined || handle === null) return
    const canvas = document.createElement('canvas')
    canvas.width = SCREEN.width
    canvas.height = SCREEN.height
    const context = canvas.getContext('2d')
    if (context === null) return
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.minFilter = LinearMipmapLinearFilter
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
    const material = new MeshBasicMaterial({ map: texture, toneMapped: false })
    let disposed = false
    let images: readonly HTMLImageElement[] = []
    let frame = 0
    let previous: number | null = null
    let lastScreenFrame = -1
    const entrance = renderer.domElement.closest<HTMLElement>('[data-teaser-entrance]')
    const render = () => {
      const seconds = reducedMotion ? 0 : elapsed.current
      model.rotation.set(...deviceOrientationToRotation({ ...FRONT, yawDeg: previewYaw(seconds) }))
      const screenFrame = teaserFrameIndex(seconds)
      if (screenFrame !== lastScreenFrame) {
        const image = images[screenFrame]
        if (image === undefined) return
        context.drawImage(image, 0, 0, SCREEN.width, SCREEN.height)
        texture.needsUpdate = true
        lastScreenFrame = screenFrame
      }
      invalidate()
    }
    const tick = (now: number) => {
      if (previous !== null) elapsed.current += Math.min((now - previous) / 1000, .1)
      previous = now
      render()
      frame = requestAnimationFrame(tick)
    }
    const sync = () => {
      cancelAnimationFrame(frame)
      previous = null
      if (entrance?.dataset['teaserEntrance'] === 'complete' && images.length > 0 && !document.hidden && !paused && !reducedMotion) frame = requestAnimationFrame(tick)
    }
    void loadTeaserFrames().then(async (frames) => {
      if (disposed) return
      images = frames
      render()
      handle.setMaterial(material)
      await renderer.compileAsync(scene, camera)
      if (disposed) return
      renderer.initTexture(texture)
      invalidate()
      entrance?.dispatchEvent(new Event('teaser-ready'))
      sync()
    }).catch(() => {
      // Keep the physical device visible if a static asset cannot be fetched.
      if (!disposed) {
        handle.setMaterial(null)
        entrance?.dispatchEvent(new Event('teaser-ready'))
      }
    })
    document.addEventListener('visibilitychange', sync)
    entrance?.addEventListener('teaser-settled', sync)
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', sync)
      entrance?.removeEventListener('teaser-settled', sync)
      handle.setMaterial(null)
      material.dispose()
      texture.dispose()
    }
  }, [camera, invalidate, paused, reducedMotion, renderer, scene, screen])
  return null
}
