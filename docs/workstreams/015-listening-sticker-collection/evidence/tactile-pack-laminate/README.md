# Printed packet laminate evidence

The previous packet had a standard-material paper exterior. The visible front and printed fold surfaces now receive a matte protective coat, while the interior cap and cut/bevel rim retain rough raw-paper materials. The neighboring sleeves use the same exterior recipe. Existing liner and vinyl finishes, immutable art, lighting and gestures are unchanged.

## Actual product captures

`coated/` contains final production-route captures: sealed/open desktop and 375px phone, plus partial peeling/contact. This is the existing native Start/cookie/SQLite browser flow, with only trusted upstream Apple/signing fixtures. It is not an alternate material renderer. The desktop packet lies off-axis in the existing perspective camera; the phone packet is nearly central. No dedicated packet rotation or manipulated proof-only pose is claimed.

`comparison-no-coat/` is an explicitly **comparison-only isolated source snapshot**, captured through that same actual product flow under identical lighting. It disables only the exterior protective coat response. It must not be confused with the final deployed-source validation. Its complete source and client/server identity are in its `browser-verification.json`.

Compared with the final source, that snapshot has `SLEEVE_LAMINATE.clearcoat=0` and inactive `clearcoatRoughness=.42`; final coating has coverage `1` and roughness `.28`. Clearcoat roughness has no rendering effect when coat coverage is zero. The comparison runner predates the later screenshot-only phone-sealed capture and accurate material-description label. No material/art/state/light differences besides the coating recipe contribute to the paired images. Separate source fingerprints record those exact differences.

## Visual judgment

The first .55-coverage/.42-roughness iteration passed source and runtime checks but was rejected as too imperceptible. Its average phone packet-region change was roughly 1–3 RGB levels. Merely adding a clearcoat property was insufficient.

The final coat produces a broad cool satin bloom on the upper-left phone packet, with a gradual transition across its warm printed face. The raw rim remains darker/matte. The artwork stays colored and legible without a white glare streak. Desktop response is much subtler under its off-axis position. The independent reviewer inspected the paired phone images and desktop open sheet and accepted this as restrained protective laminate on paper; it does not turn the object into wet plastic or foil. This is a stylized material analogy, not measured manufacturing optics or a claim of owner taste approval.

`pixel-comparison.json` supports attribution: phone upper-left sample changes from RGB194/138/108 to194/146/123. Region averages include unchanged printed art/type and are not acceptance thresholds. No difference amplification, false-color image or pixel zoom substitutes for the normal-scale captures.

## Reproduction and provenance

Final source identity: `78f9687938df885fef966c105f25b3a8c6498b5bf1c8fcec2a232598ea6c511e`, 376 files. The final `coated/browser-verification.json` reports client/server hashes and full native route results. `source-files.json` hashes the changed source files. Existing historical collection evidence remains untouched.

Commands:

```sh
bun test packages/device/src/sticker-sleeve.test.ts packages/device/src/sticker-paper.test.ts
bun run --cwd packages/device typecheck
bun run --cwd apps/web typecheck
bunx --bun eslint packages/device/src/StickerPackScene.tsx packages/device/src/sticker-sleeve.ts packages/device/src/sticker-sleeve.test.ts apps/web/scripts/sticker-browser.integration.test.ts
bun run --cwd apps/web build
WEBPOD_STICKER_EVIDENCE_DIR=/absolute/output/path bun test apps/web/scripts/sticker-browser.integration.test.ts
```

The comparison uses `prepareBrowserSourceSnapshot` from scripts/browser-source-fingerprint.ts, with its exclusions for certificates, environment files, databases, design documents and build outputs. Dependencies install with `bun install --frozen-lockfile --ignore-scripts`; only the isolated copy's laminate coverage is disabled. No shared production source is temporarily changed. Retained logs accompany the screenshots; redundant repeated gesture screenshots from calibration were removed after inspection.
