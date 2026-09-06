import { expect, spyOn, test } from 'bun:test'
import { createAppleStickerClient, type AppleImportDiagnostic } from './apple-import'

const song = { id: 'i.library', type: 'library-songs', attributes: { playParams: { id: 'i.library', isLibrary: true }, durationInMillis: 250_000, genreNames: ['Rock'] }, relationships: { catalog: { data: [{ id: '123', type: 'songs', attributes: { genreNames: ['Metal'], durationInMillis: 250_000 } }] } } }
test('official library catalog relationship and opaque cursor retain catalog metadata without inventing local IDs', async () => {
  const urls: URL[] = []; const diagnostics: AppleImportDiagnostic[] = []
  const cursor = 'opaque+/cursor==:next'
  const client = createAppleStickerClient({ developerToken: 'synthetic', musicUserToken: 'synthetic', onImport: (value) => diagnostics.push(value), fetch: async (input) => {
    const url = new URL(String(input)); urls.push(url)
    return Response.json(urls.length === 1 ? { data: [song, { id: 'i.upload', attributes: { durationInMillis: 1000, playParams: { id: 'i.upload' } } }], next: '/v1/me/library/songs?offset=' + encodeURIComponent(cursor) } : { data: [] })
  } })
  const result = await client.importLibrary()
  expect(result).toEqual({ status: 'complete', tracks: [{ catalogId: '123', genre: 'metal', durationMs: 250_000 }] })
  expect(urls[0]?.searchParams.get('include')).toBe('catalog'); expect(urls[1]?.searchParams.get('include')).toBe('catalog')
  expect(urls[1]?.searchParams.get('offset')).toBe(cursor)
  expect(diagnostics).toEqual([{ status: 'complete', reason: 'none', pages: 2, received: 2, accepted: 1, skipped: 1 }])
  expect(JSON.stringify(diagnostics)).not.toMatch(/synthetic|opaque|library|123/)
})
test('opaque pagination remains fixed-origin, songs-only, bounded and unambiguous', async () => {
  for (const next of ['https://evil.invalid/v1/me/library/songs?offset=x', '/v1/me/library/albums?offset=x', '/v1/me/library/songs?offset=x&offset=y', '/v1/me/library/songs?offset=%00', '/v1/me/library/songs?offset=x&include=artists', '/v1/me/library/songs?offset=x#secret', '/v1/me/library/songs?offset=' + 'x'.repeat(385)]) {
    let calls = 0; const diagnostics: AppleImportDiagnostic[] = []
    const client = createAppleStickerClient({ developerToken: 'synthetic', onImport: (value) => diagnostics.push(value), fetch: async () => { calls++; return Response.json({ data: [song], next }) } })
    await expect(client.importLibrary()).rejects.toThrow('pagination')
    expect(calls).toBe(1); expect(diagnostics[0]?.reason).toBe('apple_pagination')
  }
})
test('safe failure diagnostics distinguish authorization, unavailable upstream and malformed response', async () => {
  for (const [status, reason] of [[401, 'apple_authorization'], [429, 'apple_rate_limited'], [400, 'apple_request'], [500, 'apple_unavailable'], [200, 'apple_response']] as const) {
    const diagnostics: AppleImportDiagnostic[] = []
    const client = createAppleStickerClient({ developerToken: 'synthetic', onImport: (value) => diagnostics.push(value), fetch: async () => new Response('private upstream content', { status }) })
    await expect(client.importLibrary()).rejects.toThrow()
    expect(diagnostics[0]?.reason).toBe(reason); expect(JSON.stringify(diagnostics)).not.toContain('private')
  }
})

test('deadline during streamed response body reports timeout rather than unexpected failure', async () => {
  const deadline = new AbortController(); const timer = spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal)
  const diagnostics: AppleImportDiagnostic[] = []
  try {
    const client = createAppleStickerClient({ developerToken: 'synthetic', onImport: (value) => diagnostics.push(value), fetch: async () => new Response(new ReadableStream({ pull(controller) { deadline.abort(new DOMException('Synthetic timeout', 'TimeoutError')); controller.error(deadline.signal.reason) } }, { highWaterMark: 0 })) })
    await expect(client.importLibrary()).rejects.toThrow()
    expect(diagnostics[0]?.reason).toBe('apple_timeout')
  } finally { timer.mockRestore() }
})
