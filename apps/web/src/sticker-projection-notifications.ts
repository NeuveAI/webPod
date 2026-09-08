/** Cross-renderer layout notifications run once before the next paint, never
 * synchronously inside another React root's commit. The handle itself stays live. */
export function createStickerProjectionNotifications(
  publish: () => void,
  request: (callback: FrameRequestCallback) => number = callback => requestAnimationFrame(callback),
  cancel: (frame: number) => void = frame => cancelAnimationFrame(frame),
) {
  let frame: number | null = null
  return {
    notify() {
      if (frame !== null) return
      frame = request(() => { frame = null; publish() })
    },
    cancel() {
      if (frame !== null) cancel(frame)
      frame = null
    },
  }
}
