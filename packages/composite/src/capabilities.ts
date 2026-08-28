/**
 * Capability detection for the panel -> screen-mesh composite seam.
 *
 * This is the real detection the product uses. `apps/web`'s `_probe`
 * diagnostic renders the output of these functions rather than keeping a
 * parallel copy, so what the owner screenshots is what the app decides.
 *
 * ## Grounding
 *
 * Every name below was read out of the local clones, not recalled. The
 * `html-in-canvas` API is absent from or wrong in training data, and it is
 * mid-rename in at least three places, so the sources are cited per probe.
 *
 * - `~/code/agentic-context/html-in-canvas/README.md` (@ fcbe8f3) - the five
 *   primitives and the `IDL changes` block, which is the current spelling.
 * - `~/code/agentic-context/html-in-canvas/Examples/webGL.html` - the demo
 *   whose `loadTexture` carries a try/catch across *two signatures of
 *   `texElementImage2D`*, with the comment "The texElementImage2D API was
 *   recently changed".
 * - `~/code/agentic-context/three.js/src/textures/HTMLTexture.js` - the
 *   feature-detect idiom, `'requestPaint' in parent`.
 * - `~/code/agentic-context/three.js/src/renderers/webgl/WebGLTextures.js`
 *   lines 1257-1318 - the shipped consumer. It gates on
 *   `'texElementImage2D' in _gl` and branches on `.length === 3`, with the
 *   comments `// Chrome 150+` and `// Chrome 138 - 149`.
 *
 * ## The rename, stated precisely
 *
 * There are two independent axes of churn, and conflating them produces a
 * wrong answer:
 *
 * 1. **Name.** The README IDL declares `texElementSubImage2D`. Both the
 *    spec repo's own WebGL demo and three.js call `texElementImage2D`. The
 *    IDL is ahead of the implementation; only the browser can say which
 *    one actually shipped, which is the whole point of this probe.
 * 2. **Arity.** `texElementImage2D` itself was re-signatured from six
 *    arguments to three. three.js reads `.length` to tell them apart, so
 *    the arity is reported here too - it dates the build.
 *
 * The same churn hit `getCanvasTransform` (README IDL) versus
 * `getElementTransform` (the demos), so both are probed.
 *
 * ## Rules
 *
 * Feature-detect only. Nothing here branches on `navigator.userAgent`; the
 * UA is captured for the report and is never an input to `resolveTier`.
 */

/** The four fidelities in `preview-validation.md`. One architecture, not four. */
export type Tier = 'T1' | 'T2' | 'T3' | 'T4'

/** The Chrome flag that turns the whole API on. Shown to the owner verbatim. */
export const HTML_IN_CANVAS_FLAG = 'chrome://flags/#canvas-draw-element'

/** One feature-detected fact. */
export interface ProbeResult {
  /** The member name, exactly as it is spelled in the API. */
  readonly name: string
  readonly present: boolean
  /** Extra observed fact, e.g. a function's arity. `null` when absent. */
  readonly detail: string | null
  /** Where this name comes from and why it matters. */
  readonly note: string
}

/** A titled set of probes, so the diagnostic renders from data. */
export interface ProbeGroup {
  readonly id: string
  readonly title: string
  readonly subtitle: string
  readonly results: readonly ProbeResult[]
}

/**
 * Which generation of the DOM-to-canvas geometry API this browser ships.
 *
 * The explainer and the implementation are a generation apart, and the two
 * generations solve the same problem by different mechanisms, so the runtime has
 * to be written against whichever one actually exists:
 *
 * - `explainer` — `updateElementGeometry({ canvasTransform })` plus
 *   `getCanvasTransform` / `clearElementGeometry`. The canvas owns the
 *   element's geometry, and setting the canvas transform is what adds
 *   a11y geometry and inserts the element into the canvas hit-test list.
 * - `shipped` — `getElementTransform(element, screenSpaceTransform)`,
 *   which hands back a CSS transform that the author writes to
 *   `element.style.transform`. The element is genuinely transformed DOM,
 *   so hit-testing, focus, selection and a11y geometry are native and
 *   come from the CSS transform rather than from a canvas-side call.
 */
export type GeometryApiGeneration = 'explainer' | 'shipped' | 'none'

export interface GeometryApi {
  readonly generation: GeometryApiGeneration
  /** The member that carries the DOM<->canvas mapping here, or `null`. */
  readonly name: string | null
  readonly verdict: string
}

/** The mid-rename WebGL entry point, resolved by name. */
export interface WebGLEntryPoint {
  /** `false` when neither candidate exists on the context. */
  readonly available: boolean
  /** The name that actually exists, or `null`. */
  readonly name: string | null
  /** Declared parameter count of that method, or `null`. */
  readonly arity: number | null
  /** What the arity means, read off three.js's own branch. */
  readonly signature: string | null
  /** One sentence a human can act on. */
  readonly verdict: string
}

export interface EnvironmentReport {
  readonly userAgent: string
  /** From UA Client Hints when present; display only, never a decision input. */
  readonly brands: readonly string[]
  /** Chromium major version, for dating the build against three.js's 138/150 boundary. */
  readonly chromiumMajor: number | null
  readonly devicePixelRatio: number
  readonly prefersReducedMotion: boolean
  readonly webgl2: boolean
  readonly webgl1: boolean
}

export interface CapabilityReport {
  readonly probedAt: string
  readonly environment: EnvironmentReport
  /** The single headline gate, identical to three.js's `'requestPaint' in parent`. */
  readonly requestPaint: boolean
  /** Whether `layoutSubtree` reflects both ways on a real `<canvas>`. */
  readonly layoutSubtreeReflects: boolean
  readonly webglEntryPoint: WebGLEntryPoint
  /** Which generation of the geometry/hit-test API this browser ships. */
  readonly geometryApi: GeometryApi
  readonly groups: readonly ProbeGroup[]
  readonly tier: Tier
  readonly tierReason: string
  /**
   * The tier the capabilities alone imply, ignoring user preferences.
   *
   * `prefers-reduced-motion` forces T4 by design, which would otherwise
   * mask the answer this probe exists to give. When this differs from
   * `tier`, the preference - not the browser - is what moved it.
   */
  readonly capabilityTier: Tier
}

/* ─────────────────────────────────────────────────────────────
   Probe tables. Name + provenance live together so the note on
   screen and the reason for probing cannot drift apart.
   ───────────────────────────────────────────────────────────── */

const CANVAS_MEMBERS: ReadonlyArray<{ name: string; note: string }> = [
  {
    name: 'requestPaint',
    note: 'The gate. three.js HTMLTexture.js tests exactly this, as `\'requestPaint\' in parent`. If this is false nothing else matters.',
  },
  {
    name: 'onpaint',
    note: 'The `paint` event handler. Fires after the Paint step; DOM changes made inside it land on the NEXT frame.',
  },
  {
    name: 'layoutSubtree',
    note: 'README IDL: `[CEReactions, Reflect] attribute boolean layoutSubtree`. Content attribute is lowercase `layoutsubtree`.',
  },
  {
    name: 'captureElementImage',
    note: 'Takes an `ElementImage` snapshot that can be transferred to a worker and drawn to an OffscreenCanvas.',
  },
  {
    name: 'updateElementGeometry',
    note: 'MANDATORY for 3D contexts. Supplies `canvasTransform`, which is what adds a11y GEOMETRY and inserts the element into the canvas hit-test list. 2D gets it free from drawElementImage; WebGL does not.',
  },
  {
    name: 'clearElementGeometry',
    note: 'Clears the hit-test entry and canvas transform set by updateElementGeometry.',
  },
  {
    name: 'getCanvasTransform',
    note: 'README IDL spelling. Returns the element\'s border-box -> canvas DOMMatrix.',
  },
  {
    name: 'getElementTransform',
    note: 'The OTHER half of the same rename - the spelling used by the WebGPU demo and by published guidance. Probed so we learn which one shipped.',
  },
  {
    name: 'onelementgeometryupdate',
    note: 'Fires when OffscreenCanvas-originated geometry updates have been applied on the main thread.',
  },
]

const GLOBAL_MEMBERS: ReadonlyArray<{ name: string; note: string }> = [
  {
    name: 'ElementImage',
    note: 'The transferable snapshot handle returned by captureElementImage.',
  },
  {
    name: 'PaintEvent',
    note: 'README IDL declares `interface PaintEvent : Event` with a `changedElements` list. three.js reads `event.changedElements` in its paint handler, so the data is delivered even where the constructor is not exposed.',
  },
  {
    name: 'ElementGeometryUpdateEvent',
    note: 'Only meaningful alongside updateElementGeometry. Its absence corroborates which generation of the API shipped.',
  },
]

const CONTEXT_2D_MEMBERS: ReadonlyArray<{ name: string; note: string }> = [
  {
    name: 'drawElementImage',
    note: 'The 2D draw path. Not used by this product - the panel goes into a WebGL texture - but its presence corroborates that the flag is on rather than a single member being polyfilled.',
  },
]

const WEBGL_ENTRY_POINT_CANDIDATES: ReadonlyArray<{ name: string; note: string }> = [
  {
    name: 'texElementSubImage2D',
    note: 'The CURRENT README IDL name (partial interface WebGLRenderingContext). Not called by three.js and not called by the spec repo\'s own demo - the IDL is ahead of the implementation.',
  },
  {
    name: 'texElementImage2D',
    note: 'The name that Examples/webGL.html and three.js WebGLTextures.js actually call. If exactly one of these two exists, this is the one that shipped.',
  },
]

/* ─────────────────────────────────────────────────────────────
   Reflection helpers. `unknown`-typed on purpose: these members
   are not in lib.dom, and `any` is banned repo-wide.
   ───────────────────────────────────────────────────────────── */

function memberOf(target: object, name: string): unknown {
  return (target as unknown as Record<string, unknown>)[name]
}

/**
 * Declared parameter count of a member, or `null` if it is not a function.
 *
 * Read through property descriptors rather than by `target[name]`, walking
 * the prototype chain by hand. Reading the value directly would *invoke*
 * the getter behind an IDL attribute, and half these members are IDL
 * attributes: `HTMLCanvasElement.prototype.layoutSubtree` and the `onpaint`
 * handlers all throw `Illegal invocation` when their getter runs with the
 * prototype as `this`. That fault is only reachable when the flag is on —
 * with it off the members do not exist and nothing is read — so it is
 * exactly the kind of bug a probe must not have.
 */
function arityOf(target: object, name: string): number | null {
  let cursor: object | null = target
  while (cursor !== null) {
    const descriptor = Object.getOwnPropertyDescriptor(cursor, name)
    if (descriptor !== undefined) {
      const { value } = descriptor
      return typeof value === 'function' ? value.length : null
    }
    cursor = Object.getPrototypeOf(cursor) as object | null
  }
  return null
}

function probeMembers(
  target: object,
  members: ReadonlyArray<{ name: string; note: string }>,
): readonly ProbeResult[] {
  return members.map(({ name, note }) => {
    const present = name in target
    const arity = present ? arityOf(target, name) : null
    return {
      name,
      present,
      detail: arity === null ? null : `${String(arity)}-arg`,
      note,
    }
  })
}

/**
 * Does `layoutSubtree` actually reflect, in both directions, on a real
 * `<canvas>`?
 *
 * `'layoutSubtree' in HTMLCanvasElement.prototype` only proves the IDL
 * attribute is declared. Reflection is the behaviour the composite depends
 * on: three.js sets the lowercase content attribute
 * (`canvas.setAttribute('layoutsubtree', 'true')`) while the IDL exposes the
 * camelCase property, so both directions have to agree or the two halves of
 * the stack are talking past each other.
 */
function probeLayoutSubtreeReflection(): readonly ProbeResult[] {
  const declared = 'layoutSubtree' in HTMLCanvasElement.prototype

  let propToAttr = false
  let attrToProp = false

  if (declared) {
    const a = document.createElement('canvas')
    const target = a as unknown as Record<string, unknown>
    target['layoutSubtree'] = true
    propToAttr = a.hasAttribute('layoutsubtree')

    const b = document.createElement('canvas')
    b.setAttribute('layoutsubtree', 'true')
    attrToProp = (b as unknown as Record<string, unknown>)['layoutSubtree'] === true
  }

  return [
    {
      name: "'layoutSubtree' in HTMLCanvasElement.prototype",
      present: declared,
      detail: null,
      note: 'The IDL attribute is declared. Necessary, not sufficient.',
    },
    {
      name: 'canvas.layoutSubtree = true  ->  [layoutsubtree]',
      present: propToAttr,
      detail: null,
      note: 'Property reflects out to the content attribute.',
    },
    {
      name: '[layoutsubtree]  ->  canvas.layoutSubtree',
      present: attrToProp,
      detail: null,
      note: 'Content attribute reflects back to the property. three.js writes the ATTRIBUTE, so this direction is the one it depends on.',
    },
  ]
}

/* ─────────────────────────────────────────────────────────────
   Environment. Captured for the report; never a decision input.
   ───────────────────────────────────────────────────────────── */

interface UserAgentBrand {
  readonly brand: string
  readonly version: string
}

function readBrands(): readonly UserAgentBrand[] {
  const data = memberOf(navigator, 'userAgentData')
  if (typeof data !== 'object' || data === null) return []
  const brands = memberOf(data, 'brands')
  if (!Array.isArray(brands)) return []
  return brands.filter(
    (entry): entry is UserAgentBrand =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as { brand?: unknown }).brand === 'string' &&
      typeof (entry as { version?: unknown }).version === 'string',
  )
}

/**
 * Chromium major version, for dating the build.
 *
 * Display only. three.js splits `texElementImage2D`'s two signatures at
 * Chrome 150, so a version next to the observed arity turns "which one is
 * this" into a checkable statement instead of a guess.
 */
function readChromiumMajor(brands: readonly UserAgentBrand[]): number | null {
  for (const { brand, version } of brands) {
    if (!/chrom/i.test(brand)) continue
    const major = Number.parseInt(version, 10)
    if (Number.isFinite(major)) return major
  }
  const match = /Chrome\/(\d+)/.exec(navigator.userAgent)
  const captured = match?.[1]
  return captured === undefined ? null : Number.parseInt(captured, 10)
}

type AnyWebGL = WebGL2RenderingContext | WebGLRenderingContext

/** Creates a throwaway context, hands it to `read`, then releases the GPU resource. */
function withContext<T>(
  kind: 'webgl2' | 'webgl',
  read: (gl: AnyWebGL) => T,
  fallback: T,
): T {
  const canvas = document.createElement('canvas')
  // Branched rather than passed through, so `getContext`'s overloads narrow.
  const gl: AnyWebGL | null =
    kind === 'webgl2' ? canvas.getContext('webgl2') : canvas.getContext('webgl')
  if (gl === null) return fallback
  try {
    return read(gl)
  } finally {
    // A probe must not leak a GPU context. Browsers cap them hard, and a
    // leaked one is a webglcontextlost on the real device later.
    const lose = gl.getExtension('WEBGL_lose_context')
    if (lose !== null) lose.loseContext()
  }
}

/* ─────────────────────────────────────────────────────────────
   The WebGL entry point used by the composite path.
   ───────────────────────────────────────────────────────────── */

function resolveEntryPoint(results: readonly ProbeResult[]): WebGLEntryPoint {
  const found = results.filter((result) => result.present)
  const first = found[0]

  if (first === undefined) {
    return {
      available: false,
      name: null,
      arity: null,
      signature: null,
      verdict:
        'Neither texElementSubImage2D nor texElementImage2D exists on the WebGL2 context. The WebGL half of html-in-canvas is not exposed in this browser.',
    }
  }

  const arity = Number.parseInt(first.detail ?? '', 10)
  const resolvedArity = Number.isFinite(arity) ? arity : null

  const signature =
    resolvedArity === 3
      ? 'current 3-arg (target, internalformat, element) - three.js calls this its "Chrome 150+" branch'
      : resolvedArity === 6
        ? 'legacy 6-arg (target, level, internalformat, srcFormat, srcType, element) - three.js calls this its "Chrome 138 - 149" branch'
        : 'unrecognised arity - neither of the two signatures three.js knows about'

  const ambiguity =
    found.length > 1
      ? ` Both candidate names are present, which the spec repo does not describe; treat that as a finding rather than a convenience.`
      : ''

  return {
    available: true,
    name: first.name,
    arity: resolvedArity,
    signature,
    verdict: `${first.name} is the name that shipped here, with the ${signature.split(' - ')[0] ?? 'unknown'} signature.${ambiguity}`,
  }
}

function resolveGeometryApi(canvasResults: readonly ProbeResult[]): GeometryApi {
  const present = (name: string): boolean =>
    canvasResults.some((result) => result.name === name && result.present)

  if (present('updateElementGeometry')) {
    return {
      generation: 'explainer',
      name: 'updateElementGeometry',
      verdict:
        'This browser ships the explainer generation. The composited panel gets its a11y geometry and hit-test entry from updateElementGeometry({ canvasTransform }), which a 3D context must call explicitly on every device move.',
    }
  }

  if (present('getElementTransform')) {
    return {
      generation: 'shipped',
      name: 'getElementTransform',
      verdict:
        'This browser ships the OLDER generation: getElementTransform(element, screenSpaceTransform) exists, updateElementGeometry does not. The panel is positioned by writing the returned matrix to element.style.transform, so hit-testing, focus, selection and a11y geometry come from a genuinely transformed DOM element rather than from a canvas-side geometry call.',
    }
  }

  return {
    generation: 'none',
    name: null,
    verdict:
      'Neither generation is exposed. There is no way to map the panel element onto its drawn location, so the composited panel could be drawn but not interacted with.',
  }
}

/* ─────────────────────────────────────────────────────────────
   Tier resolution - the one place in the app that decides.
   ───────────────────────────────────────────────────────────── */

export interface TierFacts {
  /** Any WebGL at all. Without it there is no device to composite onto. */
  readonly webgl: boolean
  /** `'requestPaint' in HTMLCanvasElement.prototype`. */
  readonly requestPaint: boolean
  /** `prefers-reduced-motion: reduce`. A first-class path, not a degradation. */
  readonly prefersReducedMotion: boolean
}

/**
 * Resolves one tier from feature-detected facts.
 *
 * Ordered against `preview-validation.md`'s table. T4 is checked first
 * because it is an override rather than a floor: reduced motion and a
 * missing/lost WebGL context both mean "do not render the device", however
 * capable the browser otherwise is.
 *
 * T2 is reachable in the table but not producible here: it requires the
 * `three-html-render` polyfill, which is not installed. Rather
 * than add a detector for something that cannot be installed, the T3 reason
 * names T2 as the branch that would apply.
 *
 * Exported so the runtime can re-run it on `webglcontextlost` /
 * `webglcontextrestored`.
 */
export function resolveTier(facts: TierFacts): { tier: Tier; reason: string } {
  if (facts.prefersReducedMotion) {
    return {
      tier: 'T4',
      reason:
        'prefers-reduced-motion: reduce. The device is not rendered at all and the product runs as flat DOM. This is a first-class path, not a failure - it is the same path as WebGL context loss.',
    }
  }

  if (!facts.webgl) {
    return {
      tier: 'T4',
      reason:
        'No WebGL context could be created. There is no device to composite a panel onto, so the product runs as flat DOM.',
    }
  }

  if (facts.requestPaint) {
    return {
      tier: 'T1',
      reason:
        "'requestPaint' in HTMLCanvasElement.prototype is true, so html-in-canvas is exposed and the panel's DOM pixels can reach the screen mesh through three.js HTMLTexture. This is the main path.",
    }
  }

  return {
    tier: 'T3',
    reason:
      "'requestPaint' in HTMLCanvasElement.prototype is false, so html-in-canvas is not exposed. WebGL is available, so the panel would be a CSS-3D matrix3d overlay registered to the modelled bezel. T2 would take precedence here if the three-html-render polyfill were installed; it is not installed, and neither T2 nor T3 is built yet.",
  }
}

/* ─────────────────────────────────────────────────────────────
   Entry points.
   ───────────────────────────────────────────────────────────── */

/**
 * Runs the full probe. Browser-only - touches `document` and `navigator`.
 *
 * Prefer {@link getCapabilities}, which resolves once at boot. This is
 * exported unmemoised so the runtime can re-probe after a context restore.
 */
export function probeCapabilities(): CapabilityReport {
  const requestPaint = 'requestPaint' in HTMLCanvasElement.prototype

  const webgl2 = withContext('webgl2', () => true, false)
  const webgl1 = webgl2 || withContext('webgl', () => true, false)

  const entryPointResults = withContext<readonly ProbeResult[]>(
    webgl2 ? 'webgl2' : 'webgl',
    (gl) => probeMembers(gl, WEBGL_ENTRY_POINT_CANDIDATES),
    WEBGL_ENTRY_POINT_CANDIDATES.map(({ name, note }) => ({
      name,
      present: false,
      detail: null,
      note,
    })),
  )

  const context2dResults = ((): readonly ProbeResult[] => {
    const ctx = document.createElement('canvas').getContext('2d')
    if (ctx === null) {
      return CONTEXT_2D_MEMBERS.map(({ name, note }) => ({
        name,
        present: false,
        detail: null,
        note,
      }))
    }
    return probeMembers(ctx, CONTEXT_2D_MEMBERS)
  })()

  const canvasResults = probeMembers(HTMLCanvasElement.prototype, CANVAS_MEMBERS)
  const globalResults = probeMembers(window, GLOBAL_MEMBERS)
  const layoutSubtreeResults = probeLayoutSubtreeReflection()
  const layoutSubtreeReflects = layoutSubtreeResults.every((result) => result.present)

  const brands = readBrands()
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const facts: TierFacts = { webgl: webgl1, requestPaint, prefersReducedMotion }
  const { tier, reason } = resolveTier(facts)
  const { tier: capabilityTier } = resolveTier({ ...facts, prefersReducedMotion: false })

  return {
    probedAt: new Date().toISOString(),
    environment: {
      userAgent: navigator.userAgent,
      brands: brands.map(({ brand, version }) => `${brand} ${version}`),
      chromiumMajor: readChromiumMajor(brands),
      devicePixelRatio: window.devicePixelRatio,
      prefersReducedMotion,
      webgl2,
      webgl1,
    },
    requestPaint,
    layoutSubtreeReflects,
    webglEntryPoint: resolveEntryPoint(entryPointResults),
    geometryApi: resolveGeometryApi(canvasResults),
    groups: [
      {
        id: 'canvas',
        title: 'HTMLCanvasElement.prototype',
        subtitle: 'The five primitives, as declared in the README IDL block.',
        results: canvasResults,
      },
      {
        id: 'layout-subtree',
        title: 'layoutsubtree reflection',
        subtitle: 'Declared is not the same as reflecting. Both directions are checked on a real <canvas>.',
        results: layoutSubtreeResults,
      },
      {
        id: 'webgl',
        title: `WebGL${webgl2 ? '2' : ''} entry point`,
        subtitle: 'Mid-rename. Both candidate spellings are probed by name.',
        results: entryPointResults,
      },
      {
        id: 'context-2d',
        title: 'CanvasRenderingContext2D',
        subtitle: 'Not our path, but a useful corroboration that the flag is on.',
        results: context2dResults,
      },
      {
        id: 'globals',
        title: 'Global interfaces',
        subtitle: 'Which interfaces the API generation brought with it.',
        results: globalResults,
      },
    ],
    tier,
    tierReason: reason,
    capabilityTier,
  }
}

let cached: CapabilityReport | undefined

/**
 * The capability report for this document, resolved once.
 *
 * Tier detection resolves at boot and is read everywhere; probing twice
 * would mean two canvases, two GPU contexts and the possibility of two
 * different answers.
 */
export function getCapabilities(): CapabilityReport {
  cached ??= probeCapabilities()
  return cached
}
