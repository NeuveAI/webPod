import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto'
import { z } from 'zod'

const sessionSchema = z.object({
  access: z.string(),
  refresh: z.string(),
  expires: z.number(),
  until: z.number(),
})
const flowSchema = z.object({
  state: z.string(),
  verifier: z.string(),
  redirect: z.string(),
  until: z.number(),
})
const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().optional(),
  expires_in: z.number().positive(),
})
const scopes =
  'streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state user-library-read user-library-modify playlist-read-private playlist-read-collaborative playlist-modify-private playlist-modify-public user-follow-read'
const sessionName = 'webpod_spotify'
const flowName = 'webpod_spotify_flow'
const lifetime = 30 * 86400

function configuration() {
  const id = process.env['SPOTIFY_CLIENT_ID']
  const secret = process.env['SPOTIFY_CLIENT_SECRET']
  if (!id || !secret)
    throw new Error('Spotify is not configured on this server.')
  return {
    id,
    secret,
    key: createHash('sha256')
      .update(`webpod-spotify-session:${secret}`)
      .digest(),
  }
}
function seal(value: object): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', configuration().key, iv)
  const body = Buffer.concat([
    cipher.update(JSON.stringify(value), 'utf8'),
    cipher.final(),
  ])
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url')
}
function unseal(request: Request, name: string): unknown {
  try {
    const cookie = request.headers
      .get('cookie')
      ?.split(';')
      .map((v) => v.trim())
      .find((v) => v.startsWith(`${name}=`))
      ?.slice(name.length + 1)
    if (!cookie || cookie.length > 6000) return null
    const bytes = Buffer.from(cookie, 'base64url')
    const decipher = createDecipheriv(
      'aes-256-gcm',
      configuration().key,
      bytes.subarray(0, 12),
    )
    decipher.setAuthTag(bytes.subarray(12, 28))
    return JSON.parse(
      Buffer.concat([
        decipher.update(bytes.subarray(28)),
        decipher.final(),
      ]).toString('utf8'),
    )
  } catch {
    return null
  }
}
function cookie(request: Request, name: string, value: string, age: number) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`
}
function headers() {
  return new Headers({
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
  })
}
function redirect(location: string, responseHeaders = headers()) {
  responseHeaders.set('Location', location)
  return new Response(null, { status: 302, headers: responseHeaders })
}
async function exchange(params: URLSearchParams) {
  const { id, secret } = configuration()
  const result = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
    signal: AbortSignal.timeout(15000),
  })
  if (!result.ok)
    throw new Error('Spotify authorization expired. Please connect again.')
  return tokenSchema.parse(await result.json())
}

/** Handles OAuth only on the server. Refresh tokens are sealed, never returned to JavaScript. */
export async function spotifyRoute(
  request: Request,
  action: 'login' | 'callback' | 'token' | 'logout',
): Promise<Response> {
  const h = headers()
  const url = new URL(request.url)
  try {
    if (action === 'login') {
      if (url.hostname === 'localhost') {
        url.hostname = '127.0.0.1'
        return redirect(url.toString())
      }
      const { id } = configuration()
      const state = randomBytes(24).toString('base64url')
      const verifier = randomBytes(48).toString('base64url')
      const callback = `${url.origin}/api/spotify/callback`
      h.append(
        'Set-Cookie',
        cookie(
          request,
          flowName,
          seal({
            state,
            verifier,
            redirect: callback,
            until: Date.now() + 600000,
          }),
          600,
        ),
      )
      return redirect(
        `https://accounts.spotify.com/authorize?${new URLSearchParams({ client_id: id, response_type: 'code', redirect_uri: callback, state, scope: scopes, code_challenge_method: 'S256', code_challenge: createHash('sha256').update(verifier).digest('base64url') })}`,
        h,
      )
    }
    if (action === 'callback') {
      const flow = flowSchema.safeParse(unseal(request, flowName))
      h.append('Set-Cookie', cookie(request, flowName, '', 0))
      if (
        !flow.success ||
        flow.data.until < Date.now() ||
        flow.data.state !== url.searchParams.get('state')
      )
        return redirect('/?spotify=invalid-state', h)
      if (url.searchParams.has('error')) return redirect('/?spotify=denied', h)
      const code = url.searchParams.get('code')
      if (!code) return redirect('/?spotify=failed', h)
      const token = await exchange(
        new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: flow.data.redirect,
          code_verifier: flow.data.verifier,
        }),
      )
      if (!token.refresh_token) throw new Error('Missing refresh token')
      h.append(
        'Set-Cookie',
        cookie(
          request,
          sessionName,
          seal({
            access: token.access_token,
            refresh: token.refresh_token,
            expires: Date.now() + token.expires_in * 1000,
            until: Date.now() + lifetime * 1000,
          }),
          lifetime,
        ),
      )
      return redirect('/?music=spotify', h)
    }
    // POST + Origin prevents cross-site token reads and forced logout. Never enable CORS here.
    if (
      request.method !== 'POST' ||
      request.headers.get('origin') !== url.origin
    )
      return new Response(null, { status: 403, headers: h })
    if (action === 'logout') {
      h.append('Set-Cookie', cookie(request, sessionName, '', 0))
      return new Response(null, { status: 204, headers: h })
    }
    const parsed = sessionSchema.safeParse(unseal(request, sessionName))
    if (!parsed.success || parsed.data.until < Date.now())
      return new Response(null, { status: 401, headers: h })
    let session = parsed.data
    if (session.expires < Date.now() + 60000) {
      const token = await exchange(
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: session.refresh,
        }),
      )
      session = {
        ...session,
        access: token.access_token,
        refresh: token.refresh_token ?? session.refresh,
        expires: Date.now() + token.expires_in * 1000,
      }
      h.append(
        'Set-Cookie',
        cookie(
          request,
          sessionName,
          seal(session),
          Math.max(0, Math.floor((session.until - Date.now()) / 1000)),
        ),
      )
    }
    return Response.json(
      { accessToken: session.access, expiresAt: session.expires },
      { headers: h },
    )
  } catch {
    if (action === 'callback') return redirect('/?spotify=failed', h)
    return Response.json(
      { error: 'Could not connect to Spotify. Please try signing in again.' },
      { status: 503, headers: h },
    )
  }
}
