# Playback fidelity decisions

## DPF-01 — latest owner direction supersedes 5px and 9px geometry

- Determinate playback, pending/loading, and volume share a `14px` outer height and
  `12px` interior at `y153..167`. Progress/loading remain `236px` wide; volume is
  `202px` wide between the speaker endpoints.
- The existing 5px and 9px implementations and their approving reviews remain
  historical evidence, not the acceptance target for this correction.

## DPF-02 — Aqua material is one cylindrical object across all three states

- Determinate and volume share one continuous vertical fill: pale top, darker blue
  waist around the midpoint, and pale lower roll-off. The well is concave and its
  depth comes from soft inset/cast shadows, never a separately colored bottom row.
- Loading composes 45-degree, 50/50 blue/light ribs underneath the identical
  cylindrical lighting. The projected repeat is `22px`, gradient-space repeat is
  `15.56px`, and the loop translates exactly `22px` over 3.2s. Reduced motion
  freezes at the `11px` half phase.
- The PM memo's starting tokens and pixel-luminance/discontinuity thresholds are
  binding until owner visual approval; generic flat/no-gradient advice is not.

## DPF-03 — volume is a transient replacement state

- A human accepted volume change swaps the progress/time band for an equal-height
  speaker-to-speaker volume control without moving artwork or metadata.
- Default dwell is 1500ms after the last value-changing input. It may be tuned only
  within 1250–1750ms after owner observation.
- The implementation default uses a `202x14` trough at `x35, y153`, `13px`
  speaker glyphs, `4px` gaps, a `1px` rim, and a `1.5px` squared-soft radius.

## DPF-04 — quadrant means the whole annular sector

- The current label-centered hit disks are explicitly superseded.
- Every point in `37 < r <= 103` belongs to one deterministic 90-degree cardinal
  sector. Rotation is distinguished by movement/cancellation, not spatial dead
  zones. Center owns `r <= 37`.
- A release at no more than `10px` travel in the same sector remains a cardinal
  tap. Travel above `10px` or any sector crossing transfers the pointer sequence
  to rotation and permanently cancels the cardinal candidate.

## DPF-05 — presentation priority is a render invariant

- Pending/loading and terminal failure outrank the transient volume replacement.
- Leaving standard Now Playing, entering another center-button mode, Menu/root
  navigation, or a track identity change dismisses the transient immediately.
- The standard progress/timing and volume replacement share a fixed upper layout:
  titlebar `272x21`, artwork `86x86` at `(18,58)`, and metadata at `x116`.

## DPF-06 — volume swaps synchronously and follows queue occurrence identity

- Volume fill has no transition. Accepted human changes replace the lower row and
  render their exact determinate endpoint in the same committed state; playback
  progress retains its existing `120ms` determinate transition.
- Track-change dismissal compares provider, catalog identity, local key, and
  provider queue index. The queue index is required because duplicate occurrences
  of the same catalog song remain distinct playback identities.
- Rendering is synchronously gated on that occurrence identity, while an effect
  clears the shared Jotai atom afterward. A new track therefore never paints one
  stale frame of the prior track's volume overlay.

## DPF-07 — the shared radial seam belongs to Select in mounted input

- At the coincident `r=37` Three.js hit edge, the annulus handler returns before
  propagation or capture. The center hit therefore owns `r <= 37`; annular
  cardinal handling begins only above `37`.
- Oblique proof uses the mounted production orientation transform and projected
  screen coordinates for mouse, touch, and pen. Pure mapper arithmetic is not
  accepted as evidence for camera-angle behavior.

## DPF-08 — a pending scrub intent outranks passive playback reconciliation

- While a new scrub wheel intent has not yet been consumed, the scrub-control
  configuration effect preserves the current wheel value instead of resetting it
  from the provider clock. This prevents effect ordering from erasing the value
  between intent publication and preview-state transition.

## DPF-09 — owner approval remains mandatory

- Geometry, timing, state, and mapping have deterministic proof.
- Period resemblance and physical feel remain human-judgment outcomes. PM and
  independent review do not replace owner validation.

## DPF-10 — owner rejects flat/hard-edged Aqua material

- The attached Aqua specimen is the primary cross-section authority. It shows
  equal-height determinate and indeterminate controls with a rounded recessed well,
  cylindrical top/waist/bottom shading, and ribs modulated by the same lighting.
- The prior flat three-stop fill and opaque dark bottom row are rejected. Evidence
  must include equal-height detail comparisons and row-by-row pixel measurements,
  not only computed CSS tokens.
- The owner's second correction explicitly rejects the uniform gray frame produced
  by `border: 1px solid`. The trough must expose separate exterior shadow,
  asymmetric molded lip, inner recess seam, and concave empty-channel layers, with
  the PM memo's vertical, horizontal, and corner pixel thresholds.

## DPF-11 — the trough is a layered molded object, not a border

- The one-pixel authored geometric inset remains, but a uniform `border: 1px`
  surround is forbidden. The rendered hierarchy is separately inspectable:
  asymmetric top/side/bottom lip, inner recess seam, concave empty channel, and a
  detached two-stage exterior cast shadow.
- Outer radii are `2px 2px 1px 1px`; channel radii are
  `1.5px 1.5px .5px .5px`. The top/left highlight and bottom/right return use
  different luminance, preserving the primary raster's molded corner behavior.
- The PM resolved the shadow/compositing threshold with semantic colourway alpha:
  dark LCD `26%/12%`, light LCD `10%/5%`, while keeping identical neutral-black
  `0 1px 1px` and `0 2px 2px` geometry. Only exterior cast opacity varies;
  lip, seam, channel, fill, and radii remain invariant.
- Rendered vertical, horizontal, shadow, and corner profiles are acceptance
  evidence equal in status to fill colour. The owner-rejected flat-frame crop stays
  on the final close-up board as an explicit anti-reference.

## DPF-12 — loading motion advances rib phase, not material geometry

- The trough, seam, cylindrical cross-section, specular lighting, and rounded
  endcaps remain stationary. Only the repeating rib layer's background position
  advances by one exact `22px` projected period over `3200ms` with linear timing.
- Moving the finite rounded pseudo-element was rejected because its edge entered
  the stable channel at the forced `22px` endpoint and produced a maximum RGB
  delta of `15`, despite an exact computed transform. Stationary geometry with
  rib-only phase movement produces a rendered t0-to-t3200 maximum channel delta
  of `0`; the t1600 frame resolves to the exact `11px` half phase.
- Reduced motion disables animation and renders the same stationary material at
  the representative `11px` background-position phase.
