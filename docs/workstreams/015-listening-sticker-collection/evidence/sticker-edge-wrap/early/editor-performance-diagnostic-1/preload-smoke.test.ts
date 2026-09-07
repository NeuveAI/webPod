import { test, expect } from 'bun:test'
test('diagnostic preload installed before launch', async () => {
  const path = new URL('./preload-installed.json', import.meta.url)
  const marker = await Bun.file(path).json()
  expect(marker.preloadSHA256).toMatch(/^[a-f0-9]{64}$/)
})
