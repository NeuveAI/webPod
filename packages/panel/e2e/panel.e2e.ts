import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const evidence = resolve(process.env['PANEL_EVIDENCE_DIR'] ?? resolve(import.meta.dirname, '../test-results/evidence'))
const prefix = process.env['PANEL_EVIDENCE_PREFIX'] ?? 'panel'
const states = ['ready', 'loading', 'empty', 'error', 'offline', 'permission-denied', 'agent-active', 'success-confirmation'] as const

const openScreen = async (page: Page, screen: 's03' | 's08' | 's13', query = '') => {
  await page.goto(`/${query}`)
  const dark = page.locator('.wp-panel').first()
  await expect(dark).toHaveAttribute('data-screen', 'S03')
  await dark.focus()
  if (screen !== 's03') await dark.press('Enter')
  if (screen === 's13') await dark.press('Enter')
  await expect(dark).toHaveAttribute('data-screen', screen.toUpperCase())
  return dark
}

test.beforeAll(async () => mkdir(evidence, { recursive: true }))

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
  await dark.press('Enter')
  await expect(dark).toHaveAttribute('data-screen', 'S13')
  const nowPlaying = dark.locator('.wp-now')
  await expect(nowPlaying).toHaveAttribute('data-position-ms', /[1-9]\d*/)
  const before = Number(await nowPlaying.getAttribute('data-position-ms'))
  await page.waitForTimeout(800)
  const after = Number(await nowPlaying.getAttribute('data-position-ms'))
  expect(after - before).toBeGreaterThanOrEqual(500)
  await expect(dark.getByRole('progressbar')).toHaveAttribute('aria-valuenow', /\d+/)
  await dark.press('Backspace')
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
  const secondTrack = panel.locator('.wp-track-row').nth(1)
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  })
  await secondTrack.click()
  await expect(panel).toBeFocused()
  await expect(panel).toHaveAttribute('data-screen', 'S08')
  await panel.press('Enter')
  await expect(panel).toHaveAttribute('data-screen', 'S13')
})

test('all state and colourway pairs produce chrome-free screen evidence', async ({ page }) => {
  await freezeEvidenceClock(page)
  for (const state of states) {
    for (const screen of ['s03', 's08', 's13'] as const) {
      await openScreen(page, screen, `?state=${state}`)
      await stabilizeEvidence(page)
      const darkPanel = page.locator('.wp-panel').first()
      if (state === 'success-confirmation') await expect(darkPanel.getByRole('status')).toBeVisible()
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
  await expect(panel.locator('.wp-row-meta').filter({ hasText: '…' })).toHaveCount(6)
  panel = await openScreen(page, 's03', '?state=empty')
  await expect(panel.getByRole('option')).toHaveCount(8)
  await expect(panel.locator('[data-empty="true"]')).toHaveCount(5)
  await expect(panel.getByRole('status')).toContainText('Nothing in your library yet')
  panel = await openScreen(page, 's03', '?state=error')
  await expect(panel.locator('.wp-row-meta').filter({ hasText: '—' })).toHaveCount(6)
  panel = await openScreen(page, 's03', '?state=offline')
  await expect(panel).not.toContainText('Downloads')
  await expect(panel).not.toContainText('⤓')
  await expect(panel.getByRole('status')).toContainText('cached library metadata')
  panel = await openScreen(page, 's03', '?state=permission-denied')
  await expect(panel.getByRole('status')).toContainText('subscription is needed to play')
  await expect(panel.locator('[data-unavailable="true"]')).toHaveCount(1)
  panel = await openScreen(page, 's03', '?state=agent-active')
  await expect(panel.locator('.wp-menu-preview')).toContainText('Assistant browsing')

  panel = await openScreen(page, 's08', '?state=loading')
  await expect(panel.locator('.wp-track-row.wp-skeleton')).toHaveCount(8)
  panel = await openScreen(page, 's08', '?state=empty')
  await expect(panel).toContainText('Nothing here plays in your region.')
  panel = await openScreen(page, 's08', '?state=error')
  await expect(panel.locator('.wp-track-row.wp-skeleton')).toHaveCount(8)
  await expect(panel).toContainText('Retry')
  panel = await openScreen(page, 's08', '?state=permission-denied')
  await expect(panel.locator('.wp-track-row')).toHaveCount(8)
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
  await expect(panel).toContainText('Loading the song.')
  panel = await openScreen(page, 's13', '?state=empty')
  await expect(panel).toContainText('Nothing is playing.')
  panel = await openScreen(page, 's13', '?state=error')
  await expect(panel).toContainText('The next song is queued.')
  panel = await openScreen(page, 's13', '?state=offline')
  await expect(panel).toContainText('Playback unavailable; cached metadata shown')
  await expect(panel).not.toContainText(/download/i)
  panel = await openScreen(page, 's13', '?state=permission-denied')
  await expect(panel).toContainText('Playback needs an Apple Music subscription.')
  panel = await openScreen(page, 's13', '?state=agent-active')
  await expect(panel).toContainText('Assistant moved here')
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

test('provider artwork is both rendered and sampled through the same-origin proxy', async ({ page }) => {
  await freezeEvidenceClock(page)
  await openScreen(page, 's13')
  await stabilizeEvidence(page)
  const reports = []
  for (const [index, colourway] of ['dark', 'light'].entries()) {
    const panel = page.locator('.wp-panel').nth(index)
    const image = panel.locator('[data-provider-artwork="true"]')
    await expect(image).toBeVisible()
    await expect(image).toHaveAttribute('src', /^\/artwork\?/)
    await expect(panel.locator('.wp-now')).toHaveAttribute('data-art-sample-source', 'provider')
    const dimensions = await image.evaluate((element) => {
      if (!(element instanceof HTMLImageElement)) throw new Error('provider artwork must be an image')
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

test('a 120-row fixture is rendered through TanStack Virtual', async ({ page }) => {
  const panel = await openScreen(page, 's08', '?long=1')
  const list = panel.locator('[data-virtual-count="120"]')
  await expect(list).toBeVisible()
  expect(await list.locator('.wp-track-row').count()).toBeLessThan(30)
})

test('the virtual list sustains a frame-paced scroll under mid-tier CPU throttling', async ({ page }) => {
  const session = await page.context().newCDPSession(page)
  await session.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  const panel = await openScreen(page, 's08', '?long=1')
  const list = panel.locator('[data-virtual-count="120"]')
  const measurement = await list.evaluate(async (element) => {
    const timestamps: number[] = []
    await new Promise<void>((resolveAnimation) => {
      const sample = (timestamp: number) => {
        timestamps.push(timestamp)
        element.scrollTop += 4
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
      renderedRows: element.querySelectorAll('.wp-track-row').length,
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
  await expect(panel.getByRole('status')).toContainText('Volume changed')
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
    const action = page.locator(selector).getByRole('button', { name: 'Love track' })
    const box = await action.boundingBox()
    if (box === null) throw new Error('Love track action has no target box')
    const nativeTarget = await action.evaluate((element) => {
      if (!(element instanceof HTMLButtonElement)) throw new Error('Love track action must be a native button')
      const style = getComputedStyle(element)
      return {
        offsetWidth: element.offsetWidth,
        offsetHeight: element.offsetHeight,
        minInlineSize: Number.parseFloat(style.minInlineSize),
        minBlockSize: Number.parseFloat(style.minBlockSize),
      }
    })
    const hitCoverage = await action.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const points = [
        [rect.left + 1, rect.top + 1],
        [rect.right - 1, rect.top + 1],
        [rect.left + 1, rect.bottom - 1],
        [rect.right - 1, rect.bottom - 1],
      ] as const
      return points.map(([x, y]) => {
        const hit = document.elementFromPoint(x, y)
        return hit === element || element.contains(hit)
      })
    })
    expect(nativeTarget.offsetWidth).toBeGreaterThanOrEqual(44)
    expect(nativeTarget.offsetHeight).toBeGreaterThanOrEqual(44)
    expect(nativeTarget.minInlineSize).toBeGreaterThanOrEqual(44)
    expect(nativeTarget.minBlockSize).toBeGreaterThanOrEqual(44)
    expect(hitCoverage).toEqual([true, true, true, true])
    const results = await new AxeBuilder({ page }).include(selector).analyze()
    const targetSize = await new AxeBuilder({ page }).include(selector).withRules(['target-size']).analyze()
    expect(results.violations).toEqual([])
    expect(targetSize.violations).toEqual([])
    const targetPass = targetSize.passes.find((entry) => entry.id === 'target-size')
    expect(targetPass).toBeDefined()
    expect(targetPass?.nodes.length).toBeGreaterThan(0)
    reports.push({ colourway, violations: results.violations, targetSizeViolations: targetSize.violations, passes: results.passes.map((entry) => entry.id), targetSizePasses: targetSize.passes.map((entry) => entry.id), targetSizeEvaluatedNodes: targetPass?.nodes.length ?? 0, nativeTarget, hitCoverage, previewTarget: box })
  }
  await writeFile(resolve(evidence, `${prefix}-axe.json`), JSON.stringify(reports, null, 2))
})
