export const SITE_ORIGIN = 'https://webpod.vercel.app'
export const SOCIAL_TITLE = 'webPod — A thousand songs. That same feeling!'
export const SOCIAL_DESCRIPTION = 'Music can be more tactile. Play your Apple Music or Spotify library in a recreated iPod Classic, right in your browser.'
export const SOCIAL_IMAGE_ALT = 'webPod: A thousand songs. That same feeling! A black iPod Classic with its music menu and click wheel on a dark background.'

/** Static, public URLs: crawlers cannot authenticate or render the WebGL player. */
export function socialHead(pathname: string) {
  const canonical = new URL(pathname === '/webpod' ? '/webpod' : '/', SITE_ORIGIN).href
  return {
    meta: [
      { title: SOCIAL_TITLE },
      { name: 'description', content: SOCIAL_DESCRIPTION },
      { name: 'theme-color', content: '#171b22' },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'webPod' },
      { property: 'og:locale', content: 'en_US' },
      { property: 'og:title', content: SOCIAL_TITLE },
      { property: 'og:description', content: SOCIAL_DESCRIPTION },
      { property: 'og:url', content: canonical },
      { property: 'og:image', content: `${SITE_ORIGIN}/social/webpod-og-v1.jpg` },
      { property: 'og:image:type', content: 'image/jpeg' },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:image:alt', content: SOCIAL_IMAGE_ALT },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: SOCIAL_TITLE },
      { name: 'twitter:description', content: SOCIAL_DESCRIPTION },
      { name: 'twitter:image', content: `${SITE_ORIGIN}/social/webpod-x-v1.jpg` },
      { name: 'twitter:image:alt', content: SOCIAL_IMAGE_ALT },
    ],
    links: [{ rel: 'canonical', href: canonical }],
  }
}
