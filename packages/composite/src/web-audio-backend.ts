import type {
  InteractionAudioBackend,
  InteractionAudioVoice,
  InteractionVoiceKind,
  InteractionVoiceSpec,
} from './interaction-audio'
import { createInteractionVoiceSpec } from './interaction-audio'

const MASTER_GAIN = 0.62
const COMPRESSOR_THRESHOLD_DB = -18
const COMPRESSOR_KNEE_DB = 6
const COMPRESSOR_RATIO = 8
const COMPRESSOR_ATTACK_SECONDS = 0.002
const COMPRESSOR_RELEASE_SECONDS = 0.05
const PREVIEW_SAMPLE_RATE = 48_000
const PREVIEW_DURATION_SECONDS = 1

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
  private readonly graph: InteractionAudioGraph

  constructor(private readonly context: AudioContext) {
    this.graph = new InteractionAudioGraph(context)
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
    this.graph.dispose()
    return this.context.close()
  }

  schedule(spec: InteractionVoiceSpec, onEnded: () => void): InteractionAudioVoice {
    return this.graph.schedule(spec, onEnded)
  }
}

/**
 * Renders the live procedural graph into a short PCM WAV for the owner-quality
 * listening gate. The artifact contains Select, a six-detent wheel run, and a
 * secondary button in that order; it is evidence, not a substitute for hearing
 * the mounted route through the owner's actual output device.
 */
export async function renderInteractionAudioPreviewWav(): Promise<ArrayBuffer> {
  if (typeof OfflineAudioContext === 'undefined') {
    throw new Error('OfflineAudioContext is unavailable')
  }
  const frameCount = PREVIEW_SAMPLE_RATE * PREVIEW_DURATION_SECONDS
  const context = new OfflineAudioContext(1, frameCount, PREVIEW_SAMPLE_RATE)
  const graph = new InteractionAudioGraph(context)
  graph.schedule(createInteractionVoiceSpec('select', 0.12, () => 0.5), () => undefined)
  const pitchSequence = [0.25, 0.6, 0.4, 0.7, 0.3, 0.55]
  for (let index = 0; index < pitchSequence.length; index += 1) {
    const pitch = pitchSequence[index] ?? 0.5
    graph.schedule(
      createInteractionVoiceSpec(
        'wheel',
        0.4 + index / 30,
        () => pitch,
      ),
      () => undefined,
    )
  }
  graph.schedule(createInteractionVoiceSpec('button', 0.78, () => 0.5), () => undefined)
  const rendered = await context.startRendering()
  graph.dispose()
  return encodeMonoPcm16Wav(rendered)
}

class InteractionAudioGraph {
  private readonly master: GainNode
  private readonly compressor: DynamicsCompressorNode
  private readonly buffers = new Map<InteractionVoiceKind, AudioBuffer>()
  private disposed = false

  constructor(private readonly context: BaseAudioContext) {
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

  schedule(spec: InteractionVoiceSpec, onEnded: () => void): InteractionAudioVoice {
    if (this.disposed) throw new Error('Interaction audio graph is disposed')
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

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.master.disconnect()
    this.compressor.disconnect()
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

function encodeMonoPcm16Wav(buffer: AudioBuffer): ArrayBuffer {
  const samples = buffer.getChannelData(0)
  const bytesPerSample = 2
  const dataLength = samples.length * bytesPerSample
  const wav = new ArrayBuffer(44 + dataLength)
  const view = new DataView(wav)
  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, buffer.sampleRate, true)
  view.setUint32(28, buffer.sampleRate * bytesPerSample, true)
  view.setUint16(32, bytesPerSample, true)
  view.setUint16(34, 16, true)
  writeAscii(view, 36, 'data')
  view.setUint32(40, dataLength, true)
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index] ?? 0))
    const integer = sample < 0 ? sample * 0x8000 : sample * 0x7fff
    view.setInt16(44 + index * bytesPerSample, Math.round(integer), true)
  }
  return wav
}

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index))
  }
}
