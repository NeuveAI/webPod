/**
 * Device geometry, in mobile CSS pixels.
 *
 * Every number here is read from design-system §12.0's R5 table, which is
 * the canvas-reconciled geometry. §12.0 supersedes the §7.3 pixel-mapping
 * table wherever the two disagree — §7.3 still carries the pre-R5 values
 * derived from `wheelR` 106 — so §12.0 is the only column transcribed.
 *
 * The device and panel layers both consume this module so that a radius is
 * never re-derived in two places and allowed to drift.
 */

/**
 * Half the click wheel's outer diameter.
 *
 * §12.0 raised this from the 106 the canvas was built at, restoring 5G
 * fidelity: at 115 the wheel spans 230 of the body's 330, a ratio of 0.697
 * against the real device's 0.699. Every other radius below is expressed
 * as a fraction of it, so this is the one number that moves the wheel.
 */
export const WHEEL_R: number = 115

/** Body width. The authoritative scale: 330px is 61.8mm at 5.3398 px/mm (§7.3). */
export const BODY_W: number = 330

/** Body height, giving a 1.6727 ratio against {@link BODY_W} — 0.12% off the real 5G (§7.3). */
export const BODY_H: number = 552

/** D-067: saved Pencil VWaJS circular enclosure radius. */
export const BODY_CORNER_R: number = 26

/** D-067: VWaJS uses an ordinary circular corner, represented by n = 2. */
export const BODY_CORNER_EXPONENT: number = 2

/** Outer radius of the centre Select button's face (§12.0). */
export const SELECT_R: number = 42

/**
 * Outer radius of the Select button's lip — its stroke plus contact shadow (§12.0).
 *
 * This is the clearance the agent trail's inner edge is measured against:
 * §12.0 places that edge at r53, +7px clear of this value.
 */
export const SELECT_LIP_R: number = 46

/**
 * Inner radius of the printed label band on the wheel — measured, not derived (§12.0).
 *
 * 77 and 79 are what §12.0 reports measuring off the artboard. The band's
 * construction constant `SELECT_R + (WHEEL_R - SELECT_R) x 0.493` lands at
 * 77.99, i.e. inside the measured band rather than at either edge; that is the
 * check, not the source of this number.
 *
 * ⚑ §7.3 states the multiplier is 0.57, which would put the band at r83.6,
 * outside the measured range. §12.0 corrects it to 0.493 and canvas wins
 * (D-021). Both halves are locked by test.
 */
export const LABEL_BAND_INNER_R: number = 77

/** Outer radius of the printed label band (§12.0, measured r77-79). */
export const LABEL_BAND_OUTER_R: number = 79

/**
 * Innermost radius the wheel's recess shadow reaches (§12.0).
 *
 * Bounds two FX edges: the human halo's inner edge sits +1px outside it and
 * the agent trail's outer edge +5px inside it, so shrinking this collapses
 * the separation the two orbits depend on.
 */
export const RECESS_SHADOW_REACH_R: number = 104

/** Panel active-area width in panel px — the real 5G's 50.8mm rounded to an integer (§7.3). */
export const PANEL_W: number = 272

/** Panel active-area height in panel px (§7.3). */
export const PANEL_H: number = 204

/**
 * The single transform applied to the panel container on mobile (§7.4).
 *
 * Exactly 17/20. The panel is authored once at 320x240 and composited with
 * one `scale()`; font sizes are never scaled individually. Hairlines inside
 * the panel are authored as `calc(1px / var(--panel-scale))` so they resolve
 * to one device pixel at any scale.
 */
export const PANEL_SCALE: number = 0.85

/**
 * Click wheel diameter as a fraction of body width.
 *
 * The fidelity check §12.0 states the R5 geometry against: 230/330 = 0.697,
 * versus the real 5th generation's 43.2/61.8 = 0.699. Derived rather than
 * written down so it cannot silently disagree with the radii above.
 */
export const WHEEL_TO_BODY_RATIO: number = (WHEEL_R * 2) / BODY_W
