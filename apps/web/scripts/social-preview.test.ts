import { expect, test } from 'bun:test'
import { startWebPod } from './start'
import { SITE_ORIGIN, SOCIAL_DESCRIPTION, SOCIAL_TITLE } from '../src/social-meta'

test('production HTML exposes social cards without JavaScript or authentication', async () => {
  const app = await startWebPod({ port: 0 })
  try {
    for (const route of ['/', '/webpod']) {
      const response = await fetch(new URL(`${route}?shared=1`, app.server.url), { headers: { 'user-agent': 'facebookexternalhit/1.1' } })
      expect(response.status).toBe(200)
      const html = await response.text()
      const head = html.slice(0, html.indexOf('</head>'))
      expect(head).toContain(`<title>${SOCIAL_TITLE}</title>`)
      expect(head).toContain(`content="${SOCIAL_DESCRIPTION}"`)
      expect(head).toContain(`property="og:url" content="${SITE_ORIGIN}${route}"`)
      expect(head).toContain(`rel="canonical" href="${SITE_ORIGIN}${route}"`)
      expect(head).toContain('name="twitter:card" content="summary_large_image"')
      expect(head).toContain('property="og:image:width" content="1200"')
      expect(head).toContain('property="og:image:height" content="630"')
      for (const [attribute, key] of [['property', 'og:image'], ['name', 'twitter:image']] as const) {
        const imageUrl = new RegExp(`${attribute}="${key}" content="([^"]+)"`).exec(head)?.[1]
        expect(imageUrl).toBeDefined()
        if (!imageUrl) throw new Error(`Missing ${key}`)
        expect(new URL(imageUrl).origin).toBe(SITE_ORIGIN)
        const asset = await fetch(new URL(new URL(imageUrl).pathname, app.server.url))
        expect(asset.status).toBe(200)
        expect(asset.headers.get('content-type')).toContain('image/jpeg')
        const bytes = new Uint8Array(await asset.arrayBuffer())
        expect([...bytes.slice(0, 3)]).toEqual([0xff, 0xd8, 0xff])
        expect(bytes.length).toBeLessThan(1_000_000)
      }
    }
  } finally {
    app.server.stop(true)
  }
})
