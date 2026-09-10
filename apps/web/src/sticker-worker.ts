import sqlite3InitModule, { type SAHPoolUtil } from '@sqlite.org/sqlite-wasm'
import { createWasmDatabase, migrateBrowserDatabase } from '@webpod/sticker-engine/wasm'
import { createStickerRepository, exportBackup, importBackup, StickerError } from '@webpod/sticker-engine'
import type { StickerWorkerRequest, StickerWorkerResponse } from './sticker-local.ts'

const OWNER = 'local'
let sqlite: ReturnType<typeof sqlite3InitModule> | undefined
let pool: SAHPoolUtil | undefined

async function execute(request: StickerWorkerRequest) {
  if (!navigator.locks || !navigator.storage?.getDirectory) throw new StickerError('storage_unavailable', 503, 'This browser cannot save stickers locally. Use a browser with OPFS and Web Locks enabled.')
  return navigator.locks.request('webpod-stickers-opfs-v1', async () => {
    const module = await (sqlite ??= sqlite3InitModule())
    // Installing and resuming acquire OPFS handles, so both belong inside the
    // cross-tab lock. Pausing releases every pool handle before another tab runs.
    pool ??= await module.installOpfsSAHPoolVfs({ name: 'webpod-stickers', directory: '.webpod-stickers', initialCapacity: 6 })
    let client: InstanceType<SAHPoolUtil['OpfsSAHPoolDb']> | undefined
    try {
      await pool.unpauseVfs()
      client = new pool.OpfsSAHPoolDb('/collection.sqlite3')
      migrateBrowserDatabase(client)
      const db = createWasmDatabase(client); const repository = createStickerRepository(db)
      repository.ensureOwner(OWNER)
      switch (request.command) {
        case 'inventory': return repository.inventory(OWNER)
        case 'importTracks': return repository.importTracks(OWNER, ...request.args)
        case 'markImportFailed': repository.markImportFailed(OWNER); return repository.inventory(OWNER)
        case 'needsEnrichment': return repository.needsEnrichment(OWNER, ...request.args)
        case 'enrichTrack': return repository.enrichTrack(OWNER, ...request.args)
        case 'observe': return repository.observe(OWNER, ...request.args)
        case 'openPack': return repository.openPack(OWNER, ...request.args)
        case 'place': return repository.place(OWNER, ...request.args)
        case 'exportBackup': return exportBackup(db, OWNER)
        case 'importBackup': return importBackup(db, OWNER, ...request.args)
      }
    } finally { try { client?.close() } finally { pool.pauseVfs() } }
  })
}
self.onmessage = ({ data }: MessageEvent<StickerWorkerRequest>) => {
  void execute(data).then(result => self.postMessage({ id: data.id, result } satisfies StickerWorkerResponse), cause => {
    self.postMessage({ id: data.id, error: cause instanceof StickerError
      ? { code: cause.code, status: cause.status, message: cause.message }
      : { code: 'storage_unavailable', status: 503, message: 'Sticker storage could not be opened or saved. Check browser storage access and available space, then try again.' } } satisfies StickerWorkerResponse)
  })
}
