export interface BoundedAsyncCacheOptions {
  readonly maxEntries: number
  readonly ttlMs: number
  readonly now?: () => number
}

interface CacheEntry<Value> {
  readonly controller: AbortController
  readonly createdAt: number
  lastAccessedAt: number
  priority: 'low' | 'high'
  rejected: boolean
  settled: boolean
  readonly promise: Promise<Value>
}

/**
 * A small abort-aware LRU for relationship, artwork, and intent prefetch work.
 * Pending, resolved, and rejected values share the same bound. A rejected
 * speculative request remains cached until accepted input retries it, which
 * prevents a render or progressive-library update from becoming a request loop.
 */
export class BoundedAsyncCache<Value> {
  readonly #entries = new Map<string, CacheEntry<Value>>()
  readonly #maxEntries: number
  readonly #ttlMs: number
  readonly #now: () => number

  constructor(options: BoundedAsyncCacheOptions) {
    if (!Number.isInteger(options.maxEntries) || options.maxEntries < 1) throw new Error('maxEntries must be a positive integer')
    if (!Number.isFinite(options.ttlMs) || options.ttlMs <= 0) throw new Error('ttlMs must be positive')
    this.#maxEntries = options.maxEntries
    this.#ttlMs = options.ttlMs
    this.#now = options.now ?? Date.now
  }

  get(
    key: string,
    priority: 'low' | 'high',
    load: (signal: AbortSignal, priority: 'low' | 'high') => Promise<Value>,
    options: { readonly supersedeLowPriority?: boolean } = {},
  ): Promise<Value> {
    const now = this.#now()
    this.#pruneExpired(now)
    const existing = this.#entries.get(key)
    if (existing !== undefined) {
      if (priority === 'high' && existing.rejected) {
        this.#entries.delete(key)
        return this.get(key, 'high', load, options)
      }
      if (priority === 'high' && existing.priority === 'low' && !existing.settled && options.supersedeLowPriority !== false) {
        // Accepted input must not sit behind speculative work. Abort the low
        // priority request and start a fresh high-priority request that the
        // caller can observe independently.
        existing.controller.abort()
        this.#entries.delete(key)
        return this.get(key, 'high', load, options)
      }
      existing.lastAccessedAt = now
      if (priority === 'high') existing.priority = 'high'
      this.#entries.delete(key)
      this.#entries.set(key, existing)
      return existing.promise
    }

    const controller = new AbortController()
    const promise = Promise.resolve().then(() => load(controller.signal, priority))
    const entry: CacheEntry<Value> = { controller, createdAt: now, lastAccessedAt: now, priority, rejected: false, settled: false, promise }
    void promise.finally(() => { entry.settled = true }).catch(() => undefined)
    this.#entries.set(key, entry)
    void promise.catch(() => {
      entry.rejected = true
    })
    this.#evictOverflow()
    return promise
  }

  clear(): void {
    for (const entry of this.#entries.values()) entry.controller.abort()
    this.#entries.clear()
  }

  get size(): number {
    this.#pruneExpired(this.#now())
    return this.#entries.size
  }

  priorityOf(key: string): 'low' | 'high' | null {
    return this.#entries.get(key)?.priority ?? null
  }

  #pruneExpired(now: number): void {
    for (const [key, entry] of this.#entries) {
      if (now - entry.lastAccessedAt < this.#ttlMs) continue
      entry.controller.abort()
      this.#entries.delete(key)
    }
  }

  #evictOverflow(): void {
    while (this.#entries.size > this.#maxEntries) {
      const oldest = this.#entries.entries().next().value as [string, CacheEntry<Value>] | undefined
      if (oldest === undefined) return
      oldest[1].controller.abort()
      this.#entries.delete(oldest[0])
    }
  }
}
