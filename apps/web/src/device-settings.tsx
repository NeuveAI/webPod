import { StickerBackupControls } from './sticker-backup'
import { Button } from '@webpod/ui/components/button'
import { Switch } from '@webpod/ui/components/switch'
import { Field, FieldLabel } from '@webpod/ui/components/field'
import { atom, createStore, useAtomValue } from 'jotai'
import { useEffect, useRef, type ReactNode } from 'react'

/** Shared with imperative callers; React never owns a separate settings state. */
export const deviceSettingsStore = createStore()
export const settingsOpenAtom = atom(false)
export const interactionAudioEnabledAtom = atom(true)

/**
 * Opens a native modal from shared Jotai state and mirrors native dismissal back
 * into the store. Unmount resets visibility; Tab boundaries keep focus in the
 * current visible controls, including when the diagnostics disclosure changes.
 */
export function DeviceSettings({ children }: { readonly children: ReactNode }) {
  const open = useAtomValue(settingsOpenAtom, { store: deviceSettingsStore })
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog === null) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => () => { deviceSettingsStore.set(settingsOpenAtom, false) }, [])

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="device-settings"
        onClick={() => deviceSettingsStore.set(settingsOpenAtom, true)}
      >
        Settings
      </button>
      <dialog
        ref={dialogRef}
        id="device-settings"
        aria-labelledby="device-settings-title"
        className="webpod-device-settings m-auto max-h-[calc(100dvh-32px)] w-[min(440px,calc(100vw-32px))] overflow-y-auto overscroll-contain rounded-2xl border border-border bg-popover p-0 text-popover-foreground shadow-2xl backdrop:bg-black/50"
        onKeyDown={(event) => {
          if (event.key !== 'Tab') return
          const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), summary, a[href], [tabindex="0"]'))
            .filter((element) => element.getClientRects().length > 0 && (element.closest('details:not([open])') === null || element.tagName === 'SUMMARY'))
          const first = controls[0]
          const last = controls.at(-1)
          if (first === undefined || last === undefined) return
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last.focus()
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first.focus()
          }
        }}
        onClose={() => deviceSettingsStore.set(settingsOpenAtom, false)}
        onCancel={() => deviceSettingsStore.set(settingsOpenAtom, false)}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-popover px-5 py-4">
          <h1 id="device-settings-title" className="m-0 text-lg font-semibold">Settings</h1>
          <Button variant="ghost" size="sm" onClick={() => deviceSettingsStore.set(settingsOpenAtom, false)}>Close</Button>
        </header>
        <div className="p-5">{children}
          <details className="mt-6 border-t border-border pt-4">
            <summary className="cursor-pointer rounded-sm text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-4">Sticker backups</summary>
            <div className="pt-3"><StickerBackupControls /></div>
          </details>
        </div>
      </dialog>
    </>
  )
}

export function InteractionSoundSetting() {
  const enabled = useAtomValue(interactionAudioEnabledAtom, { store: deviceSettingsStore })
  return (
    <Field orientation="horizontal">
      <FieldLabel htmlFor="click-wheel-sound">Click-wheel sound</FieldLabel>
      <Switch id="click-wheel-sound" checked={enabled} onCheckedChange={(checked) => deviceSettingsStore.set(interactionAudioEnabledAtom, checked)} />
    </Field>
  )
}
