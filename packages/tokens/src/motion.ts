/**
 * Motion physics (design-system §9.1, §12.1).
 *
 * ⚑ Springs are not CSS. No CSS primitive expresses stiffness, damping and
 * mass, so these ship as TS consumed by the motion layer and by R3F rather
 * than as custom properties in the token sheet. Durations and easings that
 * *are* CSS-expressible live in `globals.css` instead, and are not repeated
 * here.
 */

/** A spring, in the stiffness/damping/mass form both the motion layer and R3F take. */
export type Spring = {
  readonly stiffness: number;
  readonly damping: number;
  readonly mass: number;
};

/**
 * The named springs (§9.1).
 *
 * ⚑ LAW 4: none of these may be passed to an agent-originated animation.
 * Motion physics is attribution channel 4 — springs read as a hand, and an
 * agent that gets one reads as a human. Gate at one call site on
 * `source !== 'agent' && source !== 'system'` and use {@link agentEase}
 * for the other branch.
 */
export const spring = {
  detent: { stiffness: 900, damping: 34, mass: 0.6 },
  press: { stiffness: 700, damping: 30, mass: 0.8 },
  select: { stiffness: 480, damping: 26, mass: 1.0 },
  panel: { stiffness: 320, damping: 28, mass: 1.0 },
  bloom: { stiffness: 260, damping: 18, mass: 0.9 },
  flip: { stiffness: 180, damping: 22, mass: 1.4 },
  settle: { stiffness: 1200, damping: 48, mass: 0.5 },
} as const satisfies Record<string, Spring>;

/**
 * The agent's motion vocabulary: duration plus easing, never a spring (§12.1).
 *
 * ⚑ The cubic-beziers have y1 = 0 and y2 = 1, so the curve cannot overshoot.
 * `step` is `linear` outright. That flatness is the point — it is what makes
 * agent motion legible as not-a-hand under LAW 4.
 *
 * `duration` is milliseconds; `easing` is a CSS easing value.
 */
export const agentEase = {
  micro: { duration: 140, easing: "cubic-bezier(.2,0,.4,1)" },
  step: { duration: 220, easing: "linear" },
  flip: { duration: 520, easing: "cubic-bezier(.35,0,.35,1)" },
} as const;
