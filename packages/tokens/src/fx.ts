/**
 * FX orbit geometry for the two-orbit system (design-system §8.5, §12.0, §14.2).
 *
 * Transcribed from §14.2's implementable form. The radii, step counts and blur
 * values are re-derived at `wheelR` 115 in §12.0's tiling table.
 *
 * ⚑ The blur values are attribution, not aesthetics. LAW 3 channel 2 is
 * continuity: the human halo must read as one continuous field and the agent
 * trail as a stack of discrete slats. With the two actor hues only 1.23:1
 * apart in luminance, the system cannot afford to lose a form channel, so
 * raising `TRAIL.blur` toward `HALO.blur` is an attribution change and not a
 * visual tweak.
 */

/**
 * The human halo's orbit, in px and degrees.
 *
 * `lead` and `trail` are the arc either side of the contact point; `core` is
 * the width of the solid core inside the bloom.
 */
export type HaloGeometry = {
  readonly c: number;
  readonly head: number;
  readonly tail: number;
  readonly lead: number;
  readonly trail: number;
  readonly steps: number;
  readonly blur: number;
  readonly gap: number;
  readonly core: number;
};

/**
 * The agent trail's orbit, in px and degrees.
 *
 * `span` is the whole swept arc, and `gap` is the angular space left between
 * consecutive slats — non-zero here, unlike the halo, because the slats are
 * meant to read as separate.
 */
export type TrailGeometry = {
  readonly c: number;
  readonly head: number;
  readonly tail: number;
  readonly span: number;
  readonly steps: number;
  readonly blur: number;
  readonly gap: number;
};

/** Taper exponent for the human halo's width profile (§14.2). */
export const GAMMA_W: number = 1.6;

/** Taper exponent for the agent trail's width profile (§14.2). */
export const GAMMA_A: number = 2.0;

/**
 * Human halo, rim-centred (§12.0, §14.2).
 *
 * `c` 116 is `WHEEL_R + 1`, straddling the rim: +1px past the recess-shadow
 * reach on the inside, 38px to the silhouette on the outside. `steps` 44 tiles
 * the 176 degrees of `lead + trail` at r116 into 8.10px arcs, and `blur` 4.25
 * clears the 0.5x-step seam-disappearance threshold of 4.05. `gap` is 0
 * because the tiles abut exactly; overlapping them accumulates as
 * 1 - (1 - a)^n and produces bright seams.
 *
 * Angles are degrees, lengths are px.
 */
export const HALO: HaloGeometry = {
  c: 116,
  head: 22,
  tail: 9,
  lead: 34,
  trail: 142,
  steps: 44,
  blur: 4.25,
  gap: 0,
  core: 30,
};

/**
 * Agent trail, travelling inside the wheel's label band (§12.0, §14.2).
 *
 * `c` 76 is 0.660 x `WHEEL_R`: +7px past the Select lip on the inside, +5px
 * inside the recess-shadow reach on the outside. The 46px head span therefore
 * contains the printed labels at r77-79, which is intentional (§8.5).
 *
 * ⚑ `blur` 1.8 is 0.218x the 8.25px step arc — deliberately below the
 * smoothness threshold of 4.13, so the trail stays visibly quantised.
 *
 * Angles are degrees, lengths are px.
 */
export const TRAIL: TrailGeometry = {
  c: 76,
  head: 46,
  tail: 16,
  span: 112,
  steps: 18,
  blur: 1.8,
  gap: 1.4,
};

/**
 * Radius of the co-occurrence repeater ring (§12.0).
 *
 * +16px clear of the halo's outer edge, 22px to the silhouette.
 */
export const REPEATER_R: number = 143;

/**
 * Alpha ceiling for any *persistent* agent state (§8.5, §14.2).
 *
 * Above it the wheel's printed labels drop below 3:1 (measured 3.37:1 at
 * 0.16, 2.46:1 at 0.30). Transient acting states may exceed it; persistent
 * ones may not. Currently moot — idle presence is cut (§12.0) — and retained
 * as a guard in case a persistent state is ever reintroduced.
 */
export const AGENT_ALPHA_PERSIST_MAX: number = 0.18;

/**
 * Width multipliers applied under `prefers-reduced-transparency` (§14.2).
 *
 * Same geometry, no blur, no bloom. Without the scaling the solid substitute
 * carries roughly 1.8x the visual weight of the bloom it replaces and becomes
 * the heaviest object on the device.
 */
export const REDUCED_TRANSPARENCY_SCALE: {
  readonly human: number;
  readonly agent: number;
} = {
  human: 0.558,
  agent: 0.3,
};

/**
 * Stroke width at a point along a trailing arc.
 *
 * @param t - Normalised position along the trailing span, 0 at the head and 1 at the tail.
 * @param head - Width at the head, px.
 * @param tail - Width at the tail, px.
 * @param gamma - Taper exponent: {@link GAMMA_W} for the human halo, {@link GAMMA_A} for the agent trail.
 * @returns Width in px.
 *
 * Direction is carried by extent rather than by colour or opacity, so it
 * survives greyscale and reduced transparency (§8.5). Not clamped: `t`
 * outside 0..1 extrapolates, which is a caller error rather than a
 * meaningful value.
 */
export const taperWidth = (
  t: number,
  head: number,
  tail: number,
  gamma: number,
): number => tail + (head - tail) * Math.pow(1 - t, gamma);

/**
 * Alpha at a point along a trailing arc.
 *
 * @param t - Normalised position along the trailing span, 0 at the head and 1 at the tail.
 * @param peak - Alpha at the head.
 * @param gamma - Taper exponent: {@link GAMMA_W} for the human halo, {@link GAMMA_A} for the agent trail.
 * @returns Alpha in 0..`peak`.
 *
 * ⚑ For persistent agent states the caller must cap `peak` at
 * {@link AGENT_ALPHA_PERSIST_MAX}; this function does not, because transient
 * acting states are allowed to exceed it.
 */
export const taperAlpha = (t: number, peak: number, gamma: number): number =>
  peak * Math.pow(1 - t, gamma);
