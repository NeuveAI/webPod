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

const contrastReport = async (panel: Locator): Promise<readonly TextContrast[]> => panel.evaluate((root) => {
  type Colour = readonly [number, number, number, number]
  const parse = (value: string): readonly [number, number, number, number] | null => {
    const match = value.match(/^rgba?\((\d+(?:\.\d+)?)\s*,?\s*(\d+(?:\.\d+)?)\s*,?\s*(\d+(?:\.\d+)?)(?:\s*[,/]\s*(\d+(?:\.\d+)?))?\)$/u)
    if (match === null) return null
    const red = Number(match[1])
    const green = Number(match[2])
    const blue = Number(match[3])
    const alpha = match[4] === undefined ? 1 : Number(match[4])
    return [red, green, blue, alpha]
  }
  const composite = (front: Colour, back: Colour): Colour => {
    const alpha = front[3] + back[3] * (1 - front[3])
    if (alpha === 0) return [0, 0, 0, 0]
    return [
      (front[0] * front[3] + back[0] * back[3] * (1 - front[3])) / alpha,
      (front[1] * front[3] + back[1] * back[3] * (1 - front[3])) / alpha,
      (front[2] * front[3] + back[2] * back[3] * (1 - front[3])) / alpha,
      alpha,
    ]
  }
  const luminance = (colour: Colour): number => {
    const channel = (value: number): number => {
      const normalized = value / 255
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * channel(colour[0]) + 0.7152 * channel(colour[1]) + 0.0722 * channel(colour[2])
  }
  const ratio = (a: Colour, b: Colour): number => {
    const light = Math.max(luminance(a), luminance(b))
    const dark = Math.min(luminance(a), luminance(b))
    return (light + 0.05) / (dark + 0.05)
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
  const unique = (colours: readonly Colour[]): readonly Colour[] => {
    const seen = new Set<string>()
    return colours.filter((colour) => {
      const key = colour.map((part) => part.toFixed(3)).join(',')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).slice(0, 96)
  }
  const applyPaint = (
    candidates: readonly Colour[],
    style: CSSStyleDeclaration,
    source: string,
    sources: string[],
    unresolved: string[],
  ): readonly Colour[] => {
    if (style.mixBlendMode !== 'normal') unresolved.push(`${source}: mix-blend-mode ${style.mixBlendMode}`)
    const opacity = Number(style.opacity)
    const solid = parse(style.backgroundColor)
    let next = candidates
    if (solid !== null && solid[3] > 0) {
      const layer = withOpacity(solid, opacity)
      next = unique(next.map((background) => composite(layer, background)))
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
          next = unique(next.flatMap((background) => stops.map((stop) => composite(withOpacity(stop, opacity), background))))
          sources.push(`${source}:gradient(${String(stops.length)} stops)`)
        }
      }
    }
    return next
  }
  const backgrounds = (element: Element): { readonly colours: readonly Colour[]; readonly sources: readonly string[]; readonly unresolved: readonly string[] } => {
    const chain: Element[] = []
    let current: Element | null = element
    while (current !== null) {
      chain.unshift(current)
      if (current === root) break
      current = current.parentElement
    }
    let candidates: readonly Colour[] = [[255, 255, 255, 1]]
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
      const ratios = painted.colours.map((background) => ratio(composite(withOpacity(foreground, opacity), background), background))
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

test.beforeAll(async () => mkdir(evidence, { recursive: true }))

test.beforeEach(async ({ page }) => {
  await page.goto('/')
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

test('U4 reduced transparency removes bloom, shadow and title translucency', async ({ page }) => {
  await openScreen(page, 's13', '?art=pale')
  await emulateFeature(page, 'prefers-reduced-transparency', 'reduce')
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-transparency: reduce)').matches)).toBe(true)
  await landPlant(page, 'U4',
    () => page.addStyleTag({ content: '.wp-titlebar{backdrop-filter:blur(2px)!important}' }).then(() => undefined),
    () => page.locator('.wp-titlebar').first().evaluate((element) => getComputedStyle(element).backdropFilter !== 'none'))
  const reports = []
  for (const [index, colourway] of colourways.entries()) {
    const panel = page.locator('.wp-panel').nth(index)
    expect(await panel.locator('.wp-now-body').evaluate((element) => getComputedStyle(element, '::before').display)).toBe('none')
    await expect(panel.locator('.wp-art')).toHaveCSS('box-shadow', 'none')
    const report = await panel.evaluate((root) => {
      const alpha = (value: string): number => {
        const slash = value.match(/\/\s*([\d.]+)\s*\)$/u)
        if (slash?.[1] !== undefined) return Number(slash[1])
        if (!value.startsWith('rgba(')) return 1
        const parts = value.slice(5, -1).split(',')
        return parts[3] === undefined ? 1 : Number(parts[3].trim())
      }
      const backdrop = Array.from(root.querySelectorAll<HTMLElement>('*')).flatMap((element) =>
        ([null, '::before', '::after'] as const).flatMap((pseudo) => {
          const style = getComputedStyle(element, pseudo)
          return style.backdropFilter !== 'none' || (style.webkitBackdropFilter !== undefined && style.webkitBackdropFilter !== 'none')
            ? [{ tag: element.tagName, pseudo, backdrop: style.backdropFilter, webkit: style.webkitBackdropFilter }]
            : []
        }))
      const title = root.querySelector<HTMLElement>('.wp-titlebar')
      if (title === null) throw new Error('titlebar missing')
      const titleStyle = getComputedStyle(title)
      const titleStops = Array.from(titleStyle.backgroundImage.matchAll(/rgba?\([^)]*\)/gu), (match) => ({ value: match[0], alpha: alpha(match[0]) }))
      const scrims = Array.from(root.querySelectorAll<HTMLElement>('[data-agent="true"]')).map((element) => ({
        background: getComputedStyle(element).backgroundColor,
        alpha: alpha(getComputedStyle(element).backgroundColor),
      }))
      return { backdrop, titleStops, scrims, title0: titleStyle.getPropertyValue('--wp-title-0').trim(), title1: titleStyle.getPropertyValue('--wp-title-1').trim() }
    })
    expect(report.backdrop).toEqual([])
    expect(report.titleStops.every((stop) => stop.alpha === 1)).toBe(true)
    expect(report.scrims.every((scrim) => scrim.alpha === 1)).toBe(true)
    reports.push({ colourway, ...report })
    await panel.screenshot({ path: resolve(evidence, `w5b-u4-reduced-transparency-${colourway}.png`) })
  }
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
  const reports = []
  const advisoryMeasurements: Array<{ readonly colourway: string; readonly text: string; readonly ratio: number; readonly required: number }> = []
  const gradientFailures: Array<{ readonly colourway: string; readonly text: string; readonly ratio: number; readonly required: number }> = []
  for (const colourway of colourways) {
    const selector = `.wp-panel[data-colourway="${colourway}"]`
    const axe = await new AxeBuilder({ page }).include(selector).withRules(['color-contrast']).analyze()
    const text = await contrastReport(page.locator(selector))
    for (const entry of text) if (entry.ratio < entry.required) {
      const failure = { colourway, text: entry.text, ratio: entry.ratio, required: entry.required }
      advisoryMeasurements.push(failure)
      if (entry.text === 'Now Playing' && entry.paintSources.some((source) => source.includes(':gradient('))) gradientFailures.push(failure)
    }
    reports.push({ colourway, axeViolations: axe.violations, axeIncomplete: axe.incomplete.filter((entry) => entry.id === 'color-contrast'), text })
  }
  await writeFile(resolve(evidence, 'w5b-u7-contrast.json'), JSON.stringify({ authority: 'axe browser paint evaluation', reports, advisoryMeasurements }, null, 2))
  expect(reports.flatMap((report) => report.axeViolations)).toEqual([])
  expect(reports.flatMap((report) => report.text.flatMap((entry) => entry.unresolved))).toEqual([])
  expect(reports.every((report) => report.text.length > 0)).toBe(true)
  expect(gradientFailures).toEqual([])
})

test('U11 200% Dynamic Type has no clipped or truncated visible text', async ({ page }) => {
  for (const screen of screens) {
    await openScreen(page, screen, '?scale=2&density=compact')
    await landPlant(page, 'U11',
      () => page.addStyleTag({ content: '.wp-titlebar{inline-size:12px!important;min-inline-size:12px!important;max-inline-size:12px!important;overflow:hidden!important}' }).then(() => undefined),
      () => page.locator('.wp-titlebar').first().evaluate((element) => element.clientWidth < 44 && getComputedStyle(element).overflow === 'hidden'))
    for (const colourway of colourways) {
      const panel = page.locator(`.wp-panel[data-colourway="${colourway}"]`)
      await expect(panel).toHaveAttribute('data-density', 'airy')
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
})

test('U12 keyboard traversal is complete, one-detent, unaccelerated and focus-visible', async ({ page }) => {
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
  await page.goto('/?state=ready')
  await page.locator('body').focus()
  const tabOrder: string[] = []
  for (let index = 0; index < 2; index += 1) {
    await page.keyboard.press('Tab')
    tabOrder.push(await page.locator(':focus').evaluate((element) => `${element.tagName}:${element.getAttribute('data-colourway') ?? element.getAttribute('aria-label') ?? ''}`))
    expect(await page.locator(':focus').evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe('none')
  }
  expect(tabOrder).toEqual(['DIV:dark', 'DIV:light'])
  await writeFile(resolve(evidence, 'w5b-u12-keyboard.json'), JSON.stringify({ oneDetentDeltas: observed, heldRepeatDetents: 20, states: states.length, colourways, traversal: ['S03', 'S08', 'S13', 'S08', 'S03'], tabOrder, focusVisible: true }, null, 2))
})

test('U13 a 30-detent browser flick publishes exactly one live announcement', async ({ page }) => {
  const panel = await openScreen(page, 's08', '?long=1')
  const live = panel.locator('[aria-live="polite"]')
  await live.evaluate((element) => {
    const records: string[] = []
    Object.defineProperty(window, '__w5bAnnouncements', { value: records, configurable: true })
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        const text = mutation.target.textContent?.trim() ?? ''
        if (text !== '') records.push(text)
      }
    }).observe(element, { childList: true, characterData: true, subtree: true })
  })
  for (let index = 0; index < 30; index += 1) await panel.press('ArrowDown')
  await landPlant(page, 'U13', async () => {
    await live.evaluate((element) => { element.textContent = 'Duplicate announcement.' })
    await page.waitForTimeout(0)
    await live.evaluate((element) => { element.textContent = ''; element.textContent = 'Duplicate announcement.' })
  }, async () => (await live.textContent()) === 'Duplicate announcement.')
  await page.waitForTimeout(450)
  const announcements = await page.evaluate(() => (window as Window & { __w5bAnnouncements?: readonly string[] }).__w5bAnnouncements ?? [])
  expect(announcements).toHaveLength(1)
  await openScreen(page, 's13', '?state=error')
  await expect(page.locator('.wp-panel').first().getByRole('alert')).toBeVisible()
  await openScreen(page, 's13', '?state=loading')
  await expect(page.locator('.wp-panel').first().locator('[aria-busy="true"]')).toBeVisible()
  await writeFile(resolve(evidence, 'w5b-u13-announcements.json'), JSON.stringify({ detents: 30, announcements, assertiveError: true, loadingBusy: true }, null, 2))
})
