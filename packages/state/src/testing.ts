/**
 * The test-only entry point.
 *
 * ⚑ Reachable as `@webpod/state/testing` and **not** from `@webpod/state`.
 * That separation is the point rather than a filing convention: the one thing
 * in here builds a second device, and a second device in a running document is
 * a defect with no symptom.
 *
 * A tool callback runs outside React and addresses the module singleton. A
 * React tree handed `<Provider store={createDeviceStore()}>` addresses a
 * different object. Both are valid stores, both are React-free, both pass
 * every test in this package — and the tool is then moving a screen nobody is
 * looking at, with no type error and nothing at runtime to report it. So the
 * import a consumer would reach for does not resolve, and the function throws
 * if it is reached anyway.
 *
 * Production code imports `deviceStore` from `@webpod/state` and hands the
 * `Provider` that.
 */

export { createDeviceStore } from './store'
export type { CreateDeviceStoreOptions } from './store'
