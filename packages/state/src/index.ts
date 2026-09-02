/**
 * `@webpod/state` — device state, reachable from outside React.
 *
 * The public surface is `./contract`: types, constants and atoms. Everything
 * else in this package implements a function type declared there, and is
 * re-exported here alongside it.
 *
 * ⚑ `./store` is enumerated rather than re-exported wholesale, for one reason:
 * `createDeviceStore` must **not** be reachable from this entry point. There
 * is exactly one device per document and it is {@link deviceStore}; the
 * factory lives at `@webpod/state/testing`, so the import a consumer would
 * write to build a second one does not resolve. `export * from './store'`
 * would quietly undo that, which is why the list below is explicit and why a
 * name added to `store.ts` does not become public by default.
 *
 * `./internal` is deliberately absent, and the package's `exports` map does
 * not expose it either.
 */
export * from './contract'
export * from './announce'
export * from './detent'
export * from './menu'
export * from './silence'
export * from './screen'

export {
  acceptedExternalPressActionAtom,
  coastActionAtom,
  detentActionAtom,
  deviceStore,
  endGestureActionAtom,
  flushAnnouncementsActionAtom,
  moveHighlightActionAtom,
  popScreenActionAtom,
  pressActionAtom,
  pushScreenActionAtom,
  resetInputState,
  resetStackActionAtom,
  setDensityActionAtom,
  setDynamicTypeScaleActionAtom,
  startAnnouncer,
} from './store'
export type { AnnouncerDriverOptions, TimerHandle } from './store'
