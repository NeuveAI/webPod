# Social previews

The root document serves Open Graph and X card tags in its initial HTML, including
when the landing/player components run only in the browser. Both `/` and `/webpod`
have production canonical URLs; query parameters are excluded. No account handles
or Meta app IDs are fabricated.

The public images use the real device model and bundled site fonts:

- `/social/webpod-og-v1.jpg` — 1200 × 630, default Open Graph preview.
- `/social/webpod-x-v1.jpg` — 1200 × 600, X large-image card.
- `/social/webpod-square-v1.jpg` — 1080 × 1080, direct social upload artwork.

Facebook and WhatsApp can consume the Open Graph preview. X has explicit Twitter
card tags. Individual clients control cropping, caching, and whether a preview is
shown. The square image is an upload asset for Instagram, not an Instagram-specific
meta tag or a guarantee that Instagram renders links as cards.

With the local app running, regenerate the images using:

```sh
bun apps/web/scripts/generate-social-cards.ts
```

Review all three images before committing. To invalidate previously cached artwork,
increment the filename version in the generator and metadata together. Build, then
verify the real server response and public images:

```sh
bun run build
bun test apps/web/scripts/social-preview.test.ts
```

After deployment, request a fresh scrape in the Facebook Sharing Debugger if an old
preview persists. Platform caches may retain previews of previously shared URLs.

References: [Open Graph](https://ogp.me/),
[Meta sharing](https://developers.facebook.com/docs/sharing/webmasters/).
