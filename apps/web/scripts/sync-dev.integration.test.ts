import { expect, test } from 'bun:test'
import { request as httpRequest } from 'node:http'
import { mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { prepareBrowserSourceSnapshot } from '../../../scripts/browser-source-fingerprint'

const pause = (ms: number) => new Promise<void>((done) => setTimeout(done, ms))
test('shipped dev POST cancellation during body and Apple import releases work and permits retry', async () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'webpod-sync-dev-'))
  let child: ReturnType<typeof Bun.spawn> | undefined; let output = ''
  const pumps: Promise<void>[] = []
  try {
  const source = prepareBrowserSourceSnapshot({ repositoryRoot: resolve(import.meta.dirname, '../../..'), snapshotRoot: resolve(directory, 'source') })
  const marker = resolve(directory, 'events'); const mode = resolve(directory, 'mode')
  writeFileSync(marker, ''); writeFileSync(mode, 'wait')
  // Only this isolated copy injects a synthetic upstream through Start's existing trusted context.
  // Package scripts, Vite adapter, native request bodies/cookies and domain SQLite are unchanged.
  const entry = resolve(source.snapshotRoot, 'apps/web/src/server.ts')
  renameSync(entry, entry.replace('server.ts', 'server-original.ts'))
  writeFileSync(entry, `import original from './server-original'
import { createLiveStickerServer } from '@webpod/server-core/stickers'
import { appendFileSync, readFileSync } from 'node:fs'
const service = createLiveStickerServer({ databasePath: ${JSON.stringify(resolve(directory, 'db.sqlite'))}, developerToken: async () => 'synthetic-developer', fetch: async (input, init) => {
 if (String(input).includes('/storefront')) return Response.json({data:[{id:'se'}]})
 appendFileSync(${JSON.stringify(marker)}, 'entered\\n')
 if(readFileSync(${JSON.stringify(mode)},'utf8') === 'wait') await new Promise((resolve,reject)=>{ const signal=init.signal; const abort=()=>{appendFileSync(${JSON.stringify(marker)},'aborted\\n');reject(signal.reason)};if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true}) })
 return Response.json({data:[{id:'i.synthetic',attributes:{playParams:{catalogId:'123'},genreNames:['Rock'],durationInMillis:300000}}]})
}})
export default {fetch:(request,options)=>original.fetch(request,{...options,context:{...options?.context,stickerServer:service}})}
`)
  const env = { PATH: process.env['PATH'] ?? '', APPLE_TEAM_ID: '', APPLE_MUSICKIT_KEY_ID: '', APPLE_MUSICKIT_KEY_PATH: '', WEBPOD_STICKER_DATABASE_PATH: resolve(directory, 'db.sqlite') }
  const collect = async (stream: ReadableStream<Uint8Array>) => { for await (const bytes of stream) output = (output + new TextDecoder().decode(bytes)).slice(-32_768) }
  const waitFor = async (check: () => boolean | Promise<boolean>) => { const deadline = Date.now() + 30_000; while (Date.now() < deadline) { if (await check()) return; await pause(25) } throw new Error(`Synthetic dev fixture timed out; credential-free output: ${output.slice(-1500)}`) }
    const installed = Bun.spawnSync(['bun', 'install', '--frozen-lockfile', '--ignore-scripts'], { cwd: source.snapshotRoot, env, stdout: 'pipe', stderr: 'pipe' }); expect(installed.exitCode).toBe(0)
    const probe = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response(null) }); const port = probe.port; await probe.stop(true)
    const origin = `http://127.0.0.1:${String(port)}`
    child = Bun.spawn(['bun', 'run', 'dev', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: source.snapshotRoot, env, detached: true, stdout: 'pipe', stderr: 'pipe' })
    if (child.stdout instanceof ReadableStream) pumps.push(collect(child.stdout)); if (child.stderr instanceof ReadableStream) pumps.push(collect(child.stderr))
    await waitFor(() => fetch(origin + '/@vite/client').then((r) => r.ok).catch(() => false))
    const prepare = await fetch(origin + '/api/stickers/device', { method: 'POST', headers: { origin } }); expect(prepare.status).toBe(200)
    const cookie = prepare.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ')
    // A real truncated HTTP body: the socket closes while readStickerBody awaits bytes.
    await new Promise<void>((done) => {
      const request = httpRequest(origin + '/api/stickers/session', { method: 'POST', headers: { origin, cookie, 'content-type': 'application/json', 'content-length': '1000' } })
      request.on('error', () => undefined); request.on('close', done)
      request.write('{"musicUserToken":"synthetic')
      setTimeout(() => request.destroy(), 250)
    })
    expect((await fetch(origin + '/api/stickers')).status).toBe(401)
    const controller = new AbortController()
    const importing = fetch(origin + '/api/stickers/session', { method: 'POST', headers: { origin, cookie, 'content-type': 'application/json' }, body: JSON.stringify({ musicUserToken: 'synthetic-user' }), signal: controller.signal }).catch(() => null)
    await waitFor(() => readFileSync(marker, 'utf8').includes('entered'))
    controller.abort(); await importing
    await waitFor(() => readFileSync(marker, 'utf8').includes('aborted'))
    expect((await fetch(origin + '/api/stickers', { headers: { cookie } })).status).toBe(401)
    writeFileSync(mode, 'complete')
    // A new device avoids the explicit per-device5s admission cooldown, exercising released global work.
    const nextDevice = await fetch(origin + '/api/stickers/device', { method: 'POST', headers: { origin } })
    const nextCookie = nextDevice.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ')
    const healthy = await fetch(origin + '/api/stickers/session', { method: 'POST', headers: { origin, cookie: nextCookie, 'content-type': 'application/json' }, body: JSON.stringify({ musicUserToken: 'synthetic-user' }) })
    expect(healthy.status).toBe(200)
    const inventory = await healthy.json() as { importStatus: string; packs: unknown[] }
    expect(inventory.importStatus).toBe('complete'); expect(inventory.packs).toHaveLength(1)
    await pause(5100)
    const retry = await fetch(origin + '/api/stickers/session', { method: 'POST', headers: { origin, cookie, 'content-type': 'application/json' }, body: JSON.stringify({ musicUserToken: 'synthetic-user' }) })
    expect(retry.status).toBe(200)
    expect((await retry.json() as { importStatus: string }).importStatus).toBe('complete')
    expect(output).not.toMatch(/unhandled:\s*true|Internal server error|Failed to run dependency scan/)
  } finally {
    if (child !== undefined) { try { process.kill(-child.pid, 'SIGTERM') } catch { /* owned group exited */ } await Promise.race([child.exited, pause(5000)]); try { process.kill(-child.pid, 'SIGKILL') } catch { /* owned group exited */ } await child.exited }
    await Promise.allSettled(pumps); rmSync(directory, { recursive: true, force: true })
  }
}, 90_000)
