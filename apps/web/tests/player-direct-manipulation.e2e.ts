import { expect, test, type Page } from '../../../packages/panel/node_modules/@playwright/test/index.mjs'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { installDeterministicAppleMusic } from './deterministic-apple-music'
import { assertBrowserSourceIdentity } from './source-identity'

const evidence = resolve(import.meta.dirname, '../../../docs/workstreams/006-aqua-interface-parity/evidence/revisions')
test.use({ launchOptions: { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--enable-blink-features=CanvasDrawElement'] } })
test.beforeAll(async () => { await mkdir(evidence, { recursive: true }) })

async function openTracks(page: Page, theme = 'white', trackCount = 11, captureMode = true) {
  await installDeterministicAppleMusic(page, { trackTitle: 'A deliberately long live recording title that exceeds the entire LCD width', trackCount })
  await page.goto(`/_spike/device?${captureMode ? 'capture=&' : ''}view=front&colourway=${theme}`)
  await assertBrowserSourceIdentity(page)
  const panel = page.locator('.wp-panel')
  await expect(panel).toHaveAttribute('data-screen', 'S03')
  await expect(panel.locator('.wp-list-scroll')).toHaveCount(0)
  await panel.focus()
  await panel.press('Enter')
  await expect(panel.getByRole('listbox', { name: 'Albums' })).toBeAttached()
  await panel.press('Enter')
  await expect(panel.locator('.wp-list-row')).toHaveCount(9)
  return panel
}

async function startPlayback(page: Page) {
  const panel = page.locator('.wp-panel')
  await panel.press('Enter')
  await expect(panel).toHaveAttribute('data-screen', 'S13')
  await page.evaluate(() => {
    const music = Reflect.get(globalThis, 'MusicKit').getInstance()
    music.playbackState = 3
    music.currentPlaybackTime = 87
    music.currentPlaybackDuration = 246
    music.__emit('playbackStateDidChange')
    music.__emit('playbackTimeDidChange')
  })
  await expect(panel.locator('.wp-now')).toHaveAttribute('data-playback-phase', 'ready')
}

async function capture(page: Page, name: string) {
  await page.locator('.wp-panel').evaluate((panel) => {
    const canvas = panel.closest('canvas')
    const requestPaint = canvas === null ? null : Reflect.get(canvas, 'requestPaint')
    if (typeof requestPaint === 'function') Reflect.apply(requestPaint, canvas, [])
  })
  await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))))
  const box = await page.locator('.wp-panel').boundingBox()
  if (box !== null) await page.screenshot({ path: resolve(evidence, `${name}.png`), clip: box })
}

test('active overflowing list and Now Playing titles move within three seconds', async ({ page }) => {
  const panel = await openTracks(page)
  const assertOnset = async (selector: string) => {
    const moving = panel.locator(selector)
    await expect(moving.locator('..')).toHaveAttribute('data-overflow', 'true')
    const animation = await moving.evaluate((element) => {
      const animation = element.getAnimations()[0]
      if (animation === undefined) throw new Error('Overflow animation absent')
      animation.currentTime = 0
      animation.pause()
      const effect = animation.effect
      if (!(effect instanceof KeyframeEffect)) throw new Error('Marquee keyframes absent')
      return { delay: effect.getTiming().delay, duration: effect.getTiming().duration }
    })
    await moving.evaluate((element) => { const animation = element.getAnimations()[0]; if (animation) animation.currentTime = 2800 })
    const offset = await moving.evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).m41)
    expect(offset).toBeLessThan(-0.5)
    expect(animation.delay).toBeGreaterThanOrEqual(1800)
  }
  await assertOnset('.wp-list-row[aria-current="true"] .wp-marquee__moving')
  await startPlayback(page)
  await assertOnset('.wp-now-meta h1 .wp-marquee__moving')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(await panel.locator('.wp-now-meta h1 .wp-marquee__moving').evaluate((element) => getComputedStyle(element).animationName)).toBe('none')
})

test('scrub presentation remains optimistic through delayed, stale, failed and successful seek acknowledgement', async ({ page }) => {
  const panel = await openTracks(page)
  await startPlayback(page)
  await page.evaluate(() => {
    const music = Reflect.get(globalThis, 'MusicKit').getInstance()
    music.seekToTime = (seconds: number) => new Promise<void>((resolveSeek, rejectSeek) => {
      Reflect.set(globalThis, '__resolveSeek', () => {
        music.currentPlaybackTime = seconds
        music.__emit('playbackTimeDidChange')
        resolveSeek()
      })
      Reflect.set(globalThis, '__rejectSeek', () => rejectSeek(new Error('Delayed seek rejected')))
    })
  })
  await panel.press('Enter')
  await expect(panel.locator('.wp-now')).toHaveAttribute('data-mode', 'scrub')
  const samples: unknown[] = []
  const sample = async (position: number, providerPosition = 87000) => {
    await expect(panel.locator('.wp-now')).toHaveAttribute('data-position-ms', String(position))
    const sample = await panel.locator('.wp-progress').evaluate((track) => {
      const fillElement = track.querySelector('i')
      const fill = fillElement?.getBoundingClientRect()
      const marker = track.querySelector('b')?.getBoundingClientRect()
      if (!fill || !marker || !fillElement) throw new Error('Scrub geometry absent')
      const now = track.closest('.wp-now')
      return { fillEnd: fill.right, markerCenter: marker.x + marker.width / 2, percent: parseFloat(fillElement.style.inlineSize), aria: track.getAttribute('aria-valuenow'), position: now?.getAttribute('data-position-ms'), time: now?.querySelector('.wp-times')?.textContent, transition: getComputedStyle(fillElement).transitionDuration, provider: Reflect.get(globalThis, 'MusicKit').getInstance().currentPlaybackTime * 1000 }
    })
    const duration = (milliseconds: number) => `${Math.floor(milliseconds / 60000)}:${String(Math.floor(milliseconds / 1000) % 60).padStart(2, '0')}`
    expect(sample.transition).toBe('0s')
    expect(Math.abs(sample.fillEnd - sample.markerCenter)).toBeLessThan(0.2)
    expect(sample.percent).toBeCloseTo(position / 246000 * 100, 3)
    expect(sample.aria).toBe(String(position))
    expect(sample.position).toBe(String(position))
    expect(sample.time).toBe(`${duration(position)}-${duration(246000 - position)}`)
    expect(sample.provider).toBe(providerPosition)
    samples.push(sample)
  }
  await panel.press('ArrowDown'); await sample(92000)
  await panel.press('ArrowUp'); await sample(87000)
  for (let index = 0; index < 18; index++) await panel.press('ArrowUp')
  await sample(0)
  for (let index = 0; index < 50; index++) await panel.press('ArrowDown')
  await sample(246000)
  await panel.press('Enter')
  await expect(panel.locator('.wp-now')).toHaveAttribute('data-scrub-state', 'committing')
  await page.waitForTimeout(300)
  await sample(246000)
  await capture(page, 'scrub-delayed-endpoint')
  await panel.press('ArrowUp')
  await sample(241000)
  await page.evaluate(() => Reflect.get(globalThis, '__rejectSeek')())
  await page.waitForTimeout(50)
  await sample(241000)
  await expect(panel.locator('.wp-now')).toHaveAttribute('data-scrub-state', 'previewing')
  await panel.press('Enter')
  await expect(panel.locator('.wp-now')).toHaveAttribute('data-scrub-state', 'committing')
  await sample(241000)
  await page.evaluate(() => Reflect.get(globalThis, '__resolveSeek')())
  await expect(panel.locator('.wp-now')).toHaveAttribute('data-scrub-state', 'clean')
  await sample(241000, 241000)
  await panel.press('ArrowUp')
  await sample(236000, 241000)
  await panel.press('Enter')
  await expect(panel.locator('.wp-now')).toHaveAttribute('data-scrub-state', 'committing')
  await page.evaluate(() => Reflect.get(globalThis, '__rejectSeek')())
  await sample(241000, 241000)
  await panel.press('ArrowUp')
  await sample(236000, 241000)
  await panel.press('Escape')
  await expect(panel.locator('.wp-now')).toHaveAttribute('data-mode', 'standard')
  await expect(panel.locator('.wp-now')).toHaveAttribute('data-position-ms', '241000')
  expect(await page.evaluate(() => Reflect.get(globalThis, 'MusicKit').getInstance().currentPlaybackTime)).toBe(241)
  await writeFile(resolve(evidence, 'scrub-delayed-samples.json'), JSON.stringify(samples, null, 2))
})

test('device labels cannot be selected, while the real search input remains editable', async ({ page }) => {
  const panel = await openTracks(page, 'white', 11, false)
  const note = page.locator('.webpod-device-preview__selection-note')
  await expect(note).toBeVisible()
  await note.dblclick(); await note.click({ clickCount: 3 })
  const noteBox = await note.boundingBox()
  if (!noteBox) throw new Error('Device help label absent')
  await page.mouse.move(noteBox.x + 2, noteBox.y + 5)
  await page.mouse.down()
  await page.mouse.move(noteBox.x + noteBox.width - 2, noteBox.y + 5, { steps: 8 })
  await page.mouse.up()
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('')
  const header = panel.locator('.wp-titlebar strong')
  await header.dblclick()
  await header.click({ clickCount: 3 })
  const box = await panel.boundingBox()
  if (box === null) throw new Error('LCD bounds absent')
  await page.mouse.move(box.x + 12, box.y + 8)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width - 12, box.y + box.height - 12, { steps: 8 })
  await page.mouse.up()
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('')
  await capture(page, 'unselected-labels')
  await panel.focus()
  await panel.press('Escape')
  await panel.press('Escape')
  await expect(panel).toHaveAttribute('data-screen', 'S03')
  for (let index = 0; index < 4; index++) await panel.press('ArrowDown')
  await panel.press('Enter')
  const input = panel.getByPlaceholder('Artists, albums, songs…')
  await input.fill('Dream Theater')
  await input.press('ControlOrMeta+A')
  const selection = await input.evaluate((input) => input instanceof HTMLInputElement ? { start: input.selectionStart, end: input.selectionEnd, style: getComputedStyle(input).userSelect } : null)
  expect(selection).toEqual({ start: 0, end: 13, style: 'text' })
  await input.press('Backspace')
  await expect(input).toHaveValue('')
})

for (const theme of ['white', 'black']) {
  test(`subtle scrollbar stays bounded at top, middle and bottom in ${theme}`, async ({ page }) => {
    const panel = await openTracks(page, theme, 200)
    const indicator = panel.locator('.wp-list-scroll')
    for (const [position, turns] of [['top', 0], ['middle', 100], ['bottom', 110]] as const) {
      for (let index = 0; index < turns; index++) await panel.press('ArrowDown')
      const geometry = await indicator.evaluate((indicator) => {
        const track = indicator.getBoundingClientRect()
        const thumb = indicator.querySelector('.wp-list-scroll__thumb')?.getBoundingClientRect()
        const well = indicator.querySelector('.wp-list-scroll__well')
        if (!thumb || !well) throw new Error('Scroll material absent')
        return { track: { top: track.top, bottom: track.bottom, width: track.width }, thumb: { top: thumb.top, bottom: thumb.bottom, width: thumb.width }, stripes: getComputedStyle(well).backgroundImage, start: indicator.getAttribute('data-window-start') }
      })
      expect(geometry.thumb.top).toBeGreaterThanOrEqual(geometry.track.top - 0.1)
      expect(geometry.thumb.bottom).toBeLessThanOrEqual(geometry.track.bottom + 0.1)
      expect(geometry.thumb.width).toBeLessThan(geometry.track.width)
      expect(geometry.stripes).not.toContain('repeating-linear-gradient')
      if (position === 'bottom') {
        expect(geometry.start).toBe('191')
        expect(Math.abs(geometry.thumb.bottom - geometry.track.bottom)).toBeLessThan(0.1)
      }
      await capture(page, `scroll-${theme}-${position}`)
    }
  })
}


test('progress and volume keep the Classic interface in both enclosure finishes', async ({ page }) => {
  const panel = await openTracks(page, 'white', 11, false)
  await startPlayback(page)
  for (const theme of ['Silver', 'Black']) {
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await page.getByRole('button', { name: theme, exact: true }).click()
    await page.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name: 'Close', exact: true }).click()
    await expect(panel).toHaveAttribute('data-colourway', theme === 'Silver' ? 'light' : 'dark')
    await capture(page, `channel-${theme.toLowerCase()}`)
    await panel.focus()
    await panel.press('ArrowUp')
    await expect(panel.locator('.wp-volume-feedback')).toBeAttached()
    await capture(page, `volume-${theme.toLowerCase()}`)
    await panel.press('Enter')
    await panel.press('Escape')
    await expect(panel.locator('.wp-volume-feedback')).toHaveCount(0)
  }
})
