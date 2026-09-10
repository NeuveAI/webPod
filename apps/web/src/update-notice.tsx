import { useEffect } from 'react'
import { useAtomValue } from 'jotai'
import { Button } from '@webpod/ui/components/button'
import { availableUpdateAtom, dismissUpdate, mountUpdateMonitor, reloadForUpdate, updateReloadingAtom, updateStore } from './update-state'

/** Nonmodal deployment notice: arrival never steals focus or interrupts playback. */
export function UpdateNotice() {
  useEffect(mountUpdateMonitor, [])
  const build = useAtomValue(availableUpdateAtom, { store: updateStore })
  const reloading = useAtomValue(updateReloadingAtom, { store: updateStore })
  if (build === null) return null
  return <aside aria-label="App update" className="fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-lg flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl border border-white/15 bg-[#182027] px-4 py-3 text-[#f5f2ea] shadow-xl">
    <div role="status" aria-live="polite" aria-atomic="true">
      <p className="text-sm font-semibold">A new version is ready</p>
      <p className="mt-0.5 text-xs text-[#c5cbd0]">Reloading pauses playback.</p>
    </div>
    <div className="flex gap-2">
      <Button type="button" variant="ghost" className="min-h-11 min-w-11 px-3 text-[#f5f2ea] hover:bg-white/10 hover:text-white" onClick={dismissUpdate} disabled={reloading}>Later</Button>
      <Button type="button" className="min-h-11 min-w-11 bg-[#f5f2ea] px-4 text-[#182027] hover:bg-white" onClick={reloadForUpdate} disabled={reloading}>Reload</Button>
    </div>
  </aside>
}
