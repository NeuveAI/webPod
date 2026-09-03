import { createHash } from 'node:crypto'

const SDK_URL = 'https://js-cdn.music.apple.com/musickit/v1/musickit.js'
const EXPECTED_SHA256 = '0ccb2ab37cedaef2eab9c7044c99afdb8c73a122a29ad8b7344af644a15bd14b'

const response = await fetch(SDK_URL)
if (!response.ok) throw new Error(`MusicKit SDK fetch failed with HTTP ${response.status}`)
const source = await response.text()
const sha256 = createHash('sha256').update(source).digest('hex')
if (sha256 !== EXPECTED_SHA256) throw new Error(`MusicKit SDK digest changed: ${sha256}`)

function requireMatch(label: string, pattern: RegExp): string {
  const match = pattern.exec(source)
  if (match?.[1] === undefined) throw new Error(`Could not extract ${label}`)
  return match[1]
}

const playbackEnum = requireMatch('PlaybackStates enum', /function\(e\)\{(e\[e\.none=0\]="none"[^}]+e\[e\.completed=10\]="completed")\}\(e\.PlaybackStates/)
const mediaItemEnum = requireMatch('media item state enum', /function\(e\)\{(e\[e\.none=0\]="none"[^}]+e\[e\.error=7\]="error")\}\([A-Za-z_$][\w$]*\|\|/)
const statePayload = requireMatch('state-change payload', /set:function\(e\)\{(var t=\{oldState:this\._state,state:e\})/)
const playbackPayload = requireMatch('playback-state payload', /set:function\(e\)\{(var t=\{oldState:this\._playbackState,state:e\})/)
const mediaForwarding = requireMatch('media-item forwarding payload', /beginMonitoringStateDidChange\(function\(e\)\{return [A-Za-z_$][\w$]*\.dispatchEvent\([^,]+,(e)\)\}\)/)

console.log(JSON.stringify({
  sdk: { url: SDK_URL, sha256 },
  playbackEnum,
  mediaItemEnum,
  payloads: { directMediaItem: statePayload, directPlayback: playbackPayload, forwardedMediaItemArgument: mediaForwarding },
}, null, 2))
