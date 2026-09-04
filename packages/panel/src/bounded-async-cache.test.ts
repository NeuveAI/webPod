import { describe, expect, test } from 'bun:test'
import { BoundedAsyncCache } from './bounded-async-cache'

describe('BoundedAsyncCache', () => {
  test('coalesces repeated reads and reuses the settled value within its TTL', async () => {
    let loads = 0
    const cache = new BoundedAsyncCache<string>({ maxEntries: 3, ttlMs: 1_000, now: () => 100 })
    const load = async () => {
      loads += 1
      return 'artwork samples'
    }

    const first = cache.get('same-resource', 'low', load)
    const duplicate = cache.get('same-resource', 'low', load)
    expect(duplicate).toBe(first)
    expect(await duplicate).toBe('artwork samples')
    expect(await cache.get('same-resource', 'high', load)).toBe('artwork samples')
    expect(loads).toBe(1)
    expect(cache.size).toBe(1)
  })

  test('supersedes speculative work when accepted input requests the same key', async () => {
    const cache = new BoundedAsyncCache<string>({ maxEntries: 4, ttlMs: 1_000 })
    let speculativeAborted = false
    const speculative = cache.get('album:1', 'low', (signal) => new Promise<string>((_resolve, reject) => {
      signal.addEventListener('abort', () => {
        speculativeAborted = true
        reject(new Error('superseded'))
      }, { once: true })
    }))
    await Promise.resolve()

    const accepted = cache.get('album:1', 'high', async (_signal, priority) => priority)

    await expect(speculative).rejects.toThrow('superseded')
    expect(await accepted).toBe('high')
    expect(speculativeAborted).toBe(true)
    expect(cache.priorityOf('album:1')).toBe('high')
  })

  test('aborts the least recently used request at its hard bound', async () => {
    const cache = new BoundedAsyncCache<string>({ maxEntries: 2, ttlMs: 1_000 })
    const aborted: string[] = []
    const pending = (key: string) => cache.get(key, 'low', (signal) => new Promise<string>((_resolve, reject) => {
      signal.addEventListener('abort', () => { aborted.push(key); reject(new Error(`aborted:${key}`)) }, { once: true })
    }))
    const first = pending('first')
    const second = pending('second')
    await Promise.resolve()
    void cache.get('second', 'low', async () => 'reused')
    const third = pending('third')

    await expect(first).rejects.toThrow('aborted:first')
    expect(cache.size).toBe(2)
    expect(aborted).toEqual(['first'])
    cache.clear()
    await Promise.allSettled([second, third])
  })

  test('expires and aborts stale work by TTL', async () => {
    let now = 0
    const cache = new BoundedAsyncCache<string>({ maxEntries: 2, ttlMs: 10, now: () => now })
    let aborted = false
    const stale = cache.get('stale', 'low', (signal) => new Promise<string>((_resolve, reject) => {
      signal.addEventListener('abort', () => { aborted = true; reject(new Error('expired')) }, { once: true })
    }))
    await Promise.resolve()
    now = 11

    expect(cache.size).toBe(0)
    await expect(stale).rejects.toThrow('expired')
    expect(aborted).toBe(true)
  })

  test('holds a rejected speculative key without refetching until accepted input retries it', async () => {
    const cache = new BoundedAsyncCache<string>({ maxEntries: 2, ttlMs: 1_000 })
    let calls = 0
    const load = async () => {
      calls += 1
      if (calls === 1) throw new Error('temporary failure')
      return 'recovered'
    }

    const speculative = cache.get('album:retry', 'low', load)
    await expect(speculative).rejects.toThrow('temporary failure')
    await Promise.resolve()
    await expect(cache.get('album:retry', 'low', load)).rejects.toThrow('temporary failure')
    expect(calls).toBe(1)
    expect(await cache.get('album:retry', 'high', load)).toBe('recovered')
    expect(calls).toBe(2)
  })
})
