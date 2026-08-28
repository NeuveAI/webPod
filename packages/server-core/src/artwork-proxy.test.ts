import { describe, expect, test } from 'bun:test'

import {
  ARTWORK_CACHE_CONTROL,
  ARTWORK_MAX_BYTES,
  handleArtworkRequest,
} from './artwork-proxy.ts'

function artworkRequest(src: string, px = 300, extra = ''): Request {
  const params = new URLSearchParams({ src, px: String(px) })
  return new Request(`http://webpod.test/artwork?${params.toString()}${extra}`)
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
          new Response(Uint8Array.of(1, 2, 3), {
            status: 200,
            headers: { 'content-type': 'image/jpeg', 'content-length': '3' },
          }),
        )
      }),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/jpeg')
    expect(response.headers.get('content-length')).toBe('3')
    expect(await response.arrayBuffer()).toEqual(Uint8Array.of(1, 2, 3).buffer)
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
        controller.enqueue(Uint8Array.of(1, 2, 3))
        controller.enqueue(Uint8Array.of(4, 5, 6))
      },
      cancel() {
        cancelled = true
      },
    })
    const response = await handleArtworkRequest(artworkRequest(source), {
      maxBytes: 5,
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
