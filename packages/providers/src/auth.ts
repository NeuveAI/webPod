import type { MusicProvider } from './provider'
import type { Session } from './domain'
import type { AppleMusicProvider } from './apple/apple-provider'

/** Native session truth stays in the provider; redirect initiation never creates a session. */
export type MusicAuthConnector = {
  readonly provider: MusicProvider
  restore(): Promise<void>
  logout(): Promise<void>
} & ({ readonly flow: 'gesture'; authorize(): Promise<Session> } | { readonly flow: 'redirect'; readonly loginUrl: string })

export function appleMusicAuth(provider: AppleMusicProvider): MusicAuthConnector {
  return { provider, flow: 'gesture', restore: () => provider.configure(), authorize: () => provider.authorize(), logout: () => provider.unauthorize() }
}

export function spotifyMusicAuth(provider: MusicProvider): MusicAuthConnector {
  return { provider, flow: 'redirect', loginUrl: '/api/spotify/login', restore: () => provider.configure(), logout: () => provider.unauthorize() }
}
