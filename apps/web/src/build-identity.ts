/** Vite replaces this value identically in client and Start server builds. */
declare const __WEBPOD_BUILD_ID__: string
export const APP_BUILD_ID = typeof __WEBPOD_BUILD_ID__ === 'undefined' ? 'development' : __WEBPOD_BUILD_ID__

/** Only bounded opaque build UUIDs can enter state or the reload URL. */
export function isBuildIdentity(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)
}
