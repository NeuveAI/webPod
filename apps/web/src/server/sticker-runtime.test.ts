import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { stickerDatabasePath } from './sticker-runtime.server'

test('production database rejects absent, relative, public, traversal and symlink paths', () => {
  expect(() => stickerDatabasePath({ NODE_ENV: 'production' })).toThrow()
  expect(() => stickerDatabasePath({ WEBPOD_STICKER_DATABASE_PATH: 'relative.sqlite' })).toThrow()
  const publicRoot = resolve(process.cwd(), 'apps/web/public')
  expect(() => stickerDatabasePath({ WEBPOD_STICKER_DATABASE_PATH: `${publicRoot}/leak.sqlite` })).toThrow()
  expect(() => stickerDatabasePath({ WEBPOD_STICKER_DATABASE_PATH: `/tmp/..${publicRoot}/leak.sqlite` })).toThrow()
  const dir = mkdtempSync(resolve(tmpdir(), 'webpod-config-'))
  try {
    mkdirSync(publicRoot, { recursive: true }); symlinkSync(publicRoot, resolve(dir, 'link'))
    expect(() => stickerDatabasePath({ WEBPOD_STICKER_DATABASE_PATH: resolve(dir, 'link/leak.sqlite') })).toThrow()
    expect(stickerDatabasePath({ WEBPOD_STICKER_DATABASE_PATH: resolve(dir, 'private.sqlite') })).toBe(resolve(realpathSync(dir), 'private.sqlite'))
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
