import { afterAll, beforeEach, describe, expect, test } from 'bun:test'

import type { InteractionVoiceSpec } from './interaction-audio'
import {
  createBrowserInteractionAudioBackend,
  renderInteractionAudioPreviewWav,
} from './web-audio-backend'

const originalAudioContext = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext')
const originalOfflineAudioContext = Object.getOwnPropertyDescriptor(
  globalThis,
  'OfflineAudioContext',
)

beforeEach(() => {
  FakeAudioContext.latest = null
  FakeOfflineAudioContext.latest = null
  Object.defineProperty(globalThis, 'AudioContext', {
    configurable: true,
    writable: true,
    value: FakeAudioContext,
  })
  Object.defineProperty(globalThis, 'OfflineAudioContext', {
    configurable: true,
    writable: true,
    value: FakeOfflineAudioContext,
  })
})

afterAll(() => {
  if (originalAudioContext === undefined) {
    Reflect.deleteProperty(globalThis, 'AudioContext')
  } else {
    Object.defineProperty(globalThis, 'AudioContext', originalAudioContext)
  }
  if (originalOfflineAudioContext === undefined) {
    Reflect.deleteProperty(globalThis, 'OfflineAudioContext')
  } else {
    Object.defineProperty(
      globalThis,
      'OfflineAudioContext',
      originalOfflineAudioContext,
    )
  }
})

describe('browser interaction audio graph', () => {
  test('builds a compressed transient graph and releases every per-voice node', async () => {
    const backend = createBrowserInteractionAudioBackend()
    const context = FakeAudioContext.latest
    if (backend === null || context === null) throw new Error('Audio backend did not construct')

    expect(context.options?.latencyHint).toBe('interactive')
    expect(context.gains).toHaveLength(1)
    expect(context.compressors).toHaveLength(1)
    const master = context.gains[0]
    const compressor = context.compressors[0]
    if (master === undefined || compressor === undefined) throw new Error('Master graph missing')
    expect(master.gain.values).toContainEqual(['set', 0.62, 0.5])
    expect(compressor.threshold.values).toContainEqual(['set', -18, 0.5])
    expect(compressor.ratio.values).toContainEqual(['set', 8, 0.5])
    expect(master.connections).toEqual([compressor])
    expect(compressor.connections).toEqual([context.destination])

    let ended = 0
    const voice = backend.schedule(wheelSpec(), () => {
      ended += 1
    })
    const source = context.sources[0]
    const filter = context.filters[0]
    const envelope = context.gains[1]
    if (source === undefined || filter === undefined || envelope === undefined) {
      throw new Error('Transient graph missing')
    }
    expect(source.connections).toEqual([filter])
    expect(filter.connections).toEqual([envelope])
    expect(envelope.connections).toEqual([master])
    expect(filter.type).toBe('bandpass')
    expect(filter.frequency.values).toContainEqual(['set', 3000, 1])
    expect(envelope.gain.values).toEqual([
      ['set', 0.0001, 1],
      ['linear', 0.05, 1.0008],
      ['exponential', 0.0001, 1.008],
    ])
    expect(source.starts).toEqual([1])
    expect(source.stops).toEqual([1.009])

    voice.stop()
    voice.stop()
    expect(ended).toBe(1)
    expect([source, filter, envelope].every((node) => node.disconnected)).toBeTrue()

    await backend.suspend()
    expect(backend.state).toBe('suspended')
    await backend.resume()
    expect(backend.state).toBe('running')
    await backend.close()
    expect(backend.state).toBe('closed')
    expect(master.disconnected).toBeTrue()
    expect(compressor.disconnected).toBeTrue()
  })

  test('uses deterministic bounded procedural buffers with no asset dependency', () => {
    const backend = createBrowserInteractionAudioBackend()
    const context = FakeAudioContext.latest
    if (backend === null || context === null) throw new Error('Audio backend did not construct')

    const specs: InteractionVoiceSpec[] = [
      wheelSpec(),
      { ...wheelSpec(), startTimeSeconds: 1.04 },
      { ...wheelSpec(), kind: 'select', durationSeconds: 0.016, filter: 'lowpass' },
      { ...wheelSpec(), kind: 'button', durationSeconds: 0.012, filter: 'lowpass' },
    ]
    for (const spec of specs) backend.schedule(spec, () => undefined)

    expect(context.buffers).toHaveLength(3)
    expect(context.sources[0]?.buffer).toBe(context.sources[1]?.buffer)
    for (const buffer of context.buffers) {
      const samples = buffer.getChannelData(0)
      expect(samples.length).toBeGreaterThan(0)
      expect(samples.every((sample) => Number.isFinite(sample))).toBeTrue()
      expect(Math.max(...samples.map(Math.abs))).toBeLessThanOrEqual(1)
      const quarter = Math.max(1, Math.floor(samples.length / 4))
      expect(meanMagnitude(samples.slice(0, quarter))).toBeGreaterThan(
        meanMagnitude(samples.slice(-quarter)),
      )
    }
  })

  test('the owner preview renders the production graph into a PCM WAV', async () => {
    const wav = await renderInteractionAudioPreviewWav()
    const context = FakeOfflineAudioContext.latest
    if (context === null) throw new Error('Offline preview context did not construct')
    const view = new DataView(wav)

    expect(readAscii(view, 0, 4)).toBe('RIFF')
    expect(readAscii(view, 8, 4)).toBe('WAVE')
    expect(readAscii(view, 36, 4)).toBe('data')
    expect(view.getUint16(20, true)).toBe(1)
    expect(view.getUint16(22, true)).toBe(1)
    expect(view.getUint32(24, true)).toBe(48_000)
    expect(view.getUint16(34, true)).toBe(16)
    expect(wav.byteLength).toBe(44 + 48_000 * 2)
    expect(context.sources).toHaveLength(8)
    expect(context.buffers).toHaveLength(3)
    expect(context.compressors).toHaveLength(1)
  })
})

function wheelSpec(): InteractionVoiceSpec {
  return {
    kind: 'wheel',
    startTimeSeconds: 1,
    durationSeconds: 0.008,
    filter: 'bandpass',
    filterFrequencyHz: 3000,
    filterQ: 0.9,
    peakGain: 0.05,
    playbackRate: 1,
  }
}

function meanMagnitude(samples: Float32Array): number {
  let total = 0
  for (const sample of samples) total += Math.abs(sample)
  return total / samples.length
}

function readAscii(view: DataView, offset: number, length: number): string {
  let value = ''
  for (let index = 0; index < length; index += 1) {
    value += String.fromCharCode(view.getUint8(offset + index))
  }
  return value
}

type ParamWrite = readonly [
  'set' | 'linear' | 'exponential',
  number,
  number,
]

class FakeAudioParam {
  readonly values: ParamWrite[] = []

  setValueAtTime(value: number, time: number): void {
    this.values.push(['set', value, time])
  }

  linearRampToValueAtTime(value: number, time: number): void {
    this.values.push(['linear', value, time])
  }

  exponentialRampToValueAtTime(value: number, time: number): void {
    this.values.push(['exponential', value, time])
  }
}

class FakeAudioNode {
  readonly connections: FakeAudioNode[] = []
  disconnected = false

  connect(destination: FakeAudioNode): FakeAudioNode {
    this.connections.push(destination)
    return destination
  }

  disconnect(): void {
    this.disconnected = true
  }
}

class FakeGainNode extends FakeAudioNode {
  readonly gain = new FakeAudioParam()
}

class FakeCompressorNode extends FakeAudioNode {
  readonly threshold = new FakeAudioParam()
  readonly knee = new FakeAudioParam()
  readonly ratio = new FakeAudioParam()
  readonly attack = new FakeAudioParam()
  readonly release = new FakeAudioParam()
}

class FakeFilterNode extends FakeAudioNode {
  type = 'lowpass'
  readonly frequency = new FakeAudioParam()
  readonly Q = new FakeAudioParam()
}

class FakeAudioBuffer {
  private readonly channels: Float32Array[]

  constructor(
    channelCount: number,
    frameCount: number,
    readonly sampleRate: number,
  ) {
    this.channels = Array.from({ length: channelCount }, () => new Float32Array(frameCount))
  }

  getChannelData(channel: number): Float32Array {
    const samples = this.channels[channel]
    if (samples === undefined) throw new Error(`Missing channel ${channel}`)
    return samples
  }
}

class FakeBufferSourceNode extends FakeAudioNode {
  buffer: FakeAudioBuffer | null = null
  readonly playbackRate = new FakeAudioParam()
  onended: (() => void) | null = null
  readonly starts: number[] = []
  readonly stops: number[] = []

  start(time: number): void {
    this.starts.push(time)
  }

  stop(time?: number): void {
    this.stops.push(time ?? 0)
  }
}

class FakeAudioContext {
  static latest: FakeAudioContext | null = null

  state: AudioContextState = 'suspended'
  currentTime = 0.5
  readonly sampleRate = 48_000
  readonly destination = new FakeAudioNode()
  readonly gains: FakeGainNode[] = []
  readonly compressors: FakeCompressorNode[] = []
  readonly filters: FakeFilterNode[] = []
  readonly sources: FakeBufferSourceNode[] = []
  readonly buffers: FakeAudioBuffer[] = []

  constructor(readonly options?: AudioContextOptions) {
    FakeAudioContext.latest = this
  }

  createGain(): FakeGainNode {
    const node = new FakeGainNode()
    this.gains.push(node)
    return node
  }

  createDynamicsCompressor(): FakeCompressorNode {
    const node = new FakeCompressorNode()
    this.compressors.push(node)
    return node
  }

  createBiquadFilter(): FakeFilterNode {
    const node = new FakeFilterNode()
    this.filters.push(node)
    return node
  }

  createBufferSource(): FakeBufferSourceNode {
    const node = new FakeBufferSourceNode()
    this.sources.push(node)
    return node
  }

  createBuffer(channels: number, frames: number, sampleRate: number): FakeAudioBuffer {
    const buffer = new FakeAudioBuffer(channels, frames, sampleRate)
    this.buffers.push(buffer)
    return buffer
  }

  async resume(): Promise<void> {
    this.state = 'running'
  }

  async suspend(): Promise<void> {
    this.state = 'suspended'
  }

  async close(): Promise<void> {
    this.state = 'closed'
  }
}

class FakeOfflineAudioContext extends FakeAudioContext {
  static override latest: FakeOfflineAudioContext | null = null

  constructor(
    readonly channelCount: number,
    readonly frameCount: number,
    sampleRate: number,
  ) {
    super()
    if (sampleRate !== this.sampleRate) throw new Error('Unexpected preview sample rate')
    FakeOfflineAudioContext.latest = this
  }

  async startRendering(): Promise<FakeAudioBuffer> {
    return new FakeAudioBuffer(this.channelCount, this.frameCount, this.sampleRate)
  }
}
