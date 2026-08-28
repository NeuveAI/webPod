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
  const parse = (value: string): readonly [number, number, number, number] | null => {
    const match = value.match(/^rgba?\((\d+(?:\.\d+)?)\s*,?\s*(\d+(?:\.\d+)?)\s*,?\s*(\d+(?:\.\d+)?)(?:\s*[,/]\s*(\d+(?:\.\d+)?))?\)$/u)
    if (match === null) return null
    const red = Number(match[1])
    const green = Number(match[2])
    const blue = Number(match[3])
    const alpha = match[4] === undefined ? 1 : Number(match[4])
    return [red, green, blue, alpha]
  }
  const composite = (front: readonly [number, number, number, number], back: readonly [number, number, number, number]): readonly [number, number, number, number] => {
    const alpha = front[3] + back[3] * (1 - front[3])
    if (alpha === 0) return [0, 0, 0, 0]
    return [
      (front[0] * front[3] + back[0] * back[3] * (1 - front[3])) / alpha,
      (front[1] * front[3] + back[1] * back[3] * (1 - front[3])) / alpha,
      (front[2] * front[3] + back[2] * back[3] * (1 - front[3])) / alpha,
      alpha,
    ]
  }
  const background = (element: Element): readonly [number, number, number, number] => {
    let current: Element | null = element
    let result: readonly [number, number, number, number] = [255, 255, 255, 1]
    const layers: Array<readonly [number, number, number, number]> = []
    while (current !== null) {
      const parsed = parse(getComputedStyle(current).backgroundColor)
      if (parsed !== null && parsed[3] > 0) layers.push(parsed)
      current = current.parentElement
    }
    for (const layer of layers.reverse()) result = composite(layer, result)
    return result
  }
  const luminance = (colour: readonly [number, number, number, number]): number => {
    const channel = (value: number): number => {
      const normalized = value / 255
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * channel(colour[0]) + 0.7152 * channel(colour[1]) + 0.0722 * channel(colour[2])
  }
  const ratio = (a: readonly [number, number, number, number], b: readonly [number, number, number, number]): number => {
    const light = Math.max(luminance(a), luminance(b))
    const dark = Math.min(luminance(a), luminance(b))
    return (light + 0.05) / (dark + 0.05)
  }
  const visible = (element: HTMLElement): boolean => {
    const style = getComputedStyle(element)
    const rect = element.getBoundingClientRect()
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0
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
      return {
        selector: `${element.tagName.toLowerCase()}:${String(index)}`,
        text: (element.textContent ?? '').trim().slice(0, 80),
        fontSize,
        fontWeight,
        ratio: ratio(composite(foreground, background(element)), background(element)),
        required,
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
      if (plant === 'U1' && state === 'ready' && screen === 's03') await page.locator('.wp-panel').nth(1).evaluate((element) => element.remove())
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
  if (plant === 'U2') await panel.evaluate((element) => element.removeAttribute('data-actor'))
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
  if (plant === 'U3') await page.addStyleTag({ content: '.wp-now-body{animation:wp-success-dark 1s infinite!important}' })
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
  if (plant === 'U4') await page.addStyleTag({ content: '.wp-now-body::before{display:block!important}' })
  for (const [index, colourway] of colourways.entries()) {
    const panel = page.locator('.wp-panel').nth(index)
    expect(await panel.locator('.wp-now-body').evaluate((element) => getComputedStyle(element, '::before').display)).toBe('none')
    await expect(panel.locator('.wp-art')).toHaveCSS('box-shadow', 'none')
    await panel.screenshot({ path: resolve(evidence, `w5b-u4-reduced-transparency-${colourway}.png`) })
  }
})

test('U5 increased contrast resolves to black/white foundations', async ({ page }) => {
  await openScreen(page, 's03')
  await emulateFeature(page, 'prefers-contrast', 'more')
  if (plant === 'U5') await page.addStyleTag({ content: '.wp-panel{--wp-bg:#777!important}' })
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
  if (plant === 'U6') await page.addStyleTag({ content: '.wp-actions button{min-inline-size:20px!important;min-block-size:20px!important;inline-size:20px!important;block-size:20px!important}' })
  const reports = []
  for (const colourway of colourways) {
    const selector = `.wp-panel[data-colourway="${colourway}"]`
    const results = await new AxeBuilder({ page }).include(selector).analyze()
    expect(results.violations).toEqual([])
    const controls = page.locator(`${selector} button,${selector} a,${selector} input,${selector} select,${selector} textarea,[role="button"]`)
    const boxes = []
    for (const control of await controls.all()) {
      if (!await control.isVisible()) continue
      const dimensions = await control.evaluate((element) => ({ width: (element as HTMLElement).offsetWidth, height: (element as HTMLElement).offsetHeight }))
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
  if (plant === 'U7') await page.addStyleTag({ content: '.wp-panel{--wp-text:#777!important;--wp-text-2:#777!important;--wp-text-3:#777!important}' })
  const reports = []
  const failures: Array<{ readonly colourway: string; readonly text: string; readonly ratio: number; readonly required: number }> = []
  for (const colourway of colourways) {
    const selector = `.wp-panel[data-colourway="${colourway}"]`
    const axe = await new AxeBuilder({ page }).include(selector).withRules(['color-contrast']).analyze()
    const unresolved = axe.incomplete.filter((entry) => entry.id === 'color-contrast')
    const text = await contrastReport(page.locator(selector))
    for (const entry of text) if (entry.ratio < entry.required) failures.push({ colourway, text: entry.text, ratio: entry.ratio, required: entry.required })
    reports.push({ colourway, axeViolations: axe.violations, axeIncompleteResolvedByMeasuredThresholds: unresolved, text })
  }
  await writeFile(resolve(evidence, 'w5b-u7-contrast.json'), JSON.stringify({ reports, failures }, null, 2))
  expect(reports.flatMap((report) => report.axeViolations)).toEqual([])
  expect(reports.every((report) => report.text.length > 0)).toBe(true)
  expect(failures).toEqual([])
})

test('U11 200% Dynamic Type has no clipped or truncated visible text', async ({ page }) => {
  for (const screen of screens) {
    await openScreen(page, screen, '?scale=2&density=compact')
    if (plant === 'U11') await page.addStyleTag({ content: '.wp-titlebar strong{display:block!important;inline-size:1px!important;overflow:hidden!important;white-space:nowrap!important}' })
    for (const colourway of colourways) {
      const panel = page.locator(`.wp-panel[data-colourway="${colourway}"]`)
      await expect(panel).toHaveAttribute('data-density', 'airy')
      const failures = await panel.evaluate((root) => Array.from(root.querySelectorAll<HTMLElement>('*')).flatMap((element) => {
        const style = getComputedStyle(element)
        if (style.display === 'none' || style.visibility === 'hidden') return []
        const hasDirectText = Array.from(element.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== '')
        if (!hasDirectText) return []
        const clipped = element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1
        const truncated = style.textOverflow === 'ellipsis' && element.scrollWidth > element.clientWidth + 1
        return clipped || truncated ? [{ tag: element.tagName, className: element.className, text: (element.textContent ?? '').trim().slice(0, 80), clipped, truncated }] : []
      }))
      expect(failures, `${screen}/${colourway} clipped content`).toEqual([])
      await panel.screenshot({ path: resolve(evidence, `w5b-u11-${screen}-200-${colourway}.png`) })
    }
  }
})

test('U12 keyboard traversal is complete, one-detent, unaccelerated and focus-visible', async ({ page }) => {
  const dark = await openScreen(page, 's03', '?long=1')
  if (plant === 'U12') await dark.evaluate((element) => element.addEventListener('keydown', (event) => event.stopImmediatePropagation(), { capture: true }))
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
  for (let index = 0; index < 20; index += 1) {
    const before = Number(await dark.locator('.wp-track-row[aria-current="true"] .wp-track-number').textContent())
    await dark.press('ArrowDown')
    const after = Number(await dark.locator('.wp-track-row[aria-current="true"] .wp-track-number').textContent())
    expect(after - before).toBe(1)
  }
  await dark.press('Enter')
  await expect(dark).toHaveAttribute('data-screen', 'S13')
  await dark.press('Backspace')
  await expect(dark).toHaveAttribute('data-screen', 'S08')
  await page.keyboard.press('Tab')
  const love = page.getByRole('button', { name: 'Love track' }).first()
  if (await love.isVisible()) {
    await love.focus()
    expect(await love.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe('none')
  }
  await writeFile(resolve(evidence, 'w5b-u12-keyboard.json'), JSON.stringify({ oneDetentDeltas: observed, rapidDetents: 20, traversal: ['S03', 'S08', 'S13', 'S08'], focusVisible: true }, null, 2))
})

test('U13 a 30-detent browser flick publishes exactly one live announcement', async ({ page }) => {
  const panel = await openScreen(page, 's08', '?long=1')
  const live = panel.locator('[aria-live="polite"]')
  await live.evaluate((element) => {
    const records: string[] = []
    Object.defineProperty(window, '__w5bAnnouncements', { value: records, configurable: true })
    new MutationObserver(() => {
      const text = element.textContent?.trim() ?? ''
      if (text !== '' && records.at(-1) !== text) records.push(text)
    }).observe(element, { childList: true, characterData: true, subtree: true })
  })
  for (let index = 0; index < 30; index += 1) await panel.press('ArrowDown')
  if (plant === 'U13') {
    await page.waitForTimeout(20)
    await live.evaluate((element) => { element.textContent = 'Injected second announcement.' })
  }
  await page.waitForTimeout(450)
  const announcements = await page.evaluate(() => (window as Window & { __w5bAnnouncements?: readonly string[] }).__w5bAnnouncements ?? [])
  expect(announcements).toHaveLength(1)
  await writeFile(resolve(evidence, 'w5b-u13-announcements.json'), JSON.stringify({ detents: 30, announcements }, null, 2))
})
