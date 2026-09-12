export const DEVICE_REVEAL_TIMING = {
  warm: 1450, turn: 440, front: 1600, settle: 1900,
  wink: 2300, winkPeak: 2720, winkReturn: 2800, complete: 3460,
  maxFrameStep: 32,
} as const
const REVEAL = { travelPercent: 110, yawDeg: 180, pitchDeg: -12, rollDeg: -5 } as const
const WINK = { yawDeg: -32, pitchDeg: -5, rollDeg: 2 } as const
export const smooth = (value: number) => {
  const t = Math.max(0, Math.min(1, value))
  return t * t * t * (t * (t * 6 - 15) + 10)
}

export function deviceRevealFrame(elapsedMs: number) {
  const progress = Math.max(0, Math.min(1, elapsedMs / DEVICE_REVEAL_TIMING.settle))
  const rise = 1 - Math.pow(1 - progress, 3)
  const turn = smooth((elapsedMs - DEVICE_REVEAL_TIMING.turn) / (DEVICE_REVEAL_TIMING.front - DEVICE_REVEAL_TIMING.turn))
  const wink = smooth((elapsedMs - DEVICE_REVEAL_TIMING.wink) / (DEVICE_REVEAL_TIMING.winkPeak - DEVICE_REVEAL_TIMING.wink)) *
    (1 - smooth((elapsedMs - DEVICE_REVEAL_TIMING.winkReturn) / (DEVICE_REVEAL_TIMING.complete - DEVICE_REVEAL_TIMING.winkReturn)))
  return {
    travelPercent: REVEAL.travelPercent * (1 - rise),
    orientation: {
      yawDeg: REVEAL.yawDeg * (1 - turn) + WINK.yawDeg * wink,
      pitchDeg: REVEAL.pitchDeg * (1 - rise) + WINK.pitchDeg * wink,
      rollDeg: REVEAL.rollDeg * (1 - rise) + WINK.rollDeg * wink,
    },
  }
}
