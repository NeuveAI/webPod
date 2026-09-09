import { expect, test } from '../../../packages/panel/node_modules/@playwright/test/index.mjs'
import { installDeterministicAppleMusic } from './deterministic-apple-music'

test.use({ channel: 'chrome', launchOptions: { args: ['--enable-blink-features=CanvasDrawElement'] } })

for (const authorized of [true, false]) {
  test(`desktop landing fits the viewport with authorized=${authorized}`, async ({ page }) => {
    await installDeterministicAppleMusic(page, { authorized })
    await page.goto('/')
    await expect(page.locator('.webpod-welcome__footer')).toBeVisible()
    for (const viewport of [
      { width: 1920, height: 1080 }, { width: 1456, height: 946 },
      { width: 1366, height: 768 }, { width: 1280, height: 600 },
      { width: 1024, height: 480 }, { width: 800, height: 600 },
    ]) {
      await page.setViewportSize(viewport)
      await expect.poll(() => page.evaluate(() => {
        const selectors = '.webpod-welcome__masthead,.webpod-welcome__intro,.webpod-welcome__play-action,.webpod-welcome__caption,.webpod-welcome__footer,.webpod-welcome__model'
        const outside = Array.from(document.querySelectorAll(selectors)).filter(element => {
          const box = element.getBoundingClientRect()
          return box.top < -1 || box.left < -1 || box.bottom > innerHeight + 1 || box.right > innerWidth + 1
        }).map(element => element.className)
        const intro = document.querySelector('.webpod-welcome__intro')?.getBoundingClientRect()
        const action = document.querySelector('.webpod-welcome__play-action')?.getBoundingClientRect()
        if (!intro || !action) throw new Error('Landing intro and play action must be present')
        return { outside, overlaps: intro.bottom > action.top + 1, scrolls: document.documentElement.scrollHeight > innerHeight + 1 }
      }), { message: `All landing content must fit ${viewport.width}×${viewport.height}` }).toEqual({ outside: [], overlaps: false, scrolls: false })
    }
  })
}

test('reload and tab return keep the footer and portal on the same frame boundary', async ({ page, context }) => {
  await installDeterministicAppleMusic(page)
  const other = await context.newPage()
  await other.goto('about:blank')
  await page.bringToFront()
  await page.goto('/')
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.reload()
    await expect(page.locator('.webpod-welcome__footer')).toBeVisible()
    const bounds = () => page.evaluate(() => {
      const footer = document.querySelector('.webpod-welcome__footer')?.getBoundingClientRect()
      return { bottom: footer?.bottom, height: innerHeight, top: document.querySelector('main')?.getBoundingClientRect().top }
    })
    await expect.poll(async () => {
      const box = await bounds()
      return box.bottom === box.height && box.top === 0
    }).toBe(true)
    const before = await bounds()
    await other.bringToFront()
    await page.bringToFront()
    expect(await bounds()).toEqual(before)
  }
  await page.getByRole('link', { name: /Lets get playing/ }).click()
  await expect(page.locator('.device-reveal-portal')).toBeAttached()
  for (const height of [600, 900, 700]) {
    await page.setViewportSize({ width: 1280, height })
    await expect.poll(() => page.evaluate(() => {
      const room = document.querySelector('.webpod-device-preview')?.getBoundingClientRect()
      const portal = document.querySelector('.device-reveal-portal')?.getBoundingClientRect()
      return !!room && !!portal && room.bottom === innerHeight && portal.bottom === room.bottom
    })).toBe(true)
  }
  await other.close()
})

test('landing teaser descends before the demo loop and skips travel for reduced motion', async ({ page }) => {
  await installDeterministicAppleMusic(page)
  await page.goto('/')
  const teaser = page.locator('[data-teaser-entrance]')
  await expect(teaser).toHaveAttribute('data-teaser-entrance', 'entering')
  const entry = await teaser.evaluate(element => {
    const animation = element.getAnimations()[0]
    const frames = animation?.effect instanceof KeyframeEffect ? animation.effect.getKeyframes() : []
    return { first: frames[0]?.transform, last: frames.at(-1)?.transform }
  })
  expect(entry.first).toMatch(/^translateY\(-/)
  expect(entry.last).toBe('translateY(0px)')
  await expect(teaser).toHaveAttribute('data-teaser-entrance', 'complete')
  expect(await teaser.evaluate(element => getComputedStyle(element).transform)).toBe('none')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await expect(teaser).toHaveAttribute('data-teaser-entrance', 'complete')
  expect(await teaser.evaluate(element => element.getAnimations().length)).toBe(0)
})
