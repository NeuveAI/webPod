import type {
  InteractionAudioBackend,
  InteractionAudioVoice,
  InteractionVoiceKind,
  InteractionVoiceSpec,
} from './interaction-audio'

const MASTER_GAIN = 0.62
const COMPRESSOR_THRESHOLD_DB = -18
const COMPRESSOR_KNEE_DB = 6
const COMPRESSOR_RATIO = 8
const COMPRESSOR_ATTACK_SECONDS = 0.002
const COMPRESSOR_RELEASE_SECONDS = 0.05

/**
 * Creates the real browser backend, or `null` when Web Audio is unavailable.
 * Calling this function constructs `AudioContext`, so callers must invoke it
 * only inside a trusted human activation path.
 */
export function createBrowserInteractionAudioBackend(): InteractionAudioBackend | null {
  if (typeof AudioContext === 'undefined') return null
  return new WebAudioInteractionBackend(
    new AudioContext({ latencyHint: 'interactive' }),
  )
}

class WebAudioInteractionBackend implements InteractionAudioBackend {
  private readonly master: GainNode
  private readonly compressor: DynamicsCompressorNode
  private readonly buffers = new Map<InteractionVoiceKind, AudioBuffer>()

  constructor(private readonly context: AudioContext) {
    const now = context.currentTime
    this.master = context.createGain()
    this.master.gain.setValueAtTime(MASTER_GAIN, now)
    this.compressor = context.createDynamicsCompressor()
    this.compressor.threshold.setValueAtTime(COMPRESSOR_THRESHOLD_DB, now)
    this.compressor.knee.setValueAtTime(COMPRESSOR_KNEE_DB, now)
    this.compressor.ratio.setValueAtTime(COMPRESSOR_RATIO, now)
    this.compressor.attack.setValueAtTime(COMPRESSOR_ATTACK_SECONDS, now)
    this.compressor.release.setValueAtTime(COMPRESSOR_RELEASE_SECONDS, now)
    this.master.connect(this.compressor).connect(context.destination)
  }

  get state(): AudioContextState {
    return this.context.state
  }

  get currentTime(): number {
    return this.context.currentTime
  }

  resume(): Promise<void> {
    return this.context.resume()
  }

  suspend(): Promise<void> {
    return this.context.suspend()
  }

  close(): Promise<void> {
    this.master.disconnect()
    this.compressor.disconnect()
    return this.context.close()
  }

  schedule(spec: InteractionVoiceSpec, onEnded: () => void): InteractionAudioVoice {
    const source = this.context.createBufferSource()
    const filter = this.context.createBiquadFilter()
    const envelope = this.context.createGain()
    const endTime = spec.startTimeSeconds + spec.durationSeconds
    source.buffer = this.bufferFor(spec.kind, spec.durationSeconds)
    source.playbackRate.setValueAtTime(spec.playbackRate, spec.startTimeSeconds)
    filter.type = spec.filter
    filter.frequency.setValueAtTime(spec.filterFrequencyHz, spec.startTimeSeconds)
    filter.Q.setValueAtTime(spec.filterQ, spec.startTimeSeconds)
    envelope.gain.setValueAtTime(0.0001, spec.startTimeSeconds)
    envelope.gain.linearRampToValueAtTime(
      spec.peakGain,
      spec.startTimeSeconds + Math.min(0.0008, spec.durationSeconds / 4),
    )
    envelope.gain.exponentialRampToValueAtTime(0.0001, endTime)
    source.connect(filter).connect(envelope).connect(this.master)

    let ended = false
    const cleanup = () => {
      if (ended) return
      ended = true
      source.disconnect()
      filter.disconnect()
      envelope.disconnect()
      onEnded()
    }
    source.onended = cleanup
    try {
      source.start(spec.startTimeSeconds)
      source.stop(endTime + 0.001)
    } catch (error) {
      cleanup()
      throw error
    }

    return {
      stop() {
        if (ended) return
        try {
          source.stop()
        } catch {
          // A source may already have ended between the guard and `stop`.
        }
        cleanup()
      },
    }
  }

  private bufferFor(kind: InteractionVoiceKind, durationSeconds: number): AudioBuffer {
    const existing = this.buffers.get(kind)
    if (existing !== undefined) return existing
    const frameCount = Math.max(1, Math.ceil(this.context.sampleRate * durationSeconds))
    const buffer = this.context.createBuffer(1, frameCount, this.context.sampleRate)
    const samples = buffer.getChannelData(0)
    let seed = kind === 'wheel' ? 0x51f15e : kind === 'select' ? 0x5e1ec7 : 0xb0770
    for (let index = 0; index < samples.length; index += 1) {
      seed = (seed * 1664525 + 1013904223) >>> 0
      const noise = (seed / 0xffffffff) * 2 - 1
      const progress = index / Math.max(1, samples.length - 1)
      const decay = Math.exp(-progress * (kind === 'wheel' ? 11 : 7))
      const plasticBody =
        kind === 'wheel'
          ? 0
          : Math.sin((2 * Math.PI * (kind === 'select' ? 1100 : 1500) * index) /
              this.context.sampleRate) * 0.24
      samples[index] = (noise * (kind === 'wheel' ? 0.9 : 0.55) + plasticBody) * decay
    }
    this.buffers.set(kind, buffer)
    return buffer
  }
}
