import { createPrivateKey } from 'node:crypto'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { appleTokenConfigFromEnv } from './apple-developer-token.ts'

/** Materializes a runtime secret in an isolated 0700 directory. The configured
 * absolute path supplies the temporary root and filename; no repository default
 * is used. Call before serving requests, then dispose after stopping the server.
 * Local file-based credentials are untouched when no secret value is supplied. */
export async function provisionAppleRuntimeKey(env: NodeJS.ProcessEnv = process.env): Promise<() => Promise<void>> {
  const pem = env['APPLE_MUSICKIT_PRIVATE_KEY']
  if (pem === undefined) return async () => {}
  let directory: string | undefined
  try {
    const config = appleTokenConfigFromEnv(env)
    const parent = await realpath(dirname(config.keyPath))
    if (parent !== await realpath(tmpdir())) throw new Error('Invalid temporary root')
    const key = createPrivateKey(pem)
    if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') throw new Error('Invalid signing algorithm')
    directory = await mkdtemp(join(parent, 'webpod-apple-'))
    const path = join(directory, basename(config.keyPath))
    await writeFile(path, pem, { mode: 0o600, flag: 'wx' })
    env['APPLE_MUSICKIT_KEY_PATH'] = path
    delete env['APPLE_MUSICKIT_PRIVATE_KEY']
    const ownedDirectory = directory
    return async () => { await rm(ownedDirectory, { recursive: true, force: true }) }
  } catch {
    if (directory !== undefined) await rm(directory, { recursive: true, force: true })
    // Never retain crypto/parser causes: they may contain secret input.
    throw new Error('Apple Music runtime signing credentials are invalid')
  }
}
