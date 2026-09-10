import { expect, test } from 'bun:test'
import { setup } from './test-fixtures'

async function nativeError(path: string, status = 403, reason = 'ACCESS_DENIED') {
  const response = new Response('{"errors":[]}', { status })
  Object.defineProperty(response, 'url', { value: `https://api.music.apple.com${path}` })
  await response.json()
  return Object.assign(new Error(String(status)), { name: reason, reason, data: response })
}
function cachedSession() {
  const { music, provider } = setup()
  let authorized = true
  let accepted = false
  let freshLogins = 0
  let resets = 0
  Object.defineProperty(music, 'isAuthorized', { get: () => authorized })
  music.authorize = async () => {
    if (authorized) return 'synthetic-cached-user'
    freshLogins += 1; authorized = true; accepted = true
    return 'synthetic-fresh-user'
  }
  music.unauthorize = async () => { resets += 1; authorized = false }
  Object.defineProperty(music.api, 'music', { value: async (path: string) => {
    if (!accepted) throw await nativeError(path)
    return { data: { data: [] } }
  }, configurable: true })
  return { music, provider, freshLogins: () => freshLogins, resets: () => resets }
}

test('rejected cached Apple user authorization clears once and next gesture performs fresh native login', async () => {
  const r = cachedSession()
  await r.provider.configure()
  await r.provider.authorize()
  expect(r.freshLogins()).toBe(0)
  await expect(r.provider.libraryList('songs')).rejects.toThrow('Please connect again')
  expect(r.provider.session).toBeNull()
  expect(r.resets()).toBe(1)
  expect(r.freshLogins()).toBe(0)
  await r.provider.authorize()
  expect(r.freshLogins()).toBe(1)
  expect((await r.provider.libraryList('songs')).items).toEqual([])
})

test('parallel rejected Apple first pages reset cached authorization only once', async () => {
  const r = cachedSession()
  await r.provider.configure()
  const results = await Promise.allSettled((['albums', 'artists', 'playlists', 'songs'] as const).map(kind => r.provider.libraryList(kind)))
  expect(results.every(result => result.status === 'rejected')).toBe(true)
  expect(r.resets()).toBe(1)
  expect(r.provider.session).toBeNull()
})

for (const [status, reason] of [[500, 'SERVER_ERROR'], [401, 'AUTHORIZATION_ERROR'], [403, 'LICENSING_ERROR']] as const) test(`Apple ${status}/${reason} does not reset authorization`, async () => {
  const r = cachedSession()
  Object.defineProperty(r.music.api, 'music', { value: async (path: string) => { throw await nativeError(path, status, reason) } })
  await r.provider.configure()
  await expect(r.provider.libraryList('songs')).rejects.toThrow()
  expect(r.resets()).toBe(0)
  expect(r.provider.session?.status).toBe('authorized')
})

test('catalog ACCESS_DENIED never clears a personalized session', async () => {
  const r = cachedSession()
  await r.provider.configure()
  await expect(r.provider.stationsList()).rejects.toThrow()
  expect(r.resets()).toBe(0)
})

test('late rejected library response cannot invalidate a newer explicit authorization', async () => {
  const r = cachedSession()
  let reject!: (cause: unknown) => void
  const pending = new Promise<never>((_, fail) => { reject = fail })
  Object.defineProperty(r.music.api, 'music', { value: () => pending })
  await r.provider.configure()
  const old = r.provider.libraryList('songs')
  await Promise.resolve(); await Promise.resolve()
  await r.provider.authorize()
  reject(await nativeError('/v1/me/library/songs'))
  await expect(old).rejects.toThrow()
  expect(r.resets()).toBe(0)
  expect(r.provider.session?.status).toBe('authorized')
})

test('failed cache reset keeps the rejected token blocked and explicit retry resets before native authorize', async () => {
  const r = cachedSession()
  const reset = r.music.unauthorize
  r.music.unauthorize = async () => { throw new Error('logout unavailable') }
  await r.provider.configure()
  await expect(r.provider.libraryList('songs')).rejects.toThrow('Please connect again')
  expect(r.provider.session).toBeNull()
  await expect(r.provider.authorize()).rejects.toThrow('logout unavailable')
  expect(r.freshLogins()).toBe(0)
  r.music.unauthorize = reset
  await r.provider.authorize()
  expect(r.freshLogins()).toBe(1)
})

test('native authorization finishing after logout cannot restore a cached signed-in session', async () => {
  const r = cachedSession()
  await r.provider.configure()
  let resolve!: (token: string) => void
  r.music.authorize = () => new Promise<string>(done => { resolve = done })
  const old = r.provider.authorize()
  await r.provider.unauthorize()
  resolve('synthetic-old-user')
  await expect(old).rejects.toThrow('superseded')
  expect(r.provider.session).toBeNull()
  await expect(r.provider.libraryList('songs')).rejects.toThrow()
})

test('old native authorization completion cannot replace the latest successful session', async () => {
  const r = cachedSession()
  await r.provider.configure()
  let resolve!: (token: string) => void
  let calls = 0
  r.music.authorize = () => ++calls === 1 ? new Promise<string>(done => { resolve = done }) : Promise.resolve('synthetic-new-user')
  const old = r.provider.authorize()
  const current = await r.provider.authorize()
  resolve('synthetic-old-user')
  await expect(old).rejects.toThrow('superseded')
  expect(r.provider.session).toBe(current)
})

test('stale native authorization after logout cannot cancel a newer pending gesture', async () => {
  const r = cachedSession()
  await r.provider.configure()
  const pending: ((token: string) => void)[] = []
  r.music.authorize = () => new Promise<string>(done => { pending.push(done) })
  const first = r.provider.authorize()
  await r.provider.unauthorize()
  const second = r.provider.authorize()
  const firstDone = pending[0]; const secondDone = pending[1]
  if (!firstDone || !secondDone) throw new Error('native authorize calls missing')
  firstDone('synthetic-old-user')
  await expect(first).rejects.toThrow('superseded')
  Object.defineProperty(r.music, 'isAuthorized', { get: () => true })
  secondDone('synthetic-new-user')
  await expect(second).resolves.toMatchObject({ status: 'authorized' })
  expect(r.resets()).toBe(1)
})
