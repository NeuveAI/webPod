export interface BoundedAsyncCacheOptions {
  readonly maxEntries: number
  readonly ttlMs: number
  readonly now?: () => number
  /** Estimated retained metadata, not a browser/process heap limit. */
  readonly maxBytes?: number
}

interface CacheEntry<Value> {
  readonly controller: AbortController
  readonly createdAt: number
  pins: number
  frequency: number
  value?: Value
  lastAccessedAt: number
  priority: 'low' | 'high'
  rejected: boolean
  settled: boolean
  readonly promise: Promise<Value>
  estimatedBytes: number
}

/**
 * A priority-aware LFU (recency breaks ties) for relationship, artwork, and intent prefetch work.
 * Pending, resolved, and rejected values share the same bound. A rejected
 * speculative request remains cached until accepted input retries it, which
 * prevents a render or progressive-library update from becoming a request loop.
 */
export class BoundedAsyncCache<Value> {
  readonly #entries = new Map<string, CacheEntry<Value>>()
  readonly #maxEntries: number
  readonly #ttlMs: number
  readonly #now: () => number
  readonly #maxBytes: number
  #estimatedBytes = 0

  constructor(options: BoundedAsyncCacheOptions) {
    if (!Number.isInteger(options.maxEntries) || options.maxEntries < 1) throw new Error('maxEntries must be a positive integer')
    if (!Number.isFinite(options.ttlMs) || options.ttlMs <= 0) throw new Error('ttlMs must be positive')
    if (options.maxBytes !== undefined && (!Number.isSafeInteger(options.maxBytes) || options.maxBytes < 1)) throw new Error('maxBytes must be a positive safe integer')
    this.#maxEntries = options.maxEntries
    this.#ttlMs = options.ttlMs
    this.#now = options.now ?? Date.now
    this.#maxBytes = options.maxBytes ?? Infinity
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
        this.#remove(key, existing)
        return this.get(key, 'high', load, options)
      }
      if (priority === 'high' && existing.priority === 'low' && !existing.settled && options.supersedeLowPriority !== false) {
        // Accepted input must not sit behind speculative work. Abort the low
        // priority request and start a fresh high-priority request that the
        // caller can observe independently.
        existing.controller.abort()
        this.#remove(key, existing)
        return this.get(key, 'high', load, options)
      }
      existing.frequency += 1
      existing.lastAccessedAt = now
      if (priority === 'high') existing.priority = 'high'
      this.#entries.delete(key)
      this.#entries.set(key, existing)
      return existing.promise
    }

    const controller = new AbortController()
    const promise = Promise.resolve().then(() => load(controller.signal, priority))
    const entry: CacheEntry<Value> = { controller, createdAt: now, lastAccessedAt: now, priority, pins: 0, frequency: 1, rejected: false, settled: false, promise, estimatedBytes: 0 }
    void promise.then((value) => { entry.value = value }, () => undefined)
    void promise.finally(() => { entry.settled = true }).catch(() => undefined)
    this.#entries.set(key, entry)
    void promise.catch(() => {
      entry.rejected = true
    })
    this.#evictOverflow(key)
    return promise
  }

  /** Reads already resolved data without increasing speculative access frequency. */
  peek(key: string): Value | undefined {
    this.#pruneExpired(this.#now())
    return this.#entries.get(key)?.value
  }

  /** Active pagination owns its entry until it releases it; child loads cannot evict their parent. */
  pin(key: string): () => void {
    const entry = this.#entries.get(key)
    if (entry === undefined) return () => undefined
    entry.pins += 1
    let released = false
    return () => {
      if (released) return
      released = true
      entry.pins = Math.max(0, entry.pins - 1)
      this.#evictOverflow()
    }
  }

  /** Charge mutations at ingestion, only while this exact resolved value still owns the key. */
  setEstimatedBytes(key: string, value: Value, bytes: number): void {
    if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error('estimated bytes must be a non-negative safe integer')
    const entry = this.#entries.get(key)
    if (entry === undefined || entry.value !== value) return
    this.#estimatedBytes += bytes - entry.estimatedBytes
    entry.estimatedBytes = bytes
    this.#evictOverflow(key)
  }

  get estimatedBytes(): number { this.#pruneExpired(this.#now()); return this.#estimatedBytes }
  get maxBytes(): number { return this.#maxBytes }

  clear(): void {
    for (const entry of this.#entries.values()) entry.controller.abort()
    this.#entries.clear()
    this.#estimatedBytes = 0
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
      if (entry.pins > 0 || now - entry.lastAccessedAt < this.#ttlMs) continue
      entry.controller.abort()
      this.#remove(key, entry)
    }
  }

  #remove(key: string, entry: CacheEntry<Value>): void {
    this.#entries.delete(key)
    this.#estimatedBytes -= entry.estimatedBytes
  }

  #evictOverflow(protectedKey?: string): void {
    // Oversized completed results can still be returned to their accepted
    // caller. Retaining them must not evict every smaller reusable entry.
    for (const [key, entry] of this.#entries) {
      if (entry.pins > 0 || entry.estimatedBytes <= this.#maxBytes) continue
      entry.controller.abort()
      this.#remove(key, entry)
    }
    let pinnedBytes = 0
    for (const entry of this.#entries.values()) if (entry.pins > 0) pinnedBytes += entry.estimatedBytes
    // Evicting reusable values cannot satisfy a budget already exceeded by
    // active owners alone. Defer byte eviction until an owner releases.
    while (this.#entries.size > this.#maxEntries || pinnedBytes <= this.#maxBytes && this.#estimatedBytes > this.#maxBytes) {
      let oldest: [string, CacheEntry<Value>] | undefined
      for (const candidate of this.#entries) {
        if (candidate[0] === protectedKey || candidate[1].pins > 0) continue
        if (protectedKey !== undefined && this.#entries.get(protectedKey)?.priority === 'low' && candidate[1].priority === 'high') continue
        if (oldest === undefined || candidate[1].priority === 'low' && oldest[1].priority === 'high' || candidate[1].priority === oldest[1].priority && candidate[1].frequency < oldest[1].frequency) oldest = candidate
      }
      if (oldest === undefined) {
        const incoming = protectedKey === undefined ? undefined : this.#entries.get(protectedKey)
        if (protectedKey !== undefined && incoming?.priority === 'low' && incoming.pins === 0) { incoming.controller.abort(); this.#remove(protectedKey, incoming) }
        // Active owners may temporarily exceed retention limits. Their final
        // release retries eviction; do not cancel accepted pagination.
        return
      }
      oldest[1].controller.abort()
      this.#remove(oldest[0], oldest[1])
    }
  }
}
