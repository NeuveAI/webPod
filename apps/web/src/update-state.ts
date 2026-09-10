import { QueryClient } from '@tanstack/query-core'
import { atom, createStore } from 'jotai'
import { APP_BUILD_ID, isBuildIdentity } from './build-identity'

const CHECK_INTERVAL_MS = 60_000
const REQUEST_TIMEOUT_MS = 5_000
const VERSION_QUERY = ['app-deployment-version'] as const
const latestBuildAtom = atom<string | null>(null)
const dismissedBuildsAtom = atom<ReadonlySet<string>>(new Set<string>())
export const updateStore = createStore()
export const updateReloadingAtom = atom(false)
export const availableUpdateAtom = atom((get) => {
  const build = get(latestBuildAtom)
  return build !== null && !get(dismissedBuildsAtom).has(build) ? build : null
})

/** Dismiss only this deployment for this document lifetime, without storage writes. */
export function dismissUpdate(): void {
  const build = updateStore.get(availableUpdateAtom)
  if (build !== null) updateStore.set(dismissedBuildsAtom, new Set([...updateStore.get(dismissedBuildsAtom), build]))
}

/** Explicit navigation retains the route, user parameters, fragment and local data. */
export function reloadForUpdate(): void {
  const build = updateStore.get(availableUpdateAtom)
  if (build === null || updateStore.get(updateReloadingAtom)) return
  updateStore.set(updateReloadingAtom, true)
  const url = new URL(window.location.href)
  url.searchParams.set('_webpod_version', build)
  window.location.replace(url.href)
}

let activeMonitor: { users: number; stop: () => void } | null = null
/** Root-shell lifetime; duplicate mounts share one query and one visible-only timer. */
export function mountUpdateMonitor(): () => void {
  if (APP_BUILD_ID === 'development' || typeof document === 'undefined') return () => {}
  const monitor = activeMonitor ??= { users: 0, stop: startMonitor() }
  monitor.users += 1
  return () => {
    monitor.users -= 1
    if (monitor.users === 0) { monitor.stop(); activeMonitor = null }
  }
}

function startMonitor(): () => void {
  const client = new QueryClient()
  let stopped = false
  let inFlight = false
  let checkAgain = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const visibleAndOnline = () => !document.hidden && navigator.onLine
  const clearTimer = () => { clearTimeout(timer); timer = undefined }
  const schedule = () => {
    clearTimer()
    if (!stopped && visibleAndOnline()) timer = setTimeout(check, CHECK_INTERVAL_MS)
  }
  const check = (): void => {
    clearTimer()
    if (stopped || !visibleAndOnline()) return
    if (inFlight) { checkAgain = true; return }
    inFlight = true
    void client.fetchQuery({
      queryKey: VERSION_QUERY,
      staleTime: 0,
      gcTime: 0,
      retry: false,
      networkMode: 'always',
      queryFn: async ({ signal }) => {
        const controller = new AbortController()
        const abort = () => controller.abort()
        signal.addEventListener('abort', abort, { once: true })
        const timeout = setTimeout(abort, REQUEST_TIMEOUT_MS)
        try {
          const response = await fetch('/api/version', { cache: 'no-store', signal: controller.signal, headers: { accept: 'application/json' } })
          if (!response.ok) throw new Error('Version check failed')
          const value: unknown = await response.json()
          if (typeof value !== 'object' || value === null || !('buildId' in value) || !isBuildIdentity(value.buildId)) throw new Error('Invalid build identity')
          return value.buildId
        } finally { clearTimeout(timeout); signal.removeEventListener('abort', abort) }
      },
    }).then((build) => {
      if (!stopped && visibleAndOnline()) updateStore.set(latestBuildAtom, build === APP_BUILD_ID ? null : build)
    }).catch(() => { /* Offline, aborted and malformed checks do not announce an update. */ }).finally(() => {
      inFlight = false
      if (checkAgain) { checkAgain = false; check() } else schedule()
    })
  }
  const suspend = () => { clearTimer(); checkAgain = false; void client.cancelQueries({ queryKey: VERSION_QUERY }) }
  const visibility = () => { if (visibleAndOnline()) check(); else suspend() }
  document.addEventListener('visibilitychange', visibility)
  window.addEventListener('online', check)
  window.addEventListener('offline', suspend)
  check()
  return () => {
    stopped = true
    clearTimer()
    document.removeEventListener('visibilitychange', visibility)
    window.removeEventListener('online', check)
    window.removeEventListener('offline', suspend)
    void client.cancelQueries({ queryKey: VERSION_QUERY })
    client.clear()
  }
}
