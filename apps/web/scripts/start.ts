import { resolve, sep } from 'node:path'
import { stat } from 'node:fs/promises'
import { provisionAppleRuntimeKey } from '@webpod/server-core'

/** Bun owns transport/static bytes only. All dynamic HTTP routing stays in the built Start handler. */
export async function startWebPod(options: { readonly port?: number; readonly hostname?: string } = {}) {
  // Storage is validated by the sticker routes when first used. Public SSR and
  // static assets must remain available when that optional service is unconfigured.
  const root = resolve(import.meta.dirname, '../dist/client')
  const entryPath = resolve(import.meta.dirname, '../dist/server/server.js')
  const entry = await import(entryPath) as {
    default: { fetch(request: Request): Promise<Response> }
    disposeStickerServer(): Promise<void>
  }
  const server = Bun.serve({
    port: options.port ?? Number(process.env['PORT'] ?? 3000), hostname: options.hostname ?? process.env['HOST'] ?? '127.0.0.1',
    async fetch(request) {
      // Vercel terminates public HTTPS at its edge; Bun receives internal HTTP.
      // Restore the public scheme without trusting a caller-supplied Origin.
      if (process.env['VERCEL'] === '1') {
        const publicUrl = new URL(request.url)
        publicUrl.protocol = 'https:'
        request = new Request(publicUrl, request)
      }
      if (request.method === 'GET' || request.method === 'HEAD') {
        let pathname: string
        try { pathname = decodeURIComponent(new URL(request.url).pathname) } catch { return new Response(null, { status: 400 }) }
        const path = resolve(root, '.' + pathname)
        if (path.startsWith(root + sep) && !pathname.split('/').some((part) => part.startsWith('.'))) {
          const info = await stat(path).catch(() => null)
          if (info?.isFile()) return new Response(request.method === 'HEAD' ? null : Bun.file(path), { headers: { 'content-type': Bun.file(path).type, 'content-length': String(info.size), 'x-content-type-options': 'nosniff' } })
        }
      }
      return entry.default.fetch(request)
    },
  })
  let stopping: Promise<void> | undefined
  return {
    server,
    stop: () => stopping ??= (async () => { await entry.disposeStickerServer(); await server.stop(true) })(),
  }
}
if (import.meta.main) {
  const disposeKey = await provisionAppleRuntimeKey()
  const app = await startWebPod()
  for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => { void app.stop().finally(disposeKey) })
  console.info(`webPod listening on ${app.server.url.origin}`)
}
