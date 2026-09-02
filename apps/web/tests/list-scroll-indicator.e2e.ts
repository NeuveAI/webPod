import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  expect,
  test,
  type Locator,
  type Page,
} from '../../../packages/panel/node_modules/@playwright/test/index.js'

import { assertBrowserSourceIdentity } from './source-identity'

const CHROME_EXECUTABLE =
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const evidenceDirectory = resolve(
  process.env['LIST_SCROLL_EVIDENCE_DIR'] ??
    resolve(import.meta.dirname, 'test-results/list-scroll-indicator'),
)

test.use({
  viewport: { width: 900, height: 1100 },
  launchOptions: {
    executablePath: CHROME_EXECUTABLE,
    args: ['--enable-blink-features=CanvasDrawElement'],
  },
})

test.beforeAll(async () => mkdir(evidenceDirectory, { recursive: true }))

test('production list indication is absent at 8/8 and follows an overflowing album window', async ({ page }) => {
  await page.goto('/_spike/device', { waitUntil: 'domcontentloaded' })
  await assertBrowserSourceIdentity(page)
  await page.addStyleTag({
    content: [
      '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}',
      '.webpod-device-preview__controls,.webpod-device-preview__selection-note{display:none!important}',
    ].join(''),
  })
  await settleCompositePaint(page)

  const panel = page.locator('.wp-panel')
  const stage = page.locator('.webpod-device-preview__stage')
  await expect(panel).toHaveAttribute('data-screen', 'S03')
  await expect(panel).toHaveAttribute('data-visible-rows', '8')
  await expect(panel.getByRole('option')).toHaveCount(8)
  await expect(panel.locator('.wp-list-scroll')).toHaveCount(0)
  await expect(panel.locator('.wp-menu-preview__rail')).toHaveCount(0)
  await stage.screenshot({ path: resolve(evidenceDirectory, 'production-main-menu.png') })

  await panel.focus()
  await panel.press('Enter')
  await expect(panel).toHaveAttribute('data-screen', 'S08')
  await settleCompositePaint(page)

  const indicator = panel.locator('.wp-album-list > .wp-list-scroll')
  await expect(indicator).toHaveCount(1)
  await expect(panel.locator('.wp-album-preview .wp-list-scroll')).toHaveCount(0)
  await expect(indicator).toHaveAttribute('data-total-rows', '11')
  await expect(indicator).toHaveAttribute('data-visible-rows', '8')
  await expect(indicator).toHaveAttribute('data-window-start', '0')

  const blackFirst = await captureSelectedRow(stage, panel, 'black', 'first')
  const startLayers = await captureIndicatorLayers(indicator, 'start')
  const darkVisual = await measureIndicator(indicator)
  expect(darkVisual.trackWidth).toBe(6)
  expect(darkVisual.thumbRatio).toBeCloseTo(8 / 11, 2)
  expect(darkVisual.trailingInset).toBeGreaterThanOrEqual(0)
  expect(darkVisual.trailingInset).toBeLessThanOrEqual(2.5)

  await dispatchDetents(panel, 5)
  const blackMiddle = await captureSelectedRow(stage, panel, 'black', 'middle')

  await dispatchDetents(panel, 4)
  await expect(indicator).toHaveAttribute('data-window-start', '2')
  await expect(indicator).toHaveAttribute('data-thumb-offset', '18.182%')
  const movedVisual = await measureIndicator(indicator)
  expect(movedVisual.progress).toBeCloseTo(2 / 3, 1)
  const middleLayers = await captureIndicatorLayers(indicator, 'middle')

  await dispatchDetents(panel, 1)
  await expect(indicator).toHaveAttribute('data-window-start', '3')
  const blackEnd = await captureSelectedRow(stage, panel, 'black', 'end')
  const endLayers = await captureIndicatorLayers(indicator, 'end')

  expect(middleLayers.trackStripeSha256).toBe(startLayers.trackStripeSha256)
  expect(endLayers.trackStripeSha256).toBe(startLayers.trackStripeSha256)
  expect(new Set([
    startLayers.compositeSha256,
    middleLayers.compositeSha256,
    endLayers.compositeSha256,
  ]).size).toBe(3)

  await page.evaluate(() => window.__webpodDevicePreview?.setColourway('white'))
  await expect(panel).toHaveAttribute('data-colourway', 'light')
  const whiteEnd = await captureSelectedRow(stage, panel, 'white', 'end')
  await dispatchDetents(panel, -5)
  const whiteMiddle = await captureSelectedRow(stage, panel, 'white', 'middle')
  await dispatchDetents(panel, -5)
  const whiteFirst = await captureSelectedRow(stage, panel, 'white', 'first')
  const lightVisual = await measureIndicator(indicator)
  expect(lightVisual.thumbMaterial).not.toBe(darkVisual.thumbMaterial)
  expect(lightVisual.trackMaterial).not.toBe(darkVisual.trackMaterial)
  expect(whiteFirst.foreground).not.toBe(blackFirst.foreground)
  expect(whiteFirst.material).not.toBe(blackFirst.material)

  await writeFile(
    resolve(evidenceDirectory, 'summary.json'),
    `${JSON.stringify({
      route: '/_spike/device',
      mainMenu: { totalRows: 8, visibleRows: 8, indicatorCount: 0 },
      album: {
        totalRows: 11,
        visibleRows: 8,
        start: darkVisual,
        afterNineWheelDetents: movedVisual,
        light: lightVisual,
        fixedTrackProof: {
          start: startLayers,
          middle: middleLayers,
          end: endLayers,
        },
        selectedRows: {
          black: { first: blackFirst, middle: blackMiddle, end: blackEnd },
          white: { first: whiteFirst, middle: whiteMiddle, end: whiteEnd },
        },
      },
    }, null, 2)}\n`,
  )
})

async function dispatchDetents(panel: Locator, count: number): Promise<void> {
  const deltaY = count < 0 ? -40 : 40
  for (let detent = 0; detent < Math.abs(count); detent += 1) {
    await panel.dispatchEvent('wheel', { deltaY, deltaMode: 0 })
  }
}

async function captureSelectedRow(
  stage: Locator,
  panel: Locator,
  colourway: 'black' | 'white',
  position: 'first' | 'middle' | 'end',
) {
  const page = panel.page()
  await settleCompositePaint(page)
  const selected = panel.locator('.wp-track-row[aria-current="true"]')
  await expect(selected).toHaveCount(1)
  const visual = await selected.evaluate((row) => {
    const style = getComputedStyle(row)
    return {
      label: row.querySelector('.wp-track-title')?.textContent ?? '',
      number: row.querySelector('.wp-track-number')?.textContent ?? '',
      foreground: style.color,
      material: style.backgroundImage,
      depth: style.boxShadow,
    }
  })
  expect(visual.number).toBe({ first: '1', middle: '6', end: '11' }[position])
  expect(visual.material.split('linear-gradient').length - 1).toBeGreaterThanOrEqual(3)
  await stage.screenshot({
    path: resolve(evidenceDirectory, `${colourway}-selected-${position}.png`),
  })
  return visual
}

async function captureIndicatorLayers(indicator: Locator, position: 'start' | 'middle' | 'end') {
  const composite = await indicator.screenshot({
    path: resolve(evidenceDirectory, `indicator-${position}.png`),
  })
  const previousStyles = await indicator.evaluate((track) => {
    if (!(track instanceof HTMLElement)) throw new Error('Aqua indicator is absent')
    const panel = track.closest('.wp-panel')
    const thumb = track.querySelector('.wp-list-scroll__thumb')
    if (!(panel instanceof HTMLElement) || !(thumb instanceof HTMLElement)) {
      throw new Error('Aqua indicator layers are incomplete')
    }
    const previous = {
      panel: panel.getAttribute('style'),
      track: track.getAttribute('style'),
      thumb: thumb.getAttribute('style'),
    }
    panel.style.transform = 'none'
    track.style.position = 'fixed'
    track.style.inset = 'auto'
    track.style.left = '0'
    track.style.top = '0'
    track.style.width = '6px'
    track.style.height = '175px'
    thumb.style.visibility = 'hidden'
    return previous
  })
  const well = indicator.locator('.wp-list-scroll__well')
  const track = await well.screenshot({
    path: resolve(evidenceDirectory, `indicator-track-${position}.png`),
  })
  const wellBounds = await well.boundingBox()
  if (wellBounds === null) throw new Error('Aqua track has no pixel bounds')
  const trackStripe = await indicator.page().screenshot({
    clip: {
      x: wellBounds.x,
      y: wellBounds.y,
      width: Math.max(1, Math.floor(wellBounds.width / 3)),
      height: wellBounds.height,
    },
    path: resolve(evidenceDirectory, `indicator-track-stripes-${position}.png`),
  })
  await indicator.evaluate((trackElement, previous) => {
    if (!(trackElement instanceof HTMLElement)) throw new Error('Aqua indicator is absent')
    const panel = trackElement.closest('.wp-panel')
    const thumb = trackElement.querySelector('.wp-list-scroll__thumb')
    if (!(panel instanceof HTMLElement) || !(thumb instanceof HTMLElement)) {
      throw new Error('Aqua indicator layers are incomplete')
    }
    restoreStyle(panel, previous.panel)
    restoreStyle(trackElement, previous.track)
    restoreStyle(thumb, previous.thumb)

    function restoreStyle(element: HTMLElement, value: string | null) {
      if (value === null) element.removeAttribute('style')
      else element.setAttribute('style', value)
    }
  }, previousStyles)
  return {
    compositeSha256: createHash('sha256').update(composite).digest('hex'),
    trackSha256: createHash('sha256').update(track).digest('hex'),
    trackStripeSha256: createHash('sha256').update(trackStripe).digest('hex'),
  }
}

async function settleCompositePaint(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const source = document.querySelector('.wp-panel')?.closest('canvas')
    const canvas = document.querySelector<HTMLCanvasElement>(
      'canvas[data-wp-composite-source-state]',
    )
    return source !== null && canvas !== null
  })
  await page.evaluate(() => {
    const source = document.querySelector('.wp-panel')?.closest('canvas')
    if (source === null || !('requestPaint' in source)) {
      throw new Error('T1 raster paint is unavailable')
    }
    const requestPaint = Reflect.get(source, 'requestPaint')
    if (typeof requestPaint !== 'function') {
      throw new Error('T1 raster requestPaint is not callable')
    }
    Reflect.apply(requestPaint, source, [])
  })
  await page.waitForFunction(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      'canvas[data-wp-composite-source-state]',
    )
    if (canvas === null) return false
    const state = canvas.dataset['wpCompositeSourceState']
    if (state === 'attach-error') {
      throw new Error(canvas.dataset['wpCompositeSourceError'] ?? 'Composite attach failed')
    }
    return state === 'painted'
  })
  await page.evaluate(
    () => new Promise<void>((resolveFrame) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame()))),
  )
}

async function measureIndicator(indicator: Locator) {
  return indicator.evaluate((track) => {
    if (!(track instanceof HTMLElement)) throw new Error('List indicator is absent')
    const thumb = track.querySelector('.wp-list-scroll__thumb')
    const well = track.querySelector('.wp-list-scroll__well')
    const pane = track.parentElement
    if (!(thumb instanceof HTMLElement) || !(well instanceof HTMLElement) || !(pane instanceof HTMLElement)) {
      throw new Error('List indicator is outside its list pane')
    }
    const trackRect = track.getBoundingClientRect()
    const thumbRect = thumb.getBoundingClientRect()
    const paneRect = pane.getBoundingClientRect()
    const trackStyle = getComputedStyle(track)
    const wellStyle = getComputedStyle(well)
    const thumbStyle = getComputedStyle(thumb)
    const authoredTrackWidth = Number.parseFloat(trackStyle.width)
    const rasterScale = trackRect.width / authoredTrackWidth
    return {
      trackWidth: authoredTrackWidth,
      thumbRatio: thumbRect.height / trackRect.height,
      progress:
        trackRect.height === thumbRect.height
          ? 0
          : (thumbRect.top - trackRect.top) / (trackRect.height - thumbRect.height),
      trailingInset: (paneRect.right - trackRect.right) / rasterScale,
      thumbMaterial: thumbStyle.backgroundImage,
      trackMaterial: wellStyle.backgroundImage,
      trackPosition: wellStyle.backgroundPosition,
      outerBackground: trackStyle.backgroundColor,
    }
  })
}
