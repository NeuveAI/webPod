import { readFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { createPrivateKey } from 'node:crypto'
import { appleTokenConfigFromEnv } from '../packages/server-core/src/apple-developer-token.ts'

/** Owner-run only: reads the local key and pipes selected credentials directly
 * to the already-linked Vercel project. Never prints CLI output or secret values.
 * Agents must not execute this script: AGENTS.md prohibits reading cert/. */
async function provision() {
  if (!Bun.argv.includes('--upload')) throw new Error('Run with --upload to provision Production and Preview credentials')
  const project: unknown = JSON.parse(await readFile('.vercel/project.json', 'utf8'))
  if (typeof project !== 'object' || project === null || !('projectId' in project) || project.projectId !== 'prj_w3YgJTuQu1ORin3WwZHjuzeD05mc') throw new Error('Link this directory to perf-lab/webpod before provisioning')
  const configuredPath = process.env['APPLE_MUSICKIT_KEY_PATH']?.trim()
  if (!configuredPath) throw new Error('APPLE_MUSICKIT_KEY_PATH is required in the local environment')
  const localPath = resolve(configuredPath)
  const config = appleTokenConfigFromEnv({ ...process.env, APPLE_MUSICKIT_KEY_PATH: localPath })
  const pem = await readFile(localPath, 'utf8')
  const key = createPrivateKey(pem)
  if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') throw new Error('Expected an Apple P-256 signing key')
  const values = [
    ['APPLE_TEAM_ID', config.teamId, '--sensitive'],
    ['APPLE_MUSICKIT_KEY_ID', config.keyId, '--sensitive'],
    ['APPLE_MUSICKIT_PRIVATE_KEY', pem, '--sensitive'],
    ['APPLE_MUSICKIT_KEY_PATH', `/tmp/${basename(localPath)}`, '--no-sensitive'],
  ] as const
  for (const [name, value, visibility] of values) {
    const child = Bun.spawn(['bunx', '--bun', 'vercel', 'env', 'add', name, 'production,preview', visibility, '--force', '--yes', '--scope', 'perf-lab'], {
      stdin: new Blob([value]), stdout: 'ignore', stderr: 'ignore',
    })
    if (await child.exited !== 0) throw new Error(`Vercel could not save ${name}; provisioning may be partial. Re-run after resolving CLI authentication.`)
    console.log(`Saved ${name} for Production and Preview`)
  }
  console.log('Credentials provisioned. Redeploy with: bunx --bun vercel deploy --prod --yes')
}

if (import.meta.main) {
  try { await provision() }
  catch { console.error('Provisioning did not complete. Verify local Apple configuration and Vercel CLI login, then re-run. Secret details were suppressed.'); process.exitCode = 1 }
}
