/**
 * `_probe.capabilities` — the html-in-canvas capability probe (W6.0).
 *
 * This is a dev-only diagnostic, and it is deliberately NOT a proof-only
 * route: every value on the page is read from `@webpod/composite`'s real
 * `getCapabilities()`, the same function the product's tier detection
 * calls. There is no parallel copy here, so a screenshot of this page is a
 * statement about the app rather than about the page.
 *
 * `ssr: false` because the probe touches `document`, `navigator` and a
 * WebGL context. That also keeps the route free of React state: the report
 * is resolved once, module-side, by `getCapabilities()` — so there is no
 * `useState` to ban and nothing for the Jotai store to hold yet. The tier
 * atom belongs to W6.1, not here.
 */
import { createFileRoute } from '@tanstack/react-router'

import {
  HTML_IN_CANVAS_FLAG,
  getCapabilities,
  type CapabilityReport,
  type ProbeGroup,
  type ProbeResult,
  type Tier,
} from '@webpod/composite'

export const Route = createFileRoute('/_probe/capabilities')({
  ssr: false,
  component: CapabilityProbe,
})

/* ─────────────────────────────────────────────────────────────
   Tone. One accent, one warning, one destructive — no more.
   The verdict block is the only place colour carries meaning,
   and it never carries it alone: every state is also worded.
   ───────────────────────────────────────────────────────────── */

const TIER_TONE: Record<Tier, { readonly text: string; readonly headline: string }> = {
  T1: {
    text: 'text-green-500',
    headline: 'html-in-canvas is exposed. The main path is live.',
  },
  T2: {
    text: 'text-amber-500',
    headline: 'Running on the polyfill. Fidelity is unknown.',
  },
  T3: {
    text: 'text-amber-500',
    headline: 'html-in-canvas is NOT exposed. The flag is off, or this build does not have it.',
  },
  T4: {
    text: 'text-red-500',
    headline: 'No device render. The product runs as flat DOM.',
  },
}

function Verdict({ report }: { readonly report: CapabilityReport }) {
  const tone = TIER_TONE[report.tier]
  const maskedByPreference = report.tier !== report.capabilityTier

  return (
    <section className="border-border bg-card rounded-xl border p-6" aria-labelledby="verdict-heading">
      <p className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
        Resolved tier
      </p>
      <div className="mt-3 flex items-baseline gap-4">
        <h2 id="verdict-heading" className={`font-machine text-6xl leading-none font-semibold ${tone.text}`}>
          {report.tier}
        </h2>
        <p className="text-xl leading-snug font-medium">{tone.headline}</p>
      </div>
      <p className="text-muted-foreground mt-4 max-w-[72ch] text-sm leading-relaxed">
        {report.tierReason}
      </p>
      {maskedByPreference ? (
        <p className="border-border text-muted-foreground mt-4 max-w-[72ch] border-l-2 pl-3 text-sm leading-relaxed">
          A user preference moved this, not the browser. On capabilities alone this machine resolves{' '}
          <span className="font-machine font-semibold">{report.capabilityTier}</span>. The rows below
          are the unfiltered facts.
        </p>
      ) : null}
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────
   The headline answers. Everything else is corroboration.
   ───────────────────────────────────────────────────────────── */

function Headline({
  question,
  answer,
  positive,
  detail,
}: {
  readonly question: string
  readonly answer: string
  readonly positive: boolean
  readonly detail: string
}) {
  return (
    <div className="border-border bg-card rounded-xl border p-5">
      <p className="font-machine text-muted-foreground text-xs break-words">{question}</p>
      <p className={`mt-2 text-2xl font-semibold ${positive ? 'text-green-500' : 'text-red-500'}`}>
        {answer}
      </p>
      <p className="text-muted-foreground mt-3 max-w-[60ch] text-sm leading-relaxed">{detail}</p>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Probe tables. Real table semantics so the page is readable by
   a screen reader as well as screenshottable.
   ───────────────────────────────────────────────────────────── */

function Row({ result }: { readonly result: ProbeResult }) {
  return (
    <tr className="border-border/60 border-t align-top">
      <td className="py-2.5 pr-4">
        <span className="font-machine text-sm break-all">{result.name}</span>
      </td>
      <td className="py-2.5 pr-4 whitespace-nowrap">
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className={`inline-block size-2 rounded-full ${result.present ? 'bg-green-500' : 'bg-muted-foreground/50'}`}
          />
          <span className={`text-sm font-medium ${result.present ? 'text-green-500' : 'text-muted-foreground'}`}>
            {result.present ? 'present' : 'absent'}
          </span>
        </span>
      </td>
      <td className="font-machine text-muted-foreground py-2.5 pr-4 text-sm whitespace-nowrap">
        {result.detail ?? '—'}
      </td>
      <td className="text-muted-foreground max-w-[54ch] py-2.5 text-sm leading-relaxed">
        {result.note}
      </td>
    </tr>
  )
}

function Group({ group }: { readonly group: ProbeGroup }) {
  return (
    <section aria-labelledby={`group-${group.id}`}>
      <h3 id={`group-${group.id}`} className="text-base font-semibold">
        {group.title}
      </h3>
      <p className="text-muted-foreground mt-1 max-w-[80ch] text-sm">{group.subtitle}</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[52rem] border-collapse text-left">
          <thead>
            <tr className="text-muted-foreground text-xs tracking-[0.12em] uppercase">
              <th scope="col" className="pb-2 pr-4 font-medium">
                Member
              </th>
              <th scope="col" className="pb-2 pr-4 font-medium">
                State
              </th>
              <th scope="col" className="pb-2 pr-4 font-medium">
                Arity
              </th>
              <th scope="col" className="pb-2 font-medium">
                Why it matters
              </th>
            </tr>
          </thead>
          <tbody>
            {group.results.map((result) => (
              <Row key={result.name} result={result} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Environment({ report }: { readonly report: CapabilityReport }) {
  const { environment } = report
  const rows: ReadonlyArray<readonly [string, string]> = [
    ['User agent', environment.userAgent],
    ['UA-CH brands', environment.brands.length > 0 ? environment.brands.join(' · ') : 'not exposed'],
    [
      'Chromium major',
      environment.chromiumMajor === null ? 'unknown' : String(environment.chromiumMajor),
    ],
    ['WebGL2', environment.webgl2 ? 'available' : 'NOT available'],
    ['WebGL (any)', environment.webgl1 ? 'available' : 'NOT available'],
    ['devicePixelRatio', String(environment.devicePixelRatio)],
    [
      'prefers-reduced-motion',
      environment.prefersReducedMotion ? 'reduce — forces T4' : 'no-preference',
    ],
    ['Probed at', report.probedAt],
  ]

  return (
    <section aria-labelledby="environment-heading">
      <h3 id="environment-heading" className="text-base font-semibold">
        Environment
      </h3>
      <p className="text-muted-foreground mt-1 max-w-[80ch] text-sm">
        Captured for the record. None of it is an input to the tier — detection is by feature only,
        never by user-agent string.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-left">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label} className="border-border/60 border-t align-top">
                <th scope="row" className="text-muted-foreground w-56 py-2.5 pr-4 text-sm font-medium">
                  {label}
                </th>
                <td className="font-machine py-2.5 text-sm break-all">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────
   Page
   ───────────────────────────────────────────────────────────── */

function CapabilityProbe() {
  if (!import.meta.env.DEV) {
    return (
      <main className="bg-background text-foreground font-ui min-h-dvh p-10">
        <h1 className="text-xl font-semibold">Diagnostic route</h1>
        <p className="text-muted-foreground mt-2 max-w-[60ch] text-sm">
          The capability probe is a development diagnostic and is not served from a production
          build. Run <span className="font-machine">bun dev</span> and open this URL again.
        </p>
      </main>
    )
  }

  const report = getCapabilities()
  const entry = report.webglEntryPoint

  return (
    <main className="bg-background text-foreground font-ui min-h-dvh px-6 py-10 sm:px-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-10">
        <header>
          <p className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
            webPod · W6.0 diagnostic
          </p>
          <h1 className="mt-2 text-3xl font-semibold">html-in-canvas capability probe</h1>
          <p className="text-muted-foreground mt-3 max-w-[76ch] text-sm leading-relaxed">
            Rendered from <span className="font-machine">@webpod/composite</span>&rsquo;s{' '}
            <span className="font-machine">getCapabilities()</span> — the same detection the product
            uses to resolve its tier. Enable with{' '}
            <span className="font-machine text-foreground">{HTML_IN_CANVAS_FLAG}</span> in Chrome
            Canary, then reload.
          </p>
        </header>

        <Verdict report={report} />

        <div className="grid items-start gap-4 lg:grid-cols-3">
          <Headline
            question="'requestPaint' in HTMLCanvasElement.prototype"
            answer={report.requestPaint ? 'true' : 'false'}
            positive={report.requestPaint}
            detail={
              report.requestPaint
                ? 'The gate three.js itself tests. html-in-canvas is exposed in this browser.'
                : `The gate three.js itself tests. html-in-canvas is not exposed. Enable ${HTML_IN_CANVAS_FLAG} and reload; if it is already on, this build does not carry the API.`
            }
          />
          <Headline
            question="WebGL entry point — which name shipped?"
            answer={entry.name ?? 'neither'}
            positive={entry.available}
            detail={entry.verdict}
          />
          <Headline
            question="Geometry API — which generation shipped?"
            answer={report.geometryApi.name ?? 'neither'}
            positive={report.geometryApi.generation !== 'none'}
            detail={report.geometryApi.verdict}
          />
        </div>

        {report.groups.map((group) => (
          <Group key={group.id} group={group} />
        ))}

        <Environment report={report} />

        {/* Collapsed by default: expanded it is ~2000px tall and buries the
            findings above it, which makes a full-page screenshot mostly
            noise. `<details>` keeps it one click away and selectable
            without introducing any component state. */}
        <details className="border-border bg-card rounded-xl border p-4">
          <summary className="cursor-pointer text-base font-semibold">
            Raw report
            <span className="text-muted-foreground ml-2 text-sm font-normal">
              — the same object, for{' '}
              <span className="font-machine">evidence/w6-capability-probe-*</span>
            </span>
          </summary>
          <pre className="font-machine mt-3 overflow-x-auto text-xs leading-relaxed">
            {JSON.stringify(report, null, 2)}
          </pre>
        </details>
      </div>
    </main>
  )
}
