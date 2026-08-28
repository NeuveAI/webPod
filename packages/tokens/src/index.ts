/**
 * `@webpod/tokens` — the single source of colour, type, spacing, radius,
 * duration, easing, geometry and motion physics.
 *
 * The CSS half ships as `./globals.css` (design-system §12.1, transcribed
 * verbatim), including the shadcn semantic mapping of §12.2 and both
 * colourways. ⚑ Light is an inversion of polarity, not of hue: the two modes
 * are the product (LAW 5), so neither is a filter over the other.
 *
 * The TS half is everything CSS cannot hold — the geometry the device and
 * panel layers share, the FX orbit constants, and the springs.
 */
export * from './geometry'
export * from './fx'
export * from './motion'
