import { useEffect, useRef } from 'react'

/** Mount one passive desktop overlay; defer Three.js until fine pointer support. */
export function HandCursor() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    let dispose: (() => void) | undefined
    const media = matchMedia('(hover: hover) and (pointer: fine)')
    const start = () => {
      if (!media.matches || dispose || cancelled) return
      void import('./runtime').then(({ mountHandCursor }) => {
        if (!cancelled && media.matches && !dispose) dispose = mountHandCursor(canvas)
      }).catch(() => { /* Native cursor remains visible if the optional chunk fails. */ })
    }
    const change = () => {
      if (!media.matches) { dispose?.(); dispose = undefined }
      else start()
    }
    start()
    media.addEventListener('change', change)
    return () => { cancelled = true; media.removeEventListener('change', change); dispose?.() }
  }, [])
  return <canvas ref={canvasRef} className="webpod-hand-cursor" data-hand-cursor="loading" aria-hidden="true" />
}
