import type { CapabilityReport } from '@webpod/composite'

export type WelcomeReason = 'experiment' | 'update' | 'browser' | 'graphics' | 'reduced-motion'

/** Version dates the setup instructions; only the observed API can bypass them. */
export function browserWelcomeReason(report: CapabilityReport): WelcomeReason | null {
  if (!report.environment.webgl2) return 'graphics'
  if (report.requestPaint) {
    return null
  }
  const { userAgent, chromiumMajor } = report.environment
  if (!/(?:Chrome|Chromium)\//.test(userAgent) || /Android|iPhone|iPad/.test(userAgent)) return 'browser'
  // Chrome's published testing guidance starts at Canary 149. This is not a
  // shipping milestone and must never be used to assume the flag is unnecessary.
  return chromiumMajor !== null && chromiumMajor < 149 ? 'update' : 'experiment'
}

/** Gentle front hold -> rear hold -> front. Derivatives are zero at each join. */
export function previewYaw(seconds: number): number {
  const phase = ((seconds % 24) + 24) % 24
  const ease = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
  if (phase < 7) return 0
  if (phase < 11) return 0 + 180 * ease((phase - 7) / 4)
  if (phase < 17) return 180
  if (phase < 21) return 180 + 180 * ease((phase - 17) / 4)
  return 360
}

/** Authentication stays available before experimental rendering is enabled. */
export function welcomeAction(signedIn: boolean, signingIn: boolean, browserReady: boolean) {
  if (!signedIn) return { kind: 'sign-in', label: signingIn ? 'Connecting…' : 'Sign in to play', disabled: signingIn } as const
  return { kind: 'play', label: 'Lets get playing!', disabled: !browserReady } as const
}
