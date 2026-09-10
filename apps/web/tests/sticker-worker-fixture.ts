import { EventEmitter } from 'node:events'
import type { Page } from '@playwright/test'

export interface PlacementFault { readonly fail?: boolean; readonly conflict?: boolean }
const replies = new EventEmitter()
replies.setMaxListeners(50)
/** Test-only observation/fault seam around the actual production worker. The real
 * WASM database still executes every accepted transaction; no app test switches. */
export async function installStickerWorkerFixture(page: Page, beforePlace: () => Promise<PlacementFault> = async () => ({})): Promise<void> {
  await page.exposeBinding('fixtureBeforeStickerPlace', beforePlace)
  await page.exposeBinding('fixtureStickerReply', (_source, status: number) => { replies.emit('place', page, status) })
  await page.addInitScript(() => {
    const scope = window as unknown as {
      fixtureBeforeStickerPlace(): Promise<{ fail?: boolean; conflict?: boolean }>
      fixtureStickerReply(status: number): Promise<void>
      fixtureStickerWorkerUrl?: string
      fixtureStickerCommand?: (command: string, args: unknown[]) => Promise<unknown>
    }
    const Native = window.Worker
    let auxiliary = -1
    window.Worker = class extends Native {
      private commands = new Map<number, string>()
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options)
        if (options?.name !== 'webpod-stickers') return
        scope.fixtureStickerWorkerUrl = String(url)
        this.addEventListener('message', (event: MessageEvent<{ id: number; error?: { status: number } }>) => {
          if (this.commands.get(event.data.id) === 'place') void scope.fixtureStickerReply(event.data.error?.status ?? 200)
          this.commands.delete(event.data.id)
        })
      }
      override postMessage(message: unknown, options?: StructuredSerializeOptions | Transferable[]): void {
        const request = message as { id: number; command: string; args: [number, { stickerId: string; x: number; y: number; width: number; rotationDeg: number }[]] }
        this.commands.set(request.id, request.command)
        if (request.command !== 'place') { super.postMessage(message, options as StructuredSerializeOptions); return }
        void (async () => {
          const fault = await scope.fixtureBeforeStickerPlace()
          if (fault.fail) { this.dispatchEvent(new MessageEvent('message', { data: { id: request.id, error: { status: 503, code: 'storage_unavailable', message: 'Synthetic storage failure' } } })); return }
          if (fault.conflict) {
            const id = auxiliary--
            await new Promise<void>(resolve => {
              const listen = (event: MessageEvent<{ id: number }>) => { if (event.data.id !== id) return; this.removeEventListener('message', listen); resolve() }
              this.addEventListener('message', listen)
              super.postMessage({ id, command: 'place', args: [request.args[0], request.args[1].map(item => item.stickerId === 'PW-C01' ? { ...item, x: .55, y: .45, width: .18, rotationDeg: 23 } : item)] })
            })
          }
          super.postMessage(message, options as StructuredSerializeOptions)
        })()
      }
    }
    let fixtureWorker: Worker | undefined
    let fixtureId = 0
    scope.fixtureStickerCommand = async (command, args) => {
      const url = scope.fixtureStickerWorkerUrl
      if (url === undefined) throw new Error('Sticker worker has not started')
      const worker = fixtureWorker ??= new Native(url, { type: 'module' })
      const id = ++fixtureId
      return new Promise((resolve, reject) => {
        const listen = (event: MessageEvent<{ id: number; result?: unknown; error?: { message: string } }>) => {
          if (event.data.id !== id) return
          worker.removeEventListener('message', listen)
          if (event.data.error) reject(new Error(event.data.error.message)); else resolve(event.data.result)
        }
        worker.addEventListener('message', listen)
        worker.postMessage({ id, command, args })
      })
    }
  })
}
export async function stickerWorkerCommand<T>(page: Page, command: string, args: unknown[] = []): Promise<T> {
  await page.waitForFunction(() => typeof (window as unknown as { fixtureStickerWorkerUrl?: unknown }).fixtureStickerWorkerUrl === 'string')
  return page.evaluate(async ({ command, args }) => {
    const scope = window as unknown as { fixtureStickerCommand(command: string, args: unknown[]): Promise<T> }
    return scope.fixtureStickerCommand(command, args)
  }, { command, args })
}
export function waitForStickerPlacement(page: Page, status = 200): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); replies.off('place', listen) }
    const listen = (target: Page, actual: number) => { if (target !== page || actual !== status) return; cleanup(); resolve() }
    const timer = setTimeout(() => { cleanup(); reject(new Error(`Expected worker placement status ${status}`)) }, 15000)
    replies.on('place', listen)
  })
}
