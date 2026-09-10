/** Run after bun run build: bun apps/web/tests/sticker-storage-browser.ts */
import { chromium, expect, type Page } from '@playwright/test'
import { readdir } from 'node:fs/promises'
import { startWebPod } from '../scripts/start.ts'
import type { StickerInventory } from '@webpod/stickers'

const assets = await readdir(new URL('../dist/client/assets/', import.meta.url))
const filename = assets.find(name => /^sticker-worker-.*\.js$/.test(name))
if (!filename) throw new Error('Build the application first.')
const app = await startWebPod({ port: 0 }); const browser = await chromium.launch()
const context = await browser.newContext()
async function page() {
  const tab = await context.newPage()
  await tab.route('**/api/**', route => route.fulfill({ status: 503, body: '{}' }))
  await tab.goto(`${app.server.url.origin}/webpod`)
  return tab
}
async function command<T>(tab: Page, command: string, args: unknown[] = []): Promise<T> {
  return tab.evaluate(({ filename, command, args }) => new Promise<T>((resolve, reject) => {
    const worker = new Worker(`/assets/${filename}`, { type: 'module' })
    const timeout = setTimeout(() => { worker.terminate(); reject(new Error('Worker timed out')) }, 15000)
    worker.onerror = e => { clearTimeout(timeout); worker.terminate(); reject(new Error(e.message)) }
    worker.onmessage = ({ data }) => { clearTimeout(timeout); worker.terminate(); if (data.error) reject(new Error(data.error.message)); else resolve(data.result) }
    worker.postMessage({ id: 1, command, args })
  }), { filename, command, args })
}
async function persistentCommand<T>(tab: Page, command: string, args: unknown[] = []): Promise<T> {
  return tab.evaluate(({ filename, command, args }) => new Promise<T>((resolve, reject) => {
    const state = window as unknown as { stickerWorker?: Worker }
    const worker = state.stickerWorker ??= new Worker(`/assets/${filename}`, { type: 'module' })
    const timer = setTimeout(() => reject(new Error('Persistent worker timed out')), 15000)
    worker.onmessage = ({ data }) => { clearTimeout(timer); if (data.error) reject(new Error(data.error.message)); else resolve(data.result) }
    worker.postMessage({ id: 1, command, args })
  }), { filename, command, args })
}
try {
  const a = await page(); const b = await page()
  const empty = await command<StickerInventory>(a, 'inventory'); expect(empty.stickerIds).toEqual([])
  const earned = await command<StickerInventory>(a, 'importTracks', [[{ catalogId: '123', genre: 'rock', durationMs: 300000 }], 'complete'])
  expect(earned.stickerIds).toHaveLength(1)
  // Every call terminates its worker: this proves reopening the durable file.
  const reopened = await command<StickerInventory>(b, 'inventory'); expect(reopened.stickerIds).toEqual(earned.stickerIds)
  const results = await Promise.allSettled([a, b].map(tab => command<StickerInventory>(tab, 'place', [0, [{ stickerId: earned.stickerIds[0], surface: 'back', x: .5, y: .5, width: .2, rotationDeg: 0, wear: .7 }]])))
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
  expect(results.filter(result => result.status === 'rejected')).toHaveLength(1)
  const backup = await command<string>(a, 'exportBackup')
  await expect(command(b, 'importBackup', ['{"format":"wrong"}'])).rejects.toThrow('valid webPod')
  expect(await command<string>(a, 'exportBackup')).toBe(backup)
  const restored = await command<StickerInventory>(b, 'importBackup', [backup])
  expect(restored.appearances?.[0]?.wear).toBe(.7)
  expect(restored.placementRevision).toBe(2)
  expect((await persistentCommand<StickerInventory>(a, 'inventory')).placementRevision).toBe(2)
  await persistentCommand<StickerInventory>(b, 'place', [2, restored.placements])
  expect((await persistentCommand<StickerInventory>(a, 'inventory')).placementRevision).toBe(3)
  expect((await persistentCommand<StickerInventory>(b, 'inventory')).placementRevision).toBe(3)
  // Hold the cross-tab lock, queue a real worker, then terminate before release.
  await a.evaluate(() => { void navigator.locks.request('webpod-stickers-opfs-v1', () => new Promise<void>(resolve => { Object.assign(window, { releaseStickerLock: resolve }) })) })
  await a.waitForFunction(() => 'releaseStickerLock' in window)
  await b.evaluate(filename => { const worker = new Worker(`/assets/${filename}`, { type: 'module' }); worker.postMessage({ id: 1, command: 'place', args: [3, []] }); setTimeout(() => worker.terminate(), 50) }, filename)
  await b.waitForTimeout(100)
  await a.evaluate(() => (window as unknown as { releaseStickerLock(): void }).releaseStickerLock())
  expect((await command<StickerInventory>(a, 'inventory')).placements).toHaveLength(1)
  // Lack of OPFS is an explicit error, never a successful transient database.
  const unavailable = await b.evaluate(filename => new Promise<string>((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([`Object.defineProperty(navigator,'storage',{value:undefined}); import(${JSON.stringify(new URL(`/assets/${filename}`, location.origin).href)});`], { type: 'text/javascript' }))
    const worker = new Worker(url, { type: 'module' }); const timer = setTimeout(() => reject(new Error('timeout')), 15000)
    worker.onmessage = ({ data }) => { clearTimeout(timer); worker.terminate(); URL.revokeObjectURL(url); resolve(data.error?.code ?? 'unexpected-success') }
    setTimeout(() => worker.postMessage({ id: 1, command: 'inventory', args: [] }), 500)
  }), filename)
  expect(unavailable).toBe('storage_unavailable')
  console.info('PASS production worker: OPFS reopen, two-tab revision conflict, backup rollback/restore, queued cancellation, unsupported storage.')
} finally { await context.close(); await browser.close(); await app.stop() }
