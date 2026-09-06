import { existsSync, mkdirSync, realpathSync } from 'node:fs'
import { dirname, isAbsolute, resolve, sep } from 'node:path'
import { appleTokenConfigFromEnv, mintAppleDeveloperToken } from '@webpod/server-core'
import { createLiveStickerServer } from '@webpod/server-core/stickers'

let disposed = false
let instance: ReturnType<typeof createLiveStickerServer> | undefined
/** No key/DB I/O at import or public SSR. Production path must be explicit and outside static roots. */
export function stickerDatabasePath(env: Readonly<Record<string, string | undefined>> = process.env): string {
  const configured = env['WEBPOD_STICKER_DATABASE_PATH']
  if (configured === undefined && env['NODE_ENV'] === 'production') throw new Error('WEBPOD_STICKER_DATABASE_PATH must be an absolute private database path')
  const rawPath = configured ?? resolve(process.cwd(), '.data/stickers.sqlite')
  if (!isAbsolute(rawPath)) throw new Error('WEBPOD_STICKER_DATABASE_PATH must be absolute')
  const canonical = (value: string): string => {
    if (existsSync(value)) return realpathSync(value)
    const parent = dirname(value)
    return parent === value ? value : resolve(canonical(parent), value.slice(parent.length + 1))
  }
  const path = canonical(resolve(rawPath))
  for (const root of [resolve(process.cwd(), 'public'), resolve(process.cwd(), 'dist'), resolve(process.cwd(), 'apps/web/public'), resolve(process.cwd(), 'apps/web/dist')].map(canonical)) {
    if (path === root || path.startsWith(root + sep)) throw new Error('Sticker database must be outside public assets')
  }
  return path
}
export function getStickerServer(): ReturnType<typeof createLiveStickerServer> {
  if (disposed) throw new Error('Sticker server lifecycle has ended')
  if (instance === undefined) {
    const databasePath = stickerDatabasePath()
    mkdirSync(dirname(databasePath), { recursive: true, mode: 0o700 })
    instance = createLiveStickerServer({ databasePath, developerToken: async () => (await mintAppleDeveloperToken({ config: appleTokenConfigFromEnv(process.env) })).token })
  }
  return instance
}
export async function disposeStickerServer(): Promise<void> { disposed = true; const current = instance; instance = undefined; await current?.dispose() }
if (import.meta.hot) import.meta.hot.dispose(() => { void disposeStickerServer() })
