# Dispatch packet — W3 · Panel DOM: shell, list primitives, S03 / S08 / S13

**Status:** `Ready on W0 + W2.1` · **Lane:** L-D · **Blocked by:** W0, and `packages/state/src/contract.ts` existing

## Read first
`scope.md` · `preview-validation.md` · 001 `design-system.md` §4 (tokens), §5.11 (the art-forward Now Playing panel, both modes), §6 (type, and the minimum-legible-size rule), §7 (geometry), §11 (accessibility math), §13.2–13.3 (component inventory) · 001 `pm-spec.md` §3.1, §10.1–10.6, **§15.1** (per-screen DoD for S13, S03, S08) · `design.pen` artboards via pencil MCP: `A76Ib` M1 Now Playing, `H4QpB` M2 Music Menu, `DLqSo` M1L Light Mode.

Skills: `/interface-craft`, `/web-design-guidelines`, `/interface-design-guardrails`, `/modern-web-guidance`, `/neuve-motion`.

## Correctness target
The 272×204 panel renders as **real DOM** — S03 Main Menu, S08 Album→Tracks, S13 Now Playing — driven by the W2 store and the W1 fixture provider, in **both colourways**, passing every mechanizable gate in 001 §15.

## The rule that defines this lane
> **The panel must remain genuine DOM, because it is the layer WebMCP actuates.** A texture cannot be focused, read by a screen reader, or driven by a tool call. If the panel becomes pixels, the product's thesis dies with it.

`grep -rn 'canvas\|useFrame' packages/panel/` must return **0**. No WebGL, no canvas, no rasterisation, at any fidelity, for any reason.

## Both colourways, together, from the first screen
001 §10.9 and §15.3 failure mode 11: **a screen designed only in dark is not designed.** Dark is where skeuomorphism is easy and everything glows; light inverts **polarity, not hue**. Every state ships a screenshot pair. Specific light-mode requirements you will otherwise miss:
- S03 gains a 1px `black / 10%` column rule and the right pane's ground is 3% darker.
- S13's artwork bloom is `multiply` α0.22 +12% saturation in light, `screen` α0.35 in dark. Verify against a pale-art album **and** a dark-art album, in both.
- S13's success pulse in light mode is a **darkening/saturation** pulse, not a brightening one.
- S08's staged-diff green tint is 8% in dark, **12% multiply** in light. (Staged diff is out of scope for 002 — noted so you build the row primitive able to carry it.)

## Per-screen DoD extracts — the full lists are in §15.1, read them
**S03:** menu rows render **on the first frame**, never blocked on a network call — only counts and the right pane shimmer. Empty slices render **present and dimmed with a `0`**, never hidden; an error renders `—`, never `0`. `Radio` is **absent from the tree**, not greyed, when `supports("stations")` is false.
**S08:** **8 skeleton rows at exactly 26px** so the list cannot reflow when data lands. Drag handles and swipe-to-remove **do not render** when the capability is absent. TanStack Virtual for lists over 100 rows; 60fps on a mid-tier Android.
**S13:** art region **clamps to `actualPx`** and never upscales a sharp image. Rotate default is **volume**, not scrub. Centre-cycles Volume → Scrub → Rate → Lyrics, and the cycle is **three stops, not four**, when `supports("lyrics")` is false. Success is: the object changes, plus one 200ms pulse, plus an in-raster footer row — **no green tick, no toast**. Green is the agent colour and can never mean success.

## Occlusion — the gate you cannot pass at your desk
001 §4.4b: a thumb occludes the inner ring (±33°). Under the contact patch, render **material** state only (depression, bevel, shadow); anything carrying **information** renders where the finger is not. This is §15.3 failure mode 3 — *"on a desktop simulator it looks perfect; the defect only exists when a real hand is on real glass."* **U14 is checked by the owner on a phone. Build for it, flag it in your diary, and do not claim it passed.**

## ⚠ There is exactly ONE device store — D-051
**Import the singleton from `packages/state`. Do NOT call `createDeviceStore()`** — that constructor exists for tests. Two stores means a tool callback mutating state nobody renders, which is the WebMCP thesis silently dead. W2 proved React is unresolvable from `packages/state`, but that only proves the package does not *need* React; it does not stop you handing a `Provider` a fresh store. The failure mode is a component reading a default forever — no type error, no crash.

## ⚠ The index overlay triggers on §9.4's tiers, not §4.4's — D-063
design-system **§9.4 governs wheel motion**, not pm-spec §4.4 (the specialist section wins over the summary table). Fast-scroll tiers are **×1 below 720°/s · ×4 at 720–1080 · ×12 above 1080**, and **only when the list exceeds 40 items**. §4.4's "multiplier ≥ 3" means *second tier or above*, which under §9.4 is **×4** — same rule, correct numbers. §4.4's separate scroll-path trigger (≥5 detents/second) is uncontested and stands. The overlay's own appearance is fully specified in §9.4: 44×44 panel px rounded square, `--ui-statusbar-0/1` gradient, 1px `--ui-divider-strong`, radius 6, initial in Source Sans 3 700 at 28 panel px `--ui-text-1`.

## ⚠ Jotai footgun — D-055
`atom(someFunction)` creates a **derived** atom: Jotai treats the function as the read computation, not as the value. `get(theAtom)()` then throws, with **no type error**. To store a function, box it deliberately. Jotai's outside-React docs are `published: false` and therefore largely absent from training data — read `~/code/agentic-context/jotai/docs/core/store.mdx`, do not recall.

## ⚠ Pin `jotai@2.20.3` exactly — D-043
`packages/state` is deliberately React-free, so the React binding lives in **your** package. **Two Jotai versions in the tree means two module instances**, and a `Provider` from one is invisible to a hook from the other. The symptom is a component reading a default forever — not a type error, not a crash, nothing a gate catches. Pin the exact version, no caret. If it fights you, tell the lead rather than working around it.

## Verification
Playwright keyboard-only traversal S03→S08→S13; axe target-size (U6) and contrast (U7) **in both colourways**; emulated reduced-motion (U3), reduced-transparency (U4), contrast-more (U5); Dynamic Type to 200% with no clipping, and ≥130% forcing `airy` density and scaling the raster 1.0→1.25 **rather than clipping** (U11); screenshot pairs per state. Plus per-package tsc, lint, gates.

## Guardrails
Own `packages/panel/**` and `apps/web/src/routes/index.tsx` + root layout. **W4 owns every file prefixed `_spike.` — do not touch them, and do not add anything to a shared route manifest (routes are file-based, so there isn't one).** Never write `packages/state/src` or `packages/device`.

## Artifacts
`diary/w3.md` · `decisions/w3.md` · `evidence/w3-*` incl. the screenshot pairs · review `reviews/w3-review.md` (lane L-D)

## Commits
`feat(panel): panel shell and list primitives` → `feat(panel): main menu, album tracks, now playing`
