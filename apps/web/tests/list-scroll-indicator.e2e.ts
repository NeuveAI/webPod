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
  const tenThousandRowEnd = await measureTenThousandRowEnd(indicator)
  expect(tenThousandRowEnd.thumbSize).toBe(5)
  expect(tenThousandRowEnd.thumbOffset).toBe(170)
  expect(tenThousandRowEnd.thumbBottom).toBe(tenThousandRowEnd.trackBottom)

  await dispatchDetents(panel, 5)
  const blackMiddle = await captureSelectedRow(stage, panel, 'black', 'middle')

  await dispatchDetents(panel, 4)
  await expect(indicator).toHaveAttribute('data-window-start', '2')
  await expect(indicator).toHaveAttribute('data-thumb-offset', '31.818px')
  const movedVisual = await measureIndicator(indicator)
  expect(movedVisual.progress).toBeCloseTo(2 / 3, 1)
  const middleLayers = await captureIndicatorLayers(indicator, 'middle')

  await dispatchDetents(panel, 1)
  await expect(indicator).toHaveAttribute('data-window-start', '3')
  const blackEnd = await captureSelectedRow(stage, panel, 'black', 'end')
  const endLayers = await captureIndicatorLayers(indicator, 'end')

  expect(middleLayers.trackSha256).toBe(startLayers.trackSha256)
  expect(endLayers.trackSha256).toBe(startLayers.trackSha256)
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
  expect(whiteFirst.rim).not.toBe(blackFirst.rim)

  await writeFile(
    resolve(evidenceDirectory, 'summary.json'),
    `${JSON.stringify({
      route: '/_spike/device',
      mainMenu: { totalRows: 8, visibleRows: 8, indicatorCount: 0 },
      album: {
        totalRows: 11,
        visibleRows: 8,
        start: darkVisual,
        tenThousandRowEnd,
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
    const list = row.closest('.wp-track-list')
    const rim = row.querySelector('.wp-selection-rim')
    const metadata = row.querySelector('.wp-row-meta')
    if (!(list instanceof HTMLElement) || !(rim instanceof HTMLElement) || !(metadata instanceof HTMLElement)) {
      throw new Error('Selected track is missing its list, structural rim, or metadata')
    }
    const rowRect = row.getBoundingClientRect()
    const listRect = list.getBoundingClientRect()
    const rimStyle = getComputedStyle(rim)
    return {
      label: row.querySelector('.wp-track-title')?.textContent ?? '',
      number: row.querySelector('.wp-track-number')?.textContent ?? '',
      foreground: style.color,
      material: style.backgroundImage,
      depth: style.boxShadow,
      rim: rimStyle.backgroundColor,
      rimSize: rimStyle.height,
      metadataOpacity: getComputedStyle(metadata).opacity,
      contained: rowRect.top >= listRect.top - 0.5 && rowRect.bottom <= listRect.bottom + 0.5,
      rowTop: rowRect.top,
      rowBottom: rowRect.bottom,
      listTop: listRect.top,
      listBottom: listRect.bottom,
    }
  })
  expect(visual.number).toBe({ first: '1', middle: '6', end: '11' }[position])
  expect(visual.material.split('linear-gradient').length - 1).toBeGreaterThanOrEqual(2)
  expect(visual.rim).not.toBe('rgba(0, 0, 0, 0)')
  expect(visual.rimSize).toBe('1px')
  expect(visual.metadataOpacity).toBe('1')
  expect(visual.contained).toBe(true)
  await stage.screenshot({
    path: resolve(evidenceDirectory, `${colourway}-selected-${position}.png`),
  })
  return visual
}

async function captureIndicatorLayers(indicator: Locator, position: 'start' | 'middle' | 'end') {
  const composite = await indicator.screenshot({
    path: resolve(evidenceDirectory, `indicator-${position}.png`),
  })
  const proofId = await indicator.evaluate((track, proofPosition) => {
    if (!(track instanceof HTMLElement)) throw new Error('Aqua indicator is absent')
    const panel = track.closest('.wp-panel')
    if (!(panel instanceof HTMLElement)) {
      throw new Error('Aqua indicator layers are incomplete')
    }
    const proofId = `wp-list-scroll-proof-${proofPosition}`
    const host = document.createElement('div')
    host.id = proofId
    host.className = 'wp-panel'
    host.dataset['colourway'] = panel.dataset['colourway']
    host.style.cssText = 'position:fixed;left:0;top:0;width:6px;height:175px;transform:none;overflow:hidden;'
    const proofTrack = document.createElement('span')
    proofTrack.className = 'wp-list-scroll'
    proofTrack.style.cssText = 'position:absolute;inset:0;width:6px;height:175px;'
    proofTrack.style.setProperty(
      '--wp-list-scroll-thumb-size',
      track.style.getPropertyValue('--wp-list-scroll-thumb-size'),
    )
    proofTrack.style.setProperty(
      '--wp-list-scroll-thumb-offset',
      track.style.getPropertyValue('--wp-list-scroll-thumb-offset'),
    )
    const proofWell = document.createElement('i')
    proofWell.className = 'wp-list-scroll__well'
    proofTrack.append(proofWell)
    host.append(proofTrack)
    document.body.append(host)
    return proofId
  }, position)
  const well = indicator.page().locator(`#${proofId} .wp-list-scroll__well`)
  const pseudo = await well.evaluate((element) => ({
    beforeContent: getComputedStyle(element, '::before').content,
    beforeDisplay: getComputedStyle(element, '::before').display,
    afterContent: getComputedStyle(element, '::after').content,
    afterDisplay: getComputedStyle(element, '::after').display,
  }))
  expect(pseudo).toEqual({
    beforeContent: 'none',
    beforeDisplay: 'none',
    afterContent: 'none',
    afterDisplay: 'none',
  })
  const track = await well.screenshot({
    path: resolve(evidenceDirectory, `indicator-track-${position}.png`),
  })
  await well.screenshot({
    path: resolve(evidenceDirectory, `indicator-track-stripes-${position}.png`),
  })
  await indicator.page().locator(`#${proofId}`).evaluate((host) => host.remove())
  return {
    compositeSha256: createHash('sha256').update(composite).digest('hex'),
    trackSha256: createHash('sha256').update(track).digest('hex'),
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

async function measureTenThousandRowEnd(indicator: Locator) {
  return indicator.evaluate((source) => {
    const panel = source.closest('.wp-panel')
    if (!(source instanceof HTMLElement) || !(panel instanceof HTMLElement)) {
      throw new Error('List indicator proof source is missing')
    }
    const host = document.createElement('div')
    host.className = 'wp-panel'
    host.dataset['colourway'] = panel.dataset['colourway']
    host.style.cssText = 'position:fixed;left:8px;top:8px;width:6px;height:175px;transform:none;overflow:hidden;'
    const track = document.createElement('span')
    track.className = 'wp-list-scroll'
    track.style.cssText = 'position:absolute;inset:0;width:6px;height:175px;--wp-list-scroll-thumb-size:5px;--wp-list-scroll-thumb-offset:170px;'
    const well = document.createElement('i')
    well.className = 'wp-list-scroll__well'
    const thumb = document.createElement('i')
    thumb.className = 'wp-list-scroll__thumb'
    track.append(well, thumb)
    host.append(track)
    document.body.append(host)
    const trackRect = track.getBoundingClientRect()
    const thumbRect = thumb.getBoundingClientRect()
    const measured = {
      thumbSize: thumbRect.height,
      thumbOffset: thumbRect.top - trackRect.top,
      thumbBottom: thumbRect.bottom,
      trackBottom: trackRect.bottom,
    }
    host.remove()
    return measured
  })
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
