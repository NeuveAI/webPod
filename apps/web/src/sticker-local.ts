import type { ImportedTrack } from '@webpod/sticker-engine'
import type { ListeningObservation, StickerInventory, StickerPlacement } from '@webpod/stickers'
export type { ImportedTrack }
export interface LocalStickerOperations {
  inventory: { args: []; result: StickerInventory }
  importTracks: { args: [readonly ImportedTrack[], 'complete' | 'partial']; result: StickerInventory }
  markImportFailed: { args: []; result: StickerInventory }
  needsEnrichment: { args: [string]; result: boolean }
  enrichTrack: { args: [ImportedTrack]; result: void }
  observe: { args: [ListeningObservation]; result: StickerInventory }
  openPack: { args: [string]; result: StickerInventory }
  place: { args: [number, readonly StickerPlacement[]]; result: StickerInventory }
  exportBackup: { args: []; result: string }
  importBackup: { args: [string]; result: StickerInventory }
}
export type LocalStickerClient = { [K in keyof LocalStickerOperations]: (...args: LocalStickerOperations[K]['args']) => Promise<LocalStickerOperations[K]['result']> } & { dispose(): void }
export type StickerWorkerRequest = { [K in keyof LocalStickerOperations]: { id: number; command: K; args: LocalStickerOperations[K]['args'] } }[keyof LocalStickerOperations]
export type StickerWorkerResponse = { id: number; result?: unknown; error?: { code: string; message: string; status: number } }

/** One worker per runtime; Web Locks serialize workers across tabs. Termination
 * cancels queued locks and prevents old runtimes from starting further commands. */
export function createLocalStickerClient(): LocalStickerClient {
  const worker = new Worker(new URL('./sticker-worker.ts', import.meta.url), { type: 'module', name: 'webpod-stickers' })
  const pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>()
  let nextId = 0; let disposed = false
  function dispose() {
    if (disposed) return
    disposed = true; worker.terminate()
    for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error('Sticker storage was closed.')) }
    pending.clear()
  }
  worker.onmessage = ({ data }: MessageEvent<StickerWorkerResponse>) => {
    const request = pending.get(data.id); if (!request) return
    pending.delete(data.id); clearTimeout(request.timer)
    if (data.error) request.reject(Object.assign(new Error(data.error.message), { code: data.error.code, status: data.error.status }))
    else request.resolve(data.result)
  }
  worker.onerror = dispose; worker.onmessageerror = dispose
  function call<K extends keyof LocalStickerOperations>(command: K, args: LocalStickerOperations[K]['args']): Promise<LocalStickerOperations[K]['result']> {
    if (disposed) return Promise.reject(new Error('Sticker storage was closed.'))
    if (pending.size >= 32) return Promise.reject(new Error('Sticker storage is busy. Try again shortly.'))
    const id = ++nextId
    return new Promise((resolve, reject) => {
      const timer = setTimeout(dispose, 60_000)
      pending.set(id, { resolve: value => resolve(value as LocalStickerOperations[K]['result']), reject, timer })
      worker.postMessage({ id, command, args })
    })
  }
  return {
    inventory: () => call('inventory', []), importTracks: (...args) => call('importTracks', args), markImportFailed: () => call('markImportFailed', []),
    needsEnrichment: (...args) => call('needsEnrichment', args), enrichTrack: (...args) => call('enrichTrack', args), observe: (...args) => call('observe', args),
    openPack: (...args) => call('openPack', args), place: (...args) => call('place', args), exportBackup: () => call('exportBackup', []), importBackup: (...args) => call('importBackup', args), dispose,
  }
}
