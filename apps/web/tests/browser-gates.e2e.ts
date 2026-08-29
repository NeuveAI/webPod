import AxeBuilder from '../../../packages/panel/node_modules/@axe-core/playwright/dist/index.js'
import { expect, test, type Locator, type Page } from '../../../packages/panel/node_modules/@playwright/test/index.js'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const evidence = resolve(process.env['W5B_EVIDENCE_DIR'] ?? resolve(import.meta.dirname, 'test-results/evidence'))
const states = ['ready', 'loading', 'empty', 'error', 'offline', 'permission-denied', 'agent-active', 'success-confirmation'] as const
const screens = ['s03', 's08', 's13'] as const
const colourways = ['dark', 'light'] as const
const plant = process.env['W5B_PLANT']

interface TextContrast {
  readonly selector: string
  readonly text: string
  readonly fontSize: number
  readonly fontWeight: number
  readonly ratio: number
  readonly required: 3 | 4.5
  readonly paintSources: readonly string[]
  readonly unresolved: readonly string[]
}

interface SourceHealth {
  readonly expected: string
  readonly current: string
  readonly fileCount: number
}

interface TransparencySnapshot {
  readonly backdrops: readonly { readonly tag: string; readonly pseudo: string; readonly value: string }[]
  readonly translucentPaint: readonly { readonly tag: string; readonly pseudo: string; readonly paint: string }[]
  readonly title: {
    readonly backgroundImage: string
    readonly alpha: number
    readonly luminance: number
    readonly averageStopLuminance: number | null
  }
  readonly metadata: {
    readonly alpha: number
    readonly compositeLuminance: number
  } | null
}

function parseSourceHealth(serialized: string): SourceHealth {
  const value: unknown = JSON.parse(serialized)
  if (typeof value !== 'object' || value === null) throw new Error('Source health did not return an object')
  if (!('expected' in value) || typeof value.expected !== 'string') throw new Error('Source health omitted expected digest')
  if (!('current' in value) || typeof value.current !== 'string') throw new Error('Source health omitted current digest')
  if (!('fileCount' in value) || typeof value.fileCount !== 'number') throw new Error('Source health omitted file count')
  return { expected: value.expected, current: value.current, fileCount: value.fileCount }
}

const landPlant = async (page: Page, gate: string, apply: () => Promise<void>, verify: () => Promise<boolean>): Promise<void> => {
  if (plant !== gate) return
  await apply()
  expect(await verify(), `${gate} plant did not land`).toBe(true)
  await page.locator('html').evaluate((element, value) => element.setAttribute('data-w5b-plant', value), gate)
  await expect(page.locator('html')).toHaveAttribute('data-w5b-plant', gate)
  console.log(`[W5B PLANT ${gate} LANDED]`)
}

const openScreen = async (page: Page, screen: (typeof screens)[number], query = ''): Promise<Locator> => {
  await page.goto(`/${query}`)
  const panel = page.locator('.wp-panel').first()
  await expect(panel).toHaveAttribute('data-screen', 'S03')
  await panel.focus()
  if (screen !== 's03') await panel.press('Enter')
  if (screen === 's13') await panel.press('Enter')
  await expect(panel).toHaveAttribute('data-screen', screen.toUpperCase())
  return panel
}

const freezeClock = async (page: Page): Promise<void> => page.clock.install({ time: new Date('2026-01-01T00:00:00Z') })

const stabilize = async (page: Page): Promise<void> => {
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' })
}

const emulateFeature = async (page: Page, name: string, value: string): Promise<void> => {
  const session = await page.context().newCDPSession(page)
  await session.send('Emulation.setEmulatedMedia', { features: [{ name, value }] })
}

const assertFlagOff = async (page: Page): Promise<void> => {
  expect(await page.evaluate(() => 'requestPaint' in HTMLCanvasElement.prototype), 'W5b must run with CanvasDrawElement disabled').toBe(false)
}

const assertSourceIdentity = async (page: Page): Promise<void> => {
  const expected = process.env['W5B_EXPECTED_SOURCE_FINGERPRINT']
  const expectedFileCount = Number(process.env['W5B_EXPECTED_SOURCE_FILE_COUNT'])
  if (expected === undefined || !Number.isInteger(expectedFileCount)) throw new Error('Playwright source fingerprint was not initialized')
  if (plant === 'SOURCE') {
    await page.route('**/__webpod_health', (route) => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ expected, current: 'source-mismatch-plant', fileCount: expectedFileCount }),
    }))
  }
  const result = await page.evaluate(async () => {
    const response = await fetch('/__webpod_health', { cache: 'no-store' })
    return { ok: response.ok, status: response.status, body: await response.text() }
  })
  expect(result.ok, `source health returned ${String(result.status)}`).toBe(true)
  const health = parseSourceHealth(result.body)
  if (plant === 'SOURCE') {
    expect(health.current, 'SOURCE plant did not land').toBe('source-mismatch-plant')
    console.log('[W5B PLANT SOURCE LANDED]')
  }
  expect(health.fileCount).toBe(expectedFileCount)
  expect(health.expected).toBe(expected)
  expect(health.current, 'served runtime source changed after the isolated server started').toBe(expected)
}

const contrastReport = async (panel: Locator): Promise<readonly TextContrast[]> => panel.evaluate((root) => {
  type Colour = readonly [number, number, number, number]
  interface ColourBounds { readonly low: Colour; readonly high: Colour }
  const parse = (value: string): readonly [number, number, number, number] | null => {
    const match = value.match(/^rgba?\((\d+(?:\.\d+)?)\s*,?\s*(\d+(?:\.\d+)?)\s*,?\s*(\d+(?:\.\d+)?)(?:\s*[,/]\s*(\d+(?:\.\d+)?))?\)$/u)
    if (match === null) return null
    const red = Number(match[1])
    const green = Number(match[2])
    const blue = Number(match[3])
    const alpha = match[4] === undefined ? 1 : Number(match[4])
    return [red, green, blue, alpha]
  }
  const luminance = (colour: Colour): number => {
    const channel = (value: number): number => {
      const normalized = value / 255
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * channel(colour[0]) + 0.7152 * channel(colour[1]) + 0.0722 * channel(colour[2])
  }
  const visible = (element: HTMLElement): boolean => {
    const style = getComputedStyle(element)
    const rect = element.getBoundingClientRect()
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0
  }
  const withOpacity = (colour: Colour, opacity: number): Colour => [colour[0], colour[1], colour[2], colour[3] * opacity]
  const coloursIn = (value: string): readonly Colour[] => Array.from(value.matchAll(/rgba?\([^)]*\)/gu)).flatMap((match) => {
    const colour = parse(match[0])
    return colour === null ? [] : [colour]
  })
  const pointBounds = (colour: Colour): ColourBounds => ({ low: colour, high: colour })
  // A stop pair describes a continuum, not two samples. The component-wise
  // hull contains every default sRGB/RGBA interpolation between the stops.
  const interpolationBounds = (left: Colour, right: Colour): ColourBounds => ({
    low: [
      Math.min(left[0], right[0]),
      Math.min(left[1], right[1]),
      Math.min(left[2], right[2]),
      Math.min(left[3], right[3]),
    ],
    high: [
      Math.max(left[0], right[0]),
      Math.max(left[1], right[1]),
      Math.max(left[2], right[2]),
      Math.max(left[3], right[3]),
    ],
  })
  const withBoundsOpacity = (bounds: ColourBounds, opacity: number): ColourBounds => ({
    low: [bounds.low[0], bounds.low[1], bounds.low[2], bounds.low[3] * opacity],
    high: [bounds.high[0], bounds.high[1], bounds.high[2], bounds.high[3] * opacity],
  })
  const compositeBounds = (front: ColourBounds, back: ColourBounds): ColourBounds => {
    const alphaLow = front.low[3] + back.low[3] * (1 - front.low[3])
    const alphaHigh = front.high[3] + back.high[3] * (1 - front.high[3])
    if (alphaLow <= 0) return { low: [0, 0, 0, 0], high: [255, 255, 255, alphaHigh] }
    const channel = (index: 0 | 1 | 2): readonly [number, number] => {
      const numeratorLow = front.low[index] * front.low[3] + back.low[index] * back.low[3] * (1 - front.high[3])
      const numeratorHigh = front.high[index] * front.high[3] + back.high[index] * back.high[3] * (1 - front.low[3])
      return [Math.max(0, numeratorLow / alphaHigh), Math.min(255, numeratorHigh / alphaLow)]
    }
    const red = channel(0)
    const green = channel(1)
    const blue = channel(2)
    return {
      low: [red[0], green[0], blue[0], alphaLow],
      high: [red[1], green[1], blue[1], alphaHigh],
    }
  }
  const unique = (bounds: readonly ColourBounds[]): readonly ColourBounds[] => {
    const seen = new Set<string>()
    return bounds.filter((candidate) => {
      const key = [...candidate.low, ...candidate.high].map((part) => part.toFixed(3)).join(',')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).slice(0, 96)
  }
  const luminanceBounds = (bounds: ColourBounds): readonly [number, number] => [luminance(bounds.low), luminance(bounds.high)]
  const contrastLowerBound = (foreground: Colour, background: ColourBounds): number => {
    const renderedForeground = compositeBounds(pointBounds(foreground), background)
    const [foregroundLow, foregroundHigh] = luminanceBounds(renderedForeground)
    const [backgroundLow, backgroundHigh] = luminanceBounds(background)
    // If the intervals meet, some admissible interior paint can be identical
    // in luminance to the text. Endpoints may both pass while that point is 1:1.
    if (foregroundLow <= backgroundHigh && backgroundLow <= foregroundHigh) return 1
    return foregroundHigh < backgroundLow
      ? (backgroundLow + 0.05) / (foregroundHigh + 0.05)
      : (foregroundLow + 0.05) / (backgroundHigh + 0.05)
  }
  const applyPaint = (
    candidates: readonly ColourBounds[],
    style: CSSStyleDeclaration,
    source: string,
    sources: string[],
    unresolved: string[],
  ): readonly ColourBounds[] => {
    if (style.mixBlendMode !== 'normal') unresolved.push(`${source}: mix-blend-mode ${style.mixBlendMode}`)
    const opacity = Number(style.opacity)
    const solid = parse(style.backgroundColor)
    let next = candidates
    if (solid !== null && solid[3] > 0) {
      const layer = pointBounds(withOpacity(solid, opacity))
      next = unique(next.map((background) => compositeBounds(layer, background)))
      sources.push(`${source}:background-color`)
    }
    const image = style.backgroundImage
    if (image !== 'none') {
      if (!/(?:linear|radial|conic)-gradient\(/u.test(image)) {
        unresolved.push(`${source}: unsupported background-image ${image.slice(0, 80)}`)
      } else {
        const stops = coloursIn(image)
        if (stops.length === 0) unresolved.push(`${source}: gradient has no resolved colour stops`)
        else {
          const spans = stops.length === 1
            ? [pointBounds(stops[0] ?? [0, 0, 0, 0])]
            : stops.slice(1).map((stop, index) => interpolationBounds(stops[index] ?? stop, stop))
          next = unique(next.flatMap((background) => spans.map((span) => compositeBounds(withBoundsOpacity(span, opacity), background))))
          sources.push(`${source}:gradient(${String(stops.length)} stops, interpolation bounded)`)
        }
      }
    }
    return next
  }
  const backgrounds = (element: Element): { readonly colours: readonly ColourBounds[]; readonly sources: readonly string[]; readonly unresolved: readonly string[] } => {
    const chain: Element[] = []
    let current: Element | null = element
    while (current !== null) {
      chain.unshift(current)
      if (current === root) break
      current = current.parentElement
    }
    let candidates: readonly ColourBounds[] = [pointBounds([255, 255, 255, 1])]
    const sources: string[] = []
    const unresolved: string[] = []
    for (const [index, node] of chain.entries()) {
      const source = `${node.tagName.toLowerCase()}:${String(index)}`
      candidates = applyPaint(candidates, getComputedStyle(node), source, sources, unresolved)
      for (const pseudo of ['::before', '::after'] as const) {
        const style = getComputedStyle(node, pseudo)
        if (style.content === 'none' || style.display === 'none') continue
        candidates = applyPaint(candidates, style, `${source}${pseudo}`, sources, unresolved)
      }
    }
    return { colours: candidates, sources, unresolved }
  }
  return Array.from(root.querySelectorAll<HTMLElement>('*'))
    .filter((element) => visible(element) && Array.from(element.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== ''))
    .map((element, index) => {
      const style = getComputedStyle(element)
      const foreground = parse(style.color)
      if (foreground === null) throw new Error(`Cannot parse foreground ${style.color}`)
      const fontSize = Number.parseFloat(style.fontSize)
      const fontWeight = Number.parseInt(style.fontWeight, 10) || 400
      const required = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700) ? 3 : 4.5
      let opacity = 1
      let ancestor: Element | null = element
      while (ancestor !== null) {
        opacity *= Number(getComputedStyle(ancestor).opacity)
        if (ancestor === root) break
        ancestor = ancestor.parentElement
      }
      const painted = backgrounds(element)
      const ratios = painted.colours.map((background) => contrastLowerBound(withOpacity(foreground, opacity), background))
      return {
        selector: `${element.tagName.toLowerCase()}:${String(index)}`,
        text: (element.textContent ?? '').trim().slice(0, 80),
        fontSize,
        fontWeight,
        ratio: Math.min(...ratios),
        required,
        paintSources: painted.sources,
        unresolved: painted.unresolved,
      }
    })
})

const transparencySnapshot = async (panel: Locator): Promise<TransparencySnapshot> => panel.evaluate((root) => {
  type Colour = readonly [number, number, number, number]
  const parse = (value: string): Colour | null => {
    const match = value.match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)(?:\s*[,/]\s*(\d+(?:\.\d+)?))?\s*\)$/u)
    if (match === null || match[1] === undefined || match[2] === undefined || match[3] === undefined) return null
    return [Number(match[1]), Number(match[2]), Number(match[3]), match[4] === undefined ? 1 : Number(match[4])]
  }
  const coloursIn = (value: string): readonly Colour[] => Array.from(value.matchAll(/rgba?\([^)]*\)/gu)).flatMap((match) => {
    const colour = parse(match[0])
    return colour === null ? [] : [colour]
  })
  const luminance = (colour: Colour): number => {
    const channel = (value: number): number => {
      const normalized = value / 255
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * channel(colour[0]) + 0.7152 * channel(colour[1]) + 0.0722 * channel(colour[2])
  }
  const composite = (front: Colour, back: Colour): Colour => [
    front[0] * front[3] + back[0] * (1 - front[3]),
    front[1] * front[3] + back[1] * (1 - front[3]),
    front[2] * front[3] + back[2] * (1 - front[3]),
    1,
  ]
  const visible = (element: HTMLElement): boolean => {
    const style = getComputedStyle(element)
    const rect = element.getBoundingClientRect()
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0
  }
  const nodes = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))].filter(visible)
  const backdrops: Array<{ readonly tag: string; readonly pseudo: string; readonly value: string }> = []
  const translucentPaint: Array<{ readonly tag: string; readonly pseudo: string; readonly paint: string }> = []
  for (const element of nodes) {
    for (const pseudo of ['', '::before', '::after'] as const) {
      const style = getComputedStyle(element, pseudo === '' ? null : pseudo)
      if (pseudo !== '' && (style.content === 'none' || style.display === 'none')) continue
      const backdrop = style.backdropFilter !== 'none' ? style.backdropFilter : style.webkitBackdropFilter
      if (backdrop !== undefined && backdrop !== 'none') backdrops.push({ tag: element.tagName, pseudo, value: backdrop })
      const background = parse(style.backgroundColor)
      if (background !== null && background[3] > 0 && background[3] < 1) {
        translucentPaint.push({ tag: element.tagName, pseudo, paint: style.backgroundColor })
      }
      for (const colour of coloursIn(style.backgroundImage)) {
        if (colour[3] > 0 && colour[3] < 1) translucentPaint.push({ tag: element.tagName, pseudo, paint: style.backgroundImage })
      }
    }
  }
  const title = root.querySelector<HTMLElement>('.wp-titlebar')
  if (title === null) throw new Error('titlebar missing')
  const titleStyle = getComputedStyle(title)
  const titleColour = parse(titleStyle.backgroundColor) ?? [0, 0, 0, 0]
  const titleStops = coloursIn(titleStyle.backgroundImage)
  const metadata = root.querySelector<HTMLElement>('.wp-now-meta')
  let metadataReport: TransparencySnapshot['metadata'] = null
  if (metadata !== null) {
    const metadataColour = parse(getComputedStyle(metadata).backgroundColor)
    if (metadataColour === null) throw new Error('metadata scrim colour was not resolved')
    let ancestor = metadata.parentElement
    let backdrop: Colour | null = null
    while (ancestor !== null && root.contains(ancestor)) {
      const candidate = parse(getComputedStyle(ancestor).backgroundColor)
      if (candidate !== null && candidate[3] === 1) {
        backdrop = candidate
        break
      }
      ancestor = ancestor.parentElement
    }
    if (backdrop === null) throw new Error('metadata scrim has no opaque backdrop')
    metadataReport = { alpha: metadataColour[3], compositeLuminance: luminance(composite(metadataColour, backdrop)) }
  }
  return {
    backdrops,
    translucentPaint,
    title: {
      backgroundImage: titleStyle.backgroundImage,
      alpha: titleColour[3],
      luminance: luminance(titleColour),
      averageStopLuminance: titleStops.length === 0
        ? null
        : titleStops.reduce((sum, colour) => sum + luminance(colour), 0) / titleStops.length,
    },
    metadata: metadataReport,
  }
})

test.beforeAll(async () => mkdir(evidence, { recursive: true }))

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await assertSourceIdentity(page)
  await assertFlagOff(page)
})

test('U1 captures a light/dark pair for every required screen state', async ({ page }) => {
  await freezeClock(page)
  let captures = 0
  for (const state of states) {
    for (const screen of screens) {
      await openScreen(page, screen, `?state=${state}`)
      await stabilize(page)
      if (state === 'ready' && screen === 's03') await landPlant(page, 'U1',
        () => page.locator('.wp-panel').nth(1).evaluate((element) => { (element as HTMLElement).style.visibility = 'hidden' }),
        () => page.locator('.wp-panel').nth(1).evaluate((element) => getComputedStyle(element).visibility === 'hidden'))
      for (const [index, colourway] of colourways.entries()) {
        const panel = page.locator('.wp-panel').nth(index)
        await expect(panel).toHaveAttribute('data-state', state)
        await panel.screenshot({ path: resolve(evidence, `w5b-u1-${screen}-${state}-${colourway}.png`) })
        captures += 1
      }
    }
  }
  expect(captures).toBe(48)
})

test('U2 greyscale preserves the human actor and non-colour selection channel', async ({ page }) => {
  const panel = await openScreen(page, 's03', '?actor=human')
  await page.locator('main').evaluate((root) => { root.style.filter = 'grayscale(1)' })
  await landPlant(page, 'U2',
    () => panel.evaluate((element) => element.setAttribute('data-actor', 'agent')),
    () => panel.evaluate((element) => element.getAttribute('data-actor') === 'agent'))
  await expect(panel).toHaveCSS('filter', 'none')
  await expect(page.locator('main')).toHaveCSS('filter', 'grayscale(1)')
  await expect(panel).toHaveAttribute('data-actor', 'human')
  const selected = panel.locator('[aria-current="true"]')
  await expect(selected).toHaveAttribute('aria-selected', 'true')
  await expect(selected).toContainText('Albums')
  const before = await panel.getAttribute('aria-activedescendant')
  await panel.press('ArrowDown')
  expect(await panel.getAttribute('aria-activedescendant')).not.toBe(before)
  await panel.screenshot({ path: resolve(evidence, 'w5b-u2-greyscale-human.png') })
})

test('U3 reduced motion removes authored animation and transition', async ({ page }) => {
  await openScreen(page, 's13', '?state=success-confirmation')
  await emulateFeature(page, 'prefers-reduced-motion', 'reduce')
  await landPlant(page, 'U3',
    () => page.addStyleTag({ content: '.wp-progress i{transition-duration:240ms!important}' }).then(() => undefined),
    () => page.locator('.wp-progress i').first().evaluate((element) => getComputedStyle(element).transitionDuration === '0.24s'))
  for (const [index, colourway] of colourways.entries()) {
    const panel = page.locator('.wp-panel').nth(index)
    await panel.screenshot({ path: resolve(evidence, `w5b-u3-reduced-motion-${colourway}.png`) })
    await expect(panel.locator('.wp-now-body')).toHaveCSS('animation-name', 'none')
    await expect(panel.locator('.wp-progress i')).toHaveCSS('transition-duration', '0s')
  }
})

test('U4 reduced transparency makes every scrim solid at equivalent luminance', async ({ page }) => {
  const reports = []
  let oldPlantLanded = false
  let solidPlantLanded = false
  for (const state of states) {
    for (const screen of screens) {
      await openScreen(page, screen, `?state=${state}&art=pale`)
      await emulateFeature(page, 'prefers-reduced-transparency', 'no-preference')
      const baseline = await Promise.all(colourways.map((colourway) => transparencySnapshot(page.locator(`.wp-panel[data-colourway="${colourway}"]`))))
      await emulateFeature(page, 'prefers-reduced-transparency', 'reduce')
      expect(await page.evaluate(() => matchMedia('(prefers-reduced-transparency: reduce)').matches)).toBe(true)
      if (state === 'ready' && screen === 's13') {
        await landPlant(page, 'U4',
          () => page.addStyleTag({ content: '.wp-titlebar{backdrop-filter:blur(2px)!important}' }).then(() => undefined),
          () => page.locator('.wp-titlebar').first().evaluate((element) => getComputedStyle(element).backdropFilter !== 'none'))
        oldPlantLanded = plant === 'U4'
        await landPlant(page, 'U4_SOLID',
          () => page.addStyleTag({ content: '.wp-titlebar{background:linear-gradient(rgb(255 255 255 / 40%),rgb(0 0 0 / 40%))!important}.wp-now-meta{background:rgb(10 15 22 / 50%)!important}' }).then(() => undefined),
          () => page.locator('.wp-now-meta').first().evaluate((element) => getComputedStyle(element).backgroundColor.includes('0.5')))
        solidPlantLanded = plant === 'U4_SOLID'
      }
      for (const [index, colourway] of colourways.entries()) {
        const panel = page.locator(`.wp-panel[data-colourway="${colourway}"]`)
        const before = baseline[index]
        if (before === undefined) throw new Error(`baseline missing for ${colourway}`)
        const after = await transparencySnapshot(panel)
        expect(after.backdrops, `${screen}/${state}/${colourway} backdrop filters`).toEqual([])
        expect(after.translucentPaint, `${screen}/${state}/${colourway} translucent paint`).toEqual([])
        expect(after.title.backgroundImage).toBe('none')
        expect(after.title.alpha).toBe(1)
        expect(before.title.averageStopLuminance).not.toBeNull()
        expect(Math.abs(after.title.luminance - (before.title.averageStopLuminance ?? -1))).toBeLessThanOrEqual(0.005)
        if (before.metadata !== null) {
          expect(before.metadata.alpha).toBeGreaterThan(0)
          expect(before.metadata.alpha).toBeLessThan(1)
          expect(after.metadata).not.toBeNull()
          if (after.metadata === null) throw new Error(`reduced metadata missing for ${screen}/${state}/${colourway}`)
          expect(after.metadata.alpha).toBe(1)
          expect(Math.abs(after.metadata.compositeLuminance - before.metadata.compositeLuminance)).toBeLessThanOrEqual(0.005)
        }
        reports.push({ state, screen, colourway, baseline: before, reduced: after })
        if (state === 'ready' && screen === 's13') {
          expect(await panel.locator('.wp-now-body').evaluate((element) => getComputedStyle(element, '::before').display)).toBe('none')
          await expect(panel.locator('.wp-art')).toHaveCSS('box-shadow', 'none')
          await panel.screenshot({ path: resolve(evidence, `w5b-u4-reduced-transparency-${colourway}.png`) })
        }
      }
    }
  }
  if (plant === 'U4') expect(oldPlantLanded).toBe(true)
  if (plant === 'U4_SOLID') expect(solidPlantLanded).toBe(true)
  expect(reports.length).toBe(states.length * screens.length * colourways.length)
  await writeFile(resolve(evidence, 'w5b-u4-transparency.json'), JSON.stringify(reports, null, 2))
})

test('U5 increased contrast resolves to black/white foundations', async ({ page }) => {
  await openScreen(page, 's03')
  await emulateFeature(page, 'prefers-contrast', 'more')
  await landPlant(page, 'U5',
    () => page.addStyleTag({ content: '.wp-panel[data-colourway="light"]{color:#777!important}' }).then(() => undefined),
    () => page.locator('.wp-panel[data-colourway="light"]').evaluate((element) => getComputedStyle(element).color === 'rgb(119, 119, 119)'))
  const expected = [['rgb(0, 0, 0)', 'rgb(255, 255, 255)'], ['rgb(255, 255, 255)', 'rgb(0, 0, 0)']] as const
  for (const [index, colourway] of colourways.entries()) {
    const panel = page.locator('.wp-panel').nth(index)
    await expect(panel).toHaveCSS('background-color', expected[index]?.[0] ?? '')
    await expect(panel).toHaveCSS('color', expected[index]?.[1] ?? '')
    await panel.screenshot({ path: resolve(evidence, `w5b-u5-contrast-more-${colourway}.png`) })
  }
})

test('U6 axe is clean and every native action is at least 44×44', async ({ page }) => {
  await openScreen(page, 's13')
  await landPlant(page, 'U6', async () => {
    await page.locator('.wp-actions').first().evaluate((element) => element.insertAdjacentHTML('beforeend', '<button data-w5b-tiny style="transform:scale(.1)!important">Tiny</button>'))
  }, () => page.locator('[data-w5b-tiny]').evaluate((element) => element.getBoundingClientRect().width < 44))
  const reports = []
  for (const colourway of colourways) {
    const selector = `.wp-panel[data-colourway="${colourway}"]`
    const results = await new AxeBuilder({ page }).include(selector).analyze()
    expect(results.violations).toEqual([])
    const controls = page.locator(['button', 'a', 'input', 'select', 'textarea', '[role="button"]'].map((control) => `${selector} ${control}`).join(','))
    const boxes = []
    for (const control of await controls.all()) {
      if (!await control.isVisible()) continue
      const dimensions = await control.evaluate((element) => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }))
      expect(dimensions.width).toBeGreaterThanOrEqual(44)
      expect(dimensions.height).toBeGreaterThanOrEqual(44)
      boxes.push(dimensions)
    }
    expect(boxes.length).toBeGreaterThan(0)
    reports.push({ colourway, violations: results.violations, boxes })
  }
  await writeFile(resolve(evidence, 'w5b-u6-axe-targets.json'), JSON.stringify(reports, null, 2))
})

test('U7 text contrast meets 4.5:1 body and 3:1 large thresholds in both colourways', async ({ page }) => {
  await openScreen(page, 's13', '?art=dark')
  await landPlant(page, 'U7',
    () => page.addStyleTag({ content: '.wp-titlebar{color:#000!important;background:linear-gradient(#000,#000)!important}' }).then(() => undefined),
    () => page.locator('.wp-titlebar').first().evaluate((element) => getComputedStyle(element).backgroundImage.includes('rgb(0, 0, 0)')))
  await landPlant(page, 'U7_ALL_TEXT',
    () => page.addStyleTag({ content: '.wp-titlebar__side{color:var(--wp-title-0)!important}' }).then(() => undefined),
    () => page.locator('.wp-titlebar__battery').first().evaluate((element) => getComputedStyle(element).color === 'rgb(35, 40, 47)'))
  const interpolationTarget = page.locator('.wp-mode-chip').first()
  await landPlant(page, 'U7_INTERPOLATION',
    () => page.addStyleTag({ content: '.wp-mode-chip{color:#767676!important;background:linear-gradient(#000,#fff)!important}' }).then(() => undefined),
    () => interpolationTarget.evaluate((element) => {
      const style = getComputedStyle(element)
      return style.color === 'rgb(118, 118, 118)' && style.backgroundImage.includes('rgb(0, 0, 0)') && style.backgroundImage.includes('rgb(255, 255, 255)')
    }))
  if (plant === 'U7_INTERPOLATION') {
    const endpoints = await interpolationTarget.evaluate(() => {
      const luminance = (value: number): number => {
        const channel = value / 255
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
      }
      const text = luminance(118)
      return { black: (text + 0.05) / 0.05, white: 1.05 / (text + 0.05) }
    })
    expect(endpoints.black).toBeGreaterThan(4.5)
    expect(endpoints.white).toBeGreaterThan(4.5)
    console.log(`[W5B U7 INTERPOLATION ENDPOINTS black=${endpoints.black.toFixed(3)} white=${endpoints.white.toFixed(3)}]`)
  }
  const reports = []
  const failures: Array<{ readonly colourway: string; readonly text: string; readonly ratio: number; readonly required: number; readonly paintSources: readonly string[] }> = []
  for (const colourway of colourways) {
    const selector = `.wp-panel[data-colourway="${colourway}"]`
    const axe = await new AxeBuilder({ page }).include(selector).withRules(['color-contrast']).analyze()
    const text = await contrastReport(page.locator(selector))
    for (const entry of text) if (entry.ratio < entry.required) {
      failures.push({ colourway, text: entry.text, ratio: entry.ratio, required: entry.required, paintSources: entry.paintSources })
    }
    reports.push({ colourway, axeViolations: axe.violations, axeIncomplete: axe.incomplete.filter((entry) => entry.id === 'color-contrast'), text })
  }
  await writeFile(resolve(evidence, 'w5b-u7-contrast.json'), JSON.stringify({ authority: 'axe plus fail-closed analytical bounds for gradients and pseudo-elements', reports, failures }, null, 2))
  expect(reports.flatMap((report) => report.axeViolations)).toEqual([])
  expect(reports.flatMap((report) => report.text.flatMap((entry) => entry.unresolved))).toEqual([])
  expect(reports.every((report) => report.text.length > 0)).toBe(true)
  for (const report of reports) {
    expect(report.text.some((entry) => entry.text === 'The Fray')).toBe(true)
    expect(report.text.some((entry) => entry.text === '▰')).toBe(true)
  }
  expect(failures).toEqual([])
})

test('U11 200% Dynamic Type has no clipped or truncated visible text', async ({ page }) => {
  for (const screen of screens) {
    await openScreen(page, screen, '?scale=2&density=compact')
    await landPlant(page, 'U11',
      () => page.addStyleTag({ content: '.wp-titlebar{inline-size:12px!important;min-inline-size:12px!important;max-inline-size:12px!important;overflow:hidden!important}' }).then(() => undefined),
      () => page.locator('.wp-titlebar').first().evaluate((element) => element.clientWidth < 44 && getComputedStyle(element).overflow === 'hidden'))
    await landPlant(page, 'U11_RASTER',
      () => page.addStyleTag({ content: '.wp-panel-stage{--wp-raster-scale:1!important}' }).then(() => undefined),
      () => page.locator('.wp-panel-stage').first().evaluate((element) => getComputedStyle(element).getPropertyValue('--wp-raster-scale').trim() === '1'))
    for (const colourway of colourways) {
      const panel = page.locator(`.wp-panel[data-colourway="${colourway}"]`)
      await expect(panel).toHaveAttribute('data-density', 'airy')
      const raster = await panel.locator('..').evaluate((stage) => ({
        scale: Number(getComputedStyle(stage).getPropertyValue('--wp-raster-scale')),
        width: stage.getBoundingClientRect().width,
        height: stage.getBoundingClientRect().height,
      }))
      expect(raster.scale).toBe(1.25)
      expect(raster.width).toBeGreaterThanOrEqual(272 * 1.25)
      expect(raster.height).toBeGreaterThanOrEqual(204 * 1.25)
      const failures = await panel.evaluate((root) => Array.from(root.querySelectorAll<HTMLElement>('*')).flatMap((element) => {
        const style = getComputedStyle(element)
        if (style.display === 'none' || style.visibility === 'hidden') return []
        const textNodes = Array.from(element.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== '')
        return textNodes.flatMap((node) => {
          const range = document.createRange()
          range.selectNodeContents(node)
          const textRect = range.getBoundingClientRect()
          const ownClip = element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1
          const ancestors: Array<{ readonly tag: string; readonly className: string; readonly rect: DOMRect }> = []
          let ancestor: HTMLElement | null = element.parentElement
          while (ancestor !== null && root.contains(ancestor)) {
            const ancestorStyle = getComputedStyle(ancestor)
            if (/(hidden|clip|auto|scroll)/u.test(`${ancestorStyle.overflowX} ${ancestorStyle.overflowY}`)) {
              ancestors.push({ tag: ancestor.tagName, className: ancestor.className, rect: ancestor.getBoundingClientRect() })
            }
            if (ancestor === root) break
            ancestor = ancestor.parentElement
          }
          const clippedBy = ancestors.filter(({ rect }) => textRect.left < rect.left - 1 || textRect.right > rect.right + 1 || textRect.top < rect.top - 1 || textRect.bottom > rect.bottom + 1)
          const trackViewport = clippedBy.find(({ className }) => className.includes('wp-track-list'))
          const intentionallyOutsideTrackViewport = trackViewport !== undefined &&
            (textRect.bottom <= trackViewport.rect.top || textRect.top >= trackViewport.rect.bottom)
          const truncated = style.textOverflow === 'ellipsis' && ownClip
          return (ownClip || (clippedBy.length > 0 && !intentionallyOutsideTrackViewport) || truncated)
            ? [{ tag: element.tagName, className: element.className, text: (node.textContent ?? '').trim().slice(0, 80), ownClip, truncated, clippedBy: clippedBy.map(({ tag, className }) => ({ tag, className })) }]
            : []
        })
      }))
      expect(failures, `${screen}/${colourway} clipped content`).toEqual([])
      await panel.screenshot({ path: resolve(evidence, `w5b-u11-${screen}-200-${colourway}.png`) })
    }
  }
  await openScreen(page, 's03', '?scale=1.3&density=compact')
  for (const colourway of colourways) {
    const panel = page.locator(`.wp-panel[data-colourway="${colourway}"]`)
    await expect(panel).toHaveAttribute('data-density', 'airy')
    expect(await panel.locator('..').evaluate((stage) => Number(getComputedStyle(stage).getPropertyValue('--wp-raster-scale')))).toBe(1.25)
  }
})

test('U12 keyboard traversal is complete, one-detent, unaccelerated and focus-visible', async ({ page }) => {
  test.setTimeout(75_000)
  const dark = await openScreen(page, 's03', '?long=1')
  await landPlant(page, 'U12', () => dark.evaluate((element) => {
    element.addEventListener('keydown', (event) => {
      if (event.repeat && event.key === 'ArrowDown') element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    }, { capture: true })
    element.setAttribute('data-repeat-accelerates', 'true')
  }), () => dark.evaluate((element) => element.getAttribute('data-repeat-accelerates') === 'true'))
  const outline = await dark.evaluate((element) => {
    const style = getComputedStyle(element)
    return { style: style.outlineStyle, width: style.outlineWidth }
  })
  expect(outline.style).not.toBe('none')
  expect(Number.parseFloat(outline.width)).toBeGreaterThan(0)
  const observed: number[] = []
  for (let index = 0; index < 6; index += 1) {
    const beforeId = await dark.getAttribute('aria-activedescendant')
    const before = Number(beforeId?.match(/(\d+)$/u)?.[1] ?? -1)
    await dark.press(index % 2 === 0 ? 'ArrowDown' : 'ArrowUp')
    const afterId = await dark.getAttribute('aria-activedescendant')
    const after = Number(afterId?.match(/(\d+)$/u)?.[1] ?? -1)
    observed.push(after - before)
  }
  expect(observed).toEqual([1, -1, 1, -1, 1, -1])
  await dark.press('Enter')
  await expect(dark).toHaveAttribute('data-screen', 'S08')
  await page.keyboard.down('ArrowDown')
  for (let index = 0; index < 20; index += 1) {
    const before = Number(await dark.locator('.wp-track-row[aria-current="true"] .wp-track-number').textContent())
    await dark.dispatchEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', repeat: true, bubbles: true })
    const after = Number(await dark.locator('.wp-track-row[aria-current="true"] .wp-track-number').textContent())
    expect(after - before).toBe(1)
  }
  await page.keyboard.up('ArrowDown')
  await dark.press('Enter')
  await expect(dark).toHaveAttribute('data-screen', 'S13')
  await dark.press('Backspace')
  await expect(dark).toHaveAttribute('data-screen', 'S08')
  await dark.press('Backspace')
  await expect(dark).toHaveAttribute('data-screen', 'S03')
  for (const state of states) {
    for (const colourway of colourways) {
      const candidate = await openScreen(page, 's03', `?state=${state}`)
      const target = colourway === 'dark' ? candidate : page.locator('.wp-panel').nth(1)
      await target.focus()
      await target.press('Enter')
      await expect(target).toHaveAttribute('data-screen', 'S08')
      await target.press('Enter')
      await expect(target).toHaveAttribute('data-screen', 'S13')
      await target.press('Backspace')
      await expect(target).toHaveAttribute('data-screen', 'S08')
      await target.press('Backspace')
      await expect(target).toHaveAttribute('data-screen', 'S03')
    }
  }
  await openScreen(page, 's13', '?state=ready')
  const actionButtons = page.getByRole('button', { name: 'Love track' })
  await expect(actionButtons).toHaveCount(2)
  await landPlant(page, 'U12_ACTION',
    () => actionButtons.evaluateAll((buttons) => { for (const button of buttons) button.setAttribute('tabindex', '-1') }),
    () => actionButtons.evaluateAll((buttons) => buttons.length === 2 && buttons.every((button) => button.getAttribute('tabindex') === '-1')))
  await actionButtons.evaluateAll((buttons) => {
    for (const button of buttons) {
      button.setAttribute('data-keyboard-activations', '0')
      button.addEventListener('click', () => {
        button.setAttribute('data-keyboard-activations', String(Number(button.getAttribute('data-keyboard-activations')) + 1))
      })
    }
  })
  await page.locator('.wp-panel[data-colourway="dark"]').focus()
  const tabOrder: string[] = []
  const activationCounts: number[] = []
  for (let index = 0; index < 3; index += 1) {
    await page.keyboard.press('Tab')
    tabOrder.push(await page.locator(':focus').evaluate((element) => {
      const colourway = element.closest<HTMLElement>('.wp-panel')?.dataset['colourway'] ?? ''
      return `${element.tagName}:${colourway}:${element.getAttribute('aria-label') ?? ''}`
    }))
    expect(await page.locator(':focus').evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe('none')
    if (index === 0 || index === 2) {
      await page.keyboard.press('Enter')
      await page.keyboard.press('Space')
      activationCounts.push(Number(await page.locator(':focus').getAttribute('data-keyboard-activations')))
    }
  }
  expect(tabOrder).toEqual(['BUTTON:dark:Love track', 'DIV:light:webPod music player', 'BUTTON:light:Love track'])
  expect(activationCounts).toEqual([2, 2])
  await writeFile(resolve(evidence, 'w5b-u12-keyboard.json'), JSON.stringify({ oneDetentDeltas: observed, heldRepeatDetents: 20, states: states.length, colourways, traversal: ['S03', 'S08', 'S13', 'S08', 'S03'], tabOrder, activationCounts, focusVisible: true }, null, 2))
})

test('U13 a 30-detent browser flick publishes exactly one live announcement', async ({ page }) => {
  const panel = await openScreen(page, 's08', '?long=1')
  const live = panel.locator('[aria-live="polite"]')
  await live.evaluate((element) => {
    interface AnnouncementProbe {
      readonly records: { readonly seq: string; readonly text: string }[]
      lastMutationAt: number
    }
    const probe: AnnouncementProbe = { records: [], lastMutationAt: performance.now() }
    Object.defineProperty(window, '__w5bAnnouncementProbe', { value: probe, configurable: true })
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type !== 'attributes' || mutation.attributeName !== 'data-announcement-seq') continue
        const text = mutation.target.textContent?.trim() ?? ''
        const seq = mutation.target instanceof HTMLElement ? mutation.target.dataset['announcementSeq'] ?? '' : ''
        if (text !== '' && seq !== '') {
          probe.records.push({ seq, text })
          probe.lastMutationAt = performance.now()
        }
      }
    }).observe(element, { attributes: true, attributeFilter: ['data-announcement-seq'] })
  })
  for (let index = 0; index < 30; index += 1) {
    await panel.dispatchEvent('wheel', { deltaY: 40, deltaMode: 0 })
  }
  await expect.poll(async () => page.evaluate(() => {
    interface AnnouncementProbe { readonly records: readonly { readonly seq: string; readonly text: string }[] }
    return (window as Window & { __w5bAnnouncementProbe?: AnnouncementProbe }).__w5bAnnouncementProbe?.records.length ?? 0
  })).toBeGreaterThanOrEqual(1)
  await page.waitForFunction(() => {
    interface AnnouncementProbe { readonly records: readonly unknown[]; readonly lastMutationAt: number }
    const probe = (window as Window & { __w5bAnnouncementProbe?: AnnouncementProbe }).__w5bAnnouncementProbe
    return probe !== undefined && probe.records.length > 0 && performance.now() - probe.lastMutationAt >= 400
  })
  const selected = panel.locator('.wp-track-row[aria-current="true"]')
  await expect(selected.locator('.wp-track-number')).toHaveText('31')
  const selectedTitle = (await selected.locator('.wp-track-title').textContent())?.trim() ?? ''
  const selectedMeta = (await selected.locator('.wp-row-meta').textContent())?.trim() ?? ''
  const expected = `Row 31 of 120. ${selectedTitle}, ${selectedMeta}.`
  await landPlant(page, 'U13', async () => {
    await live.evaluate((element) => { element.setAttribute('data-announcement-seq', 'plant-1') })
    await page.waitForTimeout(0)
    await live.evaluate((element) => { element.setAttribute('data-announcement-seq', 'plant-2') })
  }, async () => (await live.getAttribute('data-announcement-seq')) === 'plant-2')
  await landPlant(page, 'U13_SETTLED',
    () => live.evaluate((element) => { element.textContent = 'Row 2 of 120. Stale first detent.' }),
    async () => (await live.textContent()) === 'Row 2 of 120. Stale first detent.')
  const announcements = await page.evaluate(() => {
    interface AnnouncementProbe { readonly records: readonly { readonly seq: string; readonly text: string }[] }
    return (window as Window & { __w5bAnnouncementProbe?: AnnouncementProbe }).__w5bAnnouncementProbe?.records ?? []
  })
  expect(announcements).toHaveLength(1)
  expect(announcements[0]?.text).toBe(expected)
  await expect(live).toHaveText(expected)
  await openScreen(page, 's13', '?state=error')
  await expect(page.locator('.wp-panel').first().getByRole('alert')).toBeVisible()
  await openScreen(page, 's13', '?state=loading')
  await expect(page.locator('.wp-panel').first().locator('[aria-busy="true"]')).toBeVisible()
  await writeFile(resolve(evidence, 'w5b-u13-announcements.json'), JSON.stringify({ detents: 30, finalRow: 31, expected, announcements, assertiveError: true, loadingBusy: true }, null, 2))
})
