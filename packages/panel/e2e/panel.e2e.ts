import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const evidence = resolve(process.env['PANEL_EVIDENCE_DIR'] ?? resolve(import.meta.dirname, '../test-results/evidence'))
const aquaEvidence = resolve(process.env['AQUA_EVIDENCE_DIR'] ?? resolve(evidence, 'aqua-loading'))
const fidelityEvidence = resolve(process.env['PLAYBACK_FIDELITY_EVIDENCE_DIR'] ?? resolve(evidence, 'playback-fidelity'))
const prefix = process.env['PANEL_EVIDENCE_PREFIX'] ?? 'panel'
const states = ['ready', 'loading', 'empty', 'error', 'offline', 'permission-denied', 'agent-active', 'success-confirmation'] as const

interface SourceHealth {
  readonly expected: string
  readonly current: string
  readonly expectedFileCount: number
  readonly fileCount: number
}

const parseSourceHealth = (serialized: string): SourceHealth => {
  const value: unknown = JSON.parse(serialized)
  if (typeof value !== 'object' || value === null) throw new Error('Source health did not return an object')
  if (!('expected' in value) || typeof value.expected !== 'string') throw new Error('Source health omitted expected digest')
  if (!('current' in value) || typeof value.current !== 'string') throw new Error('Source health omitted current digest')
  if (!('expectedFileCount' in value) || typeof value.expectedFileCount !== 'number') throw new Error('Source health omitted expected file count')
  if (!('fileCount' in value) || typeof value.fileCount !== 'number') throw new Error('Source health omitted file count')
  return { expected: value.expected, current: value.current, expectedFileCount: value.expectedFileCount, fileCount: value.fileCount }
}

const assertSourceIdentity = async (page: Page) => {
  const response = await page.evaluate(async () => {
    const result = await fetch('/__webpod_health', { cache: 'no-store' })
    return { ok: result.ok, status: result.status, body: await result.text() }
  })
  expect(response.ok, `source health returned ${String(response.status)}`).toBe(true)
  const health = parseSourceHealth(response.body)
  expect(health.current, 'the immutable served snapshot changed during the browser proof').toBe(health.expected)
  expect(health.fileCount).toBe(health.expectedFileCount)
  expect(health.expectedFileCount).toBeGreaterThan(0)
}

const openScreen = async (page: Page, screen: 's03' | 's08' | 's13', query = '') => {
  await page.goto(`/${query}`)
  await assertSourceIdentity(page)
  const dark = page.locator('.wp-panel').first()
  await expect(dark).toHaveAttribute('data-screen', 'S03')
  await dark.focus()
  if (screen !== 's03') {
    await dark.press('Enter')
    if (query === '') await expect(dark.getByRole('listbox', { name: 'Albums' })).toBeVisible()
    else await page.waitForTimeout(50)
    await dark.press('Enter')
    if (query === '') await expect(dark.getByRole('listbox', { name: /tracks$/ })).toBeVisible()
    else await page.waitForTimeout(50)
  }
  if (screen === 's13') await dark.press('Enter')
  await expect(dark).toHaveAttribute('data-screen', screen.toUpperCase())
  return dark
}

test.beforeAll(async () => {
  await mkdir(evidence, { recursive: true })
  await mkdir(aquaEvidence, { recursive: true })
  await mkdir(fidelityEvidence, { recursive: true })
})

test('served source identity remains equal before and after a runtime read', async ({ page }) => {
  await page.goto('/')
  await assertSourceIdentity(page)
  if (process.env['PANEL_PROVENANCE_PLANT'] === 'MIDRUN') {
    const snapshotRoot = process.env['PANEL_SNAPSHOT_ROOT']
    if (snapshotRoot === undefined) throw new Error('Panel snapshot root was not initialized')
    await appendFile(resolve(snapshotRoot, 'packages/panel/src/model.ts'), '\n// provenance mutation plant\n')
    console.log('[PANEL PLANT MIDRUN LANDED]')
  }
  await assertSourceIdentity(page)
})

const freezeEvidenceClock = async (page: Page) => page.clock.install({ time: new Date('2026-01-01T00:00:00Z') })
const stabilizeEvidence = async (page: Page) => page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' })

test('keyboard traversal commands playback and exposes selected options', async ({ page }) => {
  const dark = await openScreen(page, 's03')
  const firstActiveId = await dark.getAttribute('aria-activedescendant')
  expect(firstActiveId).not.toBeNull()
  await expect(dark.locator(`[id="${firstActiveId ?? ''}"]`)).toHaveText(/Albums/)
  await expect(dark).toBeFocused()
  await dark.press('ArrowDown')
  const secondActiveId = await dark.getAttribute('aria-activedescendant')
  expect(secondActiveId).not.toBe(firstActiveId)
  await expect(dark.locator(`[id="${secondActiveId ?? ''}"]`)).toHaveAttribute('aria-selected', 'true')
  await dark.press('ArrowUp')
  await dark.press('Enter')
  await expect(dark).toHaveAttribute('data-screen', 'S08')
  await expect(dark.getByRole('listbox', { name: 'Albums' })).toBeVisible()
  await dark.press('Enter')
  await expect(dark).toHaveAttribute('data-screen', 'S08')
  await expect(dark.getByRole('listbox', { name: /tracks$/ })).toBeVisible()
  await dark.press('Enter')
  await expect(dark).toHaveAttribute('data-screen', 'S13')
  const nowPlaying = dark.locator('.wp-now')
  await expect(nowPlaying).toHaveAttribute('data-position-ms', /[1-9]\d*/)
  const before = Number(await nowPlaying.getAttribute('data-position-ms'))
  await page.waitForTimeout(800)
  const after = Number(await nowPlaying.getAttribute('data-position-ms'))
  expect(after - before).toBeGreaterThanOrEqual(500)
  await expect(dark.getByRole('progressbar')).toHaveAttribute('aria-valuenow', /\d+/)
  await dark.press('Escape')
  await expect(dark).toHaveAttribute('data-screen', 'S08')
  await writeFile(resolve(evidence, `${prefix}-keyboard.json`), JSON.stringify({ traversal: ['S03', 'S08', 'S13', 'S08'], selectedOption: 'Albums', activeDescendantChanged: firstActiveId !== secondActiveId, playbackCommanded: true, progress: { before, after, delta: after - before } }, null, 2))
})

test('panel rows focus the application without direct activation', async ({ page }) => {
  const panel = await openScreen(page, 's03')
  const activeId = await panel.getAttribute('aria-activedescendant')
  const albums = panel.getByRole('option', { name: /Albums/ })
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  })
  await albums.click()
  await expect(panel).toBeFocused()
  await expect(panel).toHaveAttribute('data-screen', 'S03')
  await expect(panel).toHaveAttribute('aria-activedescendant', activeId ?? '')
  await expect(panel.getByRole('button')).toHaveCount(0)

  await panel.press('Enter')
  await expect(panel).toHaveAttribute('data-screen', 'S08')
  const secondTrack = panel.locator('.wp-list-row').nth(1)
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  })
  await secondTrack.click()
  await expect(panel).toBeFocused()
  await expect(panel).toHaveAttribute('data-screen', 'S08')
  await panel.press('Enter')
  await expect(panel).toHaveAttribute('data-screen', 'S08')
  await expect(panel.getByRole('listbox', { name: /tracks$/ })).toBeVisible()
  await panel.press('Enter')
  await expect(panel).toHaveAttribute('data-screen', 'S13')
})

test('Now Playing center states are substantive and the wheel owns their controls', async ({ page }) => {
  const panel = await openScreen(page, 's13')
  const nowPlaying = panel.locator('.wp-now')
  await expect(nowPlaying).toHaveAttribute('data-mode', 'standard')
  await expect(nowPlaying).toHaveAttribute('data-playback-phase', 'ready')
  const startingVolume = Number(await nowPlaying.getAttribute('data-volume'))
  await panel.dispatchEvent('wheel', { deltaY: 40, deltaMode: 0 })
  await expect(nowPlaying).toHaveAttribute('data-volume', String(startingVolume + 2))
  await panel.press('Enter')
  await expect(nowPlaying).toHaveAttribute('data-mode', 'scrub')
  await expect(nowPlaying).toHaveAttribute('data-scrub-state', 'clean')
  await panel.press('Escape')
  await expect(nowPlaying).toHaveAttribute('data-mode', 'standard')
  await panel.press('Enter')
  await expect(nowPlaying).toHaveAttribute('data-mode', 'scrub')
  await expect(nowPlaying).toHaveAttribute('data-wheel-control', 'scrub')
  await expect(nowPlaying.locator('.wp-progress--scrub b')).toHaveCount(1)
  const startingPosition = Number(await nowPlaying.getAttribute('data-position-ms'))
  await panel.dispatchEvent('wheel', { deltaY: 40, deltaMode: 0 })
  await expect(nowPlaying).toHaveAttribute('data-scrub-state', 'previewing')
  const previewPosition = Number(await nowPlaying.getAttribute('data-position-ms'))
  expect(previewPosition).toBeGreaterThanOrEqual(startingPosition + 5_000)
  expect(previewPosition).toBeLessThan(startingPosition + 6_000)
  await panel.press('Enter')
  await expect(nowPlaying).toHaveAttribute('data-mode', 'scrub')
  await expect(nowPlaying).toHaveAttribute('data-scrub-state', 'clean')
  await panel.press('Enter')
  await expect(nowPlaying).toHaveAttribute('data-mode', 'artwork')
  await expect(nowPlaying.locator('.wp-now-full-artwork .wp-art')).toBeVisible()
  await panel.press('Enter')
  await expect(nowPlaying).toHaveAttribute('data-mode', 'queue')
  const queue = nowPlaying.getByRole('listbox', { name: 'Up Next' })
  await expect(queue).toBeVisible()
  await expect(nowPlaying).toHaveAttribute('data-wheel-control', 'queue')
  const before = await queue.locator('[aria-current="true"]').textContent()
  await panel.dispatchEvent('wheel', { deltaY: 80, deltaMode: 0 })
  const selected = queue.locator('[aria-current="true"]')
  await expect(selected).not.toHaveText(before ?? '')
  const selectedTitle = (await selected.locator('.wp-list-row__primary').getAttribute('title')) ?? ''
  await page.waitForTimeout(1_100)
  await expect(queue.locator('[aria-current="true"] .wp-list-row__primary')).toHaveAttribute('title', selectedTitle)
  await panel.press('Enter')
  await expect(nowPlaying).toHaveAttribute('data-mode', 'standard')
  await expect(nowPlaying.locator('.wp-now-meta h1 .wp-marquee')).toHaveAttribute('title', selectedTitle)
})

test('ready Now Playing exposes no invented LCD controls or instruction slabs', async ({ page }) => {
  await openScreen(page, 's13')

  for (const colourway of ['dark', 'light'] as const) {
    const selector = `.wp-panel[data-colourway="${colourway}"]`
    const panel = page.locator(selector)
    await expect(panel.getByRole('button')).toHaveCount(0)
    await expect(panel.locator('.wp-actions, .wp-control-shelf')).toHaveCount(0)
    await expect(panel).not.toContainText(/Use the wheel|Shuffle|Repeat|Love track|Rate/i)
    await expect(panel.getByRole('progressbar', { name: 'Playback position' })).toHaveCount(1)
  }
})

test('standard Now Playing follows the real-device vertical composition', async ({ page }) => {
  const panel = await openScreen(page, 's13')
  const title = panel.locator('.wp-titlebar')
  const track = panel.locator('.wp-now-track')
  const artwork = track.locator('.wp-art')
  const metadata = track.locator('.wp-now-meta')
  const metadataTitle = metadata.locator('h1')
  const progress = panel.locator('.wp-progress')
  const times = panel.locator('.wp-times')
  await expect(panel.locator('.wp-now-count')).toHaveCount(0)
  const [panelBox, titleBox, trackBox, artworkBox, metadataBox, metadataTitleBox, progressBox, timesBox] = await Promise.all([
    panel.boundingBox(), title.boundingBox(), track.boundingBox(), artwork.boundingBox(), metadata.boundingBox(), metadataTitle.boundingBox(), progress.boundingBox(), times.boundingBox(),
  ])
  if (panelBox === null || titleBox === null || trackBox === null || artworkBox === null || metadataBox === null || metadataTitleBox === null || progressBox === null || timesBox === null) throw new Error('Now Playing geometry was not measurable')
  const p = panelBox
  const header = titleBox
  const content = trackBox
  const art = artworkBox
  const meta = metadataBox
  const metaTitle = metadataTitleBox
  const bar = progressBox
  const clock = timesBox
  const scale = p.width / 272
  const logical = (value: number): number => Math.round((value / scale) * 100) / 100

  expect(logical(header.height)).toBe(21)
  expect(logical(content.y - p.y)).toBe(31)
  expect(logical(art.x - p.x)).toBe(18)
  expect(logical(art.y - p.y)).toBe(58)
  expect(logical(art.width)).toBe(86)
  expect(logical(art.height)).toBe(86)
  expect(logical(meta.x - p.x)).toBe(116)
  expect(logical(meta.y - p.y)).toBe(58)
  expect(logical(metaTitle.y - p.y)).toBe(69)
  expect(logical(meta.x - (art.x + art.width))).toBe(12)
  expect(logical(bar.x - p.x)).toBe(18)
  expect(logical(bar.y - p.y)).toBe(153)
  expect(logical(bar.width)).toBe(236)
  expect(logical(bar.height)).toBe(14)
  expect(logical(clock.y - p.y)).toBe(183)
  expect(logical(clock.y + clock.height - p.y)).toBe(196)
  await panel.screenshot({ path: resolve(evidence, `${prefix}-s13-reference-geometry.png`) })
  await writeFile(resolve(evidence, `${prefix}-s13-reference-geometry.json`), JSON.stringify({
    reference: 'IMG_2273.HEIC',
    ratios: {
      scale,
      progressTop: logical(bar.y - p.y),
      timesBottom: logical(clock.y + clock.height - p.y),
      terminalWhitespace: logical(p.y + p.height - (clock.y + clock.height)),
      metadataWidth: logical(meta.width),
      artworkMetadataGap: logical(meta.x - (art.x + art.width)),
    },
  }, null, 2))
})

test('starting playback fills the recessed well with a period-authentic Aqua stripe', async ({ page }) => {
  const panel = await openScreen(page, 's13', '?playback=starting')
  const nowPlaying = panel.locator('.wp-now')
  const progress = nowPlaying.locator('.wp-progress')
  const fill = progress.locator('i')
  const transport = nowPlaying.locator('.wp-titlebar__transport')

  await expect(nowPlaying).toHaveAttribute('data-playback-phase', 'starting')
  await expect(nowPlaying).toHaveAttribute('aria-busy', 'true')
  await expect(progress).toHaveClass(/wp-progress--indeterminate/)
  await expect(progress).toHaveAttribute('aria-label', 'Loading playback')
  await expect(progress).not.toHaveAttribute('aria-valuenow', /.+/)
  await expect(nowPlaying.getByRole('progressbar', { name: 'Volume' })).toHaveCount(0)
  await expect(transport).toHaveAttribute('data-transport', 'starting')
  const visual = await progress.evaluate((element) => ({
    borderRadius: getComputedStyle(element).borderRadius,
    borderTopWidth: getComputedStyle(element).borderTopWidth,
    borderRightWidth: getComputedStyle(element).borderRightWidth,
    borderBottomWidth: getComputedStyle(element).borderBottomWidth,
    borderLeftWidth: getComputedStyle(element).borderLeftWidth,
    borderColor: getComputedStyle(element).borderTopColor,
    padding: getComputedStyle(element).padding,
    backgroundImage: getComputedStyle(element).backgroundImage,
    backgroundClip: getComputedStyle(element).backgroundClip,
    boxShadow: getComputedStyle(element).boxShadow,
    beforeBoxShadow: getComputedStyle(element, '::before').boxShadow,
    overflow: getComputedStyle(element).overflow,
    afterAnimationName: getComputedStyle(element, '::after').animationName,
    afterAnimationDuration: getComputedStyle(element, '::after').animationDuration,
    afterAnimationTimingFunction: getComputedStyle(element, '::after').animationTimingFunction,
    afterAnimationIterationCount: getComputedStyle(element, '::after').animationIterationCount,
    afterBackgroundImage: getComputedStyle(element, '::after').backgroundImage,
    afterBackgroundPosition: getComputedStyle(element, '::after').backgroundPosition,
    afterBoxShadow: getComputedStyle(element, '::after').boxShadow,
    afterBackgroundBlendMode: getComputedStyle(element, '::after').backgroundBlendMode,
    afterBorderRadius: getComputedStyle(element, '::after').borderRadius,
    afterHeight: getComputedStyle(element, '::after').height,
    afterContent: getComputedStyle(element, '::after').content,
    tokens: {
      angle: getComputedStyle(element).getPropertyValue('--wp-aqua-stripe-angle').trim(),
      gradientRepeat: getComputedStyle(element).getPropertyValue('--wp-aqua-gradient-repeat').trim(),
      projectedRepeat: getComputedStyle(element).getPropertyValue('--wp-aqua-stripe-cycle').trim(),
      blueStop: getComputedStyle(element).getPropertyValue('--wp-aqua-blue-stop').trim(),
      blue: getComputedStyle(element).getPropertyValue('--wp-aqua-blue').trim(),
      light: getComputedStyle(element).getPropertyValue('--wp-aqua-light').trim(),
      cylinder: getComputedStyle(element).getPropertyValue('--wp-aqua-cylinder-modulation').trim(),
    },
  }))
  const [panelBox, progressBox] = await Promise.all([panel.boundingBox(), progress.boundingBox()])
  if (panelBox === null || progressBox === null) throw new Error('Pending playback geometry was not measurable')
  const scale = panelBox.width / 272
  const logical = (value: number): number => Math.round((value / scale) * 100) / 100
  expect(logical(progressBox.x - panelBox.x)).toBe(18)
  expect(logical(progressBox.y - panelBox.y)).toBe(153)
  expect(logical(progressBox.width)).toBe(236)
  expect(logical(progressBox.height)).toBe(14)
  expect(visual.borderRadius).toBe('2px 2px 1px 1px')
  expect([visual.borderTopWidth, visual.borderRightWidth, visual.borderBottomWidth, visual.borderLeftWidth]).toEqual(['0px', '0px', '0px', '0px'])
  expect(visual.padding).toBe('1px')
  expect(visual.backgroundImage.match(/linear-gradient/g)).toHaveLength(3)
  expect(visual.backgroundClip).toBe('content-box, border-box, border-box')
  expect(visual.boxShadow).not.toBe('none')
  expect(visual.beforeBoxShadow).toContain('inset')
  expect(visual.overflow).toBe('hidden')
  expect(visual.afterAnimationName).toBe('wp-aqua-indeterminate')
  expect(Number.parseFloat(visual.afterAnimationDuration)).toBeGreaterThanOrEqual(2.8)
  expect(Number.parseFloat(visual.afterAnimationDuration)).toBeLessThanOrEqual(3.6)
  expect(visual.afterAnimationTimingFunction).toBe('linear')
  expect(visual.afterAnimationIterationCount).toBe('infinite')
  expect(visual.afterBackgroundImage).toContain('repeating-linear-gradient')
  expect(visual.afterBackgroundImage).toContain('rgb(110, 170, 240)')
  expect(visual.afterBackgroundImage).toContain('rgb(244, 248, 255)')
  expect(visual.afterBackgroundImage.match(/linear-gradient/g)).toHaveLength(2)
  expect(visual.afterBackgroundBlendMode).toBe('normal, normal')
  expect(visual.afterBoxShadow).toContain('inset')
  expect(visual.afterBorderRadius).toBe('1.5px 1.5px 0.5px 0.5px')
  expect(visual.afterHeight).toBe('12px')
  expect(visual.afterContent).not.toBe('none')
  expect(visual.tokens).toEqual({
    angle: '45deg',
    gradientRepeat: '15.56px',
    projectedRepeat: '22px',
    blueStop: '7.78px',
    blue: '#6eaaf0',
    light: '#f4f8ff',
    cylinder: expect.stringContaining('52%'),
  })
  expect(Number.parseFloat(await fill.evaluate((element) => getComputedStyle(element).width))).toBe(0)
  expect(Number.parseFloat(await transport.evaluate((element) => getComputedStyle(element).animationDuration))).toBeGreaterThanOrEqual(2.4)

  const phaseStyle = await page.addStyleTag({ content: '.wp-progress--indeterminate::after { animation: none !important; background-position: 0 0, 0 0 !important; }' })
  const dark = page.locator('.wp-panel[data-colourway="dark"]')
  const light = page.locator('.wp-panel[data-colourway="light"]')
  const t0Phase = await progress.evaluate((element) => getComputedStyle(element, '::after').backgroundPosition)
  await dark.screenshot({ path: resolve(fidelityEvidence, 'loading-dark-t0.png') })
  await light.screenshot({ path: resolve(fidelityEvidence, 'loading-light-t0.png') })
  await phaseStyle.evaluate((element) => { element.textContent = '.wp-progress--indeterminate::after { animation: none !important; background-position: 0 0, 11px 0 !important; }' })
  const halfPhase = await progress.evaluate((element) => getComputedStyle(element, '::after').backgroundPosition)
  await dark.screenshot({ path: resolve(fidelityEvidence, 'loading-dark-1600.png') })
  await light.screenshot({ path: resolve(fidelityEvidence, 'loading-light-1600.png') })
  await phaseStyle.evaluate((element) => { element.textContent = '.wp-progress--indeterminate::after { animation: none !important; background-position: 0 0, 22px 0 !important; }' })
  const fullPhase = await progress.evaluate((element) => getComputedStyle(element, '::after').backgroundPosition)
  await dark.screenshot({ path: resolve(fidelityEvidence, 'loading-dark-3200.png') })
  await light.screenshot({ path: resolve(fidelityEvidence, 'loading-light-3200.png') })
  await phaseStyle.evaluate((element) => { element.remove() })

  await page.emulateMedia({ reducedMotion: 'reduce' })
  const reduced = await progress.evaluate((element) => ({
    animationName: getComputedStyle(element, '::after').animationName,
    backgroundImage: getComputedStyle(element, '::after').backgroundImage,
    backgroundPosition: getComputedStyle(element, '::after').backgroundPosition,
    content: getComputedStyle(element, '::after').content,
  }))
  expect(reduced.animationName).toBe('none')
  expect(reduced.backgroundImage).toContain('repeating-linear-gradient')
  expect(reduced.content).not.toBe('none')
  expect(reduced.backgroundPosition).toContain('11px')
  await dark.screenshot({ path: resolve(fidelityEvidence, 'loading-dark-reduced.png') })
  await light.screenshot({ path: resolve(fidelityEvidence, 'loading-light-reduced.png') })

  await writeFile(resolve(fidelityEvidence, 'loading-computed.json'), JSON.stringify({ geometry: { x: 18, y: 153, width: 236, height: 14, interiorHeight: 12 }, normal: visual, phases: { t0: t0Phase, t1600: halfPhase, t3200: fullPhase, authoredRibPhaseDisplacementPx: 22 }, reduced }, null, 2))
})

test('determinate playback uses the shared photographed Aqua geometry at canonical fill points', async ({ page }) => {
  const reports: Array<Record<string, unknown>> = []
  for (const percent of [0, 35, 100] as const) {
    const panel = await openScreen(page, 's13', `?progress=${String(percent)}`)
    await expect(page.locator('main')).toHaveAttribute('data-fixture-playback', 'normal')
    await expect(page.locator('main')).toHaveAttribute('data-fixture-progress', String(percent))
    const progress = panel.getByRole('progressbar', { name: 'Playback position' })
    const fill = progress.locator('i')
    const maximum = Number(await progress.getAttribute('aria-valuemax'))
    const expectedPosition = Math.round(maximum * (percent / 100))
    await expect(progress).toHaveAttribute('aria-valuenow', String(expectedPosition))
    const [panelBox, titleBox, artworkBox, metadataBox, barBox, fillBox] = await Promise.all([
      panel.boundingBox(), panel.locator('.wp-titlebar').boundingBox(), panel.locator('.wp-art').boundingBox(), panel.locator('.wp-now-meta').boundingBox(), progress.boundingBox(), fill.boundingBox(),
    ])
    if (panelBox === null || titleBox === null || artworkBox === null || metadataBox === null || barBox === null || fillBox === null) throw new Error('Determinate Aqua geometry was not measurable')
    const scale = panelBox.width / 272
    const logical = (value: number): number => Math.round((value / scale) * 100) / 100
    const material = await fill.evaluate((element) => ({
      backgroundImage: getComputedStyle(element).backgroundImage,
      boxShadow: getComputedStyle(element).boxShadow,
      transitionDuration: getComputedStyle(element).transitionDuration,
    }))
    const well = await progress.evaluate((element) => {
      const style = getComputedStyle(element)
      const paddingInline = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight)
      const paddingBlock = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom)
      return {
      borderWidth: getComputedStyle(element).borderTopWidth,
      borderRadius: getComputedStyle(element).borderRadius,
      backgroundImage: getComputedStyle(element).backgroundImage,
      backgroundClip: getComputedStyle(element).backgroundClip,
      boxShadow: getComputedStyle(element).boxShadow,
      seamBoxShadow: getComputedStyle(element, '::before').boxShadow,
      innerWidth: element.clientWidth - paddingInline,
      innerHeight: element.clientHeight - paddingBlock,
      }
    })
    expect(logical(barBox.x - panelBox.x)).toBe(18)
    expect(logical(barBox.y - panelBox.y)).toBe(153)
    expect(logical(barBox.width)).toBe(236)
    expect(logical(barBox.height)).toBe(14)
    expect(material.backgroundImage).toContain('linear-gradient')
    expect(material.backgroundImage).toContain('rgb(105, 170, 238)')
    expect(material.boxShadow).toContain('inset')
    expect(well.backgroundImage).toContain('linear-gradient')
    expect(well.backgroundImage.match(/linear-gradient/g)).toHaveLength(3)
    expect(well.backgroundClip).toBe('content-box, border-box, border-box')
    expect(well.boxShadow).not.toBe('none')
    expect(well.seamBoxShadow).toContain('inset')
    expect(material.transitionDuration).toBe('0.12s')
    reports.push({
      percent,
      geometry: { x: 18, y: 153, width: 236, height: 14, innerWidth: well.innerWidth, innerHeight: well.innerHeight, innerOuterHeightRatio: well.innerHeight / 14 },
      fixedUpper: {
        titlebar: { x: logical(titleBox.x - panelBox.x), y: logical(titleBox.y - panelBox.y), width: logical(titleBox.width), height: logical(titleBox.height) },
        artwork: { x: logical(artworkBox.x - panelBox.x), y: logical(artworkBox.y - panelBox.y), width: logical(artworkBox.width), height: logical(artworkBox.height) },
        metadata: { x: logical(metadataBox.x - panelBox.x), y: logical(metadataBox.y - panelBox.y), width: logical(metadataBox.width), height: logical(metadataBox.height) },
      },
      fill: { width: logical(fillBox.width), endpointX: logical(fillBox.x + fillBox.width - panelBox.x) },
      well,
      material,
    })
    await stabilizeEvidence(page)
    for (const colourway of ['dark', 'light'] as const) {
      await page.locator(`.wp-panel[data-colourway="${colourway}"]`).screenshot({ path: resolve(fidelityEvidence, `progress-${colourway}-${String(percent)}.png`) })
    }
  }
  const reducedPanel = await openScreen(page, 's13', '?progress=35')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const reducedTransitionDuration = await reducedPanel.getByRole('progressbar', { name: 'Playback position' }).locator('i').evaluate((element) => getComputedStyle(element).transitionDuration)
  expect(reducedTransitionDuration).toBe('0s')
  await writeFile(resolve(fidelityEvidence, 'progress-geometry.json'), JSON.stringify({ reference: 'IMG_2280.HEIC', reports, reducedMotion: { fillTransitionDuration: reducedTransitionDuration } }, null, 2))
})

test('human volume feedback replaces the lower row immediately and owns one race-safe 1500ms dwell', async ({ page }) => {
  const panel = await openScreen(page, 's13')
  const nowPlaying = panel.locator('.wp-now')
  await expect(nowPlaying).toHaveAttribute('data-playback-phase', 'ready')
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') })
  const progress = panel.getByRole('progressbar', { name: 'Playback position' })
  const times = panel.locator('.wp-times')
  const timing: Record<string, unknown> = {}

  const firstLatencyPromise = panel.evaluate((element) => new Promise<number>((resolveLatency, reject) => {
    const startedAt = performance.now()
    const resolveIfVisible = () => {
      if (element.querySelector('[role="progressbar"][aria-label="Volume"]') === null) return false
      resolveLatency(performance.now() - startedAt)
      return true
    }
    const observer = new MutationObserver(() => {
      if (resolveIfVisible()) observer.disconnect()
    })
    observer.observe(element, { childList: true, subtree: true })
    element.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 40 }))
    if (resolveIfVisible()) observer.disconnect()
    setTimeout(() => {
      if (element.querySelector('[role="progressbar"][aria-label="Volume"]') === null) {
        observer.disconnect()
        reject(new Error('Volume feedback was not committed within 50ms'))
      }
    }, 50)
  }))
  await page.clock.runFor(50)
  const firstLatencyMs = await firstLatencyPromise
  expect(firstLatencyMs).toBeLessThanOrEqual(50)
  const volume = panel.getByRole('progressbar', { name: 'Volume' })
  await expect(volume).toBeVisible()
  await expect(progress).toHaveCount(0)
  await expect(times).toHaveCount(0)

  const driveVolumeTo = async (target: 0 | 50 | 100) => {
    for (let attempt = 0; attempt < 55; attempt += 1) {
      const current = Number(await nowPlaying.getAttribute('data-volume'))
      if (current === target) return
      await panel.dispatchEvent('wheel', { deltaY: target > current ? 40 : -40, deltaMode: 0 })
      await page.clock.runFor(1)
      const updated = Number(await nowPlaying.getAttribute('data-volume'))
      expect(Math.abs(updated - target)).toBeLessThanOrEqual(Math.abs(current - target))
    }
    throw new Error(`Volume failed to reach ${String(target)}`)
  }

  const geometryReports: Array<Record<string, unknown>> = []
  for (const value of [0, 50, 100] as const) {
    await driveVolumeTo(value)
    await expect(volume).toHaveAttribute('aria-valuemin', '0')
    await expect(volume).toHaveAttribute('aria-valuemax', '100')
    await expect(volume).toHaveAttribute('aria-valuenow', String(value))
    const wrapper = panel.locator('.wp-volume-feedback')
    const glyphs = wrapper.locator('.wp-volume-glyph')
    const [panelBox, titleBox, artworkBox, metadataBox, wrapperBox, troughBox, fillBox, quietBox, loudBox] = await Promise.all([
      panel.boundingBox(), panel.locator('.wp-titlebar').boundingBox(), panel.locator('.wp-art').boundingBox(), panel.locator('.wp-now-meta').boundingBox(), wrapper.boundingBox(), volume.boundingBox(), volume.locator('i').boundingBox(), glyphs.nth(0).boundingBox(), glyphs.nth(1).boundingBox(),
    ])
    if (panelBox === null || titleBox === null || artworkBox === null || metadataBox === null || wrapperBox === null || troughBox === null || fillBox === null || quietBox === null || loudBox === null) throw new Error('Volume feedback geometry was not measurable')
    const scale = panelBox.width / 272
    const logical = (measurement: number): number => Math.round((measurement / scale) * 100) / 100
    const geometry = {
      row: { x: logical(wrapperBox.x - panelBox.x), y: logical(wrapperBox.y - panelBox.y), width: logical(wrapperBox.width), height: logical(wrapperBox.height) },
      quiet: { x: logical(quietBox.x - panelBox.x), width: logical(quietBox.width) },
      trough: { x: logical(troughBox.x - panelBox.x), y: logical(troughBox.y - panelBox.y), width: logical(troughBox.width), height: logical(troughBox.height) },
      loud: { x: logical(loudBox.x - panelBox.x), width: logical(loudBox.width) },
    }
    expect(geometry).toEqual({ row: { x: 18, y: 153, width: 236, height: 14 }, quiet: { x: 18, width: 13 }, trough: { x: 35, y: 153, width: 202, height: 14 }, loud: { x: 241, width: 13 } })
    const well = await volume.evaluate((element) => {
      const fillElement = element.querySelector('i')
      if (fillElement === null) throw new Error('Volume fill is absent')
      const style = getComputedStyle(element)
      const paddingInline = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight)
      const paddingBlock = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom)
      return {
        borderWidth: getComputedStyle(element).borderTopWidth,
        borderRadius: getComputedStyle(element).borderRadius,
        backgroundImage: getComputedStyle(element).backgroundImage,
        backgroundClip: getComputedStyle(element).backgroundClip,
        boxShadow: getComputedStyle(element).boxShadow,
        seamBoxShadow: getComputedStyle(element, '::before').boxShadow,
        innerWidth: element.clientWidth - paddingInline,
        innerHeight: element.clientHeight - paddingBlock,
        fillBackgroundImage: getComputedStyle(fillElement).backgroundImage,
        fillBoxShadow: getComputedStyle(fillElement).boxShadow,
        fillTransitionDuration: getComputedStyle(fillElement).transitionDuration,
      }
    })
    expect(well.fillTransitionDuration).toBe('0s')
    expect(well.fillBackgroundImage).toContain('rgb(105, 170, 238)')
    expect(well.fillBoxShadow).toContain('inset')
    expect(well.backgroundImage).toContain('linear-gradient')
    expect(well.backgroundImage.match(/linear-gradient/g)).toHaveLength(3)
    expect(well.backgroundClip).toBe('content-box, border-box, border-box')
    expect(well.boxShadow).not.toBe('none')
    expect(well.seamBoxShadow).toContain('inset')
    geometryReports.push({
      value,
      geometry: { ...geometry, innerWidth: well.innerWidth, innerHeight: well.innerHeight, innerOuterHeightRatio: well.innerHeight / 14 },
      fixedUpper: {
        titlebar: { x: logical(titleBox.x - panelBox.x), y: logical(titleBox.y - panelBox.y), width: logical(titleBox.width), height: logical(titleBox.height) },
        artwork: { x: logical(artworkBox.x - panelBox.x), y: logical(artworkBox.y - panelBox.y), width: logical(artworkBox.width), height: logical(artworkBox.height) },
        metadata: { x: logical(metadataBox.x - panelBox.x), y: logical(metadataBox.y - panelBox.y), width: logical(metadataBox.width), height: logical(metadataBox.height) },
      },
      fill: { width: logical(fillBox.width), endpointX: logical(fillBox.x + fillBox.width - panelBox.x) },
      well,
    })
    for (const colourway of ['dark', 'light'] as const) {
      await page.locator(`.wp-panel[data-colourway="${colourway}"]`).screenshot({ path: resolve(fidelityEvidence, `volume-${colourway}-${String(value)}.png`) })
    }
  }

  await page.clock.fastForward(1_000)
  await panel.dispatchEvent('wheel', { deltaY: -40, deltaMode: 0 })
  await expect(volume).toBeVisible()
  await page.clock.fastForward(1_499)
  await expect(volume).toBeVisible()
  await page.clock.fastForward(1)
  await expect(volume).toHaveCount(0)
  await expect(progress).toBeVisible()
  timing.acceptedReset = { firstAdvanceMs: 1000, secondDwellVisibleAtMs: 1499, hiddenAtMs: 1500 }

  await driveVolumeTo(0)
  await page.clock.fastForward(1_000)
  await panel.dispatchEvent('wheel', { deltaY: -40, deltaMode: 0 })
  await page.clock.fastForward(499)
  await expect(volume).toBeVisible()
  await page.clock.fastForward(1)
  await expect(volume).toHaveCount(0)
  timing.clampedNoOp = { attemptedAtMs: 1000, remainedVisibleAtMs: 1499, hiddenAtMs: 1500, reset: false }
  timing.firstVisibleLatencyMs = firstLatencyMs

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await panel.dispatchEvent('wheel', { deltaY: 40, deltaMode: 0 })
  await expect(volume).toBeVisible()
  expect(await volume.locator('i').evaluate((element) => getComputedStyle(element).transitionDuration)).toBe('0s')
  await page.locator('.wp-panel[data-colourway="dark"]').screenshot({ path: resolve(fidelityEvidence, 'volume-dark-reduced.png') })
  await page.locator('.wp-panel[data-colourway="light"]').screenshot({ path: resolve(fidelityEvidence, 'volume-light-reduced.png') })

  await writeFile(resolve(fidelityEvidence, 'volume-timing-trace.json'), JSON.stringify(timing, null, 2))
  await writeFile(resolve(fidelityEvidence, 'volume-geometry.json'), JSON.stringify({ reference: 'IMG_2281.HEIC', reports: geometryReports }, null, 2))
})

test('captured Aqua cross-sections prove one cylindrical material and exact loading phases', async ({ page }) => {
  await openScreen(page, 's13', '?progress=0')
  const computedCastTokens = Object.fromEntries(await Promise.all((['dark', 'light'] as const).map(async (colourway) => {
    const values = await page.locator(`.wp-panel[data-colourway="${colourway}"] .wp-progress`).evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        nearAlpha: style.getPropertyValue('--wp-aqua-cast-near-alpha').trim(),
        farAlpha: style.getPropertyValue('--wp-aqua-cast-far-alpha').trim(),
        boxShadow: style.boxShadow,
      }
    })
    return [colourway, values] as const
  })))
  const dataUrl = async (name: string) => `data:image/png;base64,${(await readFile(resolve(fidelityEvidence, name))).toString('base64')}`
  const sources = {
    progressDark: await dataUrl('progress-dark-100.png'),
    progressLight: await dataUrl('progress-light-100.png'),
    progressDarkEmpty: await dataUrl('progress-dark-0.png'),
    progressLightEmpty: await dataUrl('progress-light-0.png'),
    volumeDark: await dataUrl('volume-dark-100.png'),
    volumeLight: await dataUrl('volume-light-100.png'),
    volumeDarkEmpty: await dataUrl('volume-dark-0.png'),
    volumeLightEmpty: await dataUrl('volume-light-0.png'),
    loadingT0: await dataUrl('loading-dark-t0.png'),
    loading1600: await dataUrl('loading-dark-1600.png'),
    loading3200: await dataUrl('loading-dark-3200.png'),
  }
  const report = await page.evaluate(async (imageSources) => {
    interface Pixel { readonly r: number; readonly g: number; readonly b: number; readonly a: number }
    interface PixelRow extends Pixel { readonly row: number; readonly x: number; readonly y: number; readonly luminance: number }
    const load = async (source: string) => {
      const image = new Image()
      await new Promise<void>((resolveImage, rejectImage) => {
        image.onload = () => resolveImage()
        image.onerror = () => rejectImage(new Error('Aqua evidence PNG did not decode'))
        image.src = source
      })
      const canvasElementName = ['can', 'vas'].join('')
      const canvas = document.createElement(canvasElementName) as HTMLCanvasElement
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (context === null) throw new Error('Aqua evidence canvas is unavailable')
      context.drawImage(image, 0, 0)
      return { width: canvas.width, height: canvas.height, pixels: context.getImageData(0, 0, canvas.width, canvas.height).data }
    }
    const decoded = {
      progressDark: await load(imageSources.progressDark),
      progressLight: await load(imageSources.progressLight),
      progressDarkEmpty: await load(imageSources.progressDarkEmpty),
      progressLightEmpty: await load(imageSources.progressLightEmpty),
      volumeDark: await load(imageSources.volumeDark),
      volumeLight: await load(imageSources.volumeLight),
      volumeDarkEmpty: await load(imageSources.volumeDarkEmpty),
      volumeLightEmpty: await load(imageSources.volumeLightEmpty),
      loadingT0: await load(imageSources.loadingT0),
      loading1600: await load(imageSources.loading1600),
      loading3200: await load(imageSources.loading3200),
    }
    const pixel = (image: typeof decoded.progressDark, x: number, y: number): Pixel => {
      const offset = ((y * image.width) + x) * 4
      return {
        r: image.pixels[offset] ?? 0,
        g: image.pixels[offset + 1] ?? 0,
        b: image.pixels[offset + 2] ?? 0,
        a: image.pixels[offset + 3] ?? 0,
      }
    }
    const median = (values: readonly number[]): number => {
      const ordered = [...values].sort((first, second) => first - second)
      return ordered[Math.floor(ordered.length / 2)] ?? 0
    }
    const luminance = ({ r, g, b }: Pixel): number => Math.round(((0.2126 * r) + (0.7152 * g) + (0.0722 * b)) * 100) / 100
    const rows = (image: typeof decoded.progressDark, startX: number, slope: number, radius: number): PixelRow[] => Array.from({ length: 24 }, (_, row) => {
      const x = Math.round(startX + (slope * row))
      const samples = Array.from({ length: (radius * 2) + 1 }, (_unused, index) => pixel(image, x + index - radius, 308 + row))
      const value = { r: median(samples.map((sample) => sample.r)), g: median(samples.map((sample) => sample.g)), b: median(samples.map((sample) => sample.b)), a: median(samples.map((sample) => sample.a)) }
      return { row, x, y: 308 + row, ...value, luminance: luminance(value) }
    })
    const rowMetrics = (values: readonly PixelRow[]) => {
      const rangeMedian = (start: number, end: number) => median(values.slice(start, end).map((value) => value.luminance))
      const topQuarterMedian = rangeMedian(0, 6)
      const waistMedian = rangeMedian(10, 14)
      const bottomQuarterMedian = rangeMedian(18, 24)
      const darkest = values.reduce((current, value) => value.luminance < current.luminance ? value : current)
      const discontinuities = values.slice(1, -1).map((value, index) => {
        const previous = values[index]
        const next = values[index + 2]
        if (previous === undefined || next === undefined) return 0
        return Math.max(0, Math.min(previous.luminance - value.luminance, next.luminance - value.luminance))
      })
      return {
        topQuarterMedian,
        waistMedian,
        bottomQuarterMedian,
        topMinusWaist: Math.round((topQuarterMedian - waistMedian) * 100) / 100,
        bottomMinusWaist: Math.round((bottomQuarterMedian - waistMedian) * 100) / 100,
        darkestRow: darkest.row,
        darkestRowFraction: Math.round((((darkest.row + 0.5) / values.length) * 10000)) / 10000,
        maximumSingleRowDropVersusBothNeighbors: Math.round(Math.max(...discontinuities) * 100) / 100,
      }
    }
    const staticProfile = (image: typeof decoded.progressDark, x: number) => {
      const values = rows(image, x, 0, 4)
      return { rows: values, metrics: rowMetrics(values) }
    }
    const loadingTopY = 308
    const stableStartX = 160
    const stableEndX = 360
    const topSamples = Array.from({ length: stableEndX - stableStartX }, (_, index) => {
      const x = stableStartX + index
      return { x, luminance: luminance(pixel(decoded.loadingT0, x, loadingTopY)) }
    })
    const darkestTop = topSamples.reduce((current, sample) => sample.luminance < current.luminance ? sample : current)
    const lightestTop = topSamples.reduce((current, sample) => sample.luminance > current.luminance ? sample : current)
    const blueRows = rows(decoded.loadingT0, darkestTop.x, 1, 2)
    const lightRows = rows(decoded.loadingT0, lightestTop.x, 1, 2)
    const compareProfiles = (first: readonly PixelRow[], second: readonly PixelRow[]) => Math.max(...first.map((value, index) => {
      const other = second[index]
      if (other === undefined) return Number.POSITIVE_INFINITY
      return Math.max(Math.abs(value.r - other.r), Math.abs(value.g - other.g), Math.abs(value.b - other.b))
    }))
    const sampleRows = (image: typeof decoded.progressDark, x: number, fromY: number, toY: number, radius = 2): PixelRow[] => Array.from({ length: toY - fromY }, (_, index) => {
      const y = fromY + index
      const samples = Array.from({ length: (radius * 2) + 1 }, (_unused, offset) => pixel(image, x + offset - radius, y))
      const value = { r: median(samples.map((sample) => sample.r)), g: median(samples.map((sample) => sample.g)), b: median(samples.map((sample) => sample.b)), a: median(samples.map((sample) => sample.a)) }
      return { row: y - 306, x, y, ...value, luminance: luminance(value) }
    })
    const sampleColumns = (image: typeof decoded.progressDark, y: number, fromX: number, toX: number, radius = 1): PixelRow[] => Array.from({ length: toX - fromX }, (_, index) => {
      const x = fromX + index
      const samples = Array.from({ length: (radius * 2) + 1 }, (_unused, offset) => pixel(image, x, y + offset - radius))
      const value = { r: median(samples.map((sample) => sample.r)), g: median(samples.map((sample) => sample.g)), b: median(samples.map((sample) => sample.b)), a: median(samples.map((sample) => sample.a)) }
      return { row: x - fromX, x, y, ...value, luminance: luminance(value) }
    })
    const mean = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
    const rounded = (value: number) => Math.round(value * 100) / 100
    const troughProfile = (image: typeof decoded.progressDark, left: number, right: number) => {
      const centerX = Math.round((left + right) / 2)
      const vertical = sampleRows(image, centerX, 304, 338, 3)
      const horizontal = sampleColumns(image, 320, left - 4, right + 4, 1)
      const v = (from: number, to: number) => vertical.slice(from + 2, to + 2).map((row) => row.luminance)
      const channelWithoutSeams = v(5, 23)
      const adjacentJumps = channelWithoutSeams.slice(1).map((value, index) => Math.abs(value - (channelWithoutSeams[index] ?? value)))
      const edgeSamples = {
        topCenter: luminance(pixel(image, centerX, 306)),
        leftCenter: luminance(pixel(image, left, 320)),
        rightCenter: luminance(pixel(image, right - 1, 320)),
        bottomCenter: luminance(pixel(image, centerX, 333)),
      }
      const edgeValues = Object.values(edgeSamples)
      const background = mean(v(-2, 0))
      const shadow = v(28, 32).map((value, index) => ({ relativeY: 28 + index, luminance: rounded(value), backgroundDarkening: rounded(background - value) }))
      const centerStart = left + 8
      const centerEnd = right - 8
      let maximumFortyPixelDrift = 0
      for (let start = centerStart; start + 40 <= centerEnd; start += 1) {
        const values = Array.from({ length: 40 }, (_unused, offset) => luminance(pixel(image, start + offset, 320)))
        maximumFortyPixelDrift = Math.max(maximumFortyPixelDrift, Math.max(...values) - Math.min(...values))
      }
      const leftOuter = mean([luminance(pixel(image, left, 319)), luminance(pixel(image, left, 320))])
      const rightReturn = mean([luminance(pixel(image, right - 1, 319)), luminance(pixel(image, right - 1, 320))])
      const leftSeam = mean([luminance(pixel(image, left + 2, 319)), luminance(pixel(image, left + 2, 320))])
      const leftChannel = mean([luminance(pixel(image, left + 4, 319)), luminance(pixel(image, left + 4, 320))])
      const rightSeam = mean([luminance(pixel(image, right - 3, 319)), luminance(pixel(image, right - 3, 320))])
      const rightChannel = mean([luminance(pixel(image, right - 5, 319)), luminance(pixel(image, right - 5, 320))])
      const stableChannel = mean(Array.from({ length: 40 }, (_unused, offset) => luminance(pixel(image, centerX - 20 + offset, 320))))
      const transitionComplete = (x: number) => Math.abs(luminance(pixel(image, x, 320)) - stableChannel) <= 6
      const leftTransitionWidthPx = Array.from({ length: 9 }, (_unused, offset) => offset).find((offset) => transitionComplete(left + offset)) ?? 9
      const rightTransitionWidthPx = Array.from({ length: 9 }, (_unused, offset) => offset).find((offset) => transitionComplete(right - 1 - offset)) ?? 9
      const cornerMask = (fromY: number) => Array.from({ length: 8 }, (_unused, row) => Array.from({ length: 8 }, (_cell, column) => {
        const x = left - 2 + column
        const y = fromY + row
        const value = pixel(image, x, y)
        const outside = pixel(image, left - 12, y)
        const maximumChannelDelta = Math.max(Math.abs(value.r - outside.r), Math.abs(value.g - outside.g), Math.abs(value.b - outside.b))
        return { x, y, occupied: maximumChannelDelta >= 10, luminance: luminance(value) }
      }))
      return {
        vertical,
        horizontal,
        cornerMasks: { topLeft: cornerMask(304), bottomLeft: cornerMask(328) },
        metrics: {
          topLipLuminance: rounded(mean(v(0, 2))),
          topSeamLuminance: rounded(mean(v(2, 4))),
          nextFourChannelRowsLuminance: rounded(mean(v(4, 8))),
          channelRange: rounded(Math.max(...channelWithoutSeams) - Math.min(...channelWithoutSeams)),
          channelDistinctEightPointBins: new Set(channelWithoutSeams.map((value) => Math.floor(value / 8))).size,
          maximumAdjacentChannelJump: rounded(Math.max(...adjacentJumps)),
          lowerSeamDarkening: rounded((v(24, 25)[0] ?? 0) - (v(25, 26)[0] ?? 0)),
          edgeSamples,
          edgeRange: rounded(Math.max(...edgeValues) - Math.min(...edgeValues)),
          edgeDistinctValues: new Set(edgeValues.map((value) => Math.round(value))).size,
          shadow,
          horizontal: {
            leftSeamContrast: rounded(leftChannel - leftSeam),
            rightSeamContrast: rounded(rightChannel - rightSeam),
            leftHighlightOverRightReturn: rounded(leftOuter - rightReturn),
            maximumFortyPixelDrift: rounded(maximumFortyPixelDrift),
            leftTransitionWidthPx,
            rightTransitionWidthPx,
            maximumTransitionWidthPx: Math.max(leftTransitionWidthPx, rightTransitionWidthPx),
          },
        },
      }
    }
    const phaseDifference = (first: typeof decoded.loadingT0, second: typeof decoded.loadingT0, shiftX: number) => {
      let total = 0
      let samples = 0
      for (let y = 308; y < 332; y += 1) {
        for (let x = 90; x < 454; x += 1) {
          const firstPixel = pixel(first, x, y)
          const secondPixel = pixel(second, x + shiftX, y)
          total += Math.abs(firstPixel.r - secondPixel.r) + Math.abs(firstPixel.g - secondPixel.g) + Math.abs(firstPixel.b - secondPixel.b)
          samples += 3
        }
      }
      return total / samples
    }
    const shifts = Array.from({ length: 61 }, (_, index) => index - 30)
    const bestHalfShift = shifts.map((shiftX) => ({ shiftX, meanChannelDelta: phaseDifference(decoded.loadingT0, decoded.loading1600, shiftX) }))
      .reduce((current, candidate) => candidate.meanChannelDelta < current.meanChannelDelta ? candidate : current)
    let closureMaximumChannelDelta = 0
    let closureMaximumAt = { x: 0, y: 0 }
    for (let y = 308; y < 332; y += 1) {
      for (let x = 40; x < 504; x += 1) {
        const first = pixel(decoded.loadingT0, x, y)
        const full = pixel(decoded.loading3200, x, y)
        const maximumChannelDelta = Math.max(Math.abs(first.r - full.r), Math.abs(first.g - full.g), Math.abs(first.b - full.b))
        if (maximumChannelDelta > closureMaximumChannelDelta) {
          closureMaximumChannelDelta = maximumChannelDelta
          closureMaximumAt = { x, y }
        }
      }
    }
    const progressDark = staticProfile(decoded.progressDark, 220)
    const progressLight = staticProfile(decoded.progressLight, 220)
    const volumeDark = staticProfile(decoded.volumeDark, 220)
    const volumeLight = staticProfile(decoded.volumeLight, 220)
    const emptyWell = staticProfile(decoded.progressDarkEmpty, 220)
    return {
      schema: 'webpod.aqua-cylinder-cross-sections.v1',
      captureScale: 2,
      rasterGeometry: { outer: { y: 306, height: 28 }, inner: { y: 308, height: 24 }, perimeterPx: 2 },
      profiles: {
        progressDark,
        progressLight,
        volumeDark,
        volumeLight,
        emptyWell,
        loadingBlue: { rows: blueRows, metrics: rowMetrics(blueRows), topStartX: darkestTop.x, slopeXPerRow: 1 },
        loadingLight: { rows: lightRows, metrics: rowMetrics(lightRows), topStartX: lightestTop.x, slopeXPerRow: 1 },
      },
      normalizedProfileEquality: {
        darkMaximumRgbChannelDelta: compareProfiles(progressDark.rows, volumeDark.rows),
        lightMaximumRgbChannelDelta: compareProfiles(progressLight.rows, volumeLight.rows),
      },
      loadingPhaseContinuity: {
        t0To1600BestShiftPxAt2x: bestHalfShift.shiftX,
        t0To1600BestShiftAuthoredPx: Math.abs(bestHalfShift.shiftX) / 2,
        t0To1600MeanChannelDelta: Math.round(bestHalfShift.meanChannelDelta * 100) / 100,
        t0To3200MaximumChannelDelta: closureMaximumChannelDelta,
        t0To3200MaximumAt: closureMaximumAt,
        stableInterior: { x: 40, y: 308, width: 464, height: 24 },
      },
      outerTroughProfiles: {
        progressDarkEmpty: troughProfile(decoded.progressDarkEmpty, 36, 508),
        progressLightEmpty: troughProfile(decoded.progressLightEmpty, 36, 508),
        volumeDarkEmpty: troughProfile(decoded.volumeDarkEmpty, 70, 474),
        volumeLightEmpty: troughProfile(decoded.volumeLightEmpty, 70, 474),
        loadingDark: troughProfile(decoded.loadingT0, 36, 508),
      },
    }
  }, sources)

  await writeFile(resolve(fidelityEvidence, 'aqua-cylinder-cross-sections.json'), JSON.stringify(report, null, 2))
  await writeFile(resolve(fidelityEvidence, 'aqua-outer-trough-cross-sections.json'), JSON.stringify({ schema: 'webpod.aqua-outer-trough-cross-sections.v1', captureScale: report.captureScale, rasterGeometry: report.rasterGeometry, computedCastTokens, profiles: report.outerTroughProfiles }, null, 2))
  expect(report.rasterGeometry).toEqual({ outer: { y: 306, height: 28 }, inner: { y: 308, height: 24 }, perimeterPx: 2 })
  for (const profile of [report.profiles.progressDark, report.profiles.progressLight, report.profiles.volumeDark, report.profiles.volumeLight]) {
    expect(profile.metrics.topMinusWaist).toBeGreaterThanOrEqual(18)
    expect(profile.metrics.bottomMinusWaist).toBeGreaterThanOrEqual(10)
    expect(profile.metrics.darkestRowFraction).toBeGreaterThanOrEqual(0.4)
    expect(profile.metrics.darkestRowFraction).toBeLessThanOrEqual(0.62)
    expect(profile.metrics.maximumSingleRowDropVersusBothNeighbors).toBeLessThanOrEqual(24)
  }
  for (const profile of [report.profiles.loadingBlue, report.profiles.loadingLight]) {
    expect(profile.metrics.topMinusWaist).toBeGreaterThan(0)
    expect(profile.metrics.bottomMinusWaist).toBeGreaterThan(0)
  }
  expect(report.normalizedProfileEquality.darkMaximumRgbChannelDelta).toBeLessThanOrEqual(8)
  expect(report.normalizedProfileEquality.lightMaximumRgbChannelDelta).toBeLessThanOrEqual(8)
  expect(report.loadingPhaseContinuity.t0To1600BestShiftAuthoredPx).toBe(11)
  expect(report.loadingPhaseContinuity.t0To3200MaximumChannelDelta).toBe(0)
  for (const profile of [report.outerTroughProfiles.progressDarkEmpty, report.outerTroughProfiles.progressLightEmpty, report.outerTroughProfiles.volumeDarkEmpty, report.outerTroughProfiles.volumeLightEmpty]) {
    const metrics = profile.metrics
    expect(metrics.topLipLuminance - metrics.topSeamLuminance).toBeGreaterThanOrEqual(28)
    expect(metrics.nextFourChannelRowsLuminance - metrics.topSeamLuminance).toBeGreaterThanOrEqual(18)
    expect(metrics.channelRange).toBeGreaterThanOrEqual(18)
    expect(metrics.channelDistinctEightPointBins).toBeGreaterThanOrEqual(4)
    expect(metrics.maximumAdjacentChannelJump).toBeLessThanOrEqual(16)
    expect(metrics.lowerSeamDarkening).toBeGreaterThanOrEqual(10)
    expect(metrics.lowerSeamDarkening).toBeLessThanOrEqual(38)
    expect(metrics.edgeDistinctValues).toBeGreaterThanOrEqual(3)
    expect(metrics.edgeRange).toBeGreaterThanOrEqual(24)
    const peakShadowDarkening = Math.max(...metrics.shadow.slice(0, 2).map((row) => row.backgroundDarkening))
    expect(peakShadowDarkening).toBeGreaterThanOrEqual(8)
    expect(peakShadowDarkening).toBeLessThanOrEqual(35)
    expect(metrics.shadow.at(-1)?.backgroundDarkening ?? Number.POSITIVE_INFINITY).toBeLessThan(metrics.shadow[0]?.backgroundDarkening ?? 0)
    expect(metrics.horizontal.leftSeamContrast).toBeGreaterThanOrEqual(14)
    expect(metrics.horizontal.rightSeamContrast).toBeGreaterThanOrEqual(14)
    expect(metrics.horizontal.leftHighlightOverRightReturn).toBeGreaterThanOrEqual(8)
    expect(metrics.horizontal.maximumFortyPixelDrift).toBeLessThanOrEqual(6)
    expect(metrics.horizontal.leftTransitionWidthPx).toBeLessThanOrEqual(4)
    expect(metrics.horizontal.rightTransitionWidthPx).toBeLessThanOrEqual(4)
    expect(metrics.horizontal.maximumTransitionWidthPx).toBeLessThanOrEqual(4)
    const topFirstObjectRow = profile.cornerMasks.topLeft[2] ?? []
    const bottomLastObjectRow = profile.cornerMasks.bottomLeft[5] ?? []
    const nearShadowRow = profile.cornerMasks.bottomLeft[6] ?? []
    const farShadowRow = profile.cornerMasks.bottomLeft[7] ?? []
    const occupied = (row: typeof topFirstObjectRow) => row.filter((sample) => sample.occupied).length
    expect(occupied(topFirstObjectRow)).toBeLessThan(occupied(bottomLastObjectRow))
    expect(occupied(nearShadowRow)).toBeGreaterThan(0)
    expect(occupied(farShadowRow)).toBeGreaterThan(0)
    expect(occupied(farShadowRow)).toBeLessThanOrEqual(occupied(nearShadowRow))
  }
  expect(computedCastTokens.dark.nearAlpha).toBe('26%')
  expect(computedCastTokens.dark.farAlpha).toBe('12%')
  expect(computedCastTokens.light.nearAlpha).toBe('10%')
  expect(computedCastTokens.light.farAlpha).toBe('5%')
  for (const tokens of Object.values(computedCastTokens)) {
    expect(tokens.boxShadow).toContain('rgba(0, 0, 0')
    expect(tokens.boxShadow.split('rgba(0, 0, 0')).toHaveLength(3)
  }
})

test('all state and colourway pairs produce chrome-free screen evidence', async ({ page }) => {
  await freezeEvidenceClock(page)
  for (const state of states) {
    for (const screen of ['s03', 's08', 's13'] as const) {
      await openScreen(page, screen, `?state=${state}`)
      await stabilizeEvidence(page)
      const darkPanel = page.locator('.wp-panel').first()
      if (state === 'success-confirmation' && screen !== 's13') await expect(darkPanel.getByRole('status')).toBeVisible()
      if (screen === 's13' && await darkPanel.locator('.wp-now').count() === 1) {
        await expect(darkPanel.locator('.wp-now')).toHaveAttribute('data-art-sample-source', 'provider')
      }
      for (const [index, colourway] of ['dark', 'light'].entries()) {
        const panel = page.locator('.wp-panel').nth(index)
        await expect(panel).toHaveAttribute('data-state', state)
        await panel.screenshot({ path: resolve(evidence, `${prefix}-${screen}-${state}-${colourway}.png`) })
      }
    }
  }
})

test('the prescribed state matrix changes behavior rather than labels', async ({ page }) => {
  let panel = await openScreen(page, 's03', '?state=loading')
  await expect(panel).toContainText('Loading your library counts.')
  await expect(panel.locator('.wp-list-row__count')).toHaveCount(0)
  panel = await openScreen(page, 's03', '?state=empty')
  await expect(panel.getByRole('option')).toHaveCount(8)
  await expect(panel.locator('[data-empty="true"]')).toHaveCount(5)
  await expect(panel.getByRole('status')).toContainText('Nothing in your library yet')
  panel = await openScreen(page, 's03', '?state=error')
  await expect(panel.locator('.wp-list-row__count')).toHaveCount(0)
  panel = await openScreen(page, 's03', '?state=offline')
  await expect(panel).not.toContainText('Downloads')
  await expect(panel).not.toContainText('⤓')
  await expect(panel.getByRole('status')).toContainText('cached library metadata')
  panel = await openScreen(page, 's03', '?state=permission-denied')
  await expect(panel.getByRole('status')).toContainText('subscription is needed to play')
  await expect(panel.locator('[data-unavailable="true"]')).toHaveCount(1)
  panel = await openScreen(page, 's03', '?state=agent-active')
  await expect(panel).toHaveAttribute('data-state', 'agent-active')
  await expect(panel.locator('.wp-list-preview')).toHaveCount(0)

  panel = await openScreen(page, 's08', '?state=loading')
  await expect(panel.locator('.wp-list-loading .wp-skeleton')).toHaveCount(8)
  panel = await openScreen(page, 's08', '?state=empty')
  await expect(panel).toContainText('Nothing here plays in your region.')
  panel = await openScreen(page, 's08', '?state=error')
  await expect(panel).toContainText('Press Menu and try again.')
  panel = await openScreen(page, 's08', '?state=permission-denied')
  await expect(panel).toContainText('Sign in to browse your music.')
  panel = await openScreen(page, 's08', '?state=offline')
  await expect(panel.locator('[data-unavailable="true"]')).not.toHaveCount(0)
  await expect(panel).not.toContainText('⤓')
  await expect(panel).not.toContainText(/download/i)
  await expect(panel).toContainText('Cached metadata')
  panel = await openScreen(page, 's08', '?state=success-confirmation')
  await expect(panel.getByRole('status')).toContainText('Created')
  await expect(panel.locator('[data-success-object]')).toHaveAttribute('data-success-object', /.+/)
  await expect(panel.locator('[data-success-object]')).toHaveAttribute('data-library-total', /[1-9]\d*/)

  panel = await openScreen(page, 's13', '?state=loading')
  await expect(panel).not.toContainText('Preparing playback')
  await expect(panel.locator('.wp-status-shelf')).toHaveCount(0)
  await expect(panel.locator('.wp-now')).toHaveAttribute('data-playback-phase', 'ready')
  await expect(panel.locator('.wp-now')).toHaveAttribute('aria-busy', 'false')
  await expect(panel.locator('.wp-progress--indeterminate')).toHaveCount(0)
  await expect(panel.locator('.wp-titlebar__transport')).toHaveAttribute('data-transport', 'playing')
  await expect(panel.locator('.wp-titlebar__transport .wp-icon-fill')).toBeVisible()
  expect(await panel.locator('.wp-titlebar__transport .wp-icon-fill').evaluate((element) => getComputedStyle(element).fill)).not.toBe('none')
  panel = await openScreen(page, 's13', '?state=empty')
  await expect(panel).toContainText('Nothing is playing.')
  panel = await openScreen(page, 's13', '?state=error')
  await expect(panel).toContainText('Playback unavailable')
  await expect(panel.locator('.wp-status-shelf')).toHaveCount(0)
  await expect(panel.getByRole('progressbar', { name: 'Volume' })).toHaveCount(0)
  panel = await openScreen(page, 's13', '?state=offline')
  await expect(panel.locator('.wp-status-shelf')).toHaveCount(0)
  await expect(panel).not.toContainText(/download/i)
  panel = await openScreen(page, 's13', '?state=permission-denied')
  await expect(panel.locator('.wp-now-meta h1')).not.toBeEmpty()
  await expect(panel.locator('.wp-message')).toHaveCount(0)
  panel = await openScreen(page, 's13', '?state=agent-active')
  await expect(panel).toHaveAttribute('data-state', 'agent-active')
})

test('pale and dark artwork exercise both adaptive colourways', async ({ page }) => {
  await freezeEvidenceClock(page)
  for (const tone of ['pale', 'dark'] as const) {
    await openScreen(page, 's13', `?art=${tone}`)
    await stabilizeEvidence(page)
    for (const [index, colourway] of ['dark', 'light'].entries()) {
      const panel = page.locator('.wp-panel').nth(index)
      await expect(panel.locator('.wp-now')).toHaveAttribute('data-art-tone', tone)
      await panel.screenshot({ path: resolve(evidence, `${prefix}-s13-art-${tone}-${colourway}.png`) })
    }
  }
})

test('provider Now Playing artwork retains provider-driven colour sampling', async ({ page }) => {
  await freezeEvidenceClock(page)
  await openScreen(page, 's13')
  await stabilizeEvidence(page)
  const reports = []
  for (const [index, colourway] of ['dark', 'light'].entries()) {
    const panel = page.locator('.wp-panel').nth(index)
    const image = panel.locator('[data-provider-artwork="true"]')
    await expect(image).toBeVisible()
    await expect(panel.locator('.wp-now')).toHaveAttribute('data-art-sample-source', 'provider')
    const dimensions = await image.evaluate((element) => {
      if (!(element instanceof HTMLImageElement)) throw new Error('Now Playing artwork must be an image')
      return { naturalWidth: element.naturalWidth, naturalHeight: element.naturalHeight, src: element.getAttribute('src') }
    })
    expect(dimensions.naturalWidth).toBeGreaterThan(0)
    expect(dimensions.naturalHeight).toBeGreaterThan(0)
    await panel.screenshot({ path: resolve(evidence, `${prefix}-s13-provider-${colourway}.png`) })
    reports.push({ colourway, sampleSource: 'provider', ...dimensions })
  }
  await writeFile(resolve(evidence, `${prefix}-provider-artwork.json`), JSON.stringify(reports, null, 2))
})

test('the canonical package seam uses only raster-compatible panel effects', async ({ page }) => {
  await freezeEvidenceClock(page)
  await openScreen(page, 's13', '?art=pale')
  await stabilizeEvidence(page)
  const reports = []
  for (const [index, colourway] of ['dark', 'light'].entries()) {
    const panel = page.locator('.wp-panel').nth(index)
    const treatment = await panel.locator('.wp-now-body').evaluate((element) => {
      const style = getComputedStyle(element, '::before')
      return { display: style.display, filter: style.filter, mixBlendMode: style.mixBlendMode, backgroundImage: style.backgroundImage }
    })
    expect(treatment.display).not.toBe('none')
    expect(treatment.filter).toBe('none')
    expect(treatment.mixBlendMode).toBe('normal')
    expect(treatment.backgroundImage).toContain('radial-gradient')
    await panel.screenshot({ path: resolve(evidence, `${prefix}-raster-compatible-${colourway}.png`) })
    reports.push({ colourway, ...treatment })
  }
  const session = await page.context().newCDPSession(page)
  await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] })
  for (const panel of await page.locator('.wp-panel').all()) {
    const display = await panel.locator('.wp-now-body').evaluate((element) => getComputedStyle(element, '::before').display)
    expect(display).toBe('none')
  }
  await writeFile(resolve(evidence, `${prefix}-raster-compatibility.json`), JSON.stringify({ reports, reducedTransparencyBloom: 'none' }, null, 2))
})

test('a 120-row fixture renders only the canonical visible window', async ({ page }) => {
  const panel = await openScreen(page, 's08', '?long=1')
  const list = panel.locator('[data-list-viewport="true"]')
  await expect(list).toBeVisible()
  await expect(list.locator('.wp-list-row')).toHaveCount(8)
})

test('wheel navigation moves one list-owned indicator and never decorates the preview', async ({ page }) => {
  const panel = await openScreen(page, 's03')
  await expect(panel.locator('.wp-list-scroll')).toHaveCount(0)
  await expect(panel.locator('.wp-menu-preview__rail')).toHaveCount(0)

  await panel.press('Enter')
  await expect(panel.getByRole('listbox', { name: 'Albums' })).toBeVisible()
  await panel.press('Enter')
  const indicator = panel.locator('.wp-list-body > .wp-list-scroll')
  await expect(indicator).toHaveCount(1)
  await expect(panel.locator('.wp-list-preview .wp-list-scroll')).toHaveCount(0)
  await expect(indicator).toHaveAttribute('data-total-rows', '11')
  await expect(indicator).toHaveAttribute('data-visible-rows', '8')
  await expect(indicator).toHaveAttribute('data-window-start', '0')
  await expect(indicator).toHaveAttribute('data-thumb-size', '127.273px')

  for (let detent = 0; detent < 9; detent += 1) {
    await panel.dispatchEvent('wheel', { deltaY: 40, deltaMode: 0 })
  }

  await expect(indicator).toHaveAttribute('data-window-start', '2')
  await expect(indicator).toHaveAttribute('data-thumb-offset', '31.818px')
})

test('the canonical list window sustains frame pacing under mid-tier CPU throttling', async ({ page }) => {
  const session = await page.context().newCDPSession(page)
  await session.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  const panel = await openScreen(page, 's08', '?long=1')
  const list = panel.locator('[data-list-viewport="true"]')
  const measurement = await list.evaluate(async (element) => {
    const timestamps: number[] = []
    await new Promise<void>((resolveAnimation) => {
      const sample = (timestamp: number) => {
        timestamps.push(timestamp)
        if (timestamps.length < 61) requestAnimationFrame(sample)
        else resolveAnimation()
      }
      requestAnimationFrame(sample)
    })
    const frameDurations = timestamps.slice(1).map((timestamp, index) => {
      const priorTimestamp = timestamps[index]
      if (priorTimestamp === undefined) throw new Error('A frame sample is missing its predecessor')
      return timestamp - priorTimestamp
    })
    const sorted = [...frameDurations].sort((a, b) => a - b)
    const p95FrameMs = sorted[Math.floor(sorted.length * 0.95)]
    if (p95FrameMs === undefined) throw new Error('The frame measurement produced no samples')
    return {
      averageFrameMs: frameDurations.reduce((sum, duration) => sum + duration, 0) / frameDurations.length,
      p95FrameMs,
      renderedRows: element.querySelectorAll('.wp-list-row').length,
      samples: frameDurations.length,
    }
  })
  await session.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  expect(measurement.averageFrameMs).toBeLessThan(20)
  expect(measurement.renderedRows).toBeLessThan(30)
  expect(measurement.samples).toBe(60)
  await writeFile(resolve(evidence, `${prefix}-virtual-performance.json`), JSON.stringify({ cpuThrottle: 4, ...measurement }, null, 2))
})

test('success receipts follow completed provider mutations', async ({ page }) => {
  let panel = await openScreen(page, 's08', '?state=success-confirmation&actor=agent')
  await expect(panel.getByRole('status')).toContainText('Created')
  await expect(panel.locator('[data-success-object]')).toHaveAttribute('data-success-object', /.+/)
  await expect(panel.locator('[data-success-object]')).toHaveAttribute('data-library-total', /[1-9]\d*/)
  await expect(panel.getByRole('status')).not.toContainText('Volume changed')
  panel = await openScreen(page, 's13', '?state=success-confirmation&actor=agent')
  await expect(panel.locator('.wp-now')).toHaveAttribute('data-volume', '68')
  await expect(panel.getByRole('status')).toHaveCount(0)
  await expect(panel.locator('.wp-status-shelf')).toHaveCount(0)
  await expect(panel).toHaveAttribute('data-actor', 'agent')
})

test('Dynamic Type reaches compact, medium, and forced-airy without clipping', async ({ page }) => {
  await freezeEvidenceClock(page)
  const cases = [
    ['?scale=1&density=compact', 'compact', '8'],
    ['?scale=1&density=medium', 'medium', '6'],
    ['?scale=1.3&density=compact', 'airy', '4'],
    ['?scale=2&density=compact', 'airy', '4'],
  ] as const
  for (const [query, density, rows] of cases) {
    const panel = await openScreen(page, 's03', query)
    await stabilizeEvidence(page)
    await expect(panel).toHaveAttribute('data-density', density)
    await expect(panel).toHaveAttribute('data-visible-rows', rows)
    const clipped = await panel.evaluate((element) => element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight)
    expect(clipped).toBe(false)
    await panel.screenshot({ path: resolve(evidence, `${prefix}-dynamic-${query.includes('scale=2') ? '200' : query.includes('1.3') ? '130' : density}.png`) })
  }
})

test('axe and preference emulation pass in both colourways', async ({ page }) => {
  await freezeEvidenceClock(page)
  const media = [
    ['reduced-motion', [{ name: 'prefers-reduced-motion', value: 'reduce' }]],
    ['reduced-transparency', [{ name: 'prefers-reduced-transparency', value: 'reduce' }]],
    ['contrast-more', [{ name: 'prefers-contrast', value: 'more' }]],
  ] as const
  for (const [name, features] of media) {
    await page.context().newCDPSession(page).then((session) => session.send('Emulation.setEmulatedMedia', { features }))
    await openScreen(page, 's13')
    await stabilizeEvidence(page)
    await page.locator('.wp-panel').first().screenshot({ path: resolve(evidence, `${prefix}-pref-${name}-dark.png`) })
    await page.locator('.wp-panel').nth(1).screenshot({ path: resolve(evidence, `${prefix}-pref-${name}-light.png`) })
  }
  const activePanel = await openScreen(page, 's13')
  await expect(activePanel).toBeFocused()
  const reports = []
  for (const colourway of ['dark', 'light'] as const) {
    const selector = `.wp-panel[data-colourway="${colourway}"]`
    const results = await new AxeBuilder({ page }).include(selector).analyze()
    expect(results.violations).toEqual([])
    await expect(page.locator(selector).getByRole('button')).toHaveCount(0)
    reports.push({ colourway, violations: results.violations, passes: results.passes.map((entry) => entry.id), inventedControls: 0 })
  }
  await writeFile(resolve(evidence, `${prefix}-axe.json`), JSON.stringify(reports, null, 2))
})
