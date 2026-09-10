import { musicRuntime, ensureMusicRuntime, authorizeAppleRuntime, selectMusicRuntime, musicLoginUrl, musicRuntimeReady, type MusicRuntimeSnapshot } from './music-runtime'
import { getCompositeTierSnapshot, HTML_IN_CANVAS_FLAG, refreshCompositeTier, subscribeCompositeTier, type CapabilityReport } from '@webpod/composite'
import { atom, createStore, useAtomValue } from 'jotai'
import { Link, useNavigate } from '@tanstack/react-router'
import { Component, useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { browserWelcomeReason, welcomeAction, type WelcomeReason } from './browser-welcome-policy'
import { DeviceTeaser } from './device-teaser'
import './styles/browser-welcome.css'
import { createWelcomeEntry } from './welcome-entry'

const welcomeStore = createStore()
const pausedAtom = atom(false)
const reducedMotionAtom = atom(false)
const copyStatusAtom = atom('')
const checkStatusAtom = atom('')
const authorizationAttemptedAtom = atom(false)

/** Select the welcome before mounting player effects, account runtimes or controls. */
export function BrowserExperience({ children, landing = false }: { readonly children: ReactNode; readonly landing?: boolean }) {
  const navigate = useNavigate()
  const snapshot = useSyncExternalStore(subscribeCompositeTier, getCompositeTierSnapshot, getCompositeTierSnapshot)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const refresh = () => { if (!getCompositeTierSnapshot().contextLost) refreshCompositeTier() }
    // A restored page or a hot reload must not keep an old browser report.
    refresh()
    window.addEventListener('pageshow', refresh)
    media.addEventListener('change', refresh)
    return () => {
      window.removeEventListener('pageshow', refresh)
      media.removeEventListener('change', refresh)
    }
  }, [])
  const music = useSyncExternalStore(musicRuntime.subscribe, musicRuntime.getSnapshot, musicRuntime.getSnapshot)
  useEffect(() => { ensureMusicRuntime() }, [])
  const report = snapshot.report
  // Keep the existing restoration owner mounted when the live context is lost.
  const reason = report === null || snapshot.contextLost ? null : browserWelcomeReason(report)
  const capture = import.meta.env.DEV && new URLSearchParams(window.location.search).has('capture')
  useEffect(() => {
    if (!landing && !capture && music.phase !== 'signing-in' && !musicRuntimeReady(music)) {
      void navigate({ to: '/', replace: true })
    }
  }, [landing, capture, music, navigate])
  if (capture) return children
  if (report === null) return null
  if (!landing && reason === null && musicRuntimeReady(music)) return children
  return <BrowserWelcome report={report} reason={reason} />
}

/** The public landing stays visible even when the browser can run the player. */
export function LandingPage() {
  return <BrowserExperience landing>{null}</BrowserExperience>
}

const GUIDANCE: Record<WelcomeReason, { title: string; description: string }> = {
  experiment: { title: 'One last pause before you press play.', description: 'Enable HTML in Canvas so the screen inside your iPod can come to life.' },
  update: { title: 'A newer Chrome. A familiar feeling.', description: 'Update Chrome first, then enable HTML in Canvas if the experiment is still needed.' },
  browser: { title: 'This iPod needs desktop Chrome.', description: 'Open this page in a recent desktop Chrome. The player uses its experimental HTML in Canvas feature.' },
  graphics: { title: 'Your browser’s graphics need a hand.', description: 'webPod needs WebGL 2. Try enabling graphics acceleration in your browser settings, then relaunch.' },
  'reduced-motion': { title: 'A quieter look at webPod.', description: 'Your browser has HTML in Canvas. You’re seeing a still preview because reduced motion is enabled.' },
}

function BrowserWelcome({ report, reason }: { readonly report: CapabilityReport; readonly reason: WelcomeReason | null }) {
  const navigate = useNavigate()
  const welcomeRef = useRef<HTMLElement>(null)
  const entry = useRef(createWelcomeEntry(musicRuntime.getSnapshot))
  const enterDevice = async (accepted: MusicRuntimeSnapshot = musicRuntime.getSnapshot()) => {
    await entry.current(accepted, async (isCurrent) => {
      const welcome = welcomeRef.current
      if (!welcome || welcome.dataset['departing']) return
      welcome.dataset['departing'] = 'true'
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const model = welcome.querySelector<HTMLElement>('.webpod-welcome__model')
      // Finish the live player's descent before the router captures the home snapshot.
      const exit = !reduced && model ? model.animate([
        { transform: 'translateY(0)' },
        { transform: `translateY(${window.innerHeight - model.getBoundingClientRect().top + 32}px)` },
      ], { duration: 520, easing: 'cubic-bezier(.55, 0, .85, .45)', fill: 'forwards' }) : null
      try {
        await exit?.finished
        if (!welcome.isConnected || !isCurrent()) return false
        await navigate({ to: '/webpod', viewTransition: !reduced })
        return true
      } finally {
        exit?.cancel()
        delete welcome.dataset['departing']
      }
    })
  }
  const music = useSyncExternalStore(musicRuntime.subscribe, musicRuntime.getSnapshot, musicRuntime.getSnapshot)
  const signedIn = musicRuntimeReady(music)
  const signingIn = music.phase === 'signing-in'
  const action = welcomeAction(signedIn, signingIn, reason === null)
  const authorizationAttempted = useAtomValue(authorizationAttemptedAtom, { store: welcomeStore })
  useEffect(() => { ensureMusicRuntime() }, [music.provider])
  const signIn = async () => {
    welcomeStore.set(authorizationAttemptedAtom, true)
    const result = musicRuntime.getSnapshot().activeMode === 'spotify' && musicRuntime.getSnapshot().phase === 'error'
      ? await selectMusicRuntime('spotify') : await authorizeAppleRuntime()
    const capability = getCompositeTierSnapshot().report
    if (result.ready && capability !== null && browserWelcomeReason(capability) === null) {
      await enterDevice(result.snapshot)
    }
  }
  const paused = useAtomValue(pausedAtom, { store: welcomeStore })
  const reducedMotion = useAtomValue(reducedMotionAtom, { store: welcomeStore })
  const copyStatus = useAtomValue(copyStatusAtom, { store: welcomeStore })
  const checkStatus = useAtomValue(checkStatusAtom, { store: welcomeStore })
  const setup = reason === 'experiment' || reason === 'update'
  const guidance = reason === null ? null : GUIDANCE[reason]
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => welcomeStore.set(reducedMotionAtom, media.matches)
    update()
    media.addEventListener('change', update)
    welcomeStore.set(copyStatusAtom, '')
    welcomeStore.set(checkStatusAtom, '')
    return () => media.removeEventListener('change', update)
  }, [])
  const copy = async () => {
    welcomeStore.set(checkStatusAtom, '')
    try {
      await navigator.clipboard.writeText(HTML_IN_CANVAS_FLAG)
      welcomeStore.set(copyStatusAtom, 'Copied. Paste into the address bar of a new tab.')
    } catch {
      welcomeStore.set(copyStatusAtom, 'Select the address below and copy it manually.')
    }
  }
  const recheck = () => {
    welcomeStore.set(copyStatusAtom, '')
    const next = refreshCompositeTier()
    welcomeStore.set(checkStatusAtom, next.report !== null && browserWelcomeReason(next.report) === null
      ? 'Ready. Open webPod to start listening.'
      : 'Not ready yet. After changing the setting, relaunch Chrome and return here.')
  }
  return <main ref={welcomeRef} className="webpod-welcome" data-browser-welcome={reason}>
    <header className="webpod-welcome__masthead">
      <span className="webpod-welcome__wordmark">webPod</span>
      {reason === null ? null : <span className="webpod-welcome__edition">A little music time machine.</span>}
    </header>
    {guidance === null ? null : <section className="webpod-welcome__banner" aria-labelledby="browser-setup-title">
      <div className="webpod-welcome__guidance">
        <h1 id="browser-setup-title">{guidance.title}</h1>
        <p>{guidance.description}</p>
      </div>
      <div className="webpod-welcome__setup">
        {setup ? <>
          <div className="webpod-welcome__actions">
            <button className="webpod-welcome__primary" type="button" onClick={() => void copy()}>Copy address <span aria-hidden="true">↗</span></button>
            <button type="button" onClick={recheck}>Check again</button>
          </div>
          <p className="webpod-welcome__steps">Paste in a new tab. Set <strong>HTML-in-Canvas</strong> to <strong>Enabled</strong>, then <strong>Relaunch</strong>.</p>
          <a className="webpod-welcome__flag" href={HTML_IN_CANVAS_FLAG} target="_blank" rel="noopener noreferrer">{HTML_IN_CANVAS_FLAG}</a>
          <p className="webpod-welcome__hint">Chrome blocks direct links to settings; copy and paste if it won’t open.</p>
        </> : reason === 'browser' ? <a className="webpod-welcome__primary" href="https://www.google.com/chrome/" target="_blank" rel="noopener noreferrer">Get Chrome <span aria-hidden="true">↗</span></a>
          : reason === 'graphics' ? <button type="button" onClick={recheck}>Check again</button> : null}
        {reason === 'update' ? <a href="https://www.google.com/chrome/" target="_blank" rel="noopener noreferrer">Get the latest Chrome ↗</a> : null}
        <p className="webpod-welcome__status" role="status">{copyStatus || checkStatus}</p>
      </div>
    </section>}
    <section className="webpod-welcome__showcase" aria-label="Device preview">
      <div className="webpod-welcome__intro">
        <h2>A thousand songs<span className="webpod-welcome__aside">(or more…)</span><em>That same feeling!</em></h2>
        <p>Let’s relive one of the best moments in personal hardware history.<br />On your own, or with an agent using WebMCP.</p>
      </div>
      <div className="webpod-welcome__model" role="img" aria-label="A black iPod Classic with a demo music screen. The looping preview turns to show three music stickers on its steel back.">
        {report.environment.webgl2 ? <PreviewBoundary><DeviceTeaser paused={paused} reducedMotion={reducedMotion || report.environment.prefersReducedMotion} /></PreviewBoundary> : <p className="webpod-welcome__no-graphics">The click wheel is waiting.<br />Enable graphics acceleration to take a look.</p>}
      </div>
      <div className="webpod-welcome__caption">
        {report.environment.webgl2 ? <button type="button" aria-label={reducedMotion || report.environment.prefersReducedMotion ? 'Motion reduced' : paused ? 'Resume preview' : 'Pause preview'} title={paused ? 'Resume preview' : 'Pause preview'} aria-pressed={paused} disabled={reducedMotion || report.environment.prefersReducedMotion} onClick={() => welcomeStore.set(pausedAtom, !paused)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            {paused || reducedMotion || report.environment.prefersReducedMotion ? <path d="M4 2 14 8 4 14Z" /> : <path d="M3 2h3v12H3zM10 2h3v12h-3z" />}
          </svg>
        </button> : null}
      </div>
    <div className="webpod-welcome__play-action">
      {typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('spotify') ? <p className="webpod-welcome__auth-status" role="status">Spotify sign-in wasn’t completed. Please try again.</p> : null}
      {action.kind === 'sign-in' ? <button type="button" className="webpod-welcome__primary" disabled={action.disabled} onClick={() => void signIn()}>{music.activeMode === 'spotify' && music.phase === 'error' ? 'Retry Spotify' : action.label} <span aria-hidden="true">↗</span></button>
        : !action.disabled ? <Link to="/webpod" className="webpod-welcome__primary" onClick={event => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
          event.preventDefault()
          void enterDevice()
        }}>Lets get playing! <span aria-hidden="true">↗</span></Link>
          : <button type="button" className="webpod-welcome__primary" disabled aria-describedby="browser-setup-title">Lets get playing! <span aria-hidden="true">↗</span></button>}
      {!signedIn ? <a className="webpod-welcome__spotify" href={musicLoginUrl('spotify')}>or use Spotify</a> : null}
      {!signedIn ? <p className="webpod-welcome__auth-status">Connect your music library securely.<br />Apple Music or Spotify Premium required.</p> : null}
      {music.phase === 'error' || music.phase === 'permission-denied' ? <p className="webpod-welcome__auth-status" role="status">{music.activeMode === 'spotify' ? music.message : !authorizationAttempted ? 'Apple Music is temporarily unavailable. Try connecting again shortly.' : music.phase === 'permission-denied' ? 'Access wasn’t granted. You can connect again when you’re ready.' : 'Couldn’t connect to Apple Music. Please try again.'}</p> : null}
    </div>
    </section>
    <footer className="webpod-welcome__footer">
      <small>Inspired by one of personal hardware’s most significant innovations, and built for the joy of listening.</small>
      <small>{report.environment.chromiumMajor === null ? '' : `Chromium ${report.environment.chromiumMajor} · `}{report.requestPaint ? 'HTML in Canvas available' : 'HTML in Canvas unavailable'}</small>
    </footer>
  </main>
}

/** A driver/renderer failure must leave browser setup readable and actionable. */
class PreviewBoundary extends Component<{ readonly children: ReactNode }, { readonly failed: boolean }> {
  override state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  override render() {
    return this.state.failed ? <p className="webpod-welcome__no-graphics">The 3D preview couldn’t start.<br />Try relaunching with graphics acceleration enabled.</p> : this.props.children
  }
}
