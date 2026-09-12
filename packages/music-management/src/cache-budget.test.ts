import { expect, test } from 'bun:test'
import { BoundedAsyncCache } from './bounded-async-cache'
import { Relationships, estimateMetadataBytes } from './relationships'

test('byte pressure uses LFU and accounts replacement, expiry and clear', async () => {
  let now = 0
  const cache = new BoundedAsyncCache<object>({ maxEntries: 10, ttlMs: 100, maxBytes: 100, now: () => now })
  const a = await cache.get('a', 'high', async () => ({})); cache.setEstimatedBytes('a', a, 60)
  await cache.get('a', 'high', async () => ({}))
  const b = await cache.get('b', 'high', async () => ({})); cache.setEstimatedBytes('b', b, 30)
  const c = await cache.get('c', 'high', async () => ({})); cache.setEstimatedBytes('c', c, 40)
  expect(cache.peek('b')).toBeUndefined()
  expect(cache.estimatedBytes).toBe(100)
  cache.setEstimatedBytes('a', a, 20)
  expect(cache.estimatedBytes).toBe(60)
  now = 101; expect(cache.estimatedBytes).toBe(0)
  const fresh = await cache.get('a', 'high', async () => ({})); cache.setEstimatedBytes('a', fresh, 70)
  cache.setEstimatedBytes('a', a, 99)
  expect(cache.estimatedBytes).toBe(70)
  cache.clear(); expect(cache.estimatedBytes).toBe(0)
})

test('pins preserve active oversized results; final release drops them and restores the budget', async () => {
  const cache = new BoundedAsyncCache<object>({ maxEntries: 10, ttlMs: 1000, maxBytes: 100 })
  const reusable = await cache.get('small', 'high', async () => ({})); cache.setEstimatedBytes('small', reusable, 20)
  const active = await cache.get('active', 'high', async () => ({}))
  const release = cache.pin('active'); const releaseSecond = cache.pin('active')
  cache.setEstimatedBytes('active', active, 200)
  expect(cache.estimatedBytes).toBe(220)
  expect(cache.peek('small')).toBe(reusable)
  release(); release()
  expect(cache.peek('active')).toBe(active)
  releaseSecond()
  expect(cache.peek('active')).toBeUndefined()
  expect(cache.peek('small')).toBe(reusable)
  expect(cache.estimatedBytes).toBe(20)
})

test('low speculation cannot displace foreground retention at the entry or byte bound', async () => {
  const cache = new BoundedAsyncCache<object>({ maxEntries: 1, ttlMs: 1000, maxBytes: 100 })
  const foreground = await cache.get('foreground', 'high', async () => ({})); cache.setEstimatedBytes('foreground', foreground, 50)
  const speculative = await cache.get('speculative', 'low', async () => ({})); cache.setEstimatedBytes('speculative', speculative, 80)
  expect(cache.peek('foreground')).toBe(foreground)
  expect(cache.peek('speculative')).toBeUndefined()
  expect(cache.estimatedBytes).toBe(50)
})

test('active pagination may grow beyond retention budget without failing accepted navigation', async () => {
  let estimates = 0
  const relationships = new Relationships<string>(() => undefined, () => true, { maxBytes: 1000, estimateItemBytes: () => { estimates += 1; return 200 } })
  const loaded = await relationships.load('list', 3, 'high', async (cursor) => ({ items: [cursor ?? 'first'], next: cursor === 'third' ? null : cursor === 'second' ? 'third' : 'second', total: 3 }))
  expect(loaded).toEqual(['first', 'second', 'third'])
  expect(estimates).toBe(3)
  expect(relationships.cacheStats).toMatchObject({ entries: 0, estimatedBytes: 0, maxBytes: 1000 })
})

test('growing pinned speculation never evicts foreground data to meet the byte budget', async () => {
  const cache = new BoundedAsyncCache<object>({ maxEntries: 10, ttlMs: 1000, maxBytes: 100 })
  const high = await cache.get('high', 'high', async () => ({})); cache.setEstimatedBytes('high', high, 60)
  const low = await cache.get('low', 'low', async () => ({})); const release = cache.pin('low')
  cache.setEstimatedBytes('low', low, 60)
  expect(cache.peek('high')).toBe(high)
  expect(cache.estimatedBytes).toBe(120)
  release()
  expect(cache.peek('high')).toBe(high)
  expect(cache.peek('low')).toBeUndefined()
  expect(cache.estimatedBytes).toBe(60)
})

test('request-local completion survives eviction of an oversized completed entry', async () => {
  const relationships = new Relationships<string>(() => undefined, () => true, { maxBytes: 100, estimateItemBytes: () => 200 })
  const result = await relationships.loadResult('large', Infinity, 'high', async () => ({ items: ['finished'], next: null, total: 1 }))
  expect(result).toEqual({ items: ['finished'], complete: true })
  expect(relationships.complete('large')).toBe(false)
  expect(relationships.cacheStats.estimatedBytes).toBe(0)
})

test('each incoming item is measured once; peek and continuation do not remeasure old pages', async () => {
  let estimates = 0
  const relationships = new Relationships<{ id: string; nested: string[] }>(() => undefined, () => true, { maxBytes: 10000, estimateItemBytes: (item) => { estimates += 1; return estimateMetadataBytes(item) } })
  const first = { id: 'one', nested: ['small'] }
  await relationships.load('list', 1, 'high', async () => ({ items: [first], next: 'more', total: 2 }), (item) => item.id)
  const initialBytes = relationships.cacheStats.estimatedBytes
  for (let n = 0; n < 100; n++) { relationships.snapshot('list'); relationships.complete('list'); relationships.failed('list') }
  expect(estimates).toBe(1)
  await relationships.load('list', 2, 'high', async () => ({ items: [{ id: 'one', nested: ['larger replacement'] }, { id: 'two', nested: ['more'] }], next: null, total: 2 }), (item) => item.id)
  expect(estimates).toBe(3)
  expect(relationships.snapshot('list')).toHaveLength(2)
  expect(relationships.cacheStats.estimatedBytes).toBeGreaterThan(initialBytes)
  relationships.clear(); expect(relationships.cacheStats.estimatedBytes).toBe(0)
})

test('failed next page preserves charged prefix and accepted retry adds only new data', async () => {
  const relationships = new Relationships<string>(() => undefined, () => true, { maxBytes: 10000, estimateItemBytes: () => 100 })
  await relationships.load('list', 1, 'high', async () => ({ items: ['first'], next: 'more', total: 2 }))
  const prefixBytes = relationships.cacheStats.estimatedBytes
  await expect(relationships.load('list', 2, 'high', async () => { throw new Error('page failed') })).rejects.toThrow('page failed')
  expect(relationships.cacheStats.estimatedBytes).toBe(prefixBytes)
  expect(relationships.failed('list')).toBe(true)
  await relationships.load('list', 2, 'high', async () => ({ items: ['second'], next: null, total: 2 }))
  expect(relationships.cacheStats.estimatedBytes).toBe(prefixBytes + 108 - 'more'.length * 2)
})

test('metadata estimates include deep arrays and strings without following cycles indefinitely', () => {
  const small = { artwork: { variants: [{ url: 'x' }] } }
  const large = { artwork: { variants: [{ url: 'x'.repeat(1000) }] } }
  expect(estimateMetadataBytes(large) - estimateMetadataBytes(small)).toBe(1998)
  const cycle: { child?: object } = {}; cycle.child = cycle
  expect(estimateMetadataBytes(cycle)).toBeGreaterThan(0)
})

test('invalid budgets are rejected', () => {
  for (const maxBytes of [0, -1, NaN, Infinity, 0.5]) expect(() => new BoundedAsyncCache({ maxEntries: 1, ttlMs: 1, maxBytes })).toThrow()
})
