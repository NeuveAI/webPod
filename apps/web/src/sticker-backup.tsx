import { atom, useAtomValue } from 'jotai'
import { useRef } from 'react'
import { deviceStore, stickerInventoryAtom } from '@webpod/state'
import { exportStickerBackup, importStickerBackup } from './sticker-runtime'
import { cancelStickerInteraction } from './sticker-interaction'
import { resetStickerEditor } from './sticker-editor-model'

const backupState = atom<{ busy: boolean; message: string | null; restore: File | null }>({ busy: false, message: null, restore: null })
const MAX_BACKUP_BYTES = 8 * 1024 * 1024
const button = 'mr-2 min-h-11 rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50'
/** Backups deliberately require a second gesture before replacing the local collection. */
export function StickerBackupControls() {
  const state = useAtomValue(backupState, { store: deviceStore })
  const inventory = useAtomValue(stickerInventoryAtom, { store: deviceStore })
  const input = useRef<HTMLInputElement>(null)
  const run = async (operation: () => Promise<void>): Promise<void> => {
    deviceStore.set(backupState, { busy: true, message: null, restore: null })
    try { await operation() }
    catch { deviceStore.set(backupState, { busy: false, message: 'Backup could not complete. Check the file and browser storage, then try again.', restore: null }); return }
    deviceStore.set(backupState, { busy: false, message: 'Backup complete.', restore: null })
  }
  return <div className="space-y-3 text-muted-foreground" aria-label="Sticker backup">
    <p className="text-xs">Saved in this browser. Export to keep a copy or move browsers.</p>
    <button type="button" className={button} disabled={state.busy || inventory === null} onClick={() => { void run(async () => {
      const json = await exportStickerBackup()
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
      const link = document.createElement('a'); link.href = url; link.download = 'webpod-stickers.json'; link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }) }}>Export stickers</button>
    <button type="button" className={button} disabled={state.busy} onClick={() => input.current?.click()}>Import stickers</button>
    <input ref={input} type="file" accept=".json,application/json" className="sr-only" aria-label="Choose sticker backup" onChange={event => {
      const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''
      if (file === undefined) return
      deviceStore.set(backupState, file.size > MAX_BACKUP_BYTES ? { busy: false, message: 'This backup is too large.', restore: null } : { busy: false, message: null, restore: file })
    }} />
    {state.restore === null ? null : <div className="text-xs"><p>Replace this browser’s collection with {state.restore.name}? Export first to keep the current collection.</p>
      <button type="button" className={button} onClick={() => { const file = state.restore; if (file === null) return; void run(async () => { const json = await file.text(); resetStickerEditor(); cancelStickerInteraction(); await importStickerBackup(json) }) }}>Replace collection</button>
      <button type="button" className={button} onClick={() => deviceStore.set(backupState, { busy: false, message: null, restore: null })}>Cancel</button>
    </div>}
    {state.message === null ? null : <p role="status" className="text-xs">{state.message}</p>}
  </div>
}
