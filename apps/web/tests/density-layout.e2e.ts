import {
  expect,
  test,
  type Page,
} from '../../../packages/panel/node_modules/@playwright/test/index.js'

const CHROME_EXECUTABLE =
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

test.use({
  launchOptions: {
    executablePath: CHROME_EXECUTABLE,
    args: ['--enable-blink-features=CanvasDrawElement'],
  },
})

type Colourway = 'black' | 'white'
type Mode = 'bare' | 'composited'
type Pose = 'front' | 'three-quarter'
type Scale = 1 | 1.3 | 2

interface MenuLayout {
  readonly density: string | undefined
  readonly visibleRows: string | undefined
  readonly listHeight: number
  readonly usedHeight: number
  readonly rowHeights: readonly number[]
  readonly fontSizes: readonly number[]
  readonly rowTextClipped: readonly boolean[]
  readonly hasPreview: boolean
  readonly hasRail: boolean
  readonly titleHeight: number
}

const route = (colourway: Colourway, scale: Scale, mode: Mode, pose: Pose): string =>
  `/_probe/composite?colourway=${colourway}&state=ready&scale=${String(scale)}&fov=30&mode=${mode}&pose=${pose}`

const measureMenu = async (page: Page): Promise<MenuLayout> =>
  page.locator('.wp-panel').evaluate((panel) => {
    const list = panel.querySelector('.wp-menu-list')
    const title = panel.querySelector('.wp-titlebar')
    const rows = [...panel.querySelectorAll<HTMLElement>('.wp-menu-row')]
    if (!(list instanceof HTMLElement) || !(title instanceof HTMLElement)) {
      throw new Error('The main-menu layout surface is incomplete')
    }
    const firstTop = rows.at(0)?.offsetTop ?? 0
    const last = rows.at(-1)
    return {
      density: panel instanceof HTMLElement ? panel.dataset.density : undefined,
      visibleRows: panel instanceof HTMLElement ? panel.dataset.visibleRows : undefined,
      listHeight: list.clientHeight,
      usedHeight: last === undefined ? 0 : last.offsetTop + last.offsetHeight - firstTop,
      rowHeights: rows.map((row) => row.offsetHeight),
      fontSizes: rows.map((row) => Number.parseFloat(getComputedStyle(row).fontSize)),
      rowTextClipped: rows.map(
        (row) => row.scrollHeight > row.clientHeight || row.scrollWidth > row.clientWidth,
      ),
      hasPreview: panel.querySelector('.wp-menu-preview') !== null,
      hasRail: panel.querySelector('.wp-menu-preview__rail') !== null,
      titleHeight: title.offsetHeight,
    }
  })

const measureBareFit = async (page: Page) =>
  page.locator('.wp-composite-preview__bare-frame').evaluate((frame) => {
    const panelStage = frame.querySelector('.wp-panel-stage')
    if (!(panelStage instanceof HTMLElement)) throw new Error('The bare panel stage is absent')
    const frameRect = frame.getBoundingClientRect()
    const panelRect = panelStage.getBoundingClientRect()
    return {
      frameWidth: frameRect.width,
      frameHeight: frameRect.height,
      panelWidth: panelRect.width,
      panelHeight: panelRect.height,
    }
  })

test('forced-airy rows fill the menu viewport across the public composite matrix', async ({ page }) => {
  for (const colourway of ['black', 'white'] as const) {
    for (const scale of [1.3, 2] as const) {
      for (const mode of ['bare', 'composited'] as const) {
        for (const pose of ['front', 'three-quarter'] as const) {
          await page.goto(route(colourway, scale, mode, pose))
          const panel = page.locator('.wp-panel')
          await expect(panel).toHaveAttribute('data-density', 'airy')
          await expect(panel).toHaveAttribute('data-visible-rows', '4')

          const layout = await measureMenu(page)
          expect(layout.rowHeights, `${colourway}/${String(scale)}/${mode}/${pose}`).toEqual([
            44,
            44,
            44,
            44,
          ])
          expect(layout.fontSizes).toEqual([17, 17, 17, 17])
          expect(layout.usedHeight).toBe(176)
          expect(layout.usedHeight / layout.listHeight).toBeGreaterThan(0.95)
          expect(layout.listHeight - layout.usedHeight).toBeLessThanOrEqual(7)
          expect(layout.rowTextClipped).toEqual([false, false, false, false])
          expect(layout.hasPreview).toBe(true)
          expect(layout.hasRail).toBe(true)
          expect(layout.titleHeight).toBe(21)
          if (mode === 'bare') {
            const fit = await measureBareFit(page)
            expect(fit.panelWidth).toBeLessThanOrEqual(fit.frameWidth + 0.5)
            expect(fit.panelHeight).toBeLessThanOrEqual(fit.frameHeight + 0.5)
          }
        }
      }
    }
  }
})

test('forced-airy bare previews fit a mobile viewport without clipping the raster', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  for (const colourway of ['black', 'white'] as const) {
    for (const scale of [1.3, 2] as const) {
      await page.goto(route(colourway, scale, 'bare', 'front'))
      await expect(page.locator('.wp-panel')).toHaveAttribute('data-density', 'airy')
      const fit = await measureBareFit(page)
      expect(fit.panelWidth).toBeLessThanOrEqual(fit.frameWidth + 0.5)
      expect(fit.panelHeight).toBeLessThanOrEqual(fit.frameHeight + 0.5)
      expect(fit.frameWidth).toBeLessThanOrEqual(366)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
    }
  }
})

test('one-hundred-percent compact menus retain eight 21px rows', async ({ page }) => {
  for (const colourway of ['black', 'white'] as const) {
    for (const mode of ['bare', 'composited'] as const) {
      for (const pose of ['front', 'three-quarter'] as const) {
        await page.goto(route(colourway, 1, mode, pose))
        const panel = page.locator('.wp-panel')
        await expect(panel).toHaveAttribute('data-density', 'compact')
        await expect(panel).toHaveAttribute('data-visible-rows', '8')

        const layout = await measureMenu(page)
        expect(layout.rowHeights).toEqual([21, 21, 21, 21, 21, 21, 21, 21])
        expect(layout.fontSizes).toEqual([11, 11, 11, 11, 11, 11, 11, 11])
        expect(layout.usedHeight).toBe(168)
        expect(layout.listHeight).toBe(183)
        expect(layout.rowTextClipped).toEqual([
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
        ])
      }
    }
  }
})
