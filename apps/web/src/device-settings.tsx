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
        className="webpod-device-settings m-auto max-h-[calc(100dvh-32px)] w-[min(440px,calc(100vw-32px))] overflow-y-auto overscroll-contain rounded-2xl border border-white/15 bg-[#151a22] p-0 text-[#eef2f7] shadow-2xl backdrop:bg-black/50"
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
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-white/10 bg-[#151a22] px-5 py-4">
          <h1 id="device-settings-title" className="m-0 text-lg font-semibold">Settings</h1>
          <button type="button" onClick={() => deviceSettingsStore.set(settingsOpenAtom, false)}>Close</button>
        </header>
        <div className="space-y-5 p-5">{children}</div>
      </dialog>
    </>
  )
}

export function InteractionSoundSetting() {
  const enabled = useAtomValue(interactionAudioEnabledAtom, { store: deviceSettingsStore })
  return (
    <button
      type="button"
      aria-pressed={enabled}
      onClick={() => deviceSettingsStore.set(interactionAudioEnabledAtom, !enabled)}
    >
      Click-wheel sound
      <span aria-hidden="true"> · {enabled ? 'On' : 'Off'}</span>
    </button>
  )
}
