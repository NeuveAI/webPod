import { expect, test } from 'bun:test'
import { createPageClock, type PageActivity } from './page-readiness'

test('page clocks use real operation timestamps, read without resetting, and freeze at completion', () => {
  let now = 100
  const clock = createPageClock(() => now)
  const operation = {}
  const loading: PageActivity = { status: 'loading', operationKey: operation, operationStartedAtMs: 20, loadedItems: 5, backgroundLoading: true }
  clock.observe(loading)
  expect(clock.read()).toMatchObject({ elapsedMs: 80, progressPercent: null, interactionReady: false })
  now = 150
  expect(clock.read().elapsedMs).toBe(130)
  clock.observe({ ...loading, loadedItems: 10 })
  expect(clock.read().elapsedMs).toBe(130)
  clock.observe({ ...loading, status: 'ready' })
  now = 900
  expect(clock.read()).toMatchObject({ elapsedMs: 130, interactionReady: true, backgroundLoading: true })
})
test('already-loading mounts without a known operation start report unknown elapsed time', () => {
  const clock = createPageClock(() => 4000)
  clock.observe({ status: 'buffering', operationKey: {}, loadedItems: 0, backgroundLoading: false })
  expect(clock.read()).toMatchObject({ elapsedMs: null, startedAtMs: null, progressPercent: null })
})
test('error settlement and provider replacement cannot inherit old operation clocks', () => {
  let now = 100
  const clock = createPageClock(() => now)
  const operationKey = {}
  clock.observe({ status: 'loading', operationKey, operationStartedAtMs: 90, loadedItems: 0, backgroundLoading: false })
  now = 120
  clock.observe({ status: 'error', operationKey, loadedItems: 0, backgroundLoading: false })
  now = 500
  expect(clock.read()).toMatchObject({ status: 'error', elapsedMs: 30, interactionReady: false })
  clock.observe({ status: 'loading', operationKey: {}, operationStartedAtMs: null, loadedItems: 0, backgroundLoading: false })
  expect(clock.read().elapsedMs).toBeNull()
})
