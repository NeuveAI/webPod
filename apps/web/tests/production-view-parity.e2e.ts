import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  expect,
  test,
  type BrowserContext,
  type Page,
} from '../../../packages/panel/node_modules/@playwright/test/index.js'

import { assertBrowserSourceIdentity } from './source-identity'

const CHROME_EXECUTABLE =
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const evidenceDirectory = resolve(
  process.env['PRODUCTION_VIEW_PARITY_EVIDENCE_DIR'] ??
    resolve(import.meta.dirname, 'test-results/production-view-parity'),
)

const PROBE_ROUTE = '/_probe/composite'
const SPIKE_ROUTE = '/_spike/device'
const LEGACY_PROBE_ROUTES = [
  '/_probe/composite?colourway=black&state=ready&scale=1&fov=24&mode=bare&pose=front',
  '/_probe/composite?colourway=white&state=loading&scale=1.3&fov=30&mode=composited&pose=three-quarter',
  '/_probe/composite?colourway=black&state=empty&scale=2&fov=36&mode=bare&pose=edge',
  '/_probe/composite?colourway=white&state=error&scale=1&fov=24&mode=composited&pose=rear',
  '/_probe/composite?colourway=black&state=offline&scale=1.3&fov=30&mode=bare&pose=front',
  '/_probe/composite?colourway=white&state=permission-denied&scale=2&fov=36&mode=composited&pose=three-quarter',
  '/_probe/composite?colourway=black&state=agent-active&scale=1&fov=24&mode=bare&pose=edge',
  '/_probe/composite?colourway=white&state=success-confirmation&scale=2&fov=36&mode=composited&pose=rear',
] as const

test.use({
  launchOptions: {
    executablePath: CHROME_EXECUTABLE,
    args: ['--enable-blink-features=CanvasDrawElement'],
  },
})

interface MenuLayout {
  readonly attributes: Readonly<Record<string, string | undefined>>
  readonly labels: readonly string[]
  readonly rowIndexes: readonly number[]
  readonly highlighted: string
  readonly rowHeights: readonly number[]
  readonly rowFontSizes: readonly number[]
  readonly screen: Size
  readonly title: Size
  readonly list: Size
  readonly preview: Size
  readonly listOverflowY: string
  readonly listScrollTop: number
  readonly rasterScale: number
}

interface Size {
  readonly width: number
  readonly height: number
}

interface NormalizedLcd {
  readonly screenshotHash: string
  readonly pixelHash: string
  readonly pixels: readonly number[]
}

interface PixelDifference {
  readonly meanChannelDelta: number
  readonly changedPixelRatio: number
  readonly maximumChannelDelta: number
}

test.beforeAll(async () => mkdir(evidenceDirectory, { recursive: true }))

test('the default probe and spike render one production eight-row LCD view', async ({ context }) => {
  const probe = await openRoute(context, PROBE_ROUTE)
  const spike = await openRoute(context, SPIKE_ROUTE)

  try {
    const probeLayout = await measureMenu(probe)
    const spikeLayout = await measureMenu(spike)

    expectProductionDefault(probeLayout)
    expectProductionDefault(spikeLayout)
    expect(probeLayout).toEqual(spikeLayout)

    const probePanel = probe.locator('.wp-panel')
    const spikePanel = spike.locator('.wp-panel')
    await probePanel.focus()
    await spikePanel.focus()
    for (let movement = 0; movement < 3; movement += 1) {
      await probePanel.press('ArrowDown')
      await spikePanel.press('ArrowDown')
    }

    const advancedProbe = await measureMenu(probe)
    const advancedSpike = await measureMenu(spike)
    expect(advancedProbe).toEqual(advancedSpike)
    expect(advancedProbe.labels).toEqual([
      'Cover Flow',
      'Playlists',
      'Artists',
      'Albums',
      'Songs',
      'Genres',
      'Radio',
      'Search',
    ])
    expect(advancedProbe.highlighted).toBe('Radio')
  } finally {
    await probe.close()
    await spike.close()
  }
})

test('every legacy product-semantic query resolves to the canonical eight-row view', async ({ context }) => {
  for (const route of LEGACY_PROBE_ROUTES) {
    const page = await openRoute(context, route)
    try {
      const finalUrl = new URL(page.url())
      expect(finalUrl.pathname).toBe('/_spike/device')
      expect(finalUrl.search).toBe('')
      expectProductionDefault(await measureMenu(page))
    } finally {
      await page.close()
    }
  }
})

test('cropped LCD pixels remain equivalent across the shared route boundary', async ({ context }) => {
  const probe = await openRoute(context, PROBE_ROUTE)
  const spike = await openRoute(context, SPIKE_ROUTE)

  try {
    const probeLcd = await captureNormalizedLcd(probe, 'probe-default-lcd.png')
    const spikeLcd = await captureNormalizedLcd(spike, 'spike-front-lcd.png')
    const difference = comparePixels(probeLcd.pixels, spikeLcd.pixels)

    // Both URLs resolve to the same queryless product route. After both crops
    // are normalized to the authored 272×204 grid, only resampling noise may
    // differ.
    expect(difference.meanChannelDelta).toBeLessThanOrEqual(5)
    expect(difference.changedPixelRatio).toBeLessThanOrEqual(0.1)

    await writeFile(
      resolve(evidenceDirectory, 'summary.json'),
      `${JSON.stringify({
        routes: { probe: PROBE_ROUTE, spike: SPIKE_ROUTE },
        authoredLcd: { width: 272, height: 204 },
        probe: {
          screenshotSha256: probeLcd.screenshotHash,
          normalizedPixelSha256: probeLcd.pixelHash,
        },
        spike: {
          screenshotSha256: spikeLcd.screenshotHash,
          normalizedPixelSha256: spikeLcd.pixelHash,
        },
        difference,
      }, null, 2)}\n`,
    )
  } finally {
    await probe.close()
    await spike.close()
  }
})

async function openRoute(context: BrowserContext, route: string): Promise<Page> {
  const page = await context.newPage()
  await page.goto(route, { waitUntil: 'domcontentloaded' })
  await assertBrowserSourceIdentity(page)
  await page.addStyleTag({
    content:
      '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}',
  })
  await settleCompositePaint(page)
  await expect(page.locator('.wp-panel')).toHaveAttribute('data-screen', 'S03')
  return page
}

async function settleCompositePaint(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const source = document.querySelector('.wp-panel')?.closest('canvas')
    const canvas = document.querySelector<HTMLCanvasElement>('canvas[data-wp-composite-source-state]')
    return source !== null && canvas !== null
  })
  await page.evaluate(() => {
    const source = document.querySelector('.wp-panel')?.closest('canvas')
    if (source === null || !('requestPaint' in source)) {
      throw new Error('T1 raster paint is unavailable')
    }
    const requestPaint = Reflect.get(source, 'requestPaint')
    if (typeof requestPaint !== 'function') throw new Error('T1 raster requestPaint is not callable')
    Reflect.apply(requestPaint, source, [])
  })
  await page.waitForFunction(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('canvas[data-wp-composite-source-state]')
    if (canvas === null) return false
    const state = canvas.dataset['wpCompositeSourceState']
    if (state === 'attach-error') {
      throw new Error(canvas.dataset['wpCompositeSourceError'] ?? 'Composite attach failed')
    }
    return state === 'painted'
  })
  await page.evaluate(() => new Promise<void>((resolveFrame) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame()))))
}

async function measureMenu(page: Page): Promise<MenuLayout> {
  return page.locator('.wp-panel').evaluate((panel) => {
    if (!(panel instanceof HTMLElement)) throw new Error('Production panel is absent')
    const element = (selector: string): HTMLElement => {
      const match = panel.querySelector(selector)
      if (!(match instanceof HTMLElement)) throw new Error(`${selector} is absent`)
      return match
    }
    const size = (target: HTMLElement): Size => ({
      width: target.offsetWidth,
      height: target.offsetHeight,
    })
    const rows = [...panel.querySelectorAll<HTMLElement>('.wp-menu-row')]
    const selected = panel.querySelector<HTMLElement>('.wp-menu-row[aria-current="true"]')
    const list = element('.wp-menu-list')
    const stage = panel.parentElement
    if (!(stage instanceof HTMLElement)) throw new Error('Panel stage is absent')
    return {
      attributes: {
        actor: panel.dataset['actor'],
        colourway: panel.dataset['colourway'],
        density: panel.dataset['density'],
        screen: panel.dataset['screen'],
        state: panel.dataset['state'],
        visibleRows: panel.dataset['visibleRows'],
      },
      labels: rows.map((row) => row.querySelector('span')?.textContent?.trim() ?? ''),
      rowIndexes: rows.map((row) => {
        const index = row.id.match(/-menu-(\d+)$/)?.[1]
        return index === undefined ? -1 : Number(index)
      }),
      highlighted: selected?.querySelector('span')?.textContent?.trim() ?? '',
      rowHeights: rows.map((row) => row.offsetHeight),
      rowFontSizes: rows.map((row) => Number.parseFloat(getComputedStyle(row).fontSize)),
      screen: size(element('.wp-screen')),
      title: size(element('.wp-titlebar')),
      list: size(list),
      preview: size(element('.wp-menu-preview')),
      listOverflowY: getComputedStyle(list).overflowY,
      listScrollTop: list.scrollTop,
      rasterScale: Number.parseFloat(
        getComputedStyle(stage).getPropertyValue('--wp-raster-scale'),
      ),
    }
  })
}

function expectProductionDefault(layout: MenuLayout): void {
  expect(layout.attributes).toEqual({
    actor: 'human',
    colourway: 'dark',
    density: 'compact',
    screen: 'S03',
    state: 'ready',
    visibleRows: '8',
  })
  expect(layout.labels).toEqual([
    'Cover Flow',
    'Playlists',
    'Artists',
    'Albums',
    'Songs',
    'Genres',
    'Radio',
    'Search',
  ])
  expect(layout.rowIndexes).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  expect(layout.highlighted).toBe('Albums')
  expect(layout.rowHeights).toEqual(Array.from({ length: 8 }, () => 21))
  expect(layout.rowFontSizes).toEqual(Array.from({ length: 8 }, () => 11))
  expect(layout.screen).toEqual({ width: 272, height: 204 })
  expect(layout.title).toEqual({ width: 272, height: 21 })
  expect(layout.list).toEqual({ width: 168, height: 183 })
  expect(layout.preview).toEqual({ width: 104, height: 183 })
  expect(layout.listOverflowY).toBe('auto')
  expect(layout.listScrollTop).toBe(0)
  expect(layout.rasterScale).toBe(1)
}

async function captureNormalizedLcd(page: Page, filename: string): Promise<NormalizedLcd> {
  const clip = await page.locator('canvas[data-wp-screen-clip-left]').evaluate((canvas) => {
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Composite canvas is absent')
    const value = (key: string): number => {
      const number = Number(canvas.dataset[key])
      if (!Number.isFinite(number)) throw new Error(`Missing ${key}`)
      return number
    }
    const rect = canvas.getBoundingClientRect()
    return {
      x: rect.left + value('wpScreenClipLeft'),
      y: rect.top + value('wpScreenClipTop'),
      width: value('wpScreenClipWidth'),
      height: value('wpScreenClipHeight'),
    }
  })
  const screenshot = await page.screenshot({ clip })
  await writeFile(resolve(evidenceDirectory, filename), screenshot)
  const normalized = await page.evaluate(async (pngBase64) => {
    const image = new Image()
    const loaded = new Promise<void>((resolveImage, rejectImage) => {
      image.onload = () => resolveImage()
      image.onerror = () => rejectImage(new Error('LCD screenshot decode failed'))
    })
    image.src = `data:image/png;base64,${pngBase64}`
    await loaded
    const canvas = document.createElement('canvas')
    canvas.width = 272
    canvas.height = 204
    const context = canvas.getContext('2d')
    if (context === null) throw new Error('2D normalization context is unavailable')
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(image, 0, 0, 272, 204)
    const pixels = context.getImageData(0, 0, 272, 204).data
    const digest = await crypto.subtle.digest('SHA-256', pixels)
    return {
      pixelHash: [...new Uint8Array(digest)]
        .map((value) => value.toString(16).padStart(2, '0'))
        .join(''),
      pixels: [...pixels],
    }
  }, screenshot.toString('base64'))
  return {
    screenshotHash: createHash('sha256').update(screenshot).digest('hex'),
    pixelHash: normalized.pixelHash,
    pixels: normalized.pixels,
  }
}

function comparePixels(left: readonly number[], right: readonly number[]): PixelDifference {
  expect(left).toHaveLength(right.length)
  let totalDelta = 0
  let maximumChannelDelta = 0
  let changedPixels = 0
  for (let offset = 0; offset < left.length; offset += 4) {
    let pixelChanged = false
    for (let channel = 0; channel < 3; channel += 1) {
      const delta = Math.abs((left[offset + channel] ?? 0) - (right[offset + channel] ?? 0))
      totalDelta += delta
      maximumChannelDelta = Math.max(maximumChannelDelta, delta)
      if (delta > 20) pixelChanged = true
    }
    if (pixelChanged) changedPixels += 1
  }
  const pixelCount = left.length / 4
  return {
    meanChannelDelta: totalDelta / (pixelCount * 3),
    changedPixelRatio: changedPixels / pixelCount,
    maximumChannelDelta,
  }
}
