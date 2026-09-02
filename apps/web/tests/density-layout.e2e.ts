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
  readonly screenHeight: number
  readonly titleHeight: number
  readonly splitHeight: number
  readonly listHeight: number
  readonly previewHeight: number
  readonly rowHeights: readonly number[]
  readonly fontSizes: readonly number[]
  readonly labels: readonly string[]
  readonly listOverflowY: string
  readonly listBackground: string
  readonly railBottomGap: number
  readonly rasterScale: number
}

const route = (colourway: Colourway, scale: Scale, mode: Mode, pose: Pose): string =>
  `/_probe/composite?colourway=${colourway}&state=ready&scale=${String(scale)}&fov=30&mode=${mode}&pose=${pose}`

const measureMenu = async (page: Page, panelIndex = 0): Promise<MenuLayout> =>
  page.locator('.wp-panel').nth(panelIndex).evaluate((panel) => {
    const screen = panel.querySelector('.wp-screen')
    const title = panel.querySelector('.wp-titlebar')
    const split = panel.querySelector('.wp-menu-split')
    const list = panel.querySelector('.wp-menu-list')
    const preview = panel.querySelector('.wp-menu-preview')
    const rail = panel.querySelector('.wp-menu-preview__rail')
    const panelStage = panel.parentElement
    const rows = [...panel.querySelectorAll<HTMLElement>('.wp-menu-row')]
    if (
      !(panel instanceof HTMLElement) ||
      !(screen instanceof HTMLElement) ||
      !(title instanceof HTMLElement) ||
      !(split instanceof HTMLElement) ||
      !(list instanceof HTMLElement) ||
      !(preview instanceof HTMLElement) ||
      !(rail instanceof HTMLElement) ||
      !(panelStage instanceof HTMLElement)
    ) {
      throw new Error('The main-menu viewport is incomplete')
    }
    const listStyle = getComputedStyle(list)
    return {
      density: panel.dataset.density,
      visibleRows: panel.dataset.visibleRows,
      screenHeight: screen.clientHeight,
      titleHeight: title.offsetHeight,
      splitHeight: split.clientHeight,
      listHeight: list.clientHeight,
      previewHeight: preview.clientHeight,
      rowHeights: rows.map((row) => row.offsetHeight),
      fontSizes: rows.map((row) => Number.parseFloat(getComputedStyle(row).fontSize)),
      labels: rows.map((row) => row.querySelector('span')?.textContent ?? ''),
      listOverflowY: listStyle.overflowY,
      listBackground: listStyle.backgroundColor,
      railBottomGap: preview.clientHeight - rail.offsetTop - rail.offsetHeight,
      rasterScale: Number.parseFloat(
        getComputedStyle(panelStage).getPropertyValue('--wp-raster-scale'),
      ),
    }
  })

const expectFixedRowsInFullViewport = (
  layout: MenuLayout,
  expectedDensity: 'compact' | 'medium' | 'airy',
  expectedRows: number,
  expectedRasterScale: 1 | 1.25,
): void => {
  expect(layout.density).toBe(expectedDensity)
  expect(layout.visibleRows).toBe(String(expectedRows))
  expect(layout.screenHeight).toBe(204)
  expect(layout.titleHeight).toBe(21)
  expect(layout.splitHeight).toBe(183)
  expect(layout.listHeight).toBe(183)
  expect(layout.previewHeight).toBe(183)
  expect(layout.titleHeight + layout.listHeight).toBe(layout.screenHeight)
  expect(layout.rowHeights).toEqual(Array.from({ length: expectedRows }, () => 21))
  expect(layout.fontSizes).toEqual(Array.from({ length: expectedRows }, () => 11))
  expect(layout.listOverflowY).toBe('auto')
  expect(layout.listBackground).not.toBe('rgba(0, 0, 0, 0)')
  expect(layout.railBottomGap).toBe(7)
  expect(layout.rasterScale).toBe(expectedRasterScale)
}

test('the full-height menu viewport keeps fixed rows across scale and composite variants', async ({ page }) => {
  for (const colourway of ['black', 'white'] as const) {
    for (const scale of [1, 1.3, 2] as const) {
      for (const mode of ['bare', 'composited'] as const) {
        for (const pose of ['front', 'three-quarter'] as const) {
          await page.goto(route(colourway, scale, mode, pose))
          const layout = await measureMenu(page)
          expectFixedRowsInFullViewport(
            layout,
            scale === 1 ? 'compact' : 'airy',
            scale === 1 ? 8 : 4,
            scale === 1 ? 1 : 1.25,
          )
        }
      }
    }
  }
})

test('medium density uses the same full viewport and fixed row dimensions', async ({ page }) => {
  await page.goto('/?scale=1&density=medium')
  await expect(page.locator('.wp-panel').first()).toHaveAttribute('data-density', 'medium')
  expectFixedRowsInFullViewport(await measureMenu(page), 'medium', 6, 1)
})

test('the composite probe and device spike share the fixed-row LCD viewport', async ({ page }) => {
  await page.goto('/_spike/device')
  const spike = await measureMenu(page)
  expectFixedRowsInFullViewport(spike, 'compact', 8, 1)

  await page.goto(route('black', 1, 'composited', 'front'))
  const probe = await measureMenu(page)
  expectFixedRowsInFullViewport(probe, 'compact', 8, 1)
  expect(probe.rowHeights).toEqual(spike.rowHeights)
  expect(probe.fontSizes).toEqual(spike.fontSizes)
  expect(probe.listHeight).toBe(spike.listHeight)
  expect(probe.previewHeight).toBe(spike.previewHeight)
})

test('airy state windowing reveals later rows without stretching the four rendered rows', async ({ page }) => {
  await page.goto(route('black', 1.3, 'bare', 'front'))
  const panel = page.locator('.wp-panel')
  await panel.focus()

  const initial = await measureMenu(page)
  expectFixedRowsInFullViewport(initial, 'airy', 4, 1.25)
  expect(initial.labels).toEqual(['Cover Flow', 'Playlists', 'Artists', 'Albums'])

  await panel.press('ArrowDown')
  const advanced = await measureMenu(page)
  expect(advanced.labels).toEqual(['Playlists', 'Artists', 'Albums', 'Songs'])
  expect(advanced.rowHeights).toEqual([21, 21, 21, 21])
  expect(advanced.listHeight).toBe(183)

  await panel.press('ArrowDown')
  await panel.press('ArrowDown')
  await panel.press('ArrowDown')
  const finalWindow = await measureMenu(page)
  expect(finalWindow.labels).toEqual(['Songs', 'Genres', 'Radio', 'Search'])
  expect(finalWindow.rowHeights).toEqual([21, 21, 21, 21])
  expect(finalWindow.listHeight).toBe(183)
})
