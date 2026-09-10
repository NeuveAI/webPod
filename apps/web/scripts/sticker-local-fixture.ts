import type { Page } from '@playwright/test'

/** Test-only fault transport. Product commands still commit through the built
 * SQLite worker; synthetic HTTP carries admission faults and completion signals
 * solely to retain the UI suite's existing response/count assertions. */
export async function installLocalPlacementFaults(page: Page) {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker
    class ObservedWorker extends NativeWorker {
      private readonly places = new Set<number>()
      private forwarding = false
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options)
        if (!String(url).includes('sticker-worker-')) return
        super.addEventListener('message', event => {
          const data = event.data as { id: number; error?: { status?: number } }
          if (this.forwarding || !this.places.delete(data.id)) return
          event.stopImmediatePropagation()
          void this.deliver(data)
        })
      }
      private async deliver(data: { id: number; error?: { status?: number } }) {
        await fetch('/api/stickers/placements', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: data.error?.status ?? 200 }) })
        this.forwarding = true
        try { this.dispatchEvent(new MessageEvent('message', { data })) } finally { this.forwarding = false }
      }
      override postMessage(message: unknown, options?: StructuredSerializeOptions | Transferable[]) {
        const request = message as { id: number; command?: string }
        if (request.command !== 'place') { super.postMessage(message, options as StructuredSerializeOptions); return }
        this.places.add(request.id)
        void fetch('/__test/sticker-admission').then(response => response.json()).then((fault: { status: number }) => {
          if (fault.status) { this.places.delete(request.id); return this.deliver({ id: request.id, error: { status: fault.status, ...{ code: fault.status === 409 ? 'placement_conflict' : 'storage_unavailable', message: 'Synthetic storage fault' } } }) }
          super.postMessage(message, options as StructuredSerializeOptions)
          return undefined
        })
      }
    }
    window.Worker = ObservedWorker
  })
}
export async function localFixtureCommand<T>(page: Page, worker: string, command: string, args: unknown[] = []): Promise<T> {
  return page.evaluate(({ worker, command, args }) => new Promise<T>((resolve, reject) => {
    const client = new Worker(worker, { type: 'module' })
    const timer = setTimeout(() => { client.terminate(); reject(new Error('Fixture worker timeout')) }, 15000)
    client.onmessage = ({ data }) => { clearTimeout(timer); client.terminate(); if (data.error) reject(new Error(data.error.message)); else resolve(data.result) }
    client.onerror = event => { clearTimeout(timer); client.terminate(); reject(new Error(event.message)) }
    client.postMessage({ id: 1, command, args })
  }), { worker, command, args })
}
