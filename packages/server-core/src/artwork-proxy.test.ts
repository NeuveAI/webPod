import { describe, expect, test } from 'bun:test'

import {
  ARTWORK_CACHE_CONTROL,
  ARTWORK_FETCH_TIMEOUT_MS,
  ARTWORK_MAX_CONCURRENT,
  ARTWORK_MAX_BYTES,
  handleArtworkRequest,
} from './artwork-proxy.ts'

function artworkRequest(src: string, px = 300, extra = ''): Request {
  const params = new URLSearchParams({ src, px: String(px) })
  return new Request(`http://webpod.test/artwork?${params.toString()}${extra}`)
}

function setU32be(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = (value >>> 24) & 0xff
  bytes[offset + 1] = (value >>> 16) & 0xff
  bytes[offset + 2] = (value >>> 8) & 0xff
  bytes[offset + 3] = value & 0xff
}

function crc32(bytes: Uint8Array, start: number, end: number): number {
  let crc = 0xffffffff
  for (let index = start; index < end; index += 1) {
    crc ^= bytes[index] ?? 0
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

function png(width = 300, height = width, padding = 0): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(45 + padding)
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10], 0)
  setU32be(bytes, 8, 13)
  bytes.set([73, 72, 68, 82], 12)
  setU32be(bytes, 16, width)
  setU32be(bytes, 20, height)
  bytes.set([8, 2, 0, 0, 0], 24)
  setU32be(bytes, 29, crc32(bytes, 12, 29))
  setU32be(bytes, 33, 0)
  bytes.set([73, 69, 78, 68], 37)
  setU32be(bytes, 41, crc32(bytes, 37, 41))
  return bytes
}

function fetchStub(run: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>): typeof globalThis.fetch {
  return run as typeof globalThis.fetch
}

async function errorCode(response: Response): Promise<string> {
  const body = (await response.json()) as { readonly error: { readonly code: string } }
  return body.error.code
}

describe('/artwork fixture source', () => {
  test('returns deterministic same-origin artwork without making an outbound request', async () => {
    let calls = 0
    const response = await handleArtworkRequest(
      artworkRequest('/artwork-source/rumours/300x300.png'),
      {
        fetch: fetchStub(() => {
          calls += 1
          return Promise.reject(new Error('fixture artwork must not fetch'))
        }),
      },
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/svg+xml')
    expect(response.headers.get('cache-control')).toBe(ARTWORK_CACHE_CONTROL)
    expect(response.headers.get('content-security-policy')).toBe("default-src 'none'; sandbox")
    expect(response.headers.get('cross-origin-resource-policy')).toBe('same-origin')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(await response.text()).toContain('R')
    expect(calls).toBe(0)
  })

  test('requires fixture dimensions to agree with the provider px contract', async () => {
    const response = await handleArtworkRequest(artworkRequest('/artwork-source/rumours/640x640.png', 300))
    expect(response.status).toBe(400)
    expect(await errorCode(response)).toBe('invalid_request')
  })
})

describe('/artwork remote provider sources', () => {
  test.each([
    'https://is1-ssl.mzstatic.com/image/thumb/Music/abc/300x300bb.jpg',
    'https://is12-ssl.mzstatic.com/image/thumb/Features/abc/300x300.jpg',
    'https://i.scdn.co/image/ab67616d00001e02',
  ])('proxies an allowed provider shape: %s', async (src) => {
    let redirect: RequestRedirect | undefined
    const response = await handleArtworkRequest(artworkRequest(src), {
      fetch: fetchStub((_input, init) => {
        redirect = init?.redirect
        return Promise.resolve(
          new Response(png().buffer, {
            status: 200,
            headers: { 'content-type': 'image/png', 'content-length': '45' },
          }),
        )
      }),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(response.headers.get('content-length')).toBe('45')
    expect(await response.arrayBuffer()).toEqual(png().buffer)
    expect(redirect).toBe('manual')
  })

  test.each([
    'http://127.0.0.1/admin',
    'https://127.0.0.1/admin',
    'https://[::1]/admin',
    'https://10.0.0.1/admin',
    'https://172.16.0.1/admin',
    'https://192.168.0.1/admin',
    'http://169.254.169.254/latest/meta-data',
    'https://metadata.google.internal/computeMetadata/v1',
    'file:///etc/passwd',
    'data:image/png;base64,AA==',
    'javascript:alert(1)',
    'https://i.scdn.co.evil.example/image/x',
    'https://evil.example/image/thumb/x',
    'http://i.scdn.co/image/x',
    'https://user:pass@i.scdn.co/image/x',
    'https://i.scdn.co:444/image/x',
    '/artwork-source/../../private/300x300.png',
  ])('rejects SSRF or non-provider source %s before fetch', async (src) => {
    let calls = 0
    const response = await handleArtworkRequest(artworkRequest(src), {
      fetch: fetchStub(() => {
        calls += 1
        return Promise.reject(new Error('blocked input reached fetch'))
      }),
    })
    expect(response.status).toBe(403)
    expect(await errorCode(response)).toBe('source_not_allowed')
    expect(calls).toBe(0)
  })

  test('does not follow a provider redirect to a private target', async () => {
    let calls = 0
    const response = await handleArtworkRequest(
      artworkRequest('https://i.scdn.co/image/redirect'),
      {
        fetch: fetchStub((_input, init) => {
          calls += 1
          expect(init?.redirect).toBe('manual')
          return Promise.resolve(
            new Response(null, {
              status: 302,
              headers: { location: 'http://169.254.169.254/latest/meta-data' },
            }),
          )
        }),
      },
    )
    expect(response.status).toBe(502)
    expect(await errorCode(response)).toBe('upstream_response')
    expect(calls).toBe(1)
  })
})

describe('/artwork response bounds', () => {
  const source = 'https://i.scdn.co/image/test'

  test('rejects non-image responses and does not reflect the source URL', async () => {
    const response = await handleArtworkRequest(artworkRequest(source), {
      fetch: fetchStub(() =>
        Promise.resolve(new Response('<html>no</html>', { headers: { 'content-type': 'text/html' } })),
      ),
    })
    expect(response.status).toBe(502)
    expect(await errorCode(response.clone())).toBe('upstream_content_type')
    expect(await response.text()).not.toContain(source)
  })

  test('rejects a lying image header carrying script bytes', async () => {
    const response = await handleArtworkRequest(artworkRequest(source), {
      fetch: fetchStub(() => Promise.resolve(new Response('<script>alert(1)</script>', { headers: { 'content-type': 'image/jpeg' } }))),
    })
    expect(response.status).toBe(502)
    expect(await errorCode(response)).toBe('upstream_content_invalid')
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  test('rejects truncated and trailing-byte polyglot images', async () => {
    for (const body of [png().subarray(0, 40), png(300, 300, 8)]) {
      const response = await handleArtworkRequest(artworkRequest(source), {
        fetch: fetchStub(() => Promise.resolve(new Response(body.slice().buffer, { headers: { 'content-type': 'image/png' } }))),
      })
      expect(response.status).toBe(502)
      expect(await errorCode(response)).toBe('upstream_content_invalid')
    }
  })

  test('rejects image dimensions that disagree with px', async () => {
    const response = await handleArtworkRequest(artworkRequest(source, 300), {
      fetch: fetchStub(() => Promise.resolve(new Response(png(640).buffer, { headers: { 'content-type': 'image/png' } }))),
    })
    expect(response.status).toBe(502)
    expect(await errorCode(response)).toBe('upstream_content_invalid')
  })

  test('rejects a declared body larger than the byte ceiling', async () => {
    let cancelled = false
    const body = new ReadableStream<Uint8Array>({
      cancel() {
        cancelled = true
      },
    })
    const response = await handleArtworkRequest(artworkRequest(source), {
      fetch: fetchStub(() =>
        Promise.resolve(
          new Response(body, {
            headers: {
              'content-length': String(ARTWORK_MAX_BYTES + 1),
              'content-type': 'image/png',
            },
          }),
        ),
      ),
    })
    expect(response.status).toBe(413)
    expect(await errorCode(response)).toBe('artwork_too_large')
    expect(cancelled).toBe(true)
  })

  test('stops and cancels a chunked response as soon as the byte ceiling is crossed', async () => {
    let cancelled = false
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(png())
        controller.enqueue(png())
      },
      cancel() {
        cancelled = true
      },
    })
    const response = await handleArtworkRequest(artworkRequest(source), {
      maxBytes: 50,
      fetch: fetchStub(() =>
        Promise.resolve(new Response(body, { headers: { 'content-type': 'image/webp' } })),
      ),
    })
    expect(response.status).toBe(413)
    expect(await errorCode(response)).toBe('artwork_too_large')
    expect(cancelled).toBe(true)
  })

  test('aborts a stalled upstream within the configured timeout', async () => {
    let observedAbort = false
    const started = performance.now()
    const response = await handleArtworkRequest(artworkRequest(source), {
      timeoutMs: 15,
      fetch: fetchStub((_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => {
              observedAbort = true
              reject(new DOMException('aborted', 'AbortError'))
            },
            { once: true },
          )
        }),
      ),
    })
    expect(response.status).toBe(504)
    expect(await errorCode(response)).toBe('upstream_timeout')
    expect(observedAbort).toBe(true)
    expect(performance.now() - started).toBeLessThan(500)

    const afterTimeout = await handleArtworkRequest(artworkRequest(`${source}-after-timeout`), {
      maxConcurrent: 1,
      fetch: fetchStub(() => Promise.resolve(new Response(png().buffer, { headers: { 'content-type': 'image/png' } }))),
    })
    expect(afterTimeout.status).toBe(200)
  })

  test.each([
    ['maxBytes', Infinity], ['maxBytes', NaN], ['maxBytes', 0], ['maxBytes', ARTWORK_MAX_BYTES + 1],
    ['timeoutMs', Infinity], ['timeoutMs', NaN], ['timeoutMs', 0], ['timeoutMs', ARTWORK_FETCH_TIMEOUT_MS + 1],
    ['maxConcurrent', Infinity], ['maxConcurrent', NaN], ['maxConcurrent', 0], ['maxConcurrent', ARTWORK_MAX_CONCURRENT + 1],
  ] as const)('rejects unsafe %s configuration %s before fetch', async (key, value) => {
    let calls = 0
    const response = await handleArtworkRequest(artworkRequest(source), {
      [key]: value,
      fetch: fetchStub(() => { calls += 1; return Promise.resolve(new Response(png().buffer, { headers: { 'content-type': 'image/png' } })) }),
    })
    expect(response.status).toBe(400)
    expect(calls).toBe(0)
  })

  test('the reviewed Infinity bypass cannot fetch or return a nine MiB body', async () => {
    let calls = 0
    const response = await handleArtworkRequest(artworkRequest(source), {
      maxBytes: Infinity,
      fetch: fetchStub(() => {
        calls += 1
        return Promise.resolve(new Response(new Uint8Array(9 * 1024 * 1024).buffer, { headers: { 'content-type': 'image/png' } }))
      }),
    })
    expect(response.status).toBe(400)
    expect(calls).toBe(0)
  })
})

describe('/artwork admission', () => {
  test('rejects cross-site browser image requests before fetch', async () => {
    let calls = 0
    const request = artworkRequest('https://i.scdn.co/image/cross-site')
    const guarded = new Request(request, { headers: { 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'no-cors', 'sec-fetch-dest': 'image' } })
    const response = await handleArtworkRequest(guarded, { fetch: fetchStub(() => { calls += 1; return Promise.reject(new Error('must not fetch')) }) })
    expect(response.status).toBe(403)
    expect(await errorCode(response)).toBe('request_not_same_origin')
    expect(calls).toBe(0)
  })

  test('admits at most eight of 128 unique requests and releases every slot', async () => {
    const releases: Array<() => void> = []
    let started = 0
    const fetch = fetchStub(() => new Promise<Response>((resolve) => {
      started += 1
      releases.push(() => resolve(new Response(png().buffer, { headers: { 'content-type': 'image/png' } })))
    }))
    const pending = Array.from({ length: 128 }, (_, index) =>
      handleArtworkRequest(artworkRequest(`https://i.scdn.co/image/saturation-${String(index)}`), { fetch }),
    )
    await Bun.sleep(0)
    expect(started).toBe(ARTWORK_MAX_CONCURRENT)
    for (const release of releases) release()
    const responses = await Promise.all(pending)
    expect(responses.filter((response) => response.status === 200)).toHaveLength(ARTWORK_MAX_CONCURRENT)
    expect(responses.filter((response) => response.status === 503)).toHaveLength(128 - ARTWORK_MAX_CONCURRENT)
    const after = await handleArtworkRequest(artworkRequest('https://i.scdn.co/image/after-release'), {
      fetch: fetchStub(() => Promise.resolve(new Response(png().buffer, { headers: { 'content-type': 'image/png' } }))),
    })
    expect(after.status).toBe(200)
  })

  test('coalesces identical in-flight work and releases admission after errors', async () => {
    let calls = 0
    let release: (() => void) | undefined
    const fetch = fetchStub(() => new Promise<Response>((resolve) => {
      calls += 1
      release = () => resolve(new Response(png().buffer, { headers: { 'content-type': 'image/png' } }))
    }))
    const requests = Array.from({ length: 32 }, () => handleArtworkRequest(artworkRequest('https://i.scdn.co/image/shared'), { fetch }))
    await Bun.sleep(0)
    expect(calls).toBe(1)
    release?.()
    expect((await Promise.all(requests)).every((response) => response.status === 200)).toBe(true)
    const failed = await handleArtworkRequest(artworkRequest('https://i.scdn.co/image/fail'), { fetch: fetchStub(() => Promise.reject(new Error('fail'))) })
    expect(failed.status).toBe(502)
    const recovered = await handleArtworkRequest(artworkRequest('https://i.scdn.co/image/recover'), { fetch: fetchStub(() => Promise.resolve(new Response(png().buffer, { headers: { 'content-type': 'image/png' } }))) })
    expect(recovered.status).toBe(200)
  })

  test('client abort releases the only admitted slot', async () => {
    const controller = new AbortController()
    const request = new Request(artworkRequest('https://i.scdn.co/image/client-abort'), { signal: controller.signal })
    const pending = handleArtworkRequest(request, {
      maxConcurrent: 1,
      fetch: fetchStub((_input, init) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
      })),
    })
    await Bun.sleep(0)
    controller.abort()
    expect((await pending).status).toBe(502)
    const afterAbort = await handleArtworkRequest(artworkRequest('https://i.scdn.co/image/after-abort'), {
      maxConcurrent: 1,
      fetch: fetchStub(() => Promise.resolve(new Response(png().buffer, { headers: { 'content-type': 'image/png' } }))),
    })
    expect(afterAbort.status).toBe(200)
  })
})

describe('/artwork query validation', () => {
  test.each([
    ['missing everything', 'http://webpod.test/artwork'],
    ['missing px', 'http://webpod.test/artwork?src=https%3A%2F%2Fi.scdn.co%2Fimage%2Fx'],
    ['zero px', 'http://webpod.test/artwork?src=https%3A%2F%2Fi.scdn.co%2Fimage%2Fx&px=0'],
    ['fractional px', 'http://webpod.test/artwork?src=https%3A%2F%2Fi.scdn.co%2Fimage%2Fx&px=1.5'],
    ['oversize px', 'http://webpod.test/artwork?src=https%3A%2F%2Fi.scdn.co%2Fimage%2Fx&px=3001'],
    ['duplicate src', 'http://webpod.test/artwork?src=a&src=b&px=300'],
    ['duplicate px', 'http://webpod.test/artwork?src=https%3A%2F%2Fi.scdn.co%2Fimage%2Fx&px=300&px=301'],
    ['unknown field', 'http://webpod.test/artwork?src=https%3A%2F%2Fi.scdn.co%2Fimage%2Fx&px=300&debug=1'],
  ])('returns a structured 400 for %s', async (_label, url) => {
    const response = await handleArtworkRequest(new Request(url))
    expect(response.status).toBe(400)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await errorCode(response)).toBe('invalid_request')
  })

  test('rejects non-GET requests', async () => {
    const response = await handleArtworkRequest(
      new Request('http://webpod.test/artwork?src=https%3A%2F%2Fi.scdn.co%2Fimage%2Fx&px=300', {
        method: 'POST',
      }),
    )
    expect(response.status).toBe(400)
    expect(await errorCode(response)).toBe('invalid_request')
  })
})
