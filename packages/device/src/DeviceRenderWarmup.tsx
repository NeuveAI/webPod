import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Mesh, Texture } from 'three'

/** Compile and upload while the route holds the device below the scene. */
export function DeviceRenderWarmup() {
  const { gl, scene, camera, invalidate } = useThree()
  const frames = useRef(0)
  useEffect(() => {
    const canvas = gl.domElement
    if (!canvas.closest('[data-device-reveal="warming"]')) return
    let disposed = false
    let failed = false
    // This starts only after the complete scene commits. A stalled driver must
    // report failure rather than leave entry waiting forever on compileAsync.
    const deadline = setTimeout(() => {
      failed = true
      frames.current = 0
      canvas.dataset['wpRenderWarm'] = 'failed'
    }, 10000)
    // Let sibling environment/material effects commit before compiling.
    const start = requestAnimationFrame(() => {
      void (async () => {
        try {
          await gl.compileAsync(scene, camera)
          if (disposed || failed) return
          clearTimeout(deadline)
          const textures = new Set<Texture>()
          scene.traverse(object => {
            if (!(object instanceof Mesh)) return
            for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
              for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value)
            }
          })
          for (const texture of textures) gl.initTexture(texture)
          frames.current = 3
          invalidate()
        } catch {
          clearTimeout(deadline)
          // The route's bounded fallback still exposes graphics error UI.
          if (!disposed) canvas.dataset['wpRenderWarm'] = 'failed'
        }
      })()
    })
    return () => {
      disposed = true
      clearTimeout(deadline)
      cancelAnimationFrame(start)
      frames.current = 0
      delete canvas.dataset['wpRenderWarm']
    }
  }, [gl, scene, camera, invalidate])
  useFrame(() => {
    if (frames.current === 0) return
    frames.current -= 1
    // Two complete renders have now exercised buffers and texture bindings.
    if (frames.current === 0) gl.domElement.setAttribute('data-wp-render-warm', 'ready')
    else invalidate()
  })
  return null
}
