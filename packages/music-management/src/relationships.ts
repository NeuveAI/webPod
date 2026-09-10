import type { Cursor, Page } from '@webpod/providers'
import { BoundedAsyncCache } from './bounded-async-cache'

interface RelationshipState<T> {
  items: readonly T[]
  next: Cursor | null | undefined
  flight?: Promise<void>
  failed: boolean
  pages: number
  readonly signal: AbortSignal
  itemBytes: number
  readonly sizes: Map<string, number> | undefined
}

export interface RelationshipCacheOptions<T> {
  readonly maxBytes?: number
  readonly maxEntries?: number
  readonly ttlMs?: number
  readonly estimateItemBytes?: (item: T) => number
}

/** Conservative metadata estimate; does not measure decoded media or engine-specific heap overhead. */
export function estimateMetadataBytes(value: unknown): number {
  const visited = new Set<object>()
  const pending: unknown[] = [value]
  let bytes = 0
  while (pending.length > 0) {
    const item = pending.pop()
    if (typeof item === 'string') { bytes += 24 + item.length * 2; continue }
    if (item === null || typeof item !== 'object') { bytes += 8; continue }
    if (visited.has(item)) { bytes += 8; continue }
    visited.add(item)
    bytes += 64
    if (Array.isArray(item)) { bytes += item.length * 8; for (const child of item) pending.push(child) }
    else for (const [key, child] of Object.entries(item)) { bytes += 32 + key.length * 2; pending.push(child) }
  }
  return bytes
}

/** One bounded LFU entry owns both the visible prefix and its continuation. */
export class Relationships<T> {
  readonly #cache: BoundedAsyncCache<RelationshipState<T>>
  readonly #estimate: (item: T) => number
  constructor(readonly notify: () => void, readonly isCurrent: () => boolean, options: RelationshipCacheOptions<T> = {}) {
    this.#cache = new BoundedAsyncCache({ maxEntries: options.maxEntries ?? 512, ttlMs: options.ttlMs ?? 300_000, maxBytes: options.maxBytes ?? 64 * 1024 * 1024 })
    this.#estimate = options.estimateItemBytes ?? estimateMetadataBytes
  }
  get cacheStats(): { readonly entries: number; readonly estimatedBytes: number; readonly maxBytes: number } {
    return { entries: this.#cache.size, estimatedBytes: this.#cache.estimatedBytes, maxBytes: this.#cache.maxBytes }
  }
  snapshot(key: string): readonly T[] | undefined { return this.#cache.peek(key)?.items }
  failed(key: string): boolean { return this.#cache.peek(key)?.failed ?? false }
  complete(key: string): boolean { return this.#cache.peek(key)?.next === null }
  clear(): void { this.#cache.clear() }

  async load(...args: Parameters<Relationships<T>['loadResult']>): Promise<readonly T[]> {
    return (await this.loadResult(...args)).items
  }

  /** Concurrent requests share each page; accepted navigation resumes the saved cursor. */
  async loadResult(key: string, target: number, priority: 'low' | 'high', page: (cursor: Cursor | undefined, limit: number, signal: AbortSignal) => Promise<Page<T>>, unique?: (item: T) => string): Promise<{ readonly items: readonly T[]; readonly complete: boolean }> {
    const pending = this.#cache.get(key, priority, async (signal) => ({ items: [], next: undefined, failed: false, pages: 0, signal, itemBytes: 0, sizes: unique === undefined ? undefined : new Map() }), { supersedeLowPriority: false })
    const release = this.#cache.pin(key)
    try {
      const state = await pending
      const charge = (): void => { this.#cache.setEstimatedBytes(key, state, 512 + key.length * 2 + state.itemBytes + (state.next?.length ?? 0) * 2) }
      charge()
      const current = (): void => { state.signal.throwIfAborted(); if (!this.isCurrent()) throw new DOMException('Navigation ended', 'AbortError') }
      current()
      if (priority === 'low' && state.failed) return { items: state.items, complete: state.next === null }
      while (state.next !== null && state.items.length < target) {
        if (state.flight !== undefined) { await state.flight; current(); continue }
        state.flight = (async () => {
          try {
            current()
            const result = await page(state.next ?? undefined, Math.min(15, target - state.items.length), state.signal)
            current()
            state.pages += 1
            if (state.pages > 1000 || (result.next !== null && result.next === state.next)) throw new Error('Relationship pagination did not terminate')
            const items = [...state.items, ...result.items]
            const estimates = result.items.map((item) => {
              const bytes = this.#estimate(item) + 8
              if (!Number.isSafeInteger(bytes) || bytes < 8) throw new Error('Invalid relationship metadata estimate')
              return { item, bytes }
            })
            for (const { item, bytes } of estimates) {
              const identity = unique?.(item)
              if (identity !== undefined && state.sizes !== undefined) {
                const previous = state.sizes.get(identity)
                state.itemBytes += bytes - (previous ?? 0) + (previous === undefined ? 64 + identity.length * 2 : 0)
                state.sizes.set(identity, bytes)
              } else state.itemBytes += bytes
            }
            state.items = unique === undefined ? items : [...new Map(items.map((item) => [unique(item), item])).values()]
            state.next = result.next
            state.failed = false
            charge()
            this.notify()
          } catch (error) {
            if (!state.signal.aborted && this.isCurrent()) { state.failed = true; this.notify() }
            throw error
          } finally { state.flight = undefined }
        })()
        await state.flight
        current()
      }
      // Callers own this result even if release evicts its oversized cache
      // entry. Cache residence must never stand in for pagination completion.
      return { items: state.items, complete: state.next === null }
    } finally { release() }
  }
}
