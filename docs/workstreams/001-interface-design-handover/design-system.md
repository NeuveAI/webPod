# webPod — Visual System Specification

**Version** 1.0 · **Owner** Visual Design · **Audience** implementation engineers, PM, canvas agent
**Deliverable class** normative. Every number here is a token value, not an illustration.
**Reconciled against** iOS HIG (`visual-design.md`, `liquid-glass.md`, `motion-animation.md`, `accessibility.md`), Interface Craft design-critique methodology.

---

## Revision log

**R2 (client review).** Five changes, applied throughout. Everything not listed here is unchanged from R1 and still holds.

| # | Change | Sections touched |
| --- | --- | --- |
| 1 | **Actor hues overruled.** Human = Tailwind `sky`, agent = Tailwind `green`. Apple Music crimson demoted to a brand-only token. Green can no longer mean success. | LAW 3, LAW 4 (new), §4.7–4.11, §8, §11.1, §11.3 |
| 2 | **Tokens are Tailwind-based** wherever a palette value can serve; materials exempt, their neutrals rebased on `slate`. shadcn semantic mapping added. | §4.13 (new) |
| 3 | **Light and dark are both first-class.** Light = white polycarbonate in a light room; dark = black polycarbonate in a dark room. Panel gets a themed tint, not neutral grey. | §4.1, §4.14 (new), §5 |
| 4 | **Art-forward Now Playing specified in both modes**, with a provable contrast floor. | §5.11 (new) |
| 7 | **R4 — mapping reconciled to the built canvas** (body 330 × 552, `wheelR` 106, panel scale 0.85); halo moved onto the rim and both trails re-tapered; **width taper promoted to a first-class primitive**; exact-tiled arc rendering specified. | §5.1, §5.3 L8, §7.3, §7.4, §7.6, §8.5 (rewritten), §8.6, §8.10, §11.2 |
| 6 | **R3 — orbits inverted on ergonomic grounds.** Human moves outside the wheel as a directional halo; agent moves inside to the thumb-travel band as a ghost-thumb trail. Occlusion promoted to a first-class geometric constraint, which caught three latent defects in the existing spec. | LAW 3 ch.1 (restated), §4.5, §7.6 (new), §8.3, §8.5 (rewritten), §8.6, §8.10, §11.3 |
| 5 | **Mobile composition stripped.** Agent-idle pill, Activity tray, ticker and app bar cut; agent presence relocated onto the device as a two-orbit system; composition audit added. | §8.3, §8.5 (rewritten), §8.7 |

**Consequence of change 1, stated up front because it governs everything after it.** The R1 pair (crimson 353° / cyan 189°) was 164° apart. The R2 pair is **81° apart in OKLCH** (sky-400 H=232.7°, green-400 H=151.7° — note this is 81°, not the ~57° an HSL reading suggests). Measured against the three failure conditions:

| Condition | R1 crimson/cyan | R2 sky/green | Verdict |
| --- | --- | --- | --- |
| Deuteranopia (ΔE OKLab ×100) | crimson collapses to ochre | **20.5** (sky-400/green-400) | **R2 is better.** Blue survives red-green deficiency; crimson did not. |
| Protanopia | poor | **20.7** | **R2 is better.** |
| Greyscale (WCAG ratio between the two) | 1.94:1 | **1.23:1** | **R2 is worse.** |
| Tritanopia (ΔE) | good | **4.7** | **R2 is much worse.** Blue and green converge under blue-yellow deficiency. |

⚑ **Ruling: hue is demoted from a primary attribution channel to a confirmatory one, and is now ranked last of seven.** No attribution decision in webPod may depend on the user perceiving the difference between sky and green. The five form channels (§LAW 3) each carry the load independently. This is not a hedge — it is the only defensible reading of the numbers above, and it makes the system *more* robust than R1, because R1 was quietly leaning on a hue difference that also failed greyscale.

---

## 0. How to read this document

| Convention | Meaning |
| --- | --- |
| `--token-name` | CSS custom property. Ship exactly this name. |
| `position: hex` | Gradient stop. Position is a percentage along the gradient axis. |
| `0 2px 4px 0 #000000 / 24%` | `offset-x offset-y blur spread color / alpha`. |
| **inner** / **outer** | Shadow type. `inset` in CSS. |
| **inner** / **center** / **outer** | Stroke alignment. CSS has only center; inner is `inset 0 0 0 Npx`, outer is `0 0 0 Npx`. |
| `panel px` | A coordinate in the 320 × 240 screen space, before the panel's uniform scale transform. |
| `mm` | Millimetres on the real iPod 5th generation, used to derive pixel values. |
| ⚑ LAW | Non-negotiable. A change here is a redesign, not a tweak. |

Three global laws are stated up front because every later section depends on them.

### ⚑ LAW 1 — The Material Boundary

> **The device is skeuomorphic. Everything not the device is Liquid Glass. Nothing is both.**

The iPod body, its steel back, its click wheel, its cover glass and its 320 × 240 panel are rendered as a physical object under a single fixed light. The sidecar, overlays, sheets, consent interrupts, agent ticker, toasts and browser-level chrome are rendered as iOS 26 Liquid Glass — translucent, blurred, floating, no gloss, no bevel, no inner highlight.

**Why.** Liquid Glass earns its keep as a *functional layer that sits above content* (per `liquid-glass.md`: "Never use Liquid Glass in the content layer"). In webPod the device **is** the content layer — it is the thing being looked at. Applying glass to the device would flatten it into the same optical plane as the controls and destroy the one illusion the product is built on. Conversely, applying skeuomorphism to the sidecar would produce 2005 pastiche: beveled buttons, pinstripes, brushed-metal panels — the exact failure mode named in the thesis. The boundary is not a compromise; it is the composition. The device is an object *in a room*; the glass is the *instrument panel* you hold up to it.

**Enforcement test.** Any element you can name must be classifiable as DEVICE or GLASS in under two seconds. Elements that resist classification are design errors. There is no third category and no gradient between them.

### ⚑ LAW 2 — One Light

> **A single key light at 12 o'clock, 18° behind the viewer, plus one cool fill from the lower-left at 22% intensity. Every highlight, every shadow, every gradient direction in this document derives from it.**

Gradient angles are therefore not free parameters. Body and wheel gradients run `180deg` (top-light). The steel back runs `168deg` (top-light, skewed 12° to break symmetry, because perfectly axial metal reads as a printed gradient). Contact shadows fall down and 4px right. Specular arcs sit on the top-left third of any convex form. Fill light produces the faint cool rim on lower-left edges.

**Why.** Material Honesty (facet 1) is entirely a question of light consistency. A viewer cannot articulate "the specular on the center button contradicts the specular on the bezel," but they will report the whole thing as "fake." One light, stated numerically, is how the object becomes believable.

### ⚑ LAW 3 — Attribution Is Carried By Form, Never By Colour

> **Human and agent are distinguished on seven simultaneous channels. Five of them are pure form and survive greyscale, every colour-vision deficiency, and a still frame. Hue is ranked sixth. It is confirmatory decoration and nothing is allowed to depend on it.**

Measured, on the panel: `sky-400 #38BDF8` against `green-400 #4ADE80` is **1.23:1** in relative luminance and **ΔE 4.7** under simulated tritanopia. Two marks in those colours are, for a meaningful number of users and in any greyscale reproduction, *the same mark*. Colour cannot be the answer. Form is.

| # | Channel | Human | Agent | Greyscale-safe | CVD-safe |
| --- | --- | --- | --- | --- | --- |
| 1 | **Locus & occlusion** | **on the rim** — an emissive **halo** straddling the wheel edge, centreline `r = wheelR + 1`. It is the light that escaped around the thumb. | **inside** the wheel — a hard, slatted **band** on the thumb-travel path, `r ≈ 0.66 · wheelR`. It is the gesture that was not made. | ✓ | ✓ |
| 2 | **Continuity** | an unbroken continuous field, no edges at all | **18 discrete dashed segments**, hard-edged | ✓ | ✓ |
| 3 | **Geometry** | annular bloom / radial falloff | **hexagon** / arc segments / ticks | ✓ | ✓ |
| 4 | **Motion physics** | spring, with visible overshoot | duration + linear, terminal velocity zero, **never** overshoot | ✓ | ✓ |
| 5 | **Typeface** | no label, ever | always labelled, IBM Plex Mono uppercase `+0.06em` | ✓ | ✓ |
| 6 | **Hue** | sky (≈233°) | green (≈152°) | ✗ **1.23:1** | ✗ **ΔE 4.7 tritan** |
| 7 | **Sound / haptic** | pitched, soft attack; vibrates | unpitched relay tick, 4–6 dB quieter; **never** vibrates | ✓ | ✓ |

⚑ **Any three of channels 1–5 must be sufficient to attribute an action.** Channels 6 and 7 never count toward that three. Every FX in §8 is audited against this and the audit is in §11.3.

#### ⚑ Channel 1, stated canonically — "light escaping around my thumb" vs "the gesture I did not make"

This is the load-bearing channel and it deserves its argument in full.

**A thumb on the click wheel occludes the ring it is touching.** Measured (§7.6): a 95th-percentile adult thumb contact patch is 11–13mm — **54–64px** at the shipped mobile scale — and the thumb shaft behind it is ~20mm wide, subtending a **±33° wedge** at the trail radius. Any feedback drawn under that contact is feedback nobody can see. R1 and R2 both drew the human's response *at the point of contact*, which means the person performing the gesture was the one person who could not see its result. That is not a polish issue; it is a functional defect, and it survived two revisions because it looks correct in a static mock where no hand is present.

**So the two actors take the two sides of the occlusion boundary, and each takes the side that is legible for it.**

- **Human → outside, as a halo.** Human feedback must *escape* the contact. It blooms outward past the thumb's footprint onto the polycarbonate, where the hand is not. This is also what backlit contact physically looks like: press a finger against a lit surface and what you see is the light that got around your finger. The primitive is a soft radial bloom, not a stroke, because a bloom is the shape light makes when it escapes an obstruction.
- **Agent → inside, as a ghost thumb.** The inner band is never occluded during agent action, because there is no thumb there — and it is exactly the path a thumb *would* sweep. So the agent's trail draws **the gesture you would have made, in the place you would have made it**. It is legible precisely because the space is empty, and it is meaningful precisely because that space belongs to a hand.

**Why this is stronger than the contact-vs-hover framing it replaces.** The old framing asserted a depth relationship (human seated in the seam, agent hovering above with a drop shadow) that the user could not verify and that fought §10.6's rule that FX marks are light and cast no shadow. The new framing is *self-evidencing*: the halo is visible **because** a thumb is blocking the middle, and the trail is visible **because** nothing is. Each actor's position is explained by the presence or absence of the hand, so the rule teaches itself on first use and needs no legend.

⚑ **The shadow rule from R2 is deleted.** Neither actor mark casts a shadow. The agent trail now sits *on a recessed surface*, so giving it a shadow would imply it floats above a plane that is itself below the body plane — an incoherent double-depth reading. Both marks are light. §10.6 already said so; channel 1 now agrees with it.

### ⚑ LAW 4 — Agents Do Not Get Springs

> **No agent-originated animation may use a spring, overshoot a target, or end with non-zero velocity. Ever. This is not a stylistic preference; it is the single most reliable attribution signal in the product and it is machine-checkable.**

Stated as a lint rule: any animation whose originator is `agent` must use a `transition` with an explicit `duration` and a timing function of the form `linear` or `cubic-bezier(x1, 0, x2, 1)` with `y1 = 0` and `y2 = 1`. Spring configs, `cubic-bezier` values with `y` outside `[0, 1]`, and any easing with a negative terminal derivative are **build failures**, not review comments.

**Why it outranks hue.** A spring's overshoot-and-settle is visible in greyscale, at 4 fps, at 20% scale, in peripheral vision, and to every colour-vision deficiency. It is perceptible to a user who is not looking directly at it. Nothing about hue is true of any of those. When the client's hue change cut the colour channel's reliability roughly in half, this rule is what absorbed the loss.

**Corollary — the human never gets linear.** Human-originated motion must use a spring from §9.1. A human action that animates linearly is as much a bug as an agent action that bounces.

### ⚑ LAW 5 — Both Modes Are The Product

> **Light mode is a white polycarbonate iPod in a light room. Dark mode is a black polycarbonate iPod in a dark room. Neither is a filter applied to the other; they are two builds of the same object in two rooms, and both ship at full quality.**

This is stronger than a normal theming requirement because the device is a *physical object*: the 2005 iPod genuinely shipped in both white and black, so mode is not a UI preference being applied to a neutral surface — it is a **product variant**, and both variants have to be rendered with equal conviction. Consequences:

- Material recipes are authored twice (§5), not once with a filter. A white gloss and a black gloss have different physics: black has a 27-unit luminance range and a strong specular; white has a 27-unit range carried mostly in *hue* (§4.3).
- The panel is tinted per mode (§4.14), never neutral grey.
- The selection highlight inverts polarity between modes (§4.7) — and the light mode is the *more* historically accurate of the two, because the original iPod's panel was dark text on a pale field with a blue selection band.
- Every ratio in §11.1 is verified on both.


---

## 1. Design thesis

Skeuomorphism is usually indefensible because it decorates an abstraction with the surface of an object that was never there — the leather-stitched calendar, the felt-backed game table — spending fidelity on a lie. webPod inverts that: the iPod 5th generation *is* a real object with a documented geometry, and a music player is one of the few interfaces where the physical original was measurably better than its flat descendant, because the click wheel resolved a hard interaction problem — scrubbing a 4,000-item list with one thumb, eyes closed — that no flat list has since beaten. So the skeuomorphism here is not nostalgia cladding: it is the honest rendering of a control surface whose *affordance is load-bearing*, and rendering it at 2026 fidelity (correct light, correct specular, correct recession depth) is what makes the wheel legible as something you rotate rather than something you tap. The failure mode we are steering away from by name is **2005 pastiche and Corinthian-leather kitsch** — pinstripe textures, Aqua lozenges, bevels applied to things that are not raised, drop shadows used as decoration, "retro" as an aesthetic pose — and the target is a **real object rendered honestly**: one light source, materials that behave like polycarbonate and stainless steel actually behave, and not one bevel that does not describe a physical edge.

---

## 2. Conceptual range

Four structurally different directions were developed. These are not palette swaps of one idea; they differ in what the product *is*.

### Direction A — "Museum Replica"

A forensic 1:1 reconstruction of the 30GB iPod 5G and its firmware. Podium Sans reproduced glyph-for-glyph, the exact 320 × 240 panel with its original blue gradient highlight, the original menu tree (`Music / Videos / Photos / Podcasts / Extras / Settings / Shuffle Songs / Now Playing`), the original chunky scrollbar, the original 30-pin connector rendered even though nothing plugs into it. No modern layer whatsoever: no sidecar, no glass, no visible agent surface — the agent would have to act *through* the 2005 UI, moving the selection highlight as though a ghost thumb were on the wheel. Apple Music content is squeezed into 2005 information density: no artwork above 200px, no lossless badge, no lyrics.

**Verdict — rejected.** It is the most seductive and the least defensible. It fails Attributional Clarity outright: a 2005 firmware has no vocabulary for "an agent is doing this," and inventing one inside the replica breaks the replica. It also fails the dual-audience brief structurally, since WebMCP tool state has nowhere to live. Worst, it makes usability hostage to accuracy — Cover Flow-less browsing of a modern 100M-track catalogue through a 2005 menu tree is a worse product, and "nostalgia over usability" is an explicitly named anti-pattern (§10.7).

### Direction B — "iPod 2026 / Honest-Material Redesign"

Ask what Apple would actually ship if it revived the archetype now, and design that: the click wheel survives because it is a genuinely good control, but everything else moves to current Apple material language. Body in bead-blasted anodised aluminium (matte, no gloss — because Apple abandoned glossy polycarbonate in 2008 for good reasons), a 2.0" LTPO panel behind Ceramic Shield with a 1.5mm bezel, the wheel machined from a single aluminium disc with a laser-etched cap-touch ring, the back a solid slab with a single etched wordmark. The panel UI is full Liquid Glass: translucent nav, concentric radii, SF-style type, Dynamic Island-adjacent status treatment.

**Verdict — rejected, but harvested.** This is the professionally *safest* direction and the most boring. Matte anodised aluminium under one light is a nearly featureless surface — it has no specular story, no depth, no refraction — so the brief's mandate ("real glossy polycarbonate, real chrome, real recessed click wheel, real glass with specular highlight and edge refraction") has almost nothing to attach to. It would be a competent flat product with a wheel bolted on. Harvested from it: the concentric-radius discipline and the Liquid Glass treatment of the non-device layer, both of which became LAW 1.

### Direction C — "Object in Glass" ★ **CHOSEN**

The iPod 5G exists as a photographically-honest physical object — glossy polycarbonate front, mirror-polished steel back, recessed click wheel, cover glass with real specular and edge refraction — resting in an environment that has its own colour, floor, and reflected light. The device is 2005 and unapologetic about it, rendered at fidelity 2005 could not achieve. Everything the *application* needs that the 2005 object cannot express — the sidecar, the queue, the agent's tool-call ticker, consent interrupts, search, lyrics, the WebMCP surface — lives in Liquid Glass panels that float in the same room, at a different optical depth, obeying iOS 26 rules exactly. The two languages never blend; they are composited. The agent's presence is expressed as light *falling on* the object from the glass layer, and as a ghost thumb on the wheel — the agent reaches into the physical world from the glass one.

**Why this wins.** It is the only direction where both halves of the brief get to be excellent instead of negotiated. The device gets maximal skeuomorphism with zero pressure to also be a modern app shell. The modern app shell gets full Liquid Glass with zero pressure to be retro. The dual-audience requirement gets a natural home: **human actions happen on the object, agent actions arrive from the glass** — which is not a colour code but a *spatial* one, and spatial attribution is the most robust kind. It also gives the expose-flip real meaning: flipping the object over in a lit room is a physical act with a physical shadow, not a card transition. And the environment gives the object scale, which is what stops a rendered device from looking like a sticker.

**What it costs.** Two complete material systems to maintain, a hard compositing budget (§10.9), and the discipline to never let one language leak into the other. That discipline is LAW 1.

### Direction D — "Exploded Instrument"

Dissolve the device into its parts. The click wheel, the 320 × 240 panel, and the mirrored steel plate detach and float as three independent instrument modules on a dark workbench, each fully skeuomorphic in isolation but never reassembled into a body: the wheel is a standalone jog dial you can drag anywhere on the canvas, the panel is a screen you can scale, the steel plate is the settings slab you flip. Layout is a modular rack; the "device" is an idea the modules imply. Agent activity is wired between modules as visible signal paths — literal patch cables carrying light.

**Verdict — rejected, one idea harvested.** It is the most inventive and the most likely to be admired by designers and disliked by users. Exploding the object destroys the single strongest thing about the iPod: that it is *one object that fits in a hand*, whose entire interface is reachable by one thumb without looking. Once the wheel can be anywhere, the muscle memory that justified the wheel is gone, and the skeuomorphism becomes pure decoration — kitsch by the strict definition. Harvested: the *patch-cable* idea for agent provenance became the tool-call provenance trail (§8.10), redrawn as a thin green trace running from the sidecar edge to the affected control.

### The pick

**Direction C, "Object in Glass."** Chosen because it makes LAW 1 a composition rather than a compromise, because it gives human-vs-agent attribution a spatial channel that survives greyscale and colourblindness, and because it is the only direction in which "maximally skeuomorphic" and "iOS 26 Liquid Glass" are both fully expressed instead of both diluted.

---

## 3. Facets of quality

Five facets, in priority order. When two conflict, the higher-numbered facet yields.

| # | Facet | One-line definition |
| --- | --- | --- |
| 1 | **Material Honesty** | Every surface behaves under one consistent light as the material it depicts actually behaves. |
| 2 | **Tactility** | Controls telegraph how they will feel before contact and confirm it after. |
| 3 | **Attributional Clarity** | At any instant, with no colour vision and no motion, you know whether you or the agent did that. |
| 4 | **Panel Discipline** | The 320 × 240 screen obeys its own era's rules and never leaks modern UI. |
| 5 | **Restraint Under Delight** | Effects are thrilling on first encounter and invisible on the thousandth. |

### 3.1 What 5/5 looks like, concretely

**Material Honesty — 5/5.** A viewer shown any single cropped 200 × 200px region of the device can correctly point to where the light is coming from, and every crop agrees. The polycarbonate has a *specular* highlight (a tight bright arc with a hard falloff) and not a *diffuse* one (a soft glow); the steel has non-monotonic luminance with a visible dark horizon band, because polished metal reflects the room's dark half; the recessed wheel's inner shadow is on the **top** inside edge and its highlight on the bottom inside edge, which is what a depression does and the exact inverse of what a raised button does. Zero elements have a bevel that does not describe an actual physical edge. 1/5 is a body with a linear two-stop grey gradient and a `box-shadow` under it.

**Tactility — 5/5.** Before touch: the center button's translucency and its 1px light-catching top rim read as *pressable* without a label. On touch: it descends 1px, its specular arc shortens by 18% and slides 2px toward the contact point, its contact shadow tightens from 6px blur to 2px, and a detent tick fires within 16ms of the gesture crossing the detent threshold — visual, audible, and haptic in that order, never one without the others being deliberately suppressed. Wheel inertia decays like a real flywheel, and a fast flick produces the accelerated-scroll letter overlay the real device produced. 1/5 is a wheel that scrolls a list with `scroll-behavior: smooth` and no per-item feedback.

**Attributional Clarity — 5/5.** Print any frame of any interaction in greyscale, at 50% scale, and a first-time user correctly attributes every visible effect. This works because human marks are *filled soft circles that bloom outward from a contact point on the object* and agent marks are *unfilled dashed hexagons that arrive along an orthogonal path from the glass layer*, and because agent marks always carry an IBM Plex Mono uppercase label while human marks never carry text at all. When both fire in the same 200ms, the arbitration collar (§8.12) splits the wheel's perimeter and neither mark occludes the other. 1/5 is "human is red, agent is blue."

**Panel Discipline — 5/5.** A screenshot of the 320 × 240 panel alone, with the device cropped away, contains no backdrop blur, no translucency, no corner radius above 6 panel px, no shadow with a blur above 3 panel px, no gradient with more than three stops, and no type below 11 panel px — and would be judged by a 2005 iPod engineer as *plausible firmware, rendered better*. Modern affordances (lossless badge, lyrics, agent state) are expressed in the panel's own 2005 grammar — a glyph in the status bar, a right-aligned chevron, a one-line footer — or they are moved out to the glass layer entirely. 1/5 is a frosted-glass card floating inside the iPod screen.

**Restraint Under Delight — 5/5.** A 45-minute listening session produces zero moments where a user wished an effect would stop. Concretely: every FX class has an *attenuation rule* (§10.8) — repeat the same event within 400ms and the effect's peak opacity halves, floor 30%; the agent idle presence breathes at 0.06Hz with a 4% opacity swing, not 1Hz with 40%; nothing loops more than three times; nothing above 40% opacity persists longer than 900ms except a consent interrupt, which is *supposed* to block. 1/5 is a light show.

---

## 4. Colour tokens

All tokens are sRGB hex. Alpha is written `#RRGGBB / NN%` where relevant. Ship as CSS custom properties in the exact names given.

### 4.1 Environment — the room the object sits in

The device is an object in a lit space, and the space has a colour. Two environments — one per mode, per LAW 5.

**Why an environment exists at all:** an object with no ground and no surround reads as a decal. The floor gradient plus contact shadow plus a faint reflected bounce are what give the device physical scale. This is also where the Liquid Glass layer gets something to refract — glass over a flat single-colour field looks like grey plastic (§10.5).

**R2 change.** The canvas set the environment to a **cool slate neutral** (`#F1F3F7 → #D4DAE3` light, `#16171C → #07080A` dark) rather than R1's warm neutral. **Confirmed and adopted** — it is the right call for two reasons: it matches the Tailwind `slate` rebasing of all material neutrals (§4.13), and a cool room is what a white polycarbonate body needs, because white gloss carries its form in hue rather than luminance (§4.3) and a warm room would fight the body's cool mid-tones.

⚑ **One consequence the canvas has not yet applied:** with a cool room, the contact shadow can no longer be warm. R1's `--room-contact #4A443C / 38%` was tuned to a warm room and will read as a dirty brown smear against `#E7EBF1`. Shadows are rebased on `slate-700`/`slate-800` below.

#### Light room (`:root[data-mode="light"]`)

| Token | Value | Tailwind ref | Usage |
| --- | --- | --- | --- |
| `--room-sweep` | `120deg` radial from `28% 8%` | — | Angle/origin, aligned to LAW 2 key light |
| `--room-0` | `#F1F3F7` | ~`slate-100` | Sweep stop `0%` — lit wall behind the key light |
| `--room-1` | `#E7EBF1` | — | Sweep stop `34%` — base wall value |
| `--room-2` | `#DDE2EA` | ~`slate-200` | Sweep stop `68%` — falloff |
| `--room-3` | `#D4DAE3` | — | Sweep stop `100%` — far corner |
| `--room-floor` | `#CDD4DE` | — | Floor plane top edge, at 68% of viewport height |
| `--room-floor-far` | `#BAC2CF` | ~`slate-300` | Floor plane bottom edge |
| `--room-bounce` | `#FFFFFF / 22%` | — | Bounce light on the device's lower-left edge |
| `--room-contact` | `#334155 / 34%` | `slate-700` | ⚑ Contact shadow — **rebased cool** (was `#4A443C`) |
| `--room-ao` | `#1E293B / 20%` | `slate-800` | Ambient occlusion where device meets floor |
| `--room-ink` | `#0F172A` | `slate-900` | Environment primary text — **14.92:1** on `--room-1` |
| `--room-ink-2` | `#475569` | `slate-600` | Environment secondary text — **6.33:1** on `--room-1` |
| `--room-ink-3` | `#64748B` | `slate-500` | Environment tertiary — 4.4:1, large text only |
| `--room-rim` | `#FFFFFF / 62%` | — | Rim light on the device's top-left silhouette |

#### Dark room (`:root[data-mode="dark"]`)

| Token | Value | Tailwind ref | Usage |
| --- | --- | --- | --- |
| `--room-sweep` | `120deg` radial from `28% 6%` | — | Same origin, same law |
| `--room-0` | `#16171C` | — | Sweep stop `0%` |
| `--room-1` | `#101216` | — | Sweep stop `36%` |
| `--room-2` | `#0B0D10` | — | Sweep stop `70%` |
| `--room-3` | `#07080A` | — | Sweep stop `100%` |
| `--room-floor` | `#0D0F13` | — | Floor top edge |
| `--room-floor-far` | `#060709` | — | Floor bottom edge |
| `--room-bounce` | `#7DD3FC / 8%` | `sky-300` | Cool bounce on lower-left edge (LAW 2 fill light) |
| `--room-contact` | `#000000 / 66%` | — | Contact shadow |
| `--room-ao` | `#000000 / 48%` | — | Ambient occlusion |
| `--room-ink` | `#F1F5F9` | `slate-100` | Environment primary text — **17.11:1** on `--room-1` |
| `--room-ink-2` | `#CBD5E1` | `slate-300` | Environment secondary — **12.63:1** on `--room-1` |
| `--room-ink-3` | `#94A3B8` | `slate-400` | Environment tertiary — **7.31:1** on `--room-1` |
| `--room-rim` | `#CBD5E1 / 42%` | `slate-300` | Rim light on top-left silhouette |


### 4.2 Device body — black polycarbonate

The 2005 black iPod front was glossy polycarbonate over a black substrate. Glossy polycarbonate is not "dark grey with a gradient": it has a **near-specular top reflection**, a very dark mid-body where it reflects nothing, and a **lifted bottom edge** where the floor bounces back into it. That non-monotonic profile is the whole illusion.

| Token | Value | Usage |
| --- | --- | --- |
| `--poly-k-grad-angle` | `180deg` | LAW 2. Never change. |
| `--poly-k-0` | `0%: #3E4147` | Top edge — reflected key light through the plastic's surface layer |
| `--poly-k-1` | `5%: #262A2E` | Rapid falloff (gloss = short falloff) |
| `--poly-k-2` | `19%: #16181C` | Entering the dead zone |
| `--poly-k-3` | `44%: #0C0D0F` | Dead zone — darkest, reflects nothing |
| `--poly-k-4` | `62%: #0A0B0D` | True minimum, slightly below stop 3 |
| `--poly-k-5` | `81%: #121417` | Floor bounce begins |
| `--poly-k-6` | `93%: #1E2126` | Bounce peak |
| `--poly-k-7` | `100%: #32363C` | Bottom edge caustic |
| `--poly-k-edge-hi` | `#FFFFFF / 30%` | 1px inner stroke, top edge only (0–14% of perimeter) |
| `--poly-k-edge-lo` | `#8FB4D8 / 12%` | 1px inner stroke, bottom-left edge (fill light) |
| `--poly-k-specular` | `#FFFFFF / 42%` | The gloss arc overlay (see recipe §5.1) |
| `--poly-k-specular-2` | `#FFFFFF / 9%` | Secondary broad sheen |
| `--poly-k-seam-shadow` | `#000000 / 55%` | Where plastic meets the chrome bezel seam |
| `--poly-k-ink` | `#FFFFFF` | Screen-printed text on black body — **19.44:1** |
| `--poly-k-ink-2` | `#A9AFB7` | Secondary printed text |

### 4.3 Device body — white polycarbonate

Harder to make convincing than black, because white gloss has almost no value range to work with. The illusion lives in **hue**, not luminance: the lit top is faintly warm, the mid-body is faintly cool (it reflects sky/room), and the shadowed lower area shifts blue-grey. Total luminance range is only 27 units; total hue travel is 34°.

| Token | Value | Usage |
| --- | --- | --- |
| `--poly-w-grad-angle` | `180deg` | LAW 2 |
| `--poly-w-0` | `0%: #FFFFFF` | Top edge, pure specular |
| `--poly-w-1` | `6%: #FBFAF8` | Warm shoulder (hue ≈ 40°) |
| `--poly-w-2` | `21%: #F0F1F3` | Neutral |
| `--poly-w-3` | `47%: #E2E5E8` | Cool mid (hue ≈ 210°) — the base body value |
| `--poly-w-4` | `64%: #DBDFE4` | Coolest, deepest |
| `--poly-w-5` | `82%: #E6E9EC` | Bounce begins |
| `--poly-w-6` | `94%: #F3F5F7` | Bounce peak |
| `--poly-w-7` | `100%: #FDFEFE` | Bottom edge caustic |
| `--poly-w-edge-hi` | `#FFFFFF / 90%` | 1px inner stroke, top edge |
| `--poly-w-edge-lo` | `#A8B6C6 / 34%` | 1px inner stroke, bottom-left edge |
| `--poly-w-specular` | `#FFFFFF / 78%` | Gloss arc overlay |
| `--poly-w-specular-2` | `#FFFFFF / 24%` | Secondary sheen |
| `--poly-w-seam-shadow` | `#7D858F / 42%` | Plastic-to-chrome seam |
| `--poly-w-ink` | `#1A1C20` | Printed text on white body — **13.49:1** on `--poly-w-3` |
| `--poly-w-ink-2` | `#4A4F57` | Secondary printed text — **6.52:1** |

### 4.4 Chrome / stainless steel

Two distinct materials that are constantly confused: the **bezel seam** (a 3px chamfered chrome edge, a *line*) and the **mirrored back** (a large *plane*). They need different recipes because the seam's job is to catch one bright line and the plane's job is to reflect a whole room.

#### Bezel seam

| Token | Value | Usage |
| --- | --- | --- |
| `--chrome-seam-hi` | `#FBFDFF` | Outermost hairline, 1px — catches key light |
| `--chrome-seam-mid` | `#98A1AA` | Middle hairline, 1px — the chamfer's body |
| `--chrome-seam-lo` | `#2E3338` | Inner hairline, 1px — the shadow under the chamfer |
| `--chrome-seam-hi-alt` | `#FFFFFF / 92%` | Same, as an alpha stroke over an arbitrary base |
| `--chrome-seam-lo-alt` | `#000000 / 62%` | Same, as an alpha stroke |
| `--chrome-seam-bounce` | `#C8D6E4 / 40%` | Lower-left segment of the seam (fill light) |

#### Mirrored back — 10-stop gradient

Polished steel reads as metal **only** if luminance is non-monotonic and crosses a dark "horizon" band. A mirror reflects the bright upper half of a room, the dark lower half, and the bright floor — so the value curve goes bright, dark, bright, dark. A monotonic gradient always reads as grey plastic (§10.6). Angle is `168deg`, not `180deg`, deliberately: perfectly axial metal reads as a printed swatch.

| Token | Value | Usage |
| --- | --- | --- |
| `--steel-grad-angle` | `168deg` | 12° off-axis. Never make this 180deg. |
| `--steel-0` | `0%: #F6F8FA` | Ceiling reflection |
| `--steel-1` | `7%: #C6CDD4` | First falloff |
| `--steel-2` | `16%: #EDF1F5` | Upper-wall specular band (luminance goes back **up**) |
| `--steel-3` | `29%: #929BA5` | Descending toward horizon |
| `--steel-4` | `43%: #656E78` | **Horizon band** — the darkest region; the room's dark half |
| `--steel-5` | `50%: #7C858F` | Horizon lower edge |
| `--steel-6` | `58%: #ADB6BF` | Rising into floor reflection |
| `--steel-7` | `71%: #E1E7EC` | Floor specular band |
| `--steel-8` | `85%: #96A0AA` | Falloff |
| `--steel-9` | `94%: #C7CED5` | Secondary floor glint |
| `--steel-10` | `100%: #7A828C` | Bottom edge, in shadow |
| `--steel-sky` | radial `#FFFFFF / 30%` | Overlay: sky reflection blob, see recipe §5.2 |
| `--steel-aniso` | `#FFFFFF / 4%` | Anisotropic brush-grain overlay |
| `--steel-aniso-dark` | `#000000 / 5%` | Brush-grain dark strokes |
| `--steel-base` | `#C4CBD2` | Flat fallback for reduced-transparency / contrast modes |
| `--steel-engrave-lo` | `#5A626B` | Engraved groove shadow — **3.78:1** on `--steel-base` |
| `--steel-engrave-hi` | `#FFFFFF / 72%` | Engraved groove's lower lip highlight |
| `--steel-label-ink` | `#2B3037` | **Functional** text on the steel back (Settings labels) — **8.11:1** |
| `--steel-label-ink-2` | `#4C535B` | Secondary functional text on steel |

> **Note on the engraved Apple logo and "iPod" wordmark.** These render at 3.78:1 and 2.51:1 respectively and *do not* meet 4.5:1. This is correct and permitted: WCAG 2.2 SC 1.4.3 exempts logotypes, and a laser-etched mark on polished steel physically *is* low-contrast — forcing it to 4.5:1 would destroy Material Honesty. They carry no information. Every *functional* label on the steel back uses `--steel-label-ink` at 8.11:1. See §11.1.

### 4.5 Click wheel

The wheel is a **recession**, not a button. Its shadow geometry is therefore inverted relative to every raised element in the system: inner shadow on the **top** inside edge, inner highlight on the **bottom** inside edge. Getting this backwards is the single most common way a skeuomorphic wheel fails.

#### Ring surface — black variant

| Token | Value | Usage |
| --- | --- | --- |
| `--wheel-k-0` | `0%: #14161A` | Ring surface top (in shadow from the recess lip) |
| `--wheel-k-1` | `38%: #1E2126` | |
| `--wheel-k-2` | `62%: #23262B` | Ring surface base value |
| `--wheel-k-3` | `100%: #2C3037` | Ring surface bottom (catches the bottom lip's bounce) |
| `--wheel-k-recess-shadow` | `#000000 / 88%` (`#000000E0`) | ⚑ **R2 deepened.** Inner shadow, **top** inside edge, offset `0 5px`, blur `11px` |
| `--wheel-k-recess-hi` | `#8C949E / 34%` | Inner highlight, **bottom** inside edge, offset `0 -1px`, blur `2px` |
| `--wheel-k-rim-outer-hi` | `#FFFFFF / 16%` | Outer highlight rim — the 1px lip on the body around the recess, top arc |
| `--wheel-k-rim-outer-lo` | `#000000 / 40%` | Outer rim, bottom arc |
| `--wheel-k-label` | `#A9AFB7` | Screen-printed MENU / ⏮ / ⏭ / ▶⏸ — **7.73:1** on `--wheel-k-2` |
| `--wheel-k-label-hc` | `#E4E7EA` | Increased-contrast variant — **13.76:1** |

#### Ring surface — white variant

| Token | Value | Usage |
| --- | --- | --- |
| `--wheel-w-0` | `0%: #DCDFE2` | Ring top, in recess shadow |
| `--wheel-w-1` | `38%: #E6E8EA` | |
| `--wheel-w-2` | `62%: #E9EBED` | Base value |
| `--wheel-w-3` | `100%: #F2F4F6` | Ring bottom |
| `--wheel-w-recess-shadow` | `#94A3B8 / 36%` (`#94A3B85C`, `slate-400`) | ⚑ **R2 deepened + rebased on `slate`.** Inner shadow, **top** inside edge, offset `0 5px`, blur `11px` |
| `--wheel-w-recess-hi` | `#FFFFFF / 88%` | Inner highlight, bottom inside edge, offset `0 -1px`, blur `2px` |
| `--wheel-w-rim-outer-hi` | `#FFFFFF / 82%` | Outer rim lip, top arc |
| `--wheel-w-rim-outer-lo` | `#8B949E / 46%` | Outer rim lip, bottom arc |
| `--wheel-w-label` | `#5E646D` | Printed labels — **4.99:1** on `--wheel-w-2` |
| `--wheel-w-label-hc` | `#3E434A` | Increased-contrast variant — **8.34:1** |

#### Center Select button — translucent

The 5G center button is a translucent plug that reads slightly lighter than the ring and shows a faint internal depth. It is the only *raised* element on the wheel, so its light geometry is normal (highlight top, shadow bottom) — the deliberate inversion against the surrounding recession is what makes it pop.

| Token | Value | Usage |
| --- | --- | --- |
| `--select-k-0` | `0%: #3A3E45 / 92%` | Black variant, top |
| `--select-k-1` | `34%: #262A30 / 88%` | |
| `--select-k-2` | `70%: #1B1E23 / 90%` | |
| `--select-k-3` | `100%: #2A2E34 / 94%` | Bottom, bounce |
| `--select-w-0` | `0%: #FFFFFF / 96%` | White variant, top |
| `--select-w-1` | `34%: #F1F3F5 / 90%` | |
| `--select-w-2` | `70%: #E4E7EA / 92%` | |
| `--select-w-3` | `100%: #EFF1F4 / 96%` | Bottom, bounce |
| `--select-rim-hi` | `#FFFFFF / 62%` | 1px inner stroke, top arc — the light-catching lip |
| `--select-rim-lo` | `#000000 / 34%` | 1px inner stroke, bottom arc |
| `--select-drop` | `#000000 / 36%` dark · `#334155 / 30%` light | ⚑ **R2 deepened.** Outer shadow, offset `0 4px`, blur `9px`, spread `-1px` |
| `--select-ao` | `#000000 / 24%` | Outer shadow, offset `0 0`, blur `2px` — seats it in the ring |
| `--select-core` | `#FFFFFF / 7%` | Internal volumetric glow (translucency cue), radial from `44% 34%` |
| `--select-pressed-tint` | `#000000 / 16%` | Overlay on press |
| `--select-pressed-drop` | `#000000 / 44%` | Pressed shadow: offset `0 0.5px`, blur `2px` |

#### Quadrant pressed states

Each of the four ring quadrants (`MENU` top, `⏭` right, `▶⏸` bottom, `⏮` left) presses independently. The pressed state is a **radial darkening centred on the quadrant's arc midpoint**, not a rectangle, because the physical wheel flexes locally.

> ⚑ **R3 — this is no longer the primary feedback.** The darkening renders under the pressing thumb and is invisible to the person pressing (§7.6). It is retained because it is correct material behaviour and is visible to an observer and in capture, but the confirming signal a user actually perceives is the **halo contact core** at ×1.4 with radial peak `0.68` (§8.5). Never tune the quadrant darkening as though it were the feedback; it is the material, not the message.

| Token | Value | Usage |
| --- | --- | --- |
| `--quad-press-k` | `#000000 / 30%` | Black variant, radial `70% 70%` from arc midpoint, 0% → `30%`, 100% → `0%` |
| `--quad-press-w` | `#6E7883 / 26%` | White variant, same geometry |
| `--quad-press-inner-lip` | `#000000 / 26%` | Inner shadow deepens under the pressed arc, offset `0 2px`, blur `5px` |
| `--quad-press-outer-lip` | `#FFFFFF / 10%` | The un-pressed opposite arc gains 4% highlight (the wheel rocks) |
| `--quad-focus-ring` | `#FFFFFF / 74%` | Keyboard focus ring on a quadrant, 2px, offset 2px outward |

### 4.6 Display glass and panel

Four separate layers, often collapsed into one by mistake: the **glass** (a physical sheet), the **specular** (light on the glass), the **edge refraction** (light bending at the glass's cut edge), and the **panel** (the emissive LCD behind it).

| Token | Value | Usage |
| --- | --- | --- |
| `--glass-surround` | `#05060A` | The black printed border of the glass sheet, outside the active area. Darker than the panel. |
| `--panel-bg` | `#0B0D11` | LCD black. **Never `#000000`** — an LCD's black leaks backlight and the glass reflects the room. |
| `--panel-bg-lift` | `#0E1116` | Panel black in the light room (glass picks up more room) |
| `--glass-specular-1` | `#FFFFFF / 15%` | Primary specular sheen — a broad soft arc, top-left third |
| `--glass-specular-2` | `#FFFFFF / 7%` | Secondary counter-sheen, lower-right |
| `--glass-specular-edge` | `#FFFFFF / 34%` | The tight 1px bright line along the glass's top cut edge |
| `--glass-refract-hi` | `#BFD8F0 / 26%` | Edge refraction, top and left edges — light bending through the chamfer, cool |
| `--glass-refract-lo` | `#F0D8BF / 14%` | Edge refraction, bottom and right — the warm complement (chromatic dispersion) |
| `--glass-refract-blur` | `2px` | Refraction band blur |
| `--glass-refract-width` | `3px` | Refraction band width |
| `--glass-inner-shadow` | `#000000 / 66%` | Inner shadow from the bezel opening onto the glass, offset `0 1px`, blur `3px` |
| `--glass-room-reflect` | `#FFFFFF / 4%` | Faint whole-panel reflection of `--room-0`; rises to `7%` in light room |
| `--panel-scanline` | `#FFFFFF / 3%` | Horizontal 1px line every 3 panel px — the LCD row structure |
| `--panel-scanline-dark` | `#000000 / 4%` | The dark row between lines |
| `--panel-subpixel-r` | `#FF0000 / 2.5%` | Sub-pixel triad, 1px column stride 3 |
| `--panel-subpixel-g` | `#00FF00 / 2.0%` | Sub-pixel triad |
| `--panel-subpixel-b` | `#0000FF / 2.5%` | Sub-pixel triad |
| `--panel-vignette` | `#000816 / 18%` | Corner vignette — LCD backlight falloff, radial `120% 120%` from centre |
| `--panel-backlight-bloom` | `#B8D4FF / 5%` | Faint bloom around bright panel content |

> Sub-pixel and scanline layers total **≤ 7%** opacity combined. Above that they read as dirt (§10.2). At panel scales below 0.75 they are disabled entirely — sub-pixel texture at sub-pixel resolution is aliasing, not texture.

### 4.7 Screen UI (inside the panel)

Panel colours obey Panel Discipline: flat fills, at most three gradient stops, no translucency, no blur.

| Token | Value | Usage | Ratio on `--panel-bg` |
| --- | --- | --- | --- |
| `--ui-bg` | `#0B0D11` | Panel background | — |
| `--ui-bg-alt` | `#111419` | Alternating row band (very subtle) | — |
| `--ui-statusbar-0` | `0%: #23282F` | Status bar gradient top | — |
| `--ui-statusbar-1` | `100%: #14171C` | Status bar gradient bottom | — |
| `--ui-text-1` | `#F2F4F7` | Primary — menu labels, track titles | **17.65:1** |
| `--ui-text-2` | `#A8AEB8` | Secondary — artist, album, counts | **8.72:1** |
| `--ui-text-3` | `#7C838E` | Tertiary — timestamps, hints | **5.09:1** |
| `--ui-text-4` | `#767A81` | Disabled / inactive | **4.51:1** |
| `--ui-divider` | `#2E333B` | 1px row divider | 1.53:1 (non-text) |
| `--ui-divider-strong` | `#3A4049` | Section divider | 1.86:1 (non-text) |
| `--ui-chevron` | `#8A9199` | Right-facing disclosure chevron | 6.14:1 |
| `--ui-scrollbar-track` | `#191D23` | Panel scrollbar track | — |
| `--ui-scrollbar-thumb` | `#5A616B` | Panel scrollbar thumb | 3.05:1 (non-text) |
| `--ui-artwork-frame` | `#FFFFFF / 12%` | 1px stroke around album art in the split-pane | — |
| `--ui-artwork-shadow` | `#000000 / 60%` | Album art drop, `0 2px 4px` | — |

#### The classic selection highlight — now the human's cursor

⚑ **The selection highlight is the human accent, by definition.** This resolves a tension R1 papered over: R1 had a blue highlight *and* a cyan agent colour that were only 25° apart and constantly at risk of reading as the same system. With human = sky, the highlight simply **is** the human's cursor — the on-panel expression of where the person's attention is. An agent-moved selection uses the agent's green and gains a dashed outline.

The 2005 structure is preserved in both modes — a filled band, a 1px lighter hard line on the top edge, a darker line on the bottom. Only the polarity differs.

**Dark mode** (band is lighter than the panel is not possible on a near-black panel, so the band is a saturated blue, as in 2005):

| Token | Value | Tailwind | Usage |
| --- | --- | --- | --- |
| `--ui-hl-0` | `0%: #0369A1` | `sky-700` | Band top — **5.93:1** with `#FFFFFF`, the binding constraint |
| `--ui-hl-1` | `52%: #075985` | `sky-800` | Band mid — 7.56:1 with white |
| `--ui-hl-2` | `100%: #0C4A6E` | `sky-900` | Band bottom — 9.46:1 with white |
| `--ui-hl-topline` | `#38BDF8` | `sky-400` | 1px hard line, top edge — the 2005 signature |
| `--ui-hl-botline` | `#082F49` | `sky-950` | 1px hard line, bottom edge |
| `--ui-hl-text` | `#FFFFFF` | — | Selected row text. ⚑ **Pure white, not `--ui-text-1`.** |

**Light mode** (⚑ *this is the historically accurate one* — the original iPod's panel was dark text on a pale field with a saturated blue selection band and white text):

| Token | Value | Tailwind | Usage |
| --- | --- | --- | --- |
| `--ui-hl-0` | `0%: #0369A1` | `sky-700` | Band top — **5.93:1** with `#FFFFFF` |
| `--ui-hl-1` | `52%: #075985` | `sky-800` | Band mid |
| `--ui-hl-2` | `100%: #0C4A6E` | `sky-900` | Band bottom |
| `--ui-hl-topline` | `#0EA5E9` | `sky-500` | Top hard line — brighter in light mode so the band's top edge separates from the pale panel |
| `--ui-hl-botline` | `#082F49` | `sky-950` | Bottom hard line |
| `--ui-hl-text` | `#FFFFFF` | — | Selected row text |

> **Why light mode does not use a pale band.** A `sky-100 → sky-200` wash with dark text measures 15.56:1 and is technically better, but it makes the selection the *lightest* thing on a light panel, which inverts the figure-ground relationship the wheel depends on — you scan for the dark band. The saturated band is also what the real device did. Kept.

**Agent-driven selection** (both modes) — same structure, agent hue, plus the dashed outline that carries channel 2:

| Token | Dark | Light | Tailwind | Usage |
| --- | --- | --- | --- | --- |
| `--ui-hl-agent-0` | `0%: #15803D` | `0%: #15803D` | `green-700` | Band top — 4.6:1 with white; ⚑ paired with a 1.5px dashed outline, never alone |
| `--ui-hl-agent-1` | `52%: #166534` | `52%: #166534` | `green-800` | Band mid — 6.2:1 with white |
| `--ui-hl-agent-2` | `100%: #14532D` | `100%: #14532D` | `green-900` | Band bottom — 7.6:1 with white |
| `--ui-hl-agent-topline` | `#4ADE80` | `#22C55E` | `green-400/500` | Top hard line |
| `--ui-hl-agent-dash` | `#86EFAC` | `#166534` | `green-300` / `green-800` | 1.5px dashed `3 3` outline around the row — **the shape channel, mandatory** |

> **Why the agent gets its own band rather than a badge.** When an agent moves the selection, the *selection itself* is the agent's action; a badge elsewhere would decouple cause from effect. The band keeps the 2005 structure (Panel Discipline) while changing hue **and** adding the dashed outline — so it is attributable by form even in greyscale, where the two bands measure 1.2:1 apart and are otherwise identical.


### 4.8 Human accent ramp — Tailwind `sky`

⚑ **Human = Tailwind `sky`.** Validated as picked; no correction to the palette choice. `sky` is the right blue of the three candidates: `blue` sits further from green (better hue separation) but is the most over-used "product blue" in the category and reads as a generic CTA; `cyan` sits *closer* to green and would have made the collision worse. `sky` at H≈233° is the best available compromise between separation from `green` (81°) and not looking like every SaaS primary.

| Token | Tailwind | Hex | OKLCH L | Role |
| --- | --- | --- | --- | --- |
| `--human-100` | `sky-100` | `#E0F2FE` | 0.951 | Faintest wash; bloom outer falloff; text on saturated sky fills |
| `--human-200` | `sky-200` | `#BAE6FD` | 0.901 | Light-mode wash; hover fill |
| `--human-300` | `sky-300` | `#7DD3FC` | 0.828 | Bloom mid-ring; dark-mode hover |
| `--human-400` | `sky-400` | `#38BDF8` | 0.754 | **Dark-surface text.** Highlight top line |
| `--human-500` | `sky-500` | `#0EA5E9` | 0.685 | **Core.** Dark-surface fill / stroke / glow; the human orbit |
| `--human-600` | `sky-600` | `#0284C7` | 0.588 | **Light-surface fill / stroke.** Dark co-occurrence tier |
| `--human-700` | `sky-700` | `#0369A1` | 0.500 | **Light-surface text.** Selection band top stop |
| `--human-800` | `sky-800` | `#075985` | 0.443 | Light-surface strong text; selection band mid |
| `--human-900` | `sky-900` | `#0C4A6E` | 0.391 | Selection band bottom; deep press wells |

#### Per-surface usage — human

| Surface | Text (≥4.5:1) | Fill / stroke (≥3:1) | Glow / wash | Measured |
| --- | --- | --- | --- | --- |
| Dark panel `#0A0F16` | `sky-400` | `sky-500` | `sky-500 / 14%` | **8.97** · **6.93** |
| Black poly `#0C0D0F` | `sky-400` | `sky-500` | `sky-500 / 12%` | **9.08** · **7.02** |
| Dark glass `#191B1F` | `sky-400` | `sky-500` | `sky-500 / 16%` | **8.05** · **6.22** |
| Dark wheel `#23262B` | `sky-400` | `sky-500` | `sky-500 / 18%` | **7.08** · **5.48** |
| Light panel `#F2F6FB` | `sky-700` | `sky-600` | `sky-200 / 55%` | **5.47** · **3.77** |
| White poly `#E2E5E8` | `sky-700` | `sky-600` | `sky-200 / 50%` | **4.69** · **3.24** |
| Light glass `#EEF0F3` | `sky-700` | `sky-600` | `sky-100 / 70%` | **5.20** · **3.59** |
| White wheel `#E9EBED` | `sky-700` | `sky-600` | `sky-200 / 50%` | **4.96** · **3.43** |

⚑ `sky-500` is **fill, stroke and glow only on light surfaces** (2.4:1 there). `sky-600` is **fill and stroke only** — it clears the 3:1 non-text bar on every light surface but not the 4.5:1 text bar on white poly (3.24). Human text on any light surface is `sky-700` minimum, `sky-800` below 13px.

### 4.9 Agent accent ramp — Tailwind `green`

⚑ **Agent = Tailwind `green`.** Validated as picked, with one warning. I tested `emerald` and `lime` as substitutes and **`green` is the correct choice of the three**, but for a non-obvious reason:

| Candidate | Text-safe on *all* light surfaces | Tritan ΔE vs `sky-700` | Verdict |
| --- | --- | --- | --- |
| `green-800` `#166534` | ✓ (6.57 / 5.64 / 6.25) | 7.4 | **chosen** |
| `emerald-800` `#065F46` | ✓ (7.08 / 6.08 / 6.73) | 8.4 | rejected — `emerald-700` fails white poly (4.34), so the ramp loses a usable step, and emerald sits ~15° *closer* to sky, worsening the collision |
| `lime-800` `#3F6212` | ✓ (6.52 / 5.60 / 6.20) | 8.8 | rejected — best tritan separation of the three, but `lime` reads as caution/toxic and collides semantically with `amber` warning |

| Token | Tailwind | Hex | OKLCH L | Role |
| --- | --- | --- | --- | --- |
| `--agent-100` | `green-100` | `#DCFCE7` | 0.962 | Faintest wash; text on saturated green fills |
| `--agent-200` | `green-200` | `#BBF7D0` | 0.925 | ⚑ **Dark co-occurrence tier** (see below) |
| `--agent-300` | `green-300` | `#86EFAC` | 0.871 | **Dark-surface text**; ticker; mono readout |
| `--agent-400` | `green-400` | `#4ADE80` | 0.800 | **Core.** Dark-surface stroke / hexagon / the agent orbit |
| `--agent-500` | `green-500` | `#22C55E` | 0.723 | Dark-surface deep fill; light-surface glow |
| `--agent-600` | `green-600` | `#16A34A` | 0.627 | ⚑ **Restricted** — fails 3:1 on white poly (2.61). Light-glass fills only |
| `--agent-700` | `green-700` | `#15803D` | 0.527 | **Light-surface fill / stroke** |
| `--agent-800` | `green-800` | `#166534` | 0.448 | **Light-surface text** |
| `--agent-900` | `green-900` | `#14532D` | 0.393 | Selection band bottom; deepest trace shadow |

#### Per-surface usage — agent

| Surface | Text (≥4.5:1) | Fill / stroke (≥3:1) | Glow / wash | Measured |
| --- | --- | --- | --- | --- |
| Dark panel `#0A0F16` | `green-300` | `green-400` | `green-400 / 14%` | **13.69** · **11.03** |
| Black poly `#0C0D0F` | `green-300` | `green-400` | `green-400 / 12%` | **13.85** · **11.16** |
| Dark glass `#191B1F` | `green-300` | `green-400` | `green-400 / 16%` | **12.28** · **9.90** |
| Dark wheel `#23262B` | `green-300` | `green-400` | `green-400 / 18%` | **10.81** · **8.71** |
| Light panel `#F2F6FB` | `green-800` | `green-700` | `green-500 / 16%` | **6.57** · **4.62** |
| White poly `#E2E5E8` | `green-800` | `green-700` | `green-500 / 14%` | **5.64** · **3.97** |
| Light glass `#EEF0F3` | `green-800` | `green-700` | `green-500 / 18%` | **6.25** · **4.39** |
| White wheel `#E9EBED` | `green-800` | `green-700` | `green-500 / 14%` | **5.97** · **4.20** |

⚑ **`green-700` is not text on light surfaces.** It measures 3.97 on white polycarbonate and 4.39 on light glass — both under 4.5. Agent text on light is `green-800`, without exception. This is the tightest constraint in the R2 palette and the most likely thing to be got wrong in implementation.

#### The co-occurrence rule (replaces R1's adjacency rule)

When a human mark and an agent mark are within 24px or overlap, the steps are forced to the pair that maximises the *residual* separation:

| Mode | Human | Agent | Greyscale | Tritan ΔE | Deutan ΔE |
| --- | --- | --- | --- | --- | --- |
| **Dark** | `sky-500 #0EA5E9` | `green-200 #BBF7D0` | **2.29:1** | **22.6** | **30.2** |
| **Light** | `sky-700 #0369A1` | `green-900 #14532D` | **1.54:1** | **12.7** | **17.7** |

Both pass ≥4.5:1 against every surface in their mode. And both are still, in greyscale, nearly the same value — 2.29:1 and 1.54:1 are *not* attribution. ⚑ **Therefore the co-occurrence rule additionally forces the form channels to their maximum:** the agent stroke goes 1.5px → 2px, its dash goes `3 3` → `4 3` (more gap, more obviously discontinuous), the human mark gains a 2px `--human-900` outer contour, and on light surfaces every actor mark gains a 1px `#FFFFFF / 80%` contour. Colour is doing none of the work here; it is confirming what the geometry already said.

### 4.10 Co-pilot / handoff — the third state

Unchanged in structure from R1, re-hued. Co-pilot means a human initiated it and the agent completed it, or the reverse. **A third hue would erase attribution** — it would say "someone did this" when the point is that both did. The primitive is a **braid**, not a colour.

| Token | Value | Tailwind | Usage |
| --- | --- | --- | --- |
| `--copilot-braid-a` | `#0EA5E9` / `#0369A1` | `sky-500` dark / `sky-700` light | Odd dash segments (human) |
| `--copilot-braid-b` | `#4ADE80` / `#166534` | `green-400` dark / `green-800` light | Even dash segments (agent) |
| `--copilot-braid-dash` | `4px 4px` | — | `stroke-dashoffset` animates |
| `--copilot-braid-speed` | `18px/s` | — | Travel direction indicates who holds the action next |
| `--copilot-300` | `#C4B5FD` | `violet-300` | Co-pilot text on dark — **10.41:1** on dark panel |
| `--copilot-500` | `#8B5CF6` | `violet-500` | Collapsed fill; chip background — 4.54:1 dark |
| `--copilot-700` | `#6D28D9` | `violet-700` | Co-pilot text on light — **6.55:1** on light panel |
| `--copilot-glow` | `violet-500 / 30%` | — | Handoff pulse glow |

`violet` is the collapsed fill because it is the perceptual midpoint of sky and green in neither hue nor luminance — it is deliberately *outside* both, so a co-pilot chip can never be mistaken for a single-actor mark. It appears only where a single flat fill is unavoidable; everywhere else, the braid.

### 4.11 Semantic tokens — and the success ruling

#### ⚑ The success problem, and the ruling

Green is now the agent's identity, so a green success tick on a human action misattributes it. The coordinator's proposal was: *success has no hue of its own; it renders in the colour of whichever actor caused it (blue human, green agent, neutral system).*

**Ruling: the premise is right, the mechanism is wrong. Adopt the premise, replace the mechanism.**

*Right:* success must not have a dedicated hue, and green in particular is now unavailable. Correct call.

*Wrong:* if success renders in the actor's own colour, then "in progress" and "succeeded" are **the same colour on the same mark** — so the completion signal disappears entirely. Colour was never carrying success; it was carrying *valence*, and valence is exactly what we just removed. The proposal solves the collision and deletes the signal.

⚑ **Success is a form event: CLOSURE.** Every actor mark has an open state while acting and a closed state on success. The actor's colour never changes.

| Actor | Acting (open) | Success (closed) | Motion |
| --- | --- | --- | --- |
| **Human** | partial arc — 26° of a ring, or a ring at 1px | ring **closes** to a full 360° at 2px, then collapses inward and vanishes | `spring/select`, 300ms |
| **Agent** | hexagon, 1.5px, `dasharray 3 3` | dash gaps **collapse to zero** (`3 3` → `6 0`) making it a solid hexagon outline, which then fills | `dur/micro` 140ms `linear` |
| **System** (no actor) | — | neutral filled check glyph in `--foreground`, **no hue at all** | 120ms opacity |

Why this is better: closure is a *state change*, so it reads before and after; it is greyscale-safe, CVD-safe, and reduced-motion-safe (the closed state is a static end state, not an animation); and it keeps the actor colours doing one job instead of two.

⚑ **Static affirmative states carry no hue either.** "Downloaded", "In Library", "Lossless" are a neutral `--foreground` glyph at weight 600 — *not* green, *not* blue. A settings list of twelve green ticks would both collide with agent identity and be visual noise. This is a design improvement the client's constraint forced, not a concession.

#### What the change frees up

⚑ **Red is now completely unowned** — crimson is demoted to brand, no actor uses red, and success no longer needs green. So destructive/error can take the full, unambiguous `red` ramp with none of R1's hue-collision gymnastics. This is a **net gain** from the client's change and the strongest argument for it.

| Token | Tailwind | Hex | Usage | Dark panel | Light panel |
| --- | --- | --- | --- | --- | --- |
| `--destructive` | `red-500` | `#EF4444` | Canonical destructive fill, ≥24px icons | **5.11** | 3.47 (fill only) |
| `--destructive-onDark` | `red-400` | `#F87171` | Destructive **text** on dark | **6.95** | — |
| `--destructive-onLight` | `red-700` | `#B91C1C` | Destructive **text** on light | — | **5.96** |
| `--warning` | `amber-500` | `#F59E0B` | Warning fill | **8.95** | 1.98 (fill only) |
| `--warning-onDark` | `amber-400` | `#FBBF24` | Warning text on dark | **11.51** | — |
| `--warning-onLight` | `amber-700` | `#B45309` | Warning text on light | — | **4.63** |
| `--offline` | `slate-500` | `#64748B` | Offline / unavailable | 4.04 | 4.39 |
| `--offline-onDark` | `slate-400` | `#94A3B8` | Offline text on dark | **7.49** | — |
| `--offline-onLight` | `slate-600` | `#475569` | Offline text on light | — | **6.98** |
| `--offline-hatch` | `slate-500 / 22%` | — | 45° 2px hatch on unavailable artwork — the non-colour offline channel | — | — |

> `--offline` at 4.04 / 4.39 sits just under 4.5. It is used **only** for inactive controls, which WCAG 2.2 SC 1.4.3 exempts. Where offline state must be *read* rather than merely seen, use the `-onDark` / `-onLight` variants.

#### Apple Music crimson — demoted to brand-only

| Token | Hex | Usage | Dark panel | Light panel |
| --- | --- | --- | --- | --- |
| `--brand-am` | `#FA243C` | ⚑ **Brand only.** Now-Playing progress fill, Loved heart, station chips, wordmark accent | **4.93** (fill/glyph) | 3.60 (fill/glyph) |
| `--brand-am-light` | `#FC3C44` | Apple's lighter crimson, for fills in the light room | 5.37 | 3.30 |
| `--brand-am-text` | `#BE123C` (`rose-700`) | Crimson **text**, light surfaces only | — | **5.79** |

⚑ **Hard constraints on the brand token.** It is not an actor colour and must never behave like one: never on a hexagon, never on either orbit, never as a stroke on an actor mark, never in the ticker, never glowing. The progress fill is a flat 3px bar with no bloom, so that on the Now Playing screen the crimson reads as *chrome* while the sky and green marks read as *events*. If a crimson element ever animates with a spring, it is a bug — brand chrome does not act.


### 4.12 Liquid Glass tokens (the non-device layer)

Per LAW 1, these apply to the sidecar, overlays, sheets, consent interrupts, ticker, and toasts — and to nothing on the device. Values follow `liquid-glass.md`.

| Token | Light room | Dark room | Usage |
| --- | --- | --- | --- |
| `--lg-bg` | `#FFFFFF / 72%` | `#0F1114 / 68%` | Regular glass: sidecar, toolbars |
| `--lg-bg-clear` | `#FFFFFF / 45%` | `#0F1114 / 35%` | Clear glass: overlays on artwork |
| `--lg-border` | `#FFFFFF / 28%` | `#FFFFFF / 8%` | 1px border, centre-aligned |
| `--lg-blur` | `24px` | `24px` | `backdrop-filter: blur()` — capped at 40px (mobile Safari) |
| `--lg-saturate` | `1.8` | `1.8` | `backdrop-filter: saturate()` |
| `--lg-surface` | `#EEF0F3` | `#191B1F` | Opaque fallback for `prefers-reduced-transparency` |
| `--lg-ink-1` | `#16181C` | `#F2F4F7` | Glass primary text — **15.57:1** / **15.65:1** |
| `--lg-ink-2` | `#565C66` | `#A8AEB8` | Glass secondary text — **5.90:1** / **7.73:1** |
| `--lg-scrim` | `#000000 / 35%` | `#000000 / 48%` | Dimming layer behind clear glass on bright media |
| `--lg-edge-top` | `#FFFFFF / 18%` | `#FFFFFF / 6%` | Scroll-edge fade, 16px |
| `--lg-shadow` | `0 12px 32px #1E212611 / 18%` | `0 12px 32px #000000 / 40%` | Glass panel elevation |

> Liquid Glass gets **no gloss, no bevel, no inner highlight, no specular arc.** Those are device vocabulary. Glass gets blur, translucency, a 1px border and a soft elevation shadow. Full stop.

---

### 4.13 Tailwind policy and the shadcn semantic mapping

⚑ **Rule: every colour that can be a Tailwind v4 palette value is one, and is named as one.** Implementation leans on shadcn/ui, so a token that resolves to a real palette step costs nothing to maintain, survives a designer handoff, and is checkable by grep. Custom hexes are a liability and must be justified.

**Exempt from the rule — and why.** Physical surfaces cannot use palette steps, because a material is a *curve*, not a swatch: the black polycarbonate needs eight non-uniformly-spaced stops with a non-monotonic tail (§4.2), and the mirrored steel needs ten with a dark horizon band that no palette contains (§4.4, §10.4). Forcing these onto Tailwind steps would flatten exactly the property that makes them read as materials.

| Group | Tailwind-based? | Basis |
| --- | --- | --- |
| Actor accents (human, agent) | ✓ **required** | `sky`, `green` |
| Co-pilot | ✓ | `violet` |
| Semantics | ✓ | `red`, `amber`, `slate` |
| Screen UI text / dividers / chrome | ✓ | `slate` |
| Environment | ✓ mostly | `slate`-adjacent; four custom stops for the sweep |
| Liquid Glass | ✓ | `white` / `slate-900` at alpha |
| **Polycarbonate (black & white)** | ✗ **exempt** | custom 8-stop curves |
| **Stainless steel** | ✗ **exempt** | custom 10-stop curve |
| **Click wheel surfaces** | ✗ **exempt** | custom, but ⚑ **neutrals rebased on `slate`** — R1's wheel greys were hue-neutral; R2 pulls them onto the slate axis so they sit in the same family as everything else |
| **Display glass / specular / refraction** | ✗ **exempt** | alpha-white and two custom dispersion tints |
| **Apple Music crimson** | ✗ **exempt** | brand fidelity; `#FA243C` is a licensed brand value, not a design choice |

**Material neutrals rebased on `slate`.** Where a material token was a hue-neutral grey in R1, it is re-derived on the slate axis (hue ≈ 250° in OKLCH, chroma ≤ 0.02) so the whole product sits in one temperature. This is why the wheel recess shadow is now `slate-400` at alpha in light mode rather than a neutral grey (§5.3).

#### shadcn/ui semantic mapping

These are the variables shadcn components read. Both modes given. The **Liquid Glass layer** consumes these; the **device** does not — device surfaces come from the material tokens and are deliberately outside this table (LAW 1).

| shadcn variable | Light mode | Dark mode | Notes |
| --- | --- | --- | --- |
| `--background` | `#F1F3F7` (`--room-0`) | `#0B0D10` (`--room-2`) | The room, not the device |
| `--foreground` | `#0F172A` `slate-900` | `#F1F5F9` `slate-100` | **14.92:1** / **17.11:1** |
| `--card` | `#FFFFFF / 72%` (`--lg-bg`) | `#0F1114 / 68%` | Liquid Glass; opaque fallback `--lg-surface` |
| `--card-foreground` | `#16181C` | `#F2F4F7` | **15.57:1** / **15.65:1** |
| `--popover` | `#FFFFFF / 80%` | `#141619 / 76%` | Slightly denser than `--card` |
| `--popover-foreground` | `#0F172A` | `#F1F5F9` | — |
| `--primary` | `#0369A1` `sky-700` | `#0EA5E9` `sky-500` | ⚑ **The human actor colour.** Primary = the person |
| `--primary-foreground` | `#FFFFFF` | `#04283C` `sky-950`-ish | 5.93:1 / 8.1:1 |
| `--secondary` | `#E2E8F0` `slate-200` | `#1E293B` `slate-800` | Neutral surface |
| `--secondary-foreground` | `#0F172A` | `#F1F5F9` | — |
| `--muted` | `#E2E8F0` `slate-200` | `#1E293B` `slate-800` | — |
| `--muted-foreground` | `#475569` `slate-600` | `#94A3B8` `slate-400` | **6.98:1** / **7.49:1** |
| `--accent` | `#15803D` `green-700` | `#4ADE80` `green-400` | ⚑ **The agent actor colour.** Accent = the assistant |
| `--accent-foreground` | `#FFFFFF` | `#052E16` `green-950` | 4.6:1 / 9.9:1 |
| `--destructive` | `#B91C1C` `red-700` | `#F87171` `red-400` | **5.96:1** / **6.95:1** |
| `--destructive-foreground` | `#FFFFFF` | `#450A0A` `red-950` | — |
| `--border` | `#CBD5E1` `slate-300` | `#334155` `slate-700` | 1.37:1 / 1.86:1 — non-text, SC 1.4.11 applies only to *required* boundaries |
| `--input` | `#CBD5E1` `slate-300` | `#475569` `slate-600` | Input borders are required boundaries → **3.0:1** minimum, met in dark; light uses `slate-400 #94A3B8` at 2.36 → ⚑ **use `slate-500 #64748B` (3.5:1)** |
| `--ring` | `#0369A1` `sky-700` | `#38BDF8` `sky-400` | ⚑ Focus ring is the **human** colour — focus is a human state (§11.5) |
| `--radius` | `0.875rem` (14px) | same | Sidecar card; concentric children derive per §7.1 |

⚑ **`--primary` = human and `--accent` = agent is a deliberate, load-bearing mapping.** It means any shadcn component dropped in unmodified is already correctly attributed: a `<Button>` is a human action, a `<Badge variant="accent">` is an agent one. Do not remap these for visual variety.

### 4.14 Themed panel tokens (both modes)

⚑ **Confirmed: panel tint light `#F2F6FB` / dark `#0A0F16`.** Both are correct as set on canvas and both are adopted. The reasoning is right and worth recording: a neutral grey panel would be the only hue-neutral surface in the product and would read as *dead* next to a tinted room; pulling the tint toward the human blue makes the panel feel like it belongs to the person operating it. The values are also well-behaved — the dark tint at Y=0.00464 gives 18.37:1 headroom to `slate-50`, and the light tint at Y=0.9175 gives 18.59:1 to `slate-950`.

One correction: the panel black is `#0A0F16`, **not** `#000000`, for the physical reason given in R1 §4.6 — an LCD leaks backlight and the glass reflects the room. The R2 tint happens to also satisfy that constraint, so it stands unchanged.

| Token | Light `#F2F6FB` | Ratio | Dark `#0A0F16` | Ratio | Tailwind |
| --- | --- | --- | --- | --- | --- |
| `--ui-bg` | `#F2F6FB` | — | `#0A0F16` | — | custom tint |
| `--ui-bg-alt` | `#E9EEF6` | — | `#0E141C` | — | alternating row band |
| `--ui-statusbar-0` | `#DCE4EF` | — | `#1B222C` | — | status bar gradient top |
| `--ui-statusbar-1` | `#CBD5E1` | — | `#12181F` | — | `slate-300` / custom |
| `--ui-text-1` | `#0F172A` `slate-900` | **16.45** | `#F8FAFC` `slate-50` | **18.37** | primary |
| `--ui-text-2` | `#334155` `slate-700` | **9.54** | `#CBD5E1` `slate-300` | **12.94** | secondary |
| `--ui-text-3` | `#475569` `slate-600` | **6.98** | `#94A3B8` `slate-400` | **7.49** | tertiary |
| `--ui-text-4` | `#64748B` `slate-500` | 4.39 | `#64748B` `slate-500` | 4.04 | disabled — SC 1.4.3 exemption |
| `--ui-divider` | `#CBD5E1` `slate-300` | 1.37 | `#1E293B` `slate-800` | 1.31 | 1px row divider |
| `--ui-divider-strong` | `#94A3B8` `slate-400` | 2.36 | `#334155` `slate-700` | 1.86 | section divider; `prefers-contrast` default |
| `--ui-chevron` | `#64748B` `slate-500` | 4.39 | `#94A3B8` `slate-400` | 7.49 | disclosure chevron (non-text, 3:1) |
| `--ui-scrollbar-track` | `#E2E8F0` `slate-200` | — | `#161C25` | — | — |
| `--ui-scrollbar-thumb` | `#94A3B8` `slate-400` | 2.36 | `#475569` `slate-600` | 2.54 | thumb (non-text) |
| `--ui-artwork-frame` | `#0F172A / 10%` | — | `#FFFFFF / 12%` | — | 1px stroke around album art |
| `--ui-artwork-shadow` | `#334155 / 22%` | — | `#000000 / 60%` | — | `0 2px 4px` |

> ⚑ The panel texture layers (§4.6 scanline, sub-pixel, vignette) invert in light mode: `--panel-scanline` becomes `#0F172A / 3%` (dark lines on a light field) and `--panel-vignette` becomes `#334155 / 10%`. A light LCD's row structure is *darker* than its cells, not lighter. Combined opacity ceiling stays **≤ 7%**.


---

## 5. Material recipes

Each recipe is an **ordered layer list, bottom to top**. Every layer states fill, stroke and effects with concrete values. These are implementable as written.

### 5.1 Glossy black polycarbonate body

Target size: **330 × 552px** (mobile, as built) / 390 × 653px (desktop). Radius: squircle, see §7.1.

| # | Layer | Specification |
| --- | --- | --- |
| 1 | **Contact shadow (outer)** | Two shadows, both outer, on the body shape:<br>`0 24px 48px 0 --room-contact` (ambient)<br>`0 4px 10px -2px --room-ao` (contact) |
| 2 | **Substrate fill** | `linear-gradient(180deg, #3E4147 0%, #262A2E 5%, #16181C 19%, #0C0D0F 44%, #0A0B0D 62%, #121417 81%, #1E2126 93%, #32363C 100%)` |
| 3 | **Horizontal cylinder shading** | `linear-gradient(90deg, #000000 0%, transparent 12%, transparent 88%, #000000 100%)` at `opacity 0.34`, blend `multiply`. *Why:* the body face is very slightly cylindrical; without this the face reads as flat card stock. |
| 4 | **Sub-surface warmth** | `radial-gradient(120% 60% at 50% 118%, #6E4A2E 0%, transparent 70%)` at `opacity 0.10`, blend `screen`. *Why:* black polycarbonate is not opaque — light entering the bottom edge scatters a faint warm glow. This is the single layer most responsible for "plastic" rather than "painted metal". |
| 5 | **Primary specular arc** | Shape: an ellipse `width 74%`, `height 26%`, centred at `x 32%, y -6%` (so only its lower arc is visible). Fill `linear-gradient(180deg, --poly-k-specular 0%, #FFFFFF / 10% 62%, transparent 100%)`. `filter: blur(6px)`. Blend `screen`. Clipped to the body shape. |
| 6 | **Secondary broad sheen** | `linear-gradient(163deg, --poly-k-specular-2 0%, transparent 34%)`, blend `screen`. |
| 7 | **Edge highlight (inner stroke)** | Inner shadow used as a stroke: `inset 0 1px 0 0 --poly-k-edge-hi`. Alignment **inner**, width 1px, top edge only. |
| 8 | **Fill-light rim (inner stroke)** | `inset 1px -1px 0 0 --poly-k-edge-lo`. Inner, 1px, bottom-left. |
| 9 | **Ambient occlusion (inner)** | `inset 0 -14px 22px -14px #000000 / 40%` — the body darkens where it curves away at the bottom. |
| 10 | **Micro-noise** | 1px monochrome noise, `opacity 0.022`, blend `overlay`, tiled 128px. *Why:* kills gradient banding (§10.2). Never above 0.03. |

### 5.2 Mirror-polished stainless steel back

Applied to the device's reverse face, revealed by the expose flip.

| # | Layer | Specification |
| --- | --- | --- |
| 1 | **Contact shadow (outer)** | Identical to §5.1 layer 1. |
| 2 | **Base metal fill** | `linear-gradient(168deg, #F6F8FA 0%, #C6CDD4 7%, #EDF1F5 16%, #929BA5 29%, #656E78 43%, #7C858F 50%, #ADB6BF 58%, #E1E7EC 71%, #96A0AA 85%, #C7CED5 94%, #7A828C 100%)` |
| 3 | **Sky reflection blob** | `radial-gradient(78% 46% at 26% 12%, --steel-sky 0%, #FFFFFF / 12% 44%, transparent 78%)`, blend `screen`. *Why:* a mirror reflects a *scene*, and the brightest thing in any room is the light source. Without a localised blob the gradient reads as printed. |
| 4 | **Dark-half reflection** | `radial-gradient(96% 54% at 72% 88%, #1E252E 0%, #1E252E / 40% 38%, transparent 76%)` at `opacity 0.42`, blend `multiply`. The room's dark half, mirrored. |
| 5 | **Horizon line** | 1px horizontal line at `y 43%`, `#4A525C`, `opacity 0.5`, `filter: blur(0.5px)`. The hard transition between reflected wall and reflected floor. |
| 6 | **Anisotropic brush grain** | Two overlaid 1px-stripe patterns at `0deg`: `--steel-aniso` stripes with 3px stride, `--steel-aniso-dark` stripes with 5px stride. `filter: blur(0.4px)`. Combined effective opacity **≤ 5%**. *Why:* polished 304 stainless retains directional micro-grain; it is what stops the surface reading as chrome-plated plastic. Horizontal-only — a cross-hatch would read as brushed aluminium, which is a different material. |
| 7 | **Chamfer band (inner stroke)** | Three stacked 1px inner strokes: `inset 0 0 0 1px --chrome-seam-hi`, `inset 0 0 0 2px --chrome-seam-mid`, `inset 0 0 0 3px --chrome-seam-lo`. |
| 8 | **Edge falloff (inner)** | `inset 0 0 26px -8px #3A424C / 46%` — the plate darkens toward its rolled edges. |
| 9 | **Micro-noise** | `opacity 0.016`, blend `overlay`. Lower than the plastic's, because polished metal is smoother. |

### 5.3 Recessed click wheel

Composed of three concentric constructs: the **body recess** (a hole in the body), the **ring surface** (the wheel face, sitting 1.5px below the body plane), and the **center button** (§5.4). Diameters: 238px mobile / 273px desktop outer; 91px / 104px inner.

| # | Layer | Specification |
| --- | --- | --- |
| 1 | **Recess opening — outer lip highlight** | On the body, a circle at wheel diameter + 2px. Stroke 1px, alignment **outer**. Fill `conic-gradient(from 180deg, --wheel-k-rim-outer-lo 0deg, --wheel-k-rim-outer-hi 180deg, --wheel-k-rim-outer-lo 360deg)`. *Why conic:* the lip catches light on its top arc and is in shadow on its bottom arc — a uniform stroke would flatten it. |
| 2 | **Recess cavity shadow** | Outer shadow on the ring shape, drawn *upward*: `0 2px 3px 0 #000000 / 30%` plus the body-side inner shadow `inset 0 5px 11px 0 --wheel-k-recess-shadow` on the opening. |
| 3 | **Ring surface fill** | `linear-gradient(180deg, #14161A 0%, #1E2126 38%, #23262B 62%, #2C3037 100%)` (black variant; white variant uses `--wheel-w-0..3`). |
| 4 | **Ring radial sheen** | `radial-gradient(120% 120% at 34% 16%, #FFFFFF / 9% 0%, transparent 62%)`, blend `screen`. The wheel face is very slightly domed. |
| 5 | **Recess inner shadow — top** | ⚑ **R2:** `inset 0 5px 11px 0 --wheel-k-recess-shadow` — i.e. `#000000E0` dark, `#94A3B85C` light. **Top edge.** This is the inversion that makes it a hole.<br><br>*Adopted from canvas, and correct.* R1 specified `0 3px 7px` at 72%/58%; at the shipped wheel diameter (238px mobile) that reads as a printed ring rather than a cavity. The depth cue in a recess is the **ratio of shadow blur to lip width**: the lip is 1px, so a 7px blur gives 7:1 and reads soft/ambiguous, while 11px gives 11:1 and reads as a hard-edged cut. The alpha increase matters more in dark mode (72% → 88%) because the surrounding body is already near-black and a 72% shadow on `#23262B` produces only a 1.3:1 step. |
| 6 | **Recess inner highlight — bottom** | `inset 0 -1px 2px 0 --wheel-k-recess-hi`. ⚑ **Bottom edge.** Light bounces off the cavity floor onto the lower inside wall. |
| 7 | **Quadrant seams** | Four 1px radial lines at 45°, 135°, 225°, 315°, from inner radius + 4px to outer radius − 4px. `#000000 / 22%` (black) or `#8B949E / 26%` (white), `filter: blur(0.4px)`. Barely visible at rest — the real wheel is one continuous surface, and these only exist to hint at the quadrants. `opacity 0.55` at rest, `1.0` on hover/focus. |
| 8 | **Printed labels** | `MENU` at top (12° arc-centred, upright), `⏭` right, `▶⏸` bottom, `⏮` left. Type: Source Sans 3 600, 11px (mobile 13px), letter-spacing `+0.14em`, colour `--wheel-k-label` / `--wheel-w-label`. Positioned on a circle at `innerRadius + (ringWidth × 0.57)` from centre — ⚑ **R3 corrected from 0.30**; measured on the built artboard the band sits at r 77–79 for `wheelR` 106. Add `text-shadow: 0 1px 0 #000000 / 30%` (black variant) or `0 1px 0 #FFFFFF / 70%` (white) — screen-printed ink sits *on* the surface and casts a hairline. |
| 9 | **Inner opening shadow** | Where the ring meets the center button: `inset 0 0 0 1px #000000 / 40%` on the inner circle, plus `inset 0 2px 3px 0 #000000 / 28%`. |
| 10 | **Micro-noise** | `opacity 0.02`, blend `overlay`. |

### 5.4 Translucent center Select button

Diameter 91px mobile / 104px desktop. The only raised element on the wheel.

| # | Layer | Specification |
| --- | --- | --- |
| 1 | **Seating shadow (outer)** | ⚑ **R2:** `0 0 2px 0 --select-ao` (occlusion) + `0 4px 9px -1px --select-drop` (lift). Both outer.<br><br>*Adopted from canvas.* R1's `0 1.5px 4px -1px` seated the button flush; the deeper lift is right because the Select button is the **only raised element on the wheel** (§5.4 preamble) and its whole job is to contradict the recession around it. A 4px offset against an 11px recess blur reads as ~1.2mm of proud travel, which is close to the real part. |
| 2 | **Translucent fill** | `linear-gradient(180deg, #3A3E45 / 92% 0%, #262A30 / 88% 34%, #1B1E23 / 90% 70%, #2A2E34 / 94% 100%)`. Backed by `backdrop-filter: blur(3px) brightness(0.92)`. ⚑ This is the **one** place the device uses `backdrop-filter`, and it is not Liquid Glass — it is a translucent polycarbonate plug refracting the wheel beneath it. Distinguished by having a gloss layer (layer 5) and no border-translucency, which Liquid Glass never has. |
| 3 | **Internal volumetric core** | `radial-gradient(64% 64% at 44% 34%, --select-core 0%, transparent 72%)`, blend `screen`. The depth you see *inside* the plug. |
| 4 | **Rim (inner strokes)** | `inset 0 1px 0 0 --select-rim-hi` (top arc) + `inset 0 -1px 0 0 --select-rim-lo` (bottom arc). |
| 5 | **Gloss arc** | Ellipse, `width 68%`, `height 30%`, centred `x 46%, y 8%`. Fill `linear-gradient(180deg, #FFFFFF / 46% 0%, #FFFFFF / 6% 74%, transparent 100%)`. `filter: blur(1.5px)`. Blend `screen`. Clipped to the circle. |
| 6 | **Bottom caustic** | `radial-gradient(80% 40% at 50% 104%, #FFFFFF / 14% 0%, transparent 70%)`, blend `screen`. Light that passed through the plug and bounced. |
| 7 | **Micro-noise** | `opacity 0.018`, blend `overlay`. |

**Pressed state** (see also §5.10):

| Change | Value |
| --- | --- |
| Transform | `translateY(1px) scale(0.994)` |
| Layer 1 shadow | → `0 0 1.5px 0 #000000 / 30%` + `0 1px 3px -1px --select-pressed-drop` (from `0 4px 9px -1px` — the lift collapses, which is the press) |
| Layer 5 gloss | `width 68% → 56%`, `x 46% → 48%`, `opacity ×0.82` |
| New overlay | `--select-pressed-tint`, blend `multiply` |
| Layer 4 top rim | `opacity ×0.7` (less light reaches a recessed lip) |
| Duration | 70ms in, `spring/press` out |

### 5.5 Glass display panel with specular

The glass is a **separate physical sheet** stacked above the panel, extending 6px beyond the active area on every side (the printed black border). Active area 280 × 210px mobile / 320 × 240px desktop.

| # | Layer | Specification |
| --- | --- | --- |
| 1 | **Bezel opening shadow** | On the body, around the glass cutout: `inset 0 1px 3px 0 --glass-inner-shadow` plus a 1px outer stroke `#000000 / 50%`. |
| 2 | **Glass surround** | Fill `--glass-surround` `#05060A`, flat, occupying the 6px border. Radius 8px desktop / 7px mobile. |
| 3 | **Panel base** | Fill `--panel-bg` `#0B0D11`. Radius 5px desktop / 4px mobile (concentric: 8 − 3px print inset). |
| 4 | **Panel content** | The 320 × 240 UI, rendered per §4.7 and §6.4, in its own transformed layer. |
| 5 | **Sub-pixel triad** | `repeating-linear-gradient(90deg, --panel-subpixel-r 0 1px, --panel-subpixel-g 1px 2px, --panel-subpixel-b 2px 3px)`, blend `overlay`. Disabled below panel scale 0.75. |
| 6 | **Scanlines** | `repeating-linear-gradient(180deg, --panel-scanline 0 1px, --panel-scanline-dark 1px 3px)`, blend `overlay`. Combined with layer 5: **≤ 7% total opacity**. |
| 7 | **Backlight vignette** | `radial-gradient(126% 126% at 50% 48%, transparent 52%, --panel-vignette 100%)`, blend `multiply`. |
| 8 | **Glass room reflection** | Flat `--glass-room-reflect` over the whole glass sheet, blend `screen`. This is why the panel black is `#0B0D11` and not `#000000`. |
| 9 | **Primary specular sheen** | A quadrilateral, not a stripe (§10.5). Vertices as fractions of the glass sheet: `(0.00, 0.00) → (0.62, 0.00) → (0.34, 1.00) → (0.00, 1.00)`. Fill `linear-gradient(118deg, --glass-specular-1 0%, #FFFFFF / 6% 44%, transparent 82%)`. `filter: blur(9px)`. Blend `screen`. Clipped to the glass sheet. *Why a skewed quad with a blurred, graded fill:* a hard-edged uniform diagonal band is the single most recognisable "fake glass" tell. |
| 10 | **Counter-sheen** | `radial-gradient(70% 50% at 88% 92%, --glass-specular-2 0%, transparent 74%)`, blend `screen`. Weaker light from the fill source. |
| 11 | **Top cut-edge line** | 1px line along the glass sheet's top edge, `--glass-specular-edge`, inset 0. |
| 12 | **Edge refraction — cool** | 3px inner band on the **top and left** edges. `linear-gradient(to bottom right, --glass-refract-hi 0%, transparent 100%)`, `filter: blur(2px)`, blend `screen`. |
| 13 | **Edge refraction — warm** | 3px inner band on the **bottom and right** edges. `linear-gradient(to top left, --glass-refract-lo 0%, transparent 100%)`, `filter: blur(2px)`, blend `screen`. *Why two hues:* real chromatic dispersion splits light at a chamfer. Cool one way, warm the other. This detail is small, cheap, and disproportionately convincing. |
| 14 | **Content bloom** | Bright panel content (anything above 70% luminance) emits `--panel-backlight-bloom` via a duplicated, `blur(4px)`, `screen`-blended copy at `opacity 0.30`. Budget: one composited layer, disabled on `prefers-reduced-transparency`. |

### 5.6 Chrome bezel seam

The 3px line where the steel back's rolled edge meets the polycarbonate front. It runs the entire perimeter of the device silhouette.

| # | Layer | Specification |
| --- | --- | --- |
| 1 | **Shadow under the seam** | On the body: `inset 0 0 0 4px --poly-k-seam-shadow` (or `--poly-w-seam-shadow`), then masked to a 4px perimeter band. |
| 2 | **Dark inner hairline** | 1px stroke, alignment **inner**, offset 2px from the silhouette. `--chrome-seam-lo`. |
| 3 | **Chamfer body** | 1px stroke, **inner**, offset 1px. `conic-gradient(from 200deg, --chrome-seam-mid 0deg, --chrome-seam-hi 150deg, --chrome-seam-bounce 240deg, --chrome-seam-mid 360deg)`. *Why conic:* a metal edge running around a rounded rectangle presents different angles to the light at every point. A flat stroke here is the classic "chrome that reads as grey plastic" failure (§10.6). |
| 4 | **Bright outer hairline** | 1px stroke, alignment **outer**, offset 0. `--chrome-seam-hi` at `opacity 1.0` on the top arc, ramping to `opacity 0.22` on the bottom arc via a `conic-gradient` mask `from 0deg`. |
| 5 | **Corner glints** | Four 6px radial highlights at the silhouette's corner arc midpoints, `#FFFFFF / 70%`, `blur(1.5px)`, blend `screen`, at `opacity 0.9` (top two) and `0.28` (bottom two). *Why:* a rolled metal edge concentrates a glint where its curvature is highest. This is the detail that sells the seam as metal. |

### 5.7 Engraved text (inset letterpress)

Used for the Apple logo, the `iPod` wordmark, capacity, and the functional Settings labels on the steel back. Laser etching into steel removes material, so the groove's **upper wall is in shadow** and its **lower wall catches light**.

| # | Layer | Specification |
| --- | --- | --- |
| 1 | **Groove shadow** | Text duplicate, offset `0 -1px`, colour `--steel-engrave-lo`, `filter: blur(0.6px)`, `opacity 0.9`. |
| 2 | **Groove floor** | The text itself, filled `--steel-engrave-lo` at `opacity 0.62`, blend `multiply`. |
| 3 | **Lower-wall highlight** | Text duplicate, offset `0 1px`, colour `--steel-engrave-hi`, `filter: blur(0.5px)`, blend `screen`. |
| 4 | **Etch texture** | The text mask filled with a 0.5px horizontal noise at `opacity 0.10`, blend `overlay`. Laser etching leaves a matte, slightly diffuse floor — a perfectly smooth groove reads as a decal. |

**CSS shorthand** (for a `<span>` on steel):
```
color: transparent;
background: --steel-engrave-lo; -webkit-background-clip: text;
text-shadow:
  0 -1px 0.6px #5A626B,
  0  1px 0.5px #FFFFFF / 72%,
  0  0   1px   #3E464F / 40%;
opacity: 0.92;
```

⚑ **Never** apply the engrave recipe to text below 11px, and never to text carrying information the user needs — engraving costs ~2 stops of contrast. Functional labels use `--steel-label-ink` flat at 8.11:1 with **no** engrave treatment.

### 5.8 Embossed text (raised)

Used for the `webPod` wordmark in the environment and the hold-switch `HOLD` legend. Raised material catches light on top and shadows below — the exact inverse of §5.7.

| # | Layer | Specification |
| --- | --- | --- |
| 1 | **Cast shadow** | Text duplicate, offset `0 2px`, colour `#000000 / 34%` (dark room) or `#5C554B / 30%` (light room), `blur(2px)`. |
| 2 | **Lower bevel shadow** | Duplicate, offset `0 1px`, colour `#000000 / 40%`, `blur(0.5px)`. |
| 3 | **Face** | The text, filled with the parent surface colour +4% luminance. |
| 4 | **Upper bevel highlight** | Duplicate, offset `0 -1px`, colour `#FFFFFF / 62%`, `blur(0.5px)`, blend `screen`. |
| 5 | **Crest specular** | Duplicate, offset `0 -1.5px`, colour `#FFFFFF / 22%`, `blur(1.5px)`, blend `screen`, clipped to the top 40% of the glyph bounding box. |

### 5.9 Physical toggle switch (the hold switch, and settings toggles on the steel back)

Track 44 × 22px, thumb 20 × 20px. Slides horizontally. Off = thumb left, On = thumb right, revealing the `--hold-active` indicator field.

**Track**

| # | Layer | Specification |
| --- | --- | --- |
| 1 | Recess shadow | `inset 0 2px 4px 0 #000000 / 46%` — the track is a channel milled into the surface. |
| 2 | Track fill | `linear-gradient(180deg, #16181C 0%, #1F2328 100%)` (black) / `linear-gradient(180deg, #C8CCD1 0%, #DDE1E5 100%)` (white). |
| 3 | Indicator field | Fill `--hold-active` `#DC4E0E`, occupying the track's left 22px, revealed as the thumb moves right. Inner shadow `inset 0 1px 2px 0 #000000 / 34%`. |
| 4 | Track lip highlight | `inset 0 -1px 0 0 #FFFFFF / 22%` — bottom inside edge. |
| 5 | Radius | `11px` (height / 2). |

**Thumb**

| # | Layer | Specification |
| --- | --- | --- |
| 1 | Drop shadow | `0 1px 2px 0 #000000 / 42%` + `0 2px 6px -1px #000000 / 26%`. |
| 2 | Fill | `linear-gradient(180deg, #F6F8FA 0%, #DDE2E7 46%, #C6CDD4 82%, #D6DBE0 100%)`. |
| 3 | Rim | `inset 0 1px 0 0 #FFFFFF / 90%` + `inset 0 -1px 0 0 #8C949E / 60%`. |
| 4 | Grip ridges | Three 1px vertical lines at x = 8, 10, 12px. `#8C949E / 50%` with `#FFFFFF / 60%` 1px to their right. *Why:* grip texture is how a thumb-actuated switch tells you it is thumb-actuated. |
| 5 | Radius | `10px`. |

**Motion:** `spring/press` (stiffness 700, damping 30, mass 0.8). Thumb travel 22px. The thumb overshoots 1.5px and settles — a real switch snaps past centre. Indicator field crossfades over the first 40% of travel, not linearly, because a mechanical switch reveals its field abruptly at the detent.

### 5.10 Physical push button — at rest and pressed

Applies to the sidecar's device-styled controls and the panel-adjacent hardware buttons. Not to Liquid Glass buttons, which get no bevel (LAW 1).

**At rest**

| # | Layer | Specification |
| --- | --- | --- |
| 1 | Contact shadow | `0 2px 3px -1px #000000 / 34%` |
| 2 | Ambient shadow | `0 5px 12px -3px #000000 / 24%` |
| 3 | Fill | `linear-gradient(180deg, #2F343A 0%, #22262B 42%, #1A1D22 78%, #23272D 100%)` |
| 4 | Top rim | `inset 0 1px 0 0 #FFFFFF / 26%` |
| 5 | Bottom rim | `inset 0 -1px 0 0 #000000 / 44%` |
| 6 | Side rims | `inset 1px 0 0 0 #FFFFFF / 8%`, `inset -1px 0 0 0 #000000 / 20%` |
| 7 | Gloss | `linear-gradient(180deg, #FFFFFF / 14% 0%, transparent 48%)`, blend `screen` |
| 8 | Label | Source Sans 3 600, colour `#E4E7EA`, `text-shadow: 0 -1px 0 #000000 / 50%` (label sits on a lit surface, so its shadow points *up*) |
| 9 | Radius / height | `10px` / `44px` |

**Pressed**

| Change | Value |
| --- | --- |
| Transform | `translateY(1.5px)` |
| Layer 1 | → `0 0.5px 1px -0.5px #000000 / 40%` |
| Layer 2 | → `0 1px 3px -1px #000000 / 20%` |
| Layer 3 fill | → `linear-gradient(180deg, #191C21 0%, #1E2227 46%, #24282E 100%)` — **the gradient inverts**: a depressed cap is lit from below by bounce. |
| Layer 4 top rim | → `#FFFFFF / 10%` |
| New | `inset 0 2px 4px 0 #000000 / 40%` — cavity shadow |
| Layer 7 gloss | `opacity → 0.35` |
| Layer 8 label | `translateY(1.5px)`, `text-shadow` → `0 -1px 0 #000000 / 30%` |
| Duration | 60ms `cubic-bezier(0.4, 0, 1, 1)` in; `spring/press` out |

⚑ **The gradient inversion on press is mandatory.** Merely darkening a button is the flat-design tell. A physically depressed cap changes which of its faces the light reaches.

### 5.11 The art-forward Now Playing panel — both modes

The hardest surface in the product, and the one where "artwork becomes the environment" has to survive an arbitrary 1400×1400 image that may be pure white, pure black, or saturated in exactly an actor hue.

#### The finding that reframes it

⚑ **Light mode is the *easier* mode, not the harder one.** Solving for the alpha of the text plate that guarantees 4.5:1 against a worst-case cover:

| Mode | Text | Worst-case cover | Plate alpha floor | Shipped alpha | Artwork visible through plate |
| --- | --- | --- | --- | --- | --- |
| **Dark** | `slate-50` on `#0A0F16` plate | pure **white** (Y = 1.0) | **α ≥ 0.831** | **0.86** | 14% |
| **Light** | `slate-600` on `#F2F6FB` plate | pure **black** (Y = 0.0) | **α ≥ 0.625** | **0.68** | 32% |

A light plate's own luminance dominates the composite, so it needs far less opacity to guarantee the ratio. Light mode can therefore show **more than twice as much artwork** through its text plate and still be provably legible. The "artwork becomes the environment" idea is better served by light mode, not worse.

(The light floor is set by `slate-600` at 0.625, the weakest text tier used there. `slate-900` alone would need only α ≥ 0.234, and `slate-700` α ≥ 0.443.)

#### Side-by-side specification

| Aspect | **Dark mode** | **Light mode** |
| --- | --- | --- |
| **Base panel** | `#0A0F16` | `#F2F6FB` |
| **Bloom source** | 3×3 dominant-colour sample of the cover, 8×8 downsample for luminance | same |
| **Bloom L clamp** (OKLCH) | `L → clamp(0.10, 0.34)` | `L → clamp(0.78, 0.94)` |
| **Bloom C multiplier** | `× 0.55`, hard cap `C ≤ 0.14` | `× 0.40`, hard cap `C ≤ 0.09` |
| **Bloom blur** | `48px`, `scale(1.18)` to hide edges | `56px`, `scale(1.18)` |
| **Bloom opacity** | `0.72` | `0.62` |
| **Mesh stop 1** `10% 8%` | `#12202E` | `#E8EFF7` |
| **Mesh stop 2** `50% 6%` | `#141B28` | `#EFF4FA` |
| **Mesh stop 3** `90% 10%` | `#0E1A24` | `#E3ECF5` |
| **Mesh stop 4** `8% 46%` | `#182634` | `#F1F5FA` |
| **Mesh stop 5** `50% 44%` | `#0D141C` | `#DFE9F3` |
| **Mesh stop 6** `92% 48%` | `#101C29` | `#E9F0F8` |
| **Mesh stop 7** `12% 88%` | `#16222F` | `#F3F7FB` |
| **Mesh stop 8** `50% 94%` | `#0B1219` | `#E5EDF6` |
| **Mesh stop 9** `88% 90%` | `#131E2B` | `#EDF3F9` |
| *(measured L range / max C)* | `0.179–0.263` / `0.033` | `0.929–0.974` / `0.017` |
| **Scrim stop 0%** | `#0A0F16 / 0%` | `#F2F6FB / 0%` |
| **Scrim stop 34%** | `#0A0F16 / 18%` | `#F2F6FB / 26%` |
| **Scrim stop 58%** | `#0A0F16 / 52%` | `#F2F6FB / 64%` |
| **Scrim stop 78%** | `#0A0F16 / 80%` | `#F2F6FB / 90%` |
| **Scrim stop 100%** | `#0A0F16 / 94%` | `#F2F6FB / 97%` |
| **Text plate** (bottom 38%) | flat `#0A0F16 / 86%` | flat `#F2F6FB / 68%` |
| **Track title** | `slate-50 #F8FAFC` — **5.17:1** worst case | `slate-900 #0F172A` — **11.5:1** worst case |
| **Artist** | `slate-300 #CBD5E1` — **3.65:1** ⚑ large-text only (17 panel px / 600) | `slate-700 #334155` — **6.6:1** |
| **Album / meta** | `slate-400 #94A3B8` — 2.4:1 ⚑ **not permitted on the plate**; moves to the status bar | `slate-600 #475569` — **4.8:1** |
| **Time readout** | `slate-300` tabular | `slate-700` tabular |
| **Progress track** | `#FFFFFF / 16%` | `#0F172A / 14%` |
| **Progress fill** | `--brand-am #FA243C`, flat 3px, **no glow** | `--brand-am-light #FC3C44`, flat 3px, **no glow** |
| **Artwork frame** | `#FFFFFF / 12%` 1px | `#0F172A / 10%` 1px |
| **Vignette** | `#000816 / 18%` | `#334155 / 10%` |

⚑ Two rows above are constraints, not preferences. Dark-mode **artist** at `slate-300` measures 3.65:1 against the worst-case plate composite, so it is permitted only at ≥18.66px-equivalent — which `panel/np-track`-adjacent sizing at 17 panel px / weight 600 satisfies as large text. Dark-mode **album/meta** at `slate-400` measures 2.4:1 and fails outright; it is moved to the status bar over the flat `--ui-statusbar` gradient, where it measures 7.49:1. Light mode has no such problem — every tier clears 4.5:1 — which is the same asymmetry as the plate floor.

#### The adaptive rule

Three guards, applied in order. Only the third depends on the artwork.

**Guard 1 — the plate is never derived from the cover.** It is fixed at the floor-plus-margin values above, computed against the worst case. ⚑ *Never* compute the text plate from the artwork's luminance: an adaptive plate fails exactly when the artwork is adversarial, which is when it matters. This is the single most important rule in this section.

**Guard 2 — actor-hue exclusion.** Measured actor hues: sky-400 at **H = 232.7°**, green-400 at **H = 151.7°** (OKLCH). Any bloom mesh stop whose hue falls inside **212.7°–252.7°** (human) or **131.7°–171.7°** (agent) is rotated to the nearest edge of that window, preserving L and C.

> This guard is **new in R2 and mandatory because of the hue change.** With crimson/cyan the risk was low. With sky/green it is acute: a large fraction of real album art is dominated by blue or green, and an unguarded bloom would tint the entire Now Playing screen in an actor colour — so an agent action would become invisible against a green cover, and every human action would read as ambient on a blue one. The 40°-wide exclusion windows are the cheapest possible fix and cost nothing perceptually, because the bloom's chroma is already capped at 0.14/0.09 where a 20° rotation is imperceptible.

**Guard 3 — luminance rebalance.** Let `Ȳ` be the linear-light mean of the cover's 8×8 downsample.

| Mode | Condition | Action |
| --- | --- | --- |
| Dark | `Ȳ > 0.34` (bright cover) | Bloom opacity `0.72 → 0.72 − 0.9·(Ȳ − 0.34)`, floor `0.34`. Scrim stops ×`1 + 0.5·(Ȳ − 0.34)`, capped at the plate value. |
| Dark | `Ȳ < 0.08` (near-black cover) | Bloom L clamp raises to `(0.16, 0.38)` so the panel does not become a featureless void |
| Light | `Ȳ < 0.30` (dark cover) | Bloom opacity `0.62 → 0.62 − 0.8·(0.30 − Ȳ)`, floor `0.28`. Bloom L clamp raises to `(0.84, 0.96)`. |
| Light | `Ȳ > 0.88` (near-white cover) | Bloom L clamp lowers to `(0.70, 0.88)` so the wash stays visible against the panel |
| Both | `C̄ > 0.16` (very saturated cover) | Bloom C multiplier ×`0.62` on top of the mode multiplier |

**Guard 4 — reduced transparency.** The bloom is disabled entirely; the panel renders flat `--ui-bg` with the artwork confined to its framed thumbnail. All ratios rise to the §11.1 panel values.


---

## 6. Typography

Three families, all Google Fonts. Two for the interface; one functional "machine voice" restricted to agent surfaces.

### 6.1 The families

#### Interface family 1 — **Source Sans 3** (Google Fonts: `Source Sans 3`)

**Role:** everything on the device. The 320 × 240 panel UI, the wheel's printed labels, the engraved labels on the steel back.

**Why.** The real iPod's system face was **Podium Sans**, Apple's licensed derivative of **Myriad** — a humanist sans with open apertures, a large x-height, and slightly splayed terminals, designed by Robert Slimbach at Adobe. Source Sans is *by the same designer*, in the same humanist tradition, drawn as an open-source sibling to that lineage. It is not an approximation of the iPod's type; it is the closest thing to a direct descendant available under an open licence. Practically it also brings what the panel needs: a large x-height (0.486 em) so 15px reads as 17px would, genuinely narrow numerals in its tabular set (essential for the `-2:41` time remaining readout at 320px wide), and true optical weights at 400/600/700 rather than a variable interpolation that muddies at small sizes.

Weights loaded: `400`, `600`, `700`. Italic: none — the 2005 firmware had no italic and neither do we.

#### Interface family 2 — **Inter Tight** (Google Fonts: `Inter Tight`)

**Role:** everything *not* on the device. Marketing/display, the sidecar, sheets, overlays, toasts, consent interrupts.

**Why.** LAW 1 says the device is 2005 and the glass is 2026, and typography is the cheapest, most legible way to make that boundary felt without a single visible line. Inter Tight is a neo-grotesk with tightened default tracking and a closed, rational skeleton — the structural opposite of Source Sans's humanist openness. It is the nearest open equivalent to SF Pro Display's behaviour at large sizes: it holds up at 96px+ for the hero wordmark without the loose gaps that plague Inter's regular tracking, and it stays dense and quiet at 13–17px in the sidecar, which is where Apple Music's own typographic character lives (tight, heavy, unornamented). Set side by side with Source Sans 3 the two are unmistakably different families — a two-second read — which is exactly the point.

Weights loaded: `400`, `500`, `600`, `700`, `800`.

#### Machine family — **IBM Plex Mono** (Google Fonts: `IBM Plex Mono`)

**Role:** agent surfaces only. The provenance ticker, tool-call names and arguments, agent status readouts, the agent's label on every FX mark, timestamps in the trail, WebMCP tool identifiers.

**Why, and why this one.** The machine family is not decoration — it is **channel 5 of LAW 3**. Typeface is the only attribution signal that survives greyscale, colourblindness, motion-off, *and* a static screenshot at 50% scale, which makes it the most robust of the five. So it has to be maximally distinct from both interface families at a glance, and monospace is the strongest available shape signal.

IBM Plex Mono over the obvious alternatives: JetBrains Mono is drawn for long-form code reading and is deliberately *neutral*, which is the wrong register — it disappears. Martian Mono is so wide that a tool name would wrap in the ticker. Plex Mono has an institutional, instrument-panel character (it descends from IBM's typographic identity — the type of mainframes and test equipment), it ships genuinely tabular figures at every weight, its `0` is slashed so tool arguments are unambiguous, and its terminals are cut square, which is a hard-edged echo of the agent's hard-edged FX language. It is also narrow enough at 500 weight to fit `music.addToLibrary` on one 300px line.

Weights loaded: `400`, `500`, `600`. Always set `font-feature-settings: "tnum" 1, "zero" 1;`.

⚑ **The machine family never appears on the device.** Not in the panel, not on the wheel, not on the steel back. If an agent's action needs to be expressed inside the panel, it is expressed in Source Sans 3 with the agent hue and the dashed-outline shape channel. Plex Mono is a *glass-layer* voice.

### 6.2 Loading

```
Source Sans 3: 400, 600, 700           — subset latin, latin-ext
Inter Tight:   400, 500, 600, 700, 800 — subset latin, latin-ext
IBM Plex Mono: 400, 500, 600           — subset latin
```
`font-display: swap`. Total budget ≈ 148KB woff2. Fallback stacks:
```
--font-panel:   "Source Sans 3", "Segoe UI", system-ui, -apple-system, sans-serif;
--font-ui:      "Inter Tight", "Inter", system-ui, -apple-system, "Helvetica Neue", sans-serif;
--font-machine: "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace;
```

### 6.3 The minimum legible size rule

⚑ **No text in webPod renders below 11px at its final composited size, in any breakpoint, at any panel scale, under any Dynamic Type setting.**

This is harder than it looks because the panel is a **uniformly scaled** layer (§7.4): at mobile the panel renders at `scale(0.875)`, so an 11px authored value composites to 9.6px and violates the rule. Two consequences, both mandatory:

1. **The panel type scale has two authored columns** — a desktop column (panel scale 1.0) and a mobile column pre-compensated by ÷0.875 and rounded up to the nearest whole px. The *rendered* size is what the rule governs.
2. **`text-size-adjust: none`** on the panel, and the panel's scale transform is applied to a container, never to font sizes individually — so a browser zoom scales the whole panel coherently rather than reflowing 2005 firmware.

Additionally: **weights below 400 are never used** (per `visual-design.md` — Ultralight/Thin/Light are prohibited), and text below 13px rendered is always weight ≥ 500, because a 400-weight 11px glyph on an emissive panel with a 3% scanline overlay loses its thin strokes.

### 6.4 Type scale — device screen UI (320 × 240 panel)

Authored in **panel px**. The panel is 240px tall: a 22px status bar + 8 rows of 26px + 10px of chrome = 240. Eight rows is what the real 5G showed, and it is the number that keeps a menu scannable at a glance.

| Role | Family | Size (desktop / mobile authored) | Rendered mobile | Weight | Line-height | Letter-spacing |
| --- | --- | --- | --- | --- | --- | --- |
| `panel/statusbar` | Source Sans 3 | 13 / 15 | 13.1 | 600 | 1.23 (16px) | `+0.02em` |
| `panel/statusbar-glyph` | — (SVG) | 12 / 14 | 12.3 | — | — | — |
| `panel/menu-row` | Source Sans 3 | 15 / 17 | 14.9 | 400 | 1.27 (19px) | `0` |
| `panel/menu-row-selected` | Source Sans 3 | 15 / 17 | 14.9 | 600 | 1.27 (19px) | `0` |
| `panel/menu-row-secondary` | Source Sans 3 | 12 / 14 | 12.3 | 400 | 1.25 (15px) | `+0.01em` |
| `panel/section-header` | Source Sans 3 | 12 / 14 | 12.3 | 700 | 1.25 (15px) | `+0.05em` |
| `panel/np-track` | Source Sans 3 | 17 / 19 | 16.6 | 600 | 1.18 (20px) | `-0.008em` |
| `panel/np-artist` | Source Sans 3 | 14 / 16 | 14.0 | 400 | 1.29 (18px) | `0` |
| `panel/np-album` | Source Sans 3 | 12 / 14 | 12.3 | 400 | 1.25 (15px) | `0` |
| `panel/time` | Source Sans 3 (`tnum`) | 12 / 14 | 12.3 | 600 | 1.17 (14px) | `+0.02em` |
| `panel/counter` | Source Sans 3 (`tnum`) | 11 / 13 | 11.4 | 600 | 1.18 (13px) | `+0.03em` |
| `panel/caption` | Source Sans 3 | 11 / 13 | 11.4 | 500 | 1.18 (13px) | `+0.03em` |
| `panel/agent-note` | Source Sans 3 | 11 / 13 | 11.4 | 600 | 1.18 (13px) | `+0.06em` |

**Why the panel gets its own scale and not a subset of the interface scale.** Panel Discipline (facet 4). A 320 × 240 emissive surface at 163ppi-equivalent has different constraints than a 390px CSS viewport: no room for a large-title, no room for optical padding, and a hard requirement that every step in the scale be ≥ 2px apart or it disappears. The panel scale has 6 distinct sizes (11, 12, 13, 14, 15, 17) across 13 roles — deliberately fewer sizes than roles, differentiated by weight and colour instead, which is exactly how 2005 firmware worked.

`panel/agent-note` is the **only** agent-attributed text inside the panel: Source Sans 3 at 600 with `+0.06em` tracking, in `--agent-300`. It borrows Plex Mono's *tracking* without importing the family, because LAW 1 keeps the machine family off the device.

### 6.5 Type scale — marketing / display (environment layer)

| Role | Family | Size | Weight | Line-height | Letter-spacing |
| --- | --- | --- | --- | --- | --- |
| `display/hero` | Inter Tight | 96 (mobile 52) | 800 | 0.94 | `-0.035em` |
| `display/hero-sub` | Inter Tight | 24 (mobile 18) | 500 | 1.35 | `-0.012em` |
| `display/section` | Inter Tight | 44 (mobile 30) | 700 | 1.05 | `-0.026em` |
| `display/lede` | Inter Tight | 20 (mobile 17) | 400 | 1.50 | `-0.008em` |
| `display/eyebrow` | Inter Tight | 12 | 700 | 1.25 | `+0.14em` (uppercase) |
| `display/wordmark` | Inter Tight | 28 | 800 | 1.00 | `-0.030em` |
| `display/caption` | Inter Tight | 13 | 500 | 1.38 | `0` |

`display/wordmark` renders "webPod" with the embossed recipe (§5.8) in the light room and flat `--room-ink` in the dark room — embossing needs a value range that the dark room does not provide.

### 6.6 Type scale — sidecar (Liquid Glass layer)

| Role | Family | Size | Weight | Line-height | Letter-spacing |
| --- | --- | --- | --- | --- | --- |
| `sidecar/title` | Inter Tight | 22 | 700 | 1.18 | `-0.020em` |
| `sidecar/section` | Inter Tight | 13 | 600 | 1.23 | `+0.01em` (title case, **not** uppercase — iOS 26) |
| `sidecar/row-primary` | Inter Tight | 15 | 500 | 1.33 | `-0.006em` |
| `sidecar/row-secondary` | Inter Tight | 13 | 400 | 1.38 | `0` |
| `sidecar/meta` | Inter Tight (`tnum`) | 12 | 500 | 1.33 | `+0.01em` |
| `sidecar/button` | Inter Tight | 15 | 600 | 1.20 | `-0.004em` |
| `sidecar/button-sm` | Inter Tight | 13 | 600 | 1.23 | `0` |
| `sidecar/badge` | Inter Tight | 11 | 700 | 1.18 | `+0.06em` (uppercase) |
| `sidecar/sheet-title` | Inter Tight | 20 | 700 | 1.20 | `-0.018em` |
| `sidecar/sheet-body` | Inter Tight | 15 | 400 | 1.47 | `0` |

Row height 44px minimum throughout (touch target, §11.2). iOS 26 section headers are **title case**, per `visual-design.md`.

### 6.7 Type scale — agent readout (machine voice)

Restricted to the ticker, the agent panel, tool-call chips, and consent interrupt tool detail.

| Role | Family | Size | Weight | Line-height | Letter-spacing |
| --- | --- | --- | --- | --- | --- |
| `machine/tool-name` | IBM Plex Mono | 12 | 600 | 1.25 | `+0.02em` |
| `machine/tool-args` | IBM Plex Mono | 11 | 400 | 1.45 | `0` |
| `machine/ticker` | IBM Plex Mono | 11 | 500 | 1.27 | `+0.06em` (uppercase) |
| `machine/status` | IBM Plex Mono | 12 | 500 | 1.33 | `+0.04em` |
| `machine/timestamp` | IBM Plex Mono (`tnum`) | 10 → **rendered 11 via `min-font-size` clamp** | 500 | 1.30 | `+0.03em` |
| `machine/badge` | IBM Plex Mono | 11 | 600 | 1.18 | `+0.10em` (uppercase) |
| `machine/counter` | IBM Plex Mono (`tnum`) | 13 | 600 | 1.23 | `+0.02em` |

⚑ `machine/timestamp` is the one place a 10px value was wanted and refused. It ships at **11px** (§6.3). Density is achieved instead by truncating to `HH:MM:SS` and dropping the date.

All machine roles set `font-variant-numeric: tabular-nums slashed-zero;`. Uppercase is used for ticker and badges only — full-uppercase Plex Mono at paragraph length is unreadable.

---

## 7. Geometry

### 7.1 Corner radius spectrum

**Stated rule** — three clauses, applied in order:

1. **Concentric (iOS 26):** `child_radius = parent_radius − padding`. Nested elements share a common centre of curvature, so a card inside a 22px-radius panel with 8px padding gets 14px.
2. **Hardware informs software:** the panel's own radii are bounded above by the *screen glass* radius, not the device body radius. The glass window is 8px, so nothing inside the panel exceeds 6px. The body's 39px radius is a hardware fact and never propagates inward.
3. **Superellipse, not circular arc, on the device silhouette only.** The iPod 5G's corners are a continuous-curvature squircle. Implement as `n = 4.2` in `|x/a|^n + |y/b|^n = 1`, i.e. CSS `corner-shape: superellipse(4.2)` where supported, falling back to an SVG clip path. Glass-layer elements use plain circular `border-radius` — again a channel that makes LAW 1 felt.

| Element | Mobile | Desktop | Derivation |
| --- | --- | --- | --- |
| Device silhouette | `34px` squircle n=4.2 | `39px` squircle n=4.2 | 6.2mm × scale |
| Steel back inner wrap | `32px` | `37px` | body − 2px chamfer |
| Screen glass window | `7px` | `8px` | 1.2mm × scale, rounded |
| Screen active area | `4px` | `5px` | glass − 3px print inset (concentric) |
| Panel: selection band | `3px` | `3px` | fixed panel px |
| Panel: album-art frame | `2px` | `2px` | fixed panel px |
| Panel: max any element | `6px` | `6px` | clause 2 |
| Click wheel outer | `50%` | `50%` | circle |
| Center Select button | `50%` | `50%` | circle |
| Hold switch track | `11px` | `11px` | height / 2 |
| Hold switch thumb | `10px` | `10px` | track − 1px channel wall |
| Hardware push button | `10px` | `10px` | — |
| Sidecar glass panel | `22px` | `22px` | iOS 26 sheet range |
| Sidecar card | `14px` | `14px` | 22 − 8 padding |
| Sidecar control inside card | `8px` | `8px` | 14 − 6 padding |
| Sidecar row (grouped list) | `14px` first/last only | `14px` | — |
| Consent interrupt sheet | `26px` | `26px` | iOS 26 upper sheet range |
| Consent card inside sheet | `18px` | `18px` | 26 − 8 |
| Toast / snackbar | `18px` | `18px` | — |
| Human FX chip | `999px` (pill) | `999px` | ⚑ human = round |
| Agent FX chip | `3px` on a hexagonal clip | `3px` | ⚑ agent = hexagon (LAW 3) |
| Agent hex glyph | `1px` | `1px` | 8px point-to-point hexagon |
| Provenance ticker chip | `4px`, left edge chamfered 8px | `4px` | reads as a machine tag |

### 7.2 Spacing scale

**8px grid, 4px for micro.** Two scales, because the panel is a different world.

**Glass & environment layer**

| Token | Value | Usage |
| --- | --- | --- |
| `--sp-0` | `0` | — |
| `--sp-1` | `4px` | Micro: icon-to-label, chip internal, hairline offsets |
| `--sp-2` | `8px` | Tight: within a row, badge padding |
| `--sp-3` | `12px` | Card internal padding (small) |
| `--sp-4` | `16px` | **Base.** Row padding, panel gutters, standard margin |
| `--sp-5` | `24px` | Between cards, section internal |
| `--sp-6` | `32px` | Between sections |
| `--sp-7` | `48px` | Major block separation |
| `--sp-8` | `64px` | Hero / page rhythm |
| `--sp-9` | `96px` | Desktop hero only |

**Panel layer** (panel px — a 2px micro grid, because 320 × 240 cannot afford 8px)

| Token | Value | Usage |
| --- | --- | --- |
| `--psp-1` | `2px` | Baseline nudges, divider offsets |
| `--psp-2` | `4px` | Icon-to-label, row inner top/bottom |
| `--psp-3` | `6px` | Row left/right inset |
| `--psp-4` | `10px` | Split-pane gutter, status bar inset |
| `--psp-5` | `14px` | Now-Playing block separation |

**Why two scales.** Forcing 8px increments into a 320px-wide panel wastes 12% of horizontal space on padding that is optically invisible at that size, and it produces spacing relationships that read as "modern app shrunk down" rather than as firmware. The 2px panel grid is a Panel Discipline requirement.

### 7.3 Device dimensions — derived from the real 5th generation

**Real iPod 5G (30GB) measurements, stated:**

| Feature | Real | Source of ratio |
| --- | --- | --- |
| Body height | **103.5 mm** | — |
| Body width | **61.8 mm** | body ratio **1.6748 : 1** |
| Body depth | **11.0 mm** (30GB) / 14.0 mm (60/80GB) | side-wall thickness in the flip |
| Display diagonal | **2.5 in** = 63.5 mm, 4:3 | — |
| Display active area | **50.8 × 38.1 mm** | **82.2%** of body width |
| Display resolution | **320 × 240** px (QVGA), 163 ppi | the panel's logical grid |
| Click wheel outer Ø | **43.2 mm** (1.70 in) | **69.9%** of body width |
| Center button Ø | **16.5 mm** | **38.2%** of wheel Ø |
| Body corner radius | **≈ 6.2 mm** | 10.0% of body width |
| Top edge → glass top | **≈ 9.0 mm** | — |
| Glass bottom → wheel top | **≈ 8.0 mm** | — |
| Wheel bottom → body bottom | **≈ 5.2 mm** | — |

**Pixel mapping — R3, reconciled to the built canvas.** The canvas is the source of truth: **body 330 × 552, `wheelR` 106**. This resolves the discrepancy flagged in R3 §8.5 (I had inferred 303px from the wheel and 340px from the panel-scale rule; both were wrong).

⚑ **Two things the reconciliation exposes, both stated rather than silently absorbed.**

**(a) The wheel is 8.1% small relative to the real device.** Canvas wheel/body = 212/330 = **0.642**; the real 5G is 43.2/61.8 = **0.699**. The two scales disagree: derived from the body, 330px implies 5.3398 px/mm and a wheel of Ø230.7 (r 115.3); derived from the wheel, r106 implies 4.9074 px/mm and a body of 303px. The body is authoritative because the screen proportion derived from it is correct (272/330 = 82.4% vs real 82.2%), so the wheel is the element that has drifted. Consequence: the polycarbonate margin between wheel edge and body edge is **59px = 11.05mm**, against the real device's **9.30mm** — **+19%**, which reads as the wheel sitting slightly lost on the face, and pushes the wheel-bottom-to-body-bottom gap to 45px where the real ratio gives 28px. **This is accepted as built** — every radius below is expressed as a fraction of `wheelR` and survives either decision — but if 5G fidelity is wanted back, the single change is `wheelR` 106 → **115**, and nothing else in this document moves.

**(b) The panel scale resolves clean at 0.85.** 50.8mm × 5.3398 = 271.3px, which would give a scale of 0.8477. Rounding the active area to **272 × 204** gives **exactly 0.85 (17/20)** and both dimensions integral. ⚑ **The R1 rule restricting panel scale to {0.875, 1.0, 1.25} is retired.** It existed to keep 1px hairlines on whole-pixel boundaries; the correct fix is to author panel hairlines as `calc(1px / var(--panel-scale))` so they render at exactly one device pixel at any scale. That removes the constraint entirely and is what ships.

| | Mobile (390 × 844 viewport) | Desktop (1440 × 900) |
| --- | --- | --- |
| **Body** | **330 × 552 px** *(built)* | **390 × 653 px** |
| Body ratio | 1.6727 (real 1.6748, err 0.12%) | 1.6744 (err 0.02%) |
| Scale | **5.3398 px/mm** | **6.3107 px/mm** |
| **Panel scale** | **0.85** (= 17/20) | **1.00** |
| **Screen active** | **272 × 204 px** | **320 × 240 px** |
| Screen % of body | 82.4% (real 82.2%) | 82.1% |
| Glass window (+6px surround) | 284 × 216 px | 332 × 252 px |
| **`wheelR`** | **106** *(built; real ratio would be 115)* | **125** |
| Wheel / body | 0.642 *(real 0.699)* | 0.642 |
| **Select radius** | **39** (0.368 · `wheelR`) | **46** |
| Select lip (stroke + shadow) | to **43** | to **50** |
| **Printed label band** | **r 77 – 79** *(measured)* | **r 91 – 93** |
| Recess-shadow inner reach | r **95** | r **112** |
| Body corner radius | 33 px | 39 px |
| Vertical chain (active-area basis) | 48 + 204 + 43 + 212 + 45 = **552** ✓ | 57 + 240 + 51 + 250 + 55 = **653** ✓ |
| Side margins in viewport | (390 − 330) / 2 = **30 px** | centred |

> ⚑ **Correction to my own R3 assumption.** I placed the label band at r 53–65, derived from §5.3 L8's `innerR + ringW × 0.30`. Measured, it is **r 77–79** — the labels sit much further out, at `innerR + ringW × 0.57`. That error is exactly why my R3 agent-trail value of r75 would have crossed printed ink on the real artboard. §5.3 L8 is corrected to `innerR + (ringW × 0.57)`.

**Mobile layout, 390 × 844.** Device centred horizontally at y = 96px (leaving 96px above for the environment/status region and 179px below for the mini ticker + safe area). The 275px of remaining vertical space is *not* filled with UI — it is the room. Emptiness is what gives the object scale (facet 1). The provenance ticker occupies a 36px strip at the bottom, above `env(safe-area-inset-bottom)`. The sidecar on mobile is a Liquid Glass sheet that rises from the bottom to `max-height: 62vh`, and while it is up the device translates to y = 40px and scales to 0.86 — it recedes rather than being covered.

**Desktop layout, 1440 × 900.** Three columns: `1fr | 390px | 420px`. The device sits in the centre column at y = 124px. The **sidecar** is the 420px right column, a full-height Liquid Glass panel inset 24px from the viewport edges (so it floats, per iOS 26) with 22px radius. The left `1fr` column holds the environment and, on hover of any device control, a large-format contextual readout (now-playing artwork at 320px, lyrics, queue) — its job is to give the eye somewhere to go that is not the 320px panel, which solves the density problem the real device had. Sidecar internal padding 24px; content max-width 372px.

**Desktop wide (≥ 1680px).** Device scales to `1.12` (437 × 731, panel scale 1.12 → non-integer, so the panel instead steps to a 1.25 scale at ≥ 1920px and holds 1.0 below that; the *device chassis* scales continuously while the *panel* steps). This is the one place chassis and panel scale independently, and the seam is hidden because the glass window has 6px of surround to absorb the difference.

### 7.4 The panel as a scaled layer

⚑ The panel is authored **once**, at 320 × 240, in panel px, and composited with a single `transform: scale(var(--panel-scale))` on a container with `transform-origin: top left`. Never scale font sizes individually. Set `image-rendering: pixelated` on panel artwork below scale 1.0 is **wrong** — album art must scale smoothly; only the scanline/sub-pixel overlays are disabled below 0.75.

⚑ **R3: panel scale is unconstrained.** Ships at `0.85` mobile / `1.00` desktop. The former {0.875, 1.0, 1.25} restriction is retired — panel hairlines are authored as `calc(1px / var(--panel-scale))`, so they resolve to exactly one device pixel at any scale and the constraint has no remaining purpose.

### 7.5 Wheel quadrant geometry

| Quadrant | Arc centre | Arc span | Label | Hit area |
| --- | --- | --- | --- | --- |
| MENU | 270° (top) | 90° | `MENU` | annular sector, r 45.5 → 119 px (mobile) |
| Next | 0° (right) | 90° | `⏭` | same |
| Play/Pause | 90° (bottom) | 90° | `▶⏸` | same |
| Previous | 180° (left) | 90° | `⏮` | same |
| Select | centre | — | none | circle r 45.5 px |

Smallest inscribed dimension of a quadrant hit area (mobile): the radial band is **73.5px** deep and the arc at the inner radius is `π × 91 / 4 = 71.5px` long. Both exceed 44px by 62%. The Select button at 91px Ø exceeds it by 107%. Verified in §11.2.

### 7.6 Occlusion geometry — a first-class constraint

⚑ **The device is operated by a thumb that sits on top of it. Any region the thumb covers is a region that cannot deliver feedback to the person touching it.** This is stated in §7 rather than §8 because it is geometry, not effect: it constrains where *anything* transient may be drawn.

#### Measured occlusion

Anthropometry: adult thumb pad contact patch **11–13 mm** (95th percentile), thumb shaft width at the interphalangeal joint **≈20 mm**. Converted at the R4 mapping (mobile 5.3398 px/mm, desktop 6.3107 px/mm).

| | Mobile (`wheelR` 106, scale 4.907 px/mm) | Desktop (`wheelR` 136.5, scale 6.319 px/mm) |
| --- | --- | --- |
| Contact patch Ø | **59–69 px** (r 29–35) | **69–82 px** (r 35–41) |
| Thumb shaft width | **107 px** | **126 px** |
| Wedge half-angle at trail radius | **±33.2°** | **±33.1°** |
| Total occluded arc | **≈66°** | **≈66°** |

The occluded region is the **union** of two shapes:
1. **The contact disc** — radius 27–32px centred on the thumb's angular position on the ring.
2. **The shaft wedge** — a ±33° wedge from the wheel centre through the contact point, continuing outward past the device edge in the hand's entry direction, and *inward* across the ring and Select button when the contact point is on the far side.

| Handedness | Entry direction | Consequence |
| --- | --- | --- |
| **Right-handed** (device in right palm, right thumb) | thumb enters from the **lower-right** | everything from the contact point outward toward the lower-right corner is unreadable, plus the ring along the thumb's arc |
| **Left-handed** | enters from the **lower-left** | mirrored |
| **Two-handed** (device held left, right index on wheel) | enters from the **right or lower-right** | similar wedge, slightly narrower (index finger ≈16 mm vs thumb 20 mm) |

⚑ **The design may not assume handedness.** Because entry direction flips, no feedback may be placed in a fixed screen-space location on the assumption that the hand is elsewhere. Feedback must be placed relative to **the contact point**, and must escape it in *all* directions — which is what the halo's full annular construction does (§8.5).

#### The rule

> ⚑ **No transient feedback in the occluded zone, ever.** Any effect whose purpose is to confirm a live human input must render at least partly outside the union of the contact disc and the shaft wedge. An effect that renders only inside it is a defect, regardless of how it looks in a mock.

Corollary for the panel: the panel sits **above** the wheel and is never occluded by a thumb on the wheel, so it remains the safe surface for state that must always be readable. This is why the volume and scrub overlays (§8.3 events 7, 10) live in the panel and not on the ring — that was already correct and is now justified.

#### Audit of the existing spec against this rule

| Element | Verdict | Action |
| --- | --- | --- |
| **Per-quadrant press state** (§4.5) — radial darkening centred on the quadrant arc midpoint | ⚑ **VIOLATION** | It renders *directly under the pressing thumb* and is invisible to the person pressing. **Fixed:** the darkening is retained (it is correct material behaviour and is visible to an observer, in screenshots, and to a second party watching) but is **demoted from primary feedback**. Primary confirmation for a quadrant press is now the halo's contact core at ×1.4 intensity and radial peak `0.52 → 0.68` (§8.5). |
| **Center Select press** (§5.4) — translate + gloss change at `r < 39` | ⚑ **VIOLATION** | A thumb pressing Select covers Select completely. **Fixed:** Select press fires a **360° symmetric halo** with no directional mask. The angular extent of the halo now encodes *which control*: symmetric = Select, directional ≈130° = rotation or quadrant. |
| **Human wheel-rotate arc** (§8.3 event 1) — 26° arc at ring outer radius − 5px | ⚑ **VIOLATION** | Inside the wheel, under the thumb. **Fixed:** replaced by the halo (§8.5). |
| **Agent band** at `r = 0.66 · wheelR` | ✓ pass | Occluded only when a human thumb is simultaneously present; handled by the co-occurrence repeater (§8.5). |
| **Panel overlays** (volume, scrub, letter index) | ✓ pass | Above the wheel; never occluded. |
| **Panel status-bar agent hexagon** | ✓ pass | Above the wheel. |
| **Provenance left-borders on rows** | ✓ pass | In-panel. |
| **Arbitration collar** (§8.9) at `wheelR + 2` | ✓ pass, marginal | Sits just outside the wheel edge, inside the halo's inner boundary. It is crossed by the shaft wedge but never fully hidden, since it spans 360°. |
| **Hold switch** (top edge) | ✓ pass | Opposite end of the device from the hand. |
| **Device silhouette glow** (§8.3 event 4) | ✓ pass | 360° perimeter; partially occluded by the hand, never fully. |


---

## 8. The dual-mode FX language

This is the section the product lives or dies on. Every interaction in webPod can originate from a human thumb or from a WebMCP agent, and a user must always know which — without reading, without colour vision, and without waiting for an animation to finish.

### 8.1 The two primitives

Everything in §8.4 is a composition of exactly two primitives. They were designed as opposites on every axis simultaneously.

| | **HUMAN — "Bloom"** | **AGENT — "Trace"** |
| --- | --- | --- |
| Metaphor | heat and mass entering the object at the point of contact | a measurement instrument reaching in from outside |
| Origin | the contact point, on the device | the sidecar's device-facing edge, in the glass layer |
| Path | radial, outward from origin | orthogonal — travels along x, then along y, never diagonally |
| Fill | **filled**, feathered falloff 6–14px | **unfilled**, 1.5px stroke, `dasharray 3 3` |
| Geometry | circle, arc, radial gradient | hexagon (8px point-to-point), straight segments, ticks |
| Hue | `--human-500` / `--human-300` | `--agent-400` / `--agent-300` (adjacency rule §8.2) |
| Peak opacity | `0.46` | `0.72` on stroke, `0` on fill |
| Motion | **spring, with overshoot** | **duration + linear/near-linear, never overshoot** |
| Onset | instant (0ms) — it is the consequence of a touch | 90ms lead-in (the trace has to travel) |
| Text | never | always — Plex Mono uppercase label |
| Sound | soft, pitched, short (wood/rubber) | dry, unpitched, clicky (relay/tick) |
| Haptic | yes | never (nothing touched the device) |

⚑ **Agents do not get springs, and humans do not get labels.** Those two rules alone resolve attribution in a still frame and in greyscale.

### 8.2 The co-occurrence rule

⚑ **Superseded by §4.9.** R1's adjacency rule promoted the agent mark to a lighter step when the two came within 24px. R2 keeps the mechanism and changes the values, because the underlying numbers changed: the naive pair now measures **1.23:1** in greyscale (worse than R1's 1.94:1) and **ΔE 4.7** under tritanopia.

The rule in force is the co-occurrence table in §4.9: within 24px or overlapping, force **`sky-500` + `green-200`** (dark, 2.29:1 grey / 22.6 tritan) or **`sky-700` + `green-900`** (light, 1.54:1 grey / 12.7 tritan), *and* escalate the form channels — agent stroke 1.5px → 2px, dash `3 3` → `4 3`, human mark gains a 2px `--human-900` contour, and on light surfaces both marks gain a 1px `#FFFFFF / 80%` contour.

⚑ **Do not read the colour promotion as the fix.** At 1.54:1 in light mode the two marks are the same value in greyscale and the colour channel is contributing essentially nothing. The form escalation is the fix; the colour step is a courtesy to users who can see it.

### 8.3 The event matrix

> ⚑ **R2 surface note.** The `Where` column below still names the sidecar rail and ticker. Those exist on **desktop only**. On mobile they are cut (§8.5): the same events render through the **agent orbit's** state change plus one `machine/badge` line in the panel status bar, and land in the provenance trail on the device's steel back. Geometry, motion, and sound are unchanged in both cases — only the surface the agent's report lands on differs.

Columns: **Trigger** → what fires it. **Visual** → geometry, token, opacity. **Motion** → spring (stiffness/damping/mass) or duration + easing. **S/H** → sound and haptic intent. **Where** → the surface it appears on.

#### Event 1 — Wheel rotate (scroll)

| Actor | Trigger | Visual | Motion | S/H | Where |
| --- | --- | --- | --- | --- | --- |
| **Human** | `pointermove` on ring, angle Δ crosses a 15° detent | ⚑ **R3 — the halo** (§8.5), not an in-wheel arc: an annular bloom outside the wheel, inner `wheelR + 3`, peak `wheelR + 6` at `--human-500 / 0.52`, decaying to zero at `wheelR + 38`, masked by the directional conic (184° extent, 150° trailing tail). The old in-wheel arc rendered under the thumb and was invisible to the person scrolling (§7.6). | `spring/detent` **900 / 34 / 0.6** on arc angular position; opacity decay 130ms `ease-out` | Detent click: 8ms sample, −18dB, pitch jittered ±30 cents so a fast scroll does not machine-gun. `navigator.vibrate(6)` | On the wheel ring |
| **Agent** | `tool: music.scrollList` receives a delta | A 10px green **tick** perpendicular to the ring, 1.5px stroke `--agent-400` at `0.72`, stepping discretely to each detent position — **no smear, no tail**. A 1.5px dashed `3 3` arc, `--agent-400` at `0.30`, spans from the ring's 12 o'clock to the current tick, showing distance travelled. | **220ms per detent, `linear`.** Discrete jumps, no interpolation between detents. | Dry relay tick: 5ms, −22dB, **fixed pitch** (no jitter — machines do not vary). No haptic. | On the wheel ring + `machine/ticker` line: `SCROLL ▸ 14` |

*Distinguishable because:* human smears and springs; agent steps and holds. Both at once → the sky arc is continuous, the green tick is discrete; adjacency rule promotes the tick to `--agent-300`.

#### Event 2 — Wheel press, per quadrant

| Actor | Trigger | Visual | Motion | S/H | Where |
| --- | --- | --- | --- | --- | --- |
| **Human** | `pointerdown` inside a quadrant sector | Quadrant press recipe (§4.5): radial darkening `--quad-press-k` at `0.30` centred on arc midpoint, `70% 70%` radius. Opposite arc gains `--quad-press-outer-lip` `0.10` (the wheel rocks). Plus the **halo** with its mask narrowed to 96° and centred on the quadrant arc midpoint, contact core ×1.4, radial peak `0.52 → 0.68` (§8.5). ⚑ This — not the quadrant darkening — is the feedback the pressing user actually sees. | Press in 60ms `cubic-bezier(0.4,0,1,1)`; release `spring/press` **700 / 30 / 0.8**. Bloom expands 34 → 58px over 220ms and fades, `spring/bloom` **260 / 18 / 0.9** | Wheel click: 11ms, −14dB. `navigator.vibrate(9)` | On the wheel quadrant |
| **Agent** | `tool: music.pressQuadrant("next")` | Quadrant darkening at **half** strength (`0.15`) — the agent did not physically press it. Plus a green **hexagon**, 14px point-to-point, 1.5px `--agent-400` `0.78`, dashed `3 3`, positioned exactly at the quadrant arc midpoint. A 1.5px solid trace runs from the sidecar's left edge, orthogonally (x then y), to the hexagon, `--agent-400` `0.55`. | Trace draws over 180ms `cubic-bezier(0.2,0,0.4,1)`; hexagon appears at trace arrival, holds 240ms, fades 140ms `linear`. **Zero overshoot on any property.** | Relay click: 7ms, −20dB, fixed pitch. No haptic. | Wheel quadrant + trace crossing the environment + ticker: `PRESS ▸ NEXT` |

#### Event 3 — Center Select

| Actor | Trigger | Visual | Motion | S/H | Where |
| --- | --- | --- | --- | --- | --- |
| **Human** | `pointerdown` on Select | Pressed-state recipe (§5.4). Plus the **360° symmetric halo** — no conic mask, because Select has no direction — radial peak `0.68`, expanding from `wheelR + 3` outward. ⚑ A ring expanding *across the ring surface* would be entirely under the pressing thumb (§7.6). | Button press 70ms; ring expansion 300ms `spring/select` **480 / 26 / 1.0** (overshoots r by 4px then settles) | Confirm: 14ms two-tone, −12dB. `navigator.vibrate(12)` | Center button + wheel ring |
| **Agent** | `tool: music.select` | Cyan hexagon, 18px, at the Select button's centre, 1.5px `--agent-400` `0.80`, dashed. Inside it a 6px filled `--agent-400` dot at `0.85`. The button's own pressed state applies at `0.4` strength. Trace arrives from sidecar as Event 2. | Trace 180ms; hexagon scales 0.86 → 1.00 in 140ms `cubic-bezier(0.2,0,0.4,1)` — **stops at 1.00 exactly**; holds 300ms; fades 160ms | Relay confirm: 9ms, single tone, −18dB. No haptic. | Center button + trace + ticker: `SELECT` |

#### Event 4 — Play

| Actor | Trigger | Visual | Motion | S/H | Where |
| --- | --- | --- | --- | --- | --- |
| **Human** | Play/Pause quadrant, or `panel` Now-Playing tap | (a) Quadrant press FX (Event 2, human). (b) In the panel: the ▶ glyph fills `--human-500` and the progress bar's played portion switches from `--ui-text-3` to `--human-500`. (c) A sky **contact glow** on the device's silhouette: 2px outer stroke `--human-500` `0.30`, blur 10px, rising and falling once. | Glyph fill 160ms `ease-out`; silhouette glow in 200ms / out 420ms, `spring/bloom`. Progress bar colour 220ms `ease-out` | Soft start: 90ms filtered noise swell, −20dB. `navigator.vibrate(12)` | Wheel + panel + device silhouette |
| **Agent** | `tool: music.play` | (a) Cyan hexagon at the Play/Pause quadrant. (b) In the panel the ▶ glyph gets a 1.5px dashed `--agent-300` outline (fill stays `--ui-text-1`), and a `panel/agent-note` label `AGENT` appears right-aligned in the status bar in `--agent-300`, 11 panel px. (c) The **agent rail** (§8.9) at the sidecar edge brightens from `--agent-rail` to `--agent-400` `0.6` for 400ms. | Hexagon 140ms; dashed outline draws around the glyph over 260ms `linear` (`stroke-dashoffset`); status label fades in 120ms | Relay double-tick: 2 × 6ms, 70ms apart, −20dB. No haptic. | Quadrant + panel status bar + agent rail + ticker: `PLAY` |

#### Event 5 — Pause

| Actor | Trigger | Visual | Motion | S/H | Where |
| --- | --- | --- | --- | --- | --- |
| **Human** | Play/Pause quadrant | Quadrant press FX. The progress bar's played portion desaturates from `--human-500` to `#8C4652` over 240ms. The ▮▮ glyph fills `--human-300`. A single sky pulse **inward**: 3px ring contracting from r 108 → 45.5px, `--human-500` `0.34` → `0` — the inverse of Play. | Contract 260ms `spring/select`, damped so it does not undershoot past the button edge | Soft stop: 60ms filtered noise decay, −22dB. `navigator.vibrate(8)` | Wheel + panel |
| **Agent** | `tool: music.pause` | Cyan hexagon at quadrant. Panel ▮▮ glyph gains dashed `--agent-300` outline. Progress bar's played portion becomes a **1.5px dashed `3 3` green line at `0.5` laid over** the sky fill — the fill is not replaced, because a human started this playback and the agent only paused it. This is the first co-pilot condition (§8.11). | Dashed overlay draws 240ms `linear` | Relay tick, 6ms, −20dB. No haptic. | Wheel + panel + ticker: `PAUSE` |

#### Event 6 — Skip (next / previous)

| Actor | Trigger | Visual | Motion | S/H | Where |
| --- | --- | --- | --- | --- | --- |
| **Human** | Next/Prev quadrant press | Quadrant press FX. In the panel, the Now-Playing block slides out ±96 panel px and the new one slides in, with a 3px sky **leading edge** on the incoming block: `--human-500` `0.50`, fading over 180ms. Album art crossfades with a 1px sky frame flash. | Slide 340ms `spring/panel` **320 / 28 / 1.0**; leading edge fades 180ms `ease-out` | Wheel click + 24ms transient, −16dB. `navigator.vibrate(9)` | Wheel + panel |
| **Agent** | `tool: music.next` / `.previous` | Cyan hexagon at quadrant. Panel block **steps** — it does not slide: it cuts at 0ms and the *outgoing* block leaves a 1.5px dashed green ghost outline at its old position which fades over 200ms `linear`. Incoming block has no leading edge. | Cut 0ms; ghost outline fade 200ms `linear` | Relay tick ×1, 6ms, −20dB. No haptic. | Wheel + panel + ticker: `NEXT ▸ track title` |

*Distinguishable because:* the human skip **slides**, the agent skip **cuts and leaves a ghost**. This is the cleanest attribution pair in the system and it works with motion fully disabled (§8.14: the ghost outline persists as a static 600ms mark).

#### Event 7 — Scrub (seek within a track)

| Actor | Trigger | Visual | Motion | S/H | Where |
| --- | --- | --- | --- | --- | --- |
| **Human** | Select-then-rotate on the Now-Playing screen | The panel progress bar thickens 3 → 6 panel px. A sky **playhead** 2 × 10 panel px, `--human-500` `1.0`, with an 8px `--human-glow` halo, tracks the wheel. The elapsed time readout switches to `--human-300` and to a target-time preview. A 26° sky arc on the wheel ring follows the thumb (Event 1). | Bar thicken 120ms `ease-out`; playhead follows wheel at `spring/detent` on a 48-detent-per-revolution model (7.5° per detent); on release, `spring/select` settles to the committed position | Fine detent: 5ms, −24dB, pitch **rising with position** (0 → +200 cents across the track). `navigator.vibrate(4)` per detent | Panel progress bar + wheel ring |
| **Agent** | `tool: music.seek(ms)` | No intermediate scrubbing — an agent seek is a **jump**, not a drag, and pretending otherwise would be a lie. A 1.5px dashed green vertical marker appears at the *target* position with an 8px hexagon above it; 90ms later the playhead **teleports** there and the marker collapses into it. A green 1.5px dashed segment spans old → new position at `0.4` for 300ms, showing the distance jumped. | Marker appear 100ms `linear`; hold 90ms; teleport 0ms; span segment fades 300ms `linear` | Two relay ticks, 90ms apart, −20dB. No haptic. | Panel progress bar + ticker: `SEEK ▸ 2:14` |

#### Event 8 — Add to library

| Actor | Trigger | Visual | Motion | S/H | Where |
| --- | --- | --- | --- | --- | --- |
| **Human** | Select-hold 600ms on a row → contextual menu → Add | The row's left edge grows a 3px sky bar (`--human-500` `1.0`) that wipes rightward across the row, then retracts, leaving a `+` glyph that morphs to `✓`. ⚑ The confirming mark is the human's **ring closing** (§4.11), in `--human-500` — not a green tick. Simultaneously the device silhouette pulses `--human-500` `0.24` once. A pill chip (`999px` radius) `--human-500` `0.14` fill / `--human-300` text rises 8px in the sidecar's Recent Activity. | Wipe 260ms `cubic-bezier(0.22,1,0.36,1)`; retract 180ms; glyph morph 200ms `spring/bloom`; chip rise 300ms `spring/panel` | Success: 2-note rising, 180ms, −14dB. `navigator.vibrate([10,40,14])` | Panel row + device silhouette + sidecar |
| **Agent** | `tool: music.addToLibrary(id)` | Trace arrives from the sidecar, travels orthogonally to the row, terminates in a 14px green hexagon on the row's **right** edge (human marks use the left edge — a pure position channel). The row gains a 1.5px dashed `3 3` `--agent-300` outline at `0.6` for 500ms. The `+` glyph gets a dashed green ring rather than a fill. A **hexagonal chip** (3px radius on a hex clip) `--agent-400` `0.12` fill / `--agent-300` `machine/tool-name` text `music.addToLibrary` appears in the ticker. | Trace 200ms `cubic-bezier(0.2,0,0.4,1)`; hexagon 140ms `linear`; row outline draws 300ms `linear`; chip slides in from the ticker's right at 240ms `linear` | Relay confirm ×2, 9ms each, 110ms apart, −18dB. No haptic. | Panel row (right edge) + trace + ticker + sidecar activity |

#### Event 9 — Create playlist

| Actor | Trigger | Visual | Motion | S/H | Where |
| --- | --- | --- | --- | --- | --- |
| **Human** | Sidecar → New Playlist → name → Create | The sidecar sheet's Create button fills `--human-500`, then the sheet **collapses into a pill** that flies to the sidecar's Playlists section and expands into the new row, leaving a 300ms sky trail (3px, `--human-500` `0.34`, blur 6px). The panel's Playlists menu badge increments with a sky `+1` that rises 8 panel px and fades. | Collapse 220ms `spring/panel`; flight 420ms `spring/panel` along a 1-control-point curve; expand 260ms `spring/bloom`; trail fades 300ms `ease-out` | Success 3-note, 260ms, −12dB. `navigator.vibrate([10,40,10,40,16])` | Sidecar sheet → sidecar list + panel badge |
| **Agent** | `tool: music.createPlaylist(name, ids)` | **No sheet.** A hexagonal chip materialises in the ticker with `machine/tool-name` `music.createPlaylist` and an expandable `machine/tool-args` block showing `name` and `ids.length`. A trace runs from the ticker to the sidecar Playlists section; the new row appears with a **1.5px dashed green left border** that persists until the human first interacts with the row (a permanent provenance mark, not a transient FX — see §8.10). The panel badge increments in `--agent-300` with a dashed underline. | Chip 240ms `linear`; trace 260ms `linear`; row insert 200ms `linear` **height only, no scale, no fade-in-up** | Relay sequence ×3, 8ms each, 90ms apart, −18dB. No haptic. | Ticker + trace + sidecar list + panel badge |

#### Event 10 — Volume

| Actor | Trigger | Visual | Motion | S/H | Where |
| --- | --- | --- | --- | --- | --- |
| **Human** | Rotate wheel on Now-Playing | The panel shows the 2005-style volume bar: a 200 × 8 panel px track (`--ui-scrollbar-track`), filled `--human-500`, with a 1px `--ui-hl-topline` cap. A 26° sky arc follows the thumb on the ring. The bar's fill leading edge has a 4px `--human-glow-soft` bloom. | 48-detent model, `spring/detent`; bar auto-dismisses after 1400ms, fading 260ms `ease-out` | Fine detent, 5ms, −24dB, pitch rising with level. `navigator.vibrate(4)` | Panel overlay + wheel ring |
| **Agent** | `tool: music.setVolume(0..1)` | Same 2005 volume bar, but the fill is `--agent-400` at `0.55` **plus** a 1.5px dashed `--agent-300` outline around the whole track; the *target* level is marked first by a 2px dashed green vertical line, then the fill steps to it in **4 discrete increments of 60ms** (a machine setting a value, not sliding it). | 4 × 60ms steps, `linear`; auto-dismiss after 1400ms | 4 relay ticks, 60ms apart, −22dB. No haptic. | Panel overlay + ticker: `VOLUME ▸ 0.42` |

#### Event 11 — Flip to back (expose)

| Actor | Trigger | Visual | Motion | S/H | Where |
| --- | --- | --- | --- | --- | --- |
| **Human** | Two-finger rotate gesture on the device, or long-press the Apple logo region, or sidecar Settings | Full 3D flip (§9.3). A sky 2px silhouette stroke at `0.36` traces the leading edge as it rotates — light catching the edge you are physically turning. The room's contact shadow behaves per §9.3. | `spring/flip` **180 / 22 / 1.4**, ≈720ms to settle. Gesture-driven variant tracks the finger 1:1 with rubber-banding past 200°. | Mechanical: 140ms low woody turn + a 40ms settle thunk at the end, −16dB. `navigator.vibrate([6,0,6,0,18])` — a rising pattern peaking at settle. | Whole device + room shadow |
| **Agent** | `tool: device.exposeBack` | Same 3D transform, but at **520ms `cubic-bezier(0.35,0,0.35,1)`** with **zero overshoot** — it stops dead at 180°. No sky edge stroke; instead a 1.5px dashed green outline traces the *entire* silhouette for the duration at `0.62`, and a green hexagon sits at the rotation axis's midpoint the whole way. | 520ms, `cubic-bezier(0.35,0,0.35,1)`, terminal velocity 0 | Servo: a 500ms steady low hum + a single hard 8ms stop click, −20dB. No haptic. | Whole device + ticker: `EXPOSE ▸ BACK` |

*Distinguishable because:* the human flip **overshoots and settles**; the agent flip **arrives and stops**. Even with the colour removed and at 4fps, the terminal behaviour differs.

#### Event 12 — Tool call begin

| Actor | Trigger | Visual | Motion | S/H | Where |
| --- | --- | --- | --- | --- | --- |
| **Human** | n/a — a human does not "call a tool". The human equivalent is **entering a command in the sidecar's command field**, which is the human-initiated path *to* a tool call. | The command field's 1px border becomes 2px `--human-500`; the submit affordance fills `--human-500`; on submit the field's content collapses leftward into a sky pill and hands off to the agent — this is the canonical **handoff** and renders with the co-pilot braid (§8.11). | Border 120ms `ease-out`; collapse 240ms `spring/panel`; braid begins at handoff | Soft submit: 40ms, −18dB. `navigator.vibrate(10)` | Sidecar command field |
| **Agent** | WebMCP `tools/call` received | The **agent rail** (§8.9) at the sidecar's device-facing edge goes from `--agent-rail` to `--agent-400` and begins a 3px travelling light that runs top→bottom at 320px/s. A hexagonal chip enters the ticker with `machine/tool-name` and a 6px pulsing `--agent-400` dot at `0.85` (this is the *only* looping agent FX, and it loops at 1.4Hz with a 25% opacity swing, capped at 3 loops before it becomes static). | Rail brighten 140ms `linear`; travelling light `linear` infinite while pending; chip enter 200ms `linear` | Relay engage: 6ms, −22dB. No haptic. | Agent rail + ticker |

#### Event 13 — Tool call end (success)

| Actor | Trigger | Visual | Motion | S/H | Where |
| --- | --- | --- | --- | --- | --- |
| **Human** | n/a — see Event 12. If the human's command produced the call, the *result* renders in co-pilot braid (§8.11). | The braided outline on the affected control runs one full cycle then resolves: the sky segments fade first (over 200ms), leaving green, then green fades (200ms) — visually handing credit from initiator to executor. | 400ms total, two 200ms `linear` phases | Two-note resolve, 140ms, −16dB. Single `navigator.vibrate(10)` | Affected control + ticker |
| **Agent** | `tools/call` result returned | The ticker chip's pulsing dot becomes a **solid 6px green hexagon** and its dash gaps **collapse to zero** (`3 3` → `6 0`), turning the dashed outline solid before it fills. ⚑ **This is the success signal (§4.11) — closure, not colour.** No green success edge: green is now the agent's identity, so a green 'success' mark would be indistinguishable from the agent's ordinary presence. The rail's travelling light completes its current pass and stops at the bottom. Chip settles into the provenance trail. | Dot→hex 140ms `linear`; edge 100ms `linear`; rail stop at end of current pass | Relay release: 5ms + a 3ms confirm, 40ms apart, −20dB. No haptic. | Ticker + rail |

#### Event 14 — Tool call denied

| Actor | Trigger | Visual | Motion | S/H | Where |
| --- | --- | --- | --- | --- | --- |
| **Human** | Human taps **Deny** on a consent interrupt (§8.8) | The consent sheet's Deny button fills `--destructive-500`; the sheet drops 12px and fades over 200ms; a sky-to-destructive 2px strike line draws left→right across the requesting ticker chip in 180ms, then the chip greys to `--offline-500` and shrinks 6% in place. | Sheet drop 200ms `cubic-bezier(0.4,0,1,1)`; strike 180ms `ease-out`; grey 240ms `ease-out` | Dismissive: 70ms damped thud, −16dB. `navigator.vibrate([16,60,16])` | Consent sheet + ticker chip |
| **Agent** | Permission policy auto-denies, no human present | The ticker chip does **not** grey. It gains a 1.5px `--destructive-onDark` dashed outline replacing its green one, a `machine/badge` label `DENIED`, and the reason in `machine/tool-args`. A 6px hexagon collapses to a 2px horizontal dash over 180ms and stays as a permanent dash in the provenance trail. The rail flashes `--destructive-onDark` at `0.6` once, 200ms. | Outline swap 140ms `linear`; hex→dash 180ms `linear`; rail flash 200ms `linear` | Relay reject: a single 12ms dull click at −16dB (lower and duller than the confirm click). No haptic. | Ticker + rail |

#### Event 15 — Error

| Actor | Trigger | Visual | Motion | S/H | Where |
| --- | --- | --- | --- | --- | --- |
| **Human** | A human action fails (track unavailable, offline) | The affected panel row shakes ±3 panel px, 2 cycles. Its text goes `--destructive-onDark`; a ⚠ glyph appears left of the label. The device silhouette flashes `--destructive-500` at `0.20` once. A Liquid Glass toast rises with `sidecar/sheet-body` copy naming the cause and one recovery action. | Shake 2 × 90ms `ease-in-out`; toast rise 320ms `spring/panel` | Error: 3 × 40ms descending, −14dB. `navigator.vibrate([40,60,40])` | Panel row + silhouette + glass toast |
| **Agent** | A tool call throws | **No shake.** The ticker chip's outline becomes solid (not dashed) `--destructive-onDark` at `0.9` — the loss of the dash is itself the signal that the machine's normal state has broken. Badge `ERROR`, error string in `machine/tool-args`, truncated to 2 lines with a disclosure. The rail turns solid `--destructive-onDark` at `0.5` and its travelling light **stops mid-pass** and stays frozen where it stopped until acknowledged. | Outline solidify 160ms `linear`; rail freeze 0ms (instant) | Relay fault: one 20ms buzzy click, −14dB. No haptic. | Ticker + rail |

*Distinguishable because:* human errors move the object; agent errors freeze the instrument. A frozen travelling light in the rail is a uniquely machine failure image.

#### Event 16 — Search / query (bonus, both actors share a surface)

| Actor | Trigger | Visual | Motion | S/H | Where |
| --- | --- | --- | --- | --- | --- |
| **Human** | Typing in the sidecar search field | Results list items fade+rise 8px, staggered 40ms. Matched substrings get a `--human-100` background at `0.16` with `--human-300` text. | Stagger 40ms, each item `spring/panel` | Keystroke: none (typing is its own feedback). No haptic. | Sidecar |
| **Agent** | `tool: music.search(q)` | Results appear **all at once, no stagger, no rise** — only opacity 0→1 over 120ms `linear`. Matched substrings get a 1px dashed `--agent-300` underline, no background fill. Each result row carries a 6px green hexagon on its right edge until touched. | 120ms `linear`, simultaneous | Relay tick ×1. No haptic. | Sidecar + ticker: `SEARCH ▸ "q"` |

### 8.4 Attenuation (Restraint Under Delight, enforced)

⚑ Every FX in §8.3 obeys this rule: **if the same event fires again within 400ms, the new instance's peak opacity is multiplied by 0.5, floored at 0.30 of the base value, and its duration is multiplied by 0.7.** The multiplier resets after 900ms of quiet. Sound follows: repeat within 400ms drops 6dB, floored at −30dB.

This is what stops a fast wheel spin from becoming a strobe and a batch of 40 agent tool calls from becoming a light show (§10.8).

### 8.5 The two-orbit system — human halo on the rim, agent trail in the travel band

**R3 inversion, R4 refinement.** R2 had the human riding the seam and the agent hovering outside; R3 inverted them on ergonomic grounds (§7.6 — feedback under a thumb is feedback nobody can see). R4 refines both after seeing them rendered: the human halo moves **onto the rim** rather than sitting outside it, and the agent band grows to **symbolise an actual thumb**. The canonical argument is unchanged — *"light escaping around my thumb"* vs *"the gesture I did not make."*

#### Radii — as built

| | Fraction of `wheelR` | **Mobile** (`wheelR` 106) | **Desktop** (`wheelR` 125) | Clearance and why |
| --- | --- | --- | --- | --- |
| Select radius | `0.368` | 39 | 46 | — |
| Select lip | — | to **43** | to **50** | 1px stroke + 3px inner shadow (§5.3 L9) |
| Printed label band | `0.57 · ringW` | **77 – 79** | **91 – 93** | measured on the artboard |
| Recess-shadow inner reach | — | **95** | **112** | §5.3 L5 `0 5px 11px` intrudes inward |
| **HUMAN halo centreline** | **`1.009`** | **r 107** | **r 126** | ⚑ **On the rim, not outside it.** `wheelR + 1` — the band straddles the wheel edge so the glow reads as the wheel's own edge lighting rather than a detached ring. |
| — head width | `0.208 · wheelR` | **22px** → spans r **96 – 118** | **26px** → r **113 – 139** | inner edge lands 1px past the recess-shadow reach (95 / 112); the overlap is **correct** — light escaping under a thumb spills into the cavity. Outer edge clears the silhouette by **47px / 56px**. |
| — tail width | `0.085 · wheelR` | **9px** → r **102.5 – 111.5** | **11px** → r **120.5 – 131.5** | — |
| — span | — | **34° leading + 142° trailing** | same | 176° total |
| — contact core | `0.283 · wheelR` | **30px** | **35px** | — |
| **AGENT band centreline** | **`0.660`** | **r 70** | **r 83** | centre of the thumb-travel band |
| — head width | `0.434 · wheelR` | **46px** → spans r **47 – 93** | **54px** → r **56 – 110** | clears the Select lip by **4px / 6px**; clears the recess-shadow reach by **2px** at both scales |
| — tail width | `0.151 · wheelR` | **16px** → r **62 – 78** | **19px** → r **73.5 – 92.5** | — |
| — span | — | **112°** | same | — |
| **Agent 18-dash presence orbit** | `0.660` | r 70 · circ 439.8 · **dash 15 / gap 9.4** | r 83 · circ 521.5 · **dash 18 / gap 11** | co-radial with the gesture band — one agent locus, not two |
| **Co-occurrence repeater** | `wheelR + 0.245·wheelR` | **r 132** | **r 156** | see below |

⚑ **The agent band overlaps the printed labels, and that is intentional.** At the head the band spans r 47–93, fully containing the label band at r 77–79. A real thumb covers `MENU`, `⏭`, `▶⏸`, `⏮` when it scrolls; a ghost thumb that politely routed around them would read as a graphic, not as a hand. The overlap is the point.

> **The one guard on that overlap.** Measured on the black wheel (`#23262B` ground, `#A9AFB7` labels, `green-400` screen-blended): label contrast falls to **2.46:1 at α 0.30**, **1.77:1 at α 0.55** and **1.53:1 at α 0.72** — obscured, which is intended and *transient*. But at the **idle** alpha of **0.16** it measures **3.37:1**, and at 0.18 it measures **3.19:1** — both clear of the 3:1 non-text floor. ⚑ **Rule: the agent's persistent states (idle, thinking) are capped at α ≤ 0.18 so the wheel's own affordance labels stay legible at rest; only the transient acting states are permitted to obscure them.** Persistence is what WCAG governs, so this is the correct place to draw the line.

#### The halo — rim-centred construction

The R3 construction (a radial gradient from r109 to r144) is **superseded**: it read as detached from the wheel. The halo is now a **tapered arc band whose centreline sits on the rim**, so it is composed cross-sectionally rather than radially.

**Layer A — cross-sectional profile.** Alpha across the band width, parameterised by `u` (0 = inner edge, 1 = outer edge). ⚑ Peak sits at `u = 0.56`, slightly **outboard** of centre, because the inner half is the half under the thumb — biasing the light outward is both physically right and puts the energy where it can be seen.

| `u` | 0.00 | 0.18 | 0.42 | **0.56** | 0.72 | 0.88 | 1.00 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| profile | 0.00 | 0.34 | 0.92 | **1.00** | 0.80 | 0.24 | 0.00 |

**Layer B — angular mask**, `θ = 0` at contact, positive `θ` trailing:

| θ | −34° | −14° | **0°** | +24° | +58° | +98° | +142° |
| --- | --- | --- | --- | --- | --- | --- | --- |
| mask | 0.08 | 0.52 | **1.00** | 0.74 | 0.40 | 0.16 | 0.00 |

**Layer C — contact core.** 30px (mobile) / 35px (desktop) radial bloom centred on the contact point *on the centreline*, `--human-200` at 0.62 → transparent, `screen`.

**Composite.** `alpha(u, θ) = profile(u) × mask(θ) × peak`, where `peak` = **0.52** (rotation) / **0.68** (press), plus Layer C additively. Blend `screen`; clip to the device silhouette. ⚑ **No radial-gradient mask is used any more** — the band's own width taper defines its extent, which is what makes it read as integrated with the rim rather than as a glow hovering nearby.

#### ⚑ Width taper — a first-class primitive

Taper is now load-bearing, not decorative. It carries direction through an asymmetry of **extent**, so unlike an alpha ramp it survives greyscale, reduced transparency, and printing.

| Parameter | Human | Agent |
| --- | --- | --- |
| `--taper-head` | 22px (0.208 · `wheelR`) | 46px (0.434 · `wheelR`) |
| `--taper-tail` | 9px (0.085 · `wheelR`) | 16px (0.151 · `wheelR`) |
| Head : tail ratio | **2.44 : 1** | **2.88 : 1** |
| `--taper-span` | 176° (34 lead + 142 trail) | 112° |
| `--taper-gamma-w` | **1.6** | **1.6** |
| `--taper-gamma-a` | **2.0** | **2.0** |

Width law, with `t = θ / span_trailing`:
```
w(t) = tail + (head − tail) · (1 − t)^1.6
a(t) = peak · (1 − t)^2.0
```
`γ_w = 1.6` narrows fast near the head then levels — the comet profile. `γ_α = 2.0` is confirmed (see below). The leading 34° holds `w = head` and ramps alpha only; it is mostly occluded (§7.6) but supplies the hard onset that makes the tail read as a tail rather than a wedge.

⚑ **Two taper ratios, deliberately different.** 2.44:1 for the human, 2.88:1 for the agent. The agent's more aggressive taper, over a shorter 112° span, makes its band read as a *sampled sweep* while the human's longer, gentler 176° taper reads as a *continuous smear*. That difference is channel 2 doing its job at the level of the taper itself.

#### Rendering — exact-tiled arcs

⚑ **Confirmed: exact-tiled, never overlapping.** Overlapping arc segments accumulate alpha as `1 − (1 − a)ⁿ`, which is non-linear and produces bright seams at every overlap — the blotchiness in v1. Tiles must abut exactly, sharing edges, each drawn once.

| | Human | Agent |
| --- | --- | --- |
| Steps | **44** | ⚑ **18** (not 44) |
| Step arc length | 328.7px / 44 = **7.47px** | 136.8px / 18 = **7.60px** |
| Minimum blur (`≥ 0.5 × step`) | **3.74px** | 3.80px |
| **Ships at** | **blur 4.0** ⚑ *(corrected from 3.5)* | **blur 1.8** ⚑ *(corrected from 4)* |
| Inter-tile gap | 0 (exact tiling) | ⚑ **1.5px** |
| Reads as | one continuous field | a stack of discrete slats |

**Blur rule:** `blur ≥ 0.5 × step arc length` is the threshold at which tile seams disappear. Human at 3.5px is **0.47 × step** — marginally under, so faint seams would show; **4.0** is the correct value.

**The agent correction is the important one.** At blur 4 the agent band would be exactly as smooth as the human halo, which collapses LAW 3 channel 2 (continuous field vs discrete). Dropping to **blur 1.8 with 18 tiles and a 1.5px gap** makes the band visibly quantised — a strobed motion capture rather than a smear. Using **18** tiles rather than 44 also ties the gesture band to the 18-segment presence orbit, so every agent mark on the device shares one count. ⚑ The agent's dashes and slats are never blurred past legibility; only the human's field is fully smoothed.

#### Presence model

| State | Agent trail | Motion | Redundant non-colour cue |
| --- | --- | --- | --- |
| **Disconnected** | **absent entirely** | — | ⚑ Absence is the honest signal. |
| **Connected, idle** | 18 seg, `green-400 / 0.16` | breathes `0.16 → 0.19` at 0.06 Hz. No rotation. | 6px hexagon in the panel status bar |
| **Thinking** | `green-400 / 0.18` ⚑ *(capped — label guard)* | rotates 1 rev / 12s, `linear` | status hexagon → solid outline |
| **Acting** | gesture band, `green-400 / 0.55` | 3-slat bright group travels 1 rev / 1.6s, `linear` | status hexagon fills; `machine/badge` in status bar |
| **Consent required** | `green-400 / 0.72` | ⚑ **stops dead**; 2 segments at 12 o'clock → one 14px hexagon | consent sheet (§8.8) |
| **Denied** | `red-400 / 0.50` | one revolution, then segments → 2px dots, 600ms | `DENIED` in status bar, 2s |
| **Error** | `red-400 / 0.60` | ⚑ **freezes mid-rotation** | solid-stroked hexagon |

**The human has no resting halo.** It fires on contact and decays with the gesture. *A mark visible at rest is always the agent.*

#### Co-occurrence repeater — re-derived

With the human now **on** the rim rather than outside it, the halo's outermost reach is **r 118** (head) instead of R3's 144. The repeater at `wheelR + 26` = **r 132** therefore clears the halo by **14px** (desktop: r 156 clears r 139 by **17px**), sitting in clean polycarbonate with 33px / 39px still to the silhouette.

⚑ **Confirmed, and it is now strictly better than in R3.** Previously the repeater fell *inside* the halo's falloff and the two composited; now they never touch, so the agent's co-occurrence mark is unambiguously separate from the human's glow rather than merely distinguishable within it. No change to the value is needed — the refinement fixed the collision by itself.


### 8.6 Agent ghost cursor / hand on the wheel

When an agent operates the wheel, a **ghost thumb** appears. This is the one moment the agent has a body.

> ⚑ **R4:** the reticle rides the **agent band centreline** — `r = 0.660 · wheelR` (mobile **70**, desktop **83**) — not the ring's outer edge. It is the same locus as the trail because they are the same idea: *the gesture that was not made*, drawn where a thumb would have made it. The trail is the path; the reticle is the position on it.

| Layer | Specification |
| --- | --- |
| **Shape** | A 34px-diameter circle **outline only**, 1.5px stroke `--agent-400` at `0.66`, `dasharray 3 3`. Inside it, a 6px filled `--agent-400` dot at `0.80` marking the exact contact point. It is deliberately *not* a hand or a finger illustration — a literal ghost hand would be kitsch, and an outline reads as a target/reticle, which is instrument language. |
| **Crosshair** | Two 8px 1px `--agent-400` `0.40` ticks, radial and tangential to the ring, extending from the circle — orienting the reticle to the wheel's geometry. |
| **Trail** | The last 5 detent positions are marked with 4px green hexagon outlines at descending opacity `0.5 / 0.38 / 0.26 / 0.16 / 0.08`. They persist 600ms then fade over 200ms `linear`. **Discrete marks, not a continuous smear** — the human arc smears, the agent trail is sampled. |
| **Label** | A `machine/badge` tag `AGENT` in `--agent-300`, 11px, positioned **radially inward** from the reticle toward the Select button, ⚑ **R4:** placed in the clear annulus between the Select lip (r 43) and the agent band's inner edge (r 47). ⚑ Inward, not outward: outward would cross the printed `MENU / ⏭ / ▶⏸ / ⏮` ink at r 77–79. Rotates to stay upright, never tangent. |
| **Motion** | Steps discretely between detent positions, 220ms `linear` per detent. No easing between. No overshoot. |
| **Entry / exit** | Enters by scaling `0.7 → 1.0` over 140ms `linear` while a trace runs from the sidecar to its start position. Exits by scaling `1.0 → 0.7` and fading over 160ms `linear`. |
| **Co-occurrence** | If a human thumb is also on the wheel the reticle is physically occluded (§7.6), so it is **mirrored into the outside repeater** at `wheelR + 26` per §8.5 rather than offset. Stroke goes to 2px, dash to `4 3`, colour to `--agent-200`. The in-wheel reticle is still drawn — it is simply accepted as hidden under the hand. |
| **Reduced motion** | The reticle jumps with no scale-in, and the trail renders as a static set of 5 hexagons with no fade. |

### 8.7 Tool-call ticker and provenance trail

Two related surfaces: the **ticker** (live, ephemeral) and the **trail** (persistent, auditable). Both are Liquid Glass; both are the only places the machine family appears at length.

**Ticker.** Desktop: a 36px strip at the bottom of the sidecar. Mobile: a 36px strip at the bottom of the viewport, above the safe area. Background `--agent-ticker-bg #08161B` at `0.86` with `--lg-blur`, top border 1px `--agent-400` `0.14`.

Chips enter from the right and travel left. Each chip:

| Part | Specification |
| --- | --- |
| Shape | Rectangle, `4px` radius, **left edge chamfered 8px at 45°** — a machine tag silhouette. Height 24px. |
| Fill | `--agent-400` at `0.10`; on error `--destructive-onDark` at `0.10` |
| Stroke | 1.5px `dasharray 3 3` `--agent-400` at `0.55`. Solid on error. |
| Status mark | 6px hexagon at the left, inside the chamfer: outline while pending (1.4Hz pulse, max 3 loops), **filled** on success, collapsed to a 2px dash on denial, solid-stroked on error |
| Label | `machine/tool-name` 12px/600, `--agent-300` (**12.86:1** on ticker bg) |
| Timestamp | `machine/timestamp` 11px/500, `--agent-400` at `0.7`, right-aligned |
| Motion | Enter 240ms `linear` from `translateX(+40px)`; travel left `linear` at 26px/s; exit by fading over 200ms at the left edge |
| Max visible | 4 chips. A 5th collapses the oldest into a `+N` counter chip. |

**Provenance trail.** The auditable record, reachable by tapping the ticker (mobile) or always visible as the sidecar's bottom third (desktop). A reverse-chronological list of every agent action with: hexagon status mark, `machine/tool-name`, expandable `machine/tool-args`, `machine/timestamp`, and the **affected target** rendered as a live link that, on hover, draws the same orthogonal green trace from the trail row to the affected control on the device — reconnecting the record to the object. This is the harvested idea from Direction D.

**Persistent provenance marks.** Distinct from FX. Anything an agent created or modified carries a **1.5px dashed `--agent-300` left border at `0.5`** until a human interacts with it, at which point the border animates to the co-pilot braid for 400ms and then disappears. Rows a human created carry a **2px solid `--human-500` left border at `0.7`** for their first 24 hours, then nothing. Objects both touched carry the braid permanently at `0.4`.

| Provenance | Left border | Persistence |
| --- | --- | --- |
| Human-created | 2px solid `--human-500` `0.7` | 24 h |
| Agent-created, untouched | 1.5px dashed `3 3` `--agent-300` `0.5` | until first human interaction |
| Co-created | braid `4px 4px`, `--copilot-braid-a/b`, `0.4` | permanent |
| Agent-modified human object | 1.5px dashed `--agent-300` `0.35` on the **right** edge | until acknowledged |

### 8.8 Consent interrupt

Fires when an agent requests a tool the policy marks as requiring consent (anything destructive, anything that writes to the library, anything that spends money).

| Layer | Specification |
| --- | --- |
| **Scrim** | `--lg-scrim` (`0.48` dark room / `0.35` light room) over the environment, `backdrop-filter: blur(6px)` on the environment **only** — ⚑ the device is **not** blurred. It dims to `brightness(0.62)` but stays sharp, because blurring the object would break the physical illusion and imply the object moved. Scrim in 200ms `ease-out`. |
| **Sheet** | Liquid Glass, `--lg-bg`, `--lg-blur 24px`, `--lg-saturate 1.8`, 1px `--lg-border`, radius `26px`, inset 16px from viewport sides, bottom-anchored on mobile / centred on desktop at 420px wide. `--lg-shadow`. |
| **Machine seam** | A 3px `--agent-400` bar at `0.9` across the sheet's **top edge only**, with an 8px green hexagon centred on it. This is the sheet's attribution: an agent asked for this. |
| **Header** | `sidecar/sheet-title` 20px/700 `--lg-ink-1`: a plain-language statement of the request. Never the tool name. |
| **Tool detail** | Inside an 18px-radius card (`26 − 8`, concentric), `--agent-400` at `0.06` fill, 1px dashed `--agent-400` `0.30` border: `machine/tool-name` + expandable `machine/tool-args`. This is the only consent-sheet element in the machine family. |
| **Scope line** | `sidecar/sheet-body` naming exactly what changes, with counts: "Adds 14 songs to your library." |
| **Actions** | Two 44px buttons, `8px` radius (`18 − 10` padding, concentric). **Allow** is `--human-600` fill with `#FFFFFF` label — ⚑ the *approval* button is **sky, not green**, because the human is the one acting when they approve. **Deny** is a `--lg-border` outline with `--destructive-onLight` / `--destructive-onDark` label and a mandatory ⊘ glyph. A third text action, **Always allow for this session**, in `sidecar/button-sm`. |
| **Timeout** | A 1.5px `--agent-400` progress hairline along the sheet's bottom edge, draining right→left over the policy timeout (default 30s). On expiry: auto-deny, Event 14 agent path. |
| **Entry motion** | Sheet `translateY(100%) → 0` + `opacity 0 → 1`, `spring/panel` **320 / 28 / 1.0**. The machine seam draws left→right over 240ms `linear` *after* the sheet settles — the sheet is glass (spring), the seam is machine (linear). Both languages, correctly attributed, in one element. |
| **Exit** | Allow: sheet collapses into a sky pill and flies to the affected control (Event 8 human path continues from there). Deny: Event 14 human path. |
| **Focus** | Focus trapped; initial focus on **Deny** (the safe action); `Escape` = deny; `role="alertdialog"`, `aria-modal="true"`. |
| **Announcement** | `role="alert"`: "Agent requests permission: {plain-language statement}. Two options: Allow, Deny." |

### 8.9 Simultaneous and conflicting action

Three cases, escalating. Arbitration is deterministic and always visible.

#### Case A — Simultaneous, non-conflicting (human adjusts volume while agent queues a track)

Both FX render at full strength. The adjacency rule (§8.2) applies if they come within 24px. Nothing is suppressed. No arbitration UI.

#### Case B — Simultaneous, same control, compatible (both scroll the same list in the same direction)

The human's input wins as the *source of truth*; the agent's is folded in. The wheel shows the sky arc (human) and the green tick (agent) at their true independent positions, and a 1.5px `--copilot-braid` arc spans between them, showing the disagreement as a measurable gap. The list follows the human. The ticker shows `SCROLL ▸ FOLLOWING HUMAN`.

#### Case C — Simultaneous, same control, conflicting (human is scrubbing while agent calls `music.next`)

⚑ **The human always wins. The agent action is never silently dropped.**

**The arbitration collar.** A 4px ring at the wheel's outer radius + 6px, split into two arcs:

| Arc | Span | Fill | Meaning |
| --- | --- | --- | --- |
| Human arc | 200°, centred on the human contact angle | `--human-500` at `0.62`, solid, feathered 4px at both ends | you have control |
| Agent arc | 160°, the remainder | `--agent-300` at `0.55`, 1.5px `dasharray 3 3`, **hollow** | the agent is queued |

The collar appears in 160ms `spring/press` (it is a human-caused element, so it springs). The agent's queued action renders as a **hollow green hexagon parked on its arc** with a `machine/counter` countdown in `--agent-300`: `DEFERRED 2.4s`. The countdown runs while the human's gesture is active, plus a 400ms grace. Then:

| Outcome | Visual |
| --- | --- |
| **Grace expires, action still valid** | Hexagon fills, the collar's agent arc sweeps to 360° over 200ms `linear` as the human arc retracts, the deferred action executes with its normal Event FX. Ticker: `NEXT ▸ EXECUTED (deferred 2.4s)`. |
| **Human's action invalidated it** (they scrubbed to a different track) | Hexagon **collapses to a 2px horizontal dash** over 180ms `linear`, slides out along the collar to the ticker, and lands in the trail with a 1px `--offline-500` strikethrough and badge `SUPERSEDED`. Collar dissolves 200ms. A single `machine/status` line states the reason: `SUPERSEDED BY HUMAN SCRUB`. |
| **Third conflicting request arrives while deferred** | The collar's agent arc splits into stacked 1.5px dashed segments (max 3 visible, then `+N`). Ordering is FIFO. No stacking beyond 3 — the 4th is rejected immediately with Event 14 agent path and reason `QUEUE FULL`. |

**Why a collar and not a modal.** A modal would stop the human's gesture, which is the opposite of "the human wins." The collar is peripheral, non-blocking, and geometrically bound to the control in dispute, so cause and location stay attached. It is also the one FX allowed to persist above 40% opacity beyond 900ms (§10.8 exception), because a deferred agent action is a state, not a flourish.

**Hard rule:** if a conflict cannot be arbitrated by the above (both parties writing to different fields of the same object), the agent's write is **denied**, not merged, and rendered as Event 14 with reason `CONFLICT`. Silent merges are the worst possible outcome for Attributional Clarity.

### 8.10 Reduced-motion and reduced-transparency fallbacks — every FX class

`prefers-reduced-motion: reduce` — motion is replaced, never merely shortened to 0ms, because an instant state change with no other cue loses information.

| FX class | Full | Reduced motion | Reduced transparency |
| --- | --- | --- | --- |
| **Human halo** (§8.5) | rim-centred tapered band, 44 exact tiles, blur 4.0, tracks contact, springs | ⚑ Angular **tracking is retained** — it is positional feedback tied to a live gesture and removing it removes the function. What is removed is the *sweep*: the mask holds its 176° extent and **jumps per detent** with a 100ms opacity cross-fade. The taper does not animate. Alpha `0 → peak` in 100ms, hold, `→ 0` in 160ms. Contact core does not pulse. Direction reversal instant (no 60ms fade). | ⚑ **R4: the substitution collapses to "same geometry, no blur, no bloom" — plus one width rule.** Same centreline (r107), same 176° span, same taper law, `--human-600` / `--human-400` at full opacity, blur 0, flat cross-section, contact core → solid filled circle. **But widths scale by the profile's mean alpha (0.558): 22 → 12px head, 9 → 5px tail.** Without that scaling the solid band carries ~1.8× the visual weight of the bloom it replaces and becomes the heaviest object on the device — the classic reduced-transparency failure. Never approximate the bloom with stacked solid rings (§10.2). |
| **Agent gesture band** (§8.5) | 18 tiles, 1.5px gaps, blur 1.8 | tiles appear all at once, no travelling group; static at `0.55` plus a `PENDING` badge | same geometry, blur 0, gaps widened to 2px, widths × mean alpha 0.30: **46 → 14px head, 16 → 5px tail** |
| **Human bloom** (other radial blooms) | expanding feathered circle, spring | **Static** filled circle at 70% of peak radius and 100% of peak opacity, cross-fading in 120ms and out 200ms. Radius never animates. | solid 2px ring at the bloom's peak radius, no fill |
| **Human arc / smear** (wheel rotate) | 26° arc with 14° tail | 26° arc, **no tail**, position updates per detent with a 100ms opacity cross-fade | unchanged |
| **Human slide** (skip, panel transitions) | 340ms slide, spring | **Cross-fade** 160ms, plus the 3px sky leading edge rendered as a **static 3px sky left border** on the incoming block for 400ms | unchanged |
| **Human press** (buttons, quadrants, Select) | translate + gradient inversion, spring out | gradient inversion **retained** (it is a state, not motion), `translateY` removed, 0ms in / 100ms opacity out | unchanged |
| **Human flight** (create playlist) | 420ms curved flight | The pill **cross-fades** at origin (160ms out) and at destination (160ms in). No trail. | unchanged |
| **Agent trace** | orthogonal line draws over 180–260ms | The **full path renders instantly** as a static 1.5px dashed line, holds 500ms, fades 200ms. The path is the information; drawing it is not. | unchanged |
| **Agent hexagon** | scale 0.86→1.0, 140ms | appears at 1.0 with a 100ms opacity fade. No scale. | unchanged |
| **Agent stepping** (rotate, volume, ghost cursor) | discrete 220ms / 60ms steps | jumps to the final value; the intermediate positions render as **static hexagon breadcrumbs** at descending opacity, held 600ms | unchanged |
| **Agent ghost reticle** | 140ms scale entry, stepping | appears at final position instantly; trail is 5 static hexagons, no fade | unchanged |
| **Agent trail travelling group** (§8.5) | 3-segment bright group, 1 rev/1.6s `linear` | replaced by **all 18 segments held at `0.55`** plus a `machine/badge` `PENDING` label in the status bar. No movement whatsoever. | segments render at full opacity, stroke 1.5 → 2px |
| **Agent trail rotation** (thinking) | 1 rev / 12s `linear` | **static**; liveness carried by the status-bar hexagon's outline state instead | unchanged |
| **Agent idle breathe** | 0.06Hz ±4% opacity | **static** at `0.36` (the midpoint). | unchanged |
| **Agent pending dot pulse** | 1.4Hz ±25%, max 3 loops | **static** at `0.85` with a `machine/badge` `PENDING` label added — the label replaces the motion as the liveness cue | unchanged |
| **Co-pilot braid travel** | dashes travel 18px/s | **static** braid, no `dashoffset` animation. Direction is instead shown by a 6px triangular arrow at the braid's leading end. | unchanged |
| **Ticker chip travel** | enters + travels left at 26px/s | chips appear in place with a 100ms fade and **do not travel**; the list scrolls only on new entries, instantly | ticker bg → solid `--agent-ticker-bg` at `1.0`, no blur |
| **Expose flip** | 3D rotateY, spring / 520ms | **Cross-fade** front→back over 240ms with a 1.06→1.00 scale on the incoming face **only if** `prefers-reduced-motion` is not also paired with vestibular concern flags; the conservative default is a pure 240ms cross-fade with **no** transform at all. The contact shadow cross-fades between its front and back states. | shadow simplifies to one layer |
| **Arbitration collar** | 160ms spring in, arcs sweep | appears instantly at full state; the arc sweep on resolution is replaced by an instant re-split. The countdown remains (it is text, not motion). | collar strokes become solid, no feather |
| **Consent interrupt** | sheet springs up, seam draws | sheet **fades in** over 200ms at final position; seam renders complete. Timeout hairline still drains (it is a clock — removing it would remove information); if `prefers-reduced-motion`, it steps in 1-second increments instead of animating continuously. | glass → `--lg-surface` solid, 2px border, no blur |
| **Error shake** | ±3px, 2 cycles | **no shake.** Replaced by a 2px `--destructive-onDark` border that appears for 900ms plus the ⚠ glyph plus the toast. | unchanged |
| **Glass sheets / sidecar** | blur 24px, translucent | unchanged by reduced motion | `backdrop-filter: none`, background `--lg-surface`, border 1px → 2px, `--lg-shadow` retained (shadow is not transparency) |
| **Device glass specular** | 3 blurred layers | unchanged | **retained.** ⚑ `prefers-reduced-transparency` governs *UI translucency*, not the depiction of a physical material. Removing the device's specular would not aid legibility; it would just make the object worse. Panel text contrast is unaffected by the specular because the specular is `screen`-blended at ≤15% over a `#0B0D11` field and never crosses text at above 4% effective. |
| **Panel scanline / sub-pixel** | ≤7% overlay | unchanged | **disabled** under `prefers-contrast: more` (they cost ~0.3:1 of effective contrast), retained under reduced transparency |

`prefers-contrast: more` additionally: the **halo** peak goes `0.52 → 0.72` and gains a 1px `#FFFFFF / 70%` (dark) or `#0F172A / 60%` (light) contour along its inner edge, giving the field a definite boundary; all dashed agent strokes go 1.5px → 2px; `--agent-300` replaces `--agent-400` everywhere on dark; `--human-300` replaces `--human-500` for any human *stroke* (fills keep `--human-500`); every FX gains a 1px `#000000 / 60%` or `#FFFFFF / 60%` contour against its background; wheel labels switch to the `-hc` tokens; panel dividers go `--ui-divider` → `--ui-divider-strong`.

---

## 9. Motion system

### 9.1 Spring tokens

Springs are the **human/device** vocabulary. Every value below is `stiffness / damping / mass` for a Framer-Motion-style physical spring.

| Token | Stiffness | Damping | Mass | ζ (approx) | Settle | Mapped events |
| --- | --- | --- | --- | --- | --- | --- |
| `spring/detent` | **900** | **34** | **0.60** | 0.73 | ≈ 90 ms | Wheel detent advance, scrub playhead, volume step |
| `spring/press` | **700** | **30** | **0.80** | 0.63 | ≈ 130 ms | Button release, quadrant release, toggle thumb, arbitration collar entry |
| `spring/select` | **480** | **26** | **1.00** | 0.59 | ≈ 200 ms | Center Select ring expansion, Pause contraction, scrub commit |
| `spring/panel` | **320** | **28** | **1.00** | 0.78 | ≈ 300 ms | Panel slides, sheet rise, sidecar reveal, playlist flight, toast |
| `spring/bloom` | **260** | **18** | **0.90** | 0.59 | ≈ 380 ms | Human blooms, glyph morphs, add-to-library confirm |
| `spring/flip` | **180** | **22** | **1.40** | 0.69 | ≈ 720 ms | The expose flip (human-initiated) |
| `spring/settle` | **1200** | **48** | **0.50** | 0.62 | ≈ 60 ms | Micro-corrections, focus ring, hover lift |

Derived from the ios-hig baseline set (`snappy 400/30`, `responsive 300/25`, `gentle 200/20`, `bouncy 400/15`) and re-tuned for a physical object: mass is explicit because a 653px device and a 6px hexagon must not move with the same inertia, and stiffness is raised for the detent because a click wheel's feedback must land within one animation frame of the gesture crossing the threshold.

⚑ **Damping ratio floor: ζ ≥ 0.55.** Nothing in webPod is allowed to visibly ring. Overshoot is a single, small, deliberate excursion — a real mechanism settling — not a bounce.

### 9.2 Duration tokens

Durations are the **agent/machine** vocabulary, plus the small set of things that are genuinely time-based (fades, cross-dissolves, timeouts).

| Token | Value | Easing | Mapped events |
| --- | --- | --- | --- |
| `dur/instant` | `0 ms` | — | Agent skip cut, agent seek teleport, rail freeze |
| `dur/tick` | `100 ms` | `linear` | Agent marker appearance, opacity cross-fades |
| `dur/micro` | `140 ms` | `linear` | Agent hexagon appear/scale, rail brighten, outline swap |
| `dur/step` | `220 ms` | `linear` | One agent detent step, ghost-cursor step |
| `dur/trace` | `200 ms` | `cubic-bezier(0.2, 0, 0.4, 1)` | Agent trace draw, provenance trace |
| `dur/commit` | `260 ms` | `cubic-bezier(0.2, 0, 0.4, 1)` | Agent row insert, chip enter, dashed outline draw |
| `dur/flip-agent` | `520 ms` | `cubic-bezier(0.35, 0, 0.35, 1)` | Agent-initiated expose flip — terminal velocity 0 |
| `dur/fade-in` | `160 ms` | `cubic-bezier(0.33, 1, 0.68, 1)` (ios ease-out) | Entering opacity, toasts, scrim |
| `dur/fade-out` | `220 ms` | `cubic-bezier(0.42, 0, 1, 1)` (ease-in) | Leaving opacity |
| `dur/crossfade` | `240 ms` | `linear` | Mid-flip material crossfade, reduced-motion flip substitute |
| `dur/dismiss` | `1400 ms` | — | Volume / scrub overlay auto-dismiss delay |
| `dur/consent` | `30 000 ms` | `linear` | Consent timeout hairline |

**The easing law.** Agent motion uses `linear` or `cubic-bezier(x1, 0, x2, 1)` — curves whose **terminal derivative is zero or positive but never negative**, i.e. they decelerate into place and stop. Nothing agent-driven uses `cubic-bezier` values above 1.0 in the y axis (no `--ios-spring-smooth`, no back-out). Human motion may. That is a machine-checkable rule.

### 9.3 The expose flip — 3D transform specification

| Property | Value | Why |
| --- | --- | --- |
| **Axis** | `rotateY` primary. Plus a **constant** `rotateX(-6deg)` held for the entire flip (not animated in/out). | The −6° X tilt is what makes the 11mm side wall visible near 90° and makes the object read as three-dimensional rather than as a rotating plane. Constant, so it does not add a second animated axis. |
| **Degrees** | `0deg → 180deg`. Return flip is `180deg → 360deg`, **not** `180 → 0` | Always rotating the same direction means the object never "un-turns", which reads as a rewind rather than a physical action. |
| **Perspective** | Desktop `1600px`, mobile `1200px`, applied on the **parent**, not the transformed element. `perspective-origin: 50% 44%` | 1600px at a 653px-tall object is a ~24° field of view — enough foreshortening to be convincing, shallow enough not to distort. Mobile is tighter because the device fills more of the viewport. |
| **Transform style** | `transform-style: preserve-3d` on the device container; front and back faces are siblings, back at `rotateY(180deg)`, both with `backface-visibility: hidden` | — |
| **Z lift** | `translateZ` animates `0 → 28px → 0`, peaking at exactly 90° | A real object lifts slightly off the surface as you turn it. This is the single cheapest detail that stops the flip feeling like a CSS card. |
| **Duration — human** | `spring/flip` **180 / 22 / 1.4**, ≈720ms to settle, overshooting 180° by **≈4.5°** then settling | An object turned by a hand overshoots. |
| **Duration — agent** | `520ms cubic-bezier(0.35, 0, 0.35, 1)`, terminal velocity 0, **no overshoot** | LAW 3 / §9.2. |
| **Gesture variant** | Two-finger rotate tracks 1:1 with the gesture. Past 200° or below −20° it rubber-bands with a `0.35` resistance factor. Release below 90° traversed snaps back with `spring/flip`; above, completes. | — |
| **Mid-flip material crossfade** | Between **88°** and **92°** the two faces cross-fade over **`dur/crossfade` 240 ms** scaled to the local angular velocity (so a slow gesture gets a slow crossfade). Additionally at exactly 90° a **specular sweep** fires: a 2px `#FFFFFF` at `0.86` line along the device's leading vertical edge, `blur(1px)`, opacity ramping `0 → 0.86 → 0` over the 88–92° window, plus a global `brightness(1.06)` on the device for the same window. | This is the moment the object's edge passes through the key light. Without it the flip has a visible dead frame where neither face is legible. With it, the dead frame becomes the most convincing 4° of the whole animation. |
| **Side wall** | A 61px (mobile) / 69px (desktop) deep face, filled with the steel gradient rotated 90° and compressed, plus the chamfer band from §5.6 layers 2–4 on both long edges. Visible from ~62° to ~118°. | 11mm of real depth. |
| **Shadow behaviour** | The contact shadow is a separate element, not a `box-shadow`, so it can be animated independently:<br>• `scaleX`: `1.00 → 0.22 → 1.00` (the object's footprint narrows as it turns edge-on)<br>• `blur`: `28px → 64px → 28px` (a lifted object casts a softer shadow)<br>• `opacity`: `0.42 → 0.14 → 0.42`<br>• `translateY`: `0 → +10px → 0` (the shadow separates as the object lifts)<br>• `skewX`: `0 → -7deg → 0`<br>All keyed to the same 0 / 90 / 180 angular positions, driven by the same spring so shadow and object never desynchronise. | A flip with a static shadow is the most common tell that a 3D transform is fake. |
| **Panel during flip** | The panel's content freezes at flip start (no live updates) and its bloom layer (§5.5 layer 14) is disabled, to hold the compositing budget at 4 layers (§10.9). |
| **Reduced motion** | Pure opacity cross-fade, `dur/crossfade` 240 ms, **no transform, no perspective, no Z lift, no specular sweep.** The contact shadow cross-fades between its front-state and back-state values. The `rotateX(-6deg)` is dropped. |
| **Announcement** | `aria-live="polite"`: "Showing device back. Settings." / "Showing device front. Now playing." Focus moves to the back face's first control. |

### 9.4 The wheel inertia and detent model

| Parameter | Value | Why |
| --- | --- | --- |
| **Detents per revolution — list scroll** | **24** (15.0° per detent) | The real click wheel produced roughly one list advance per 15° of thumb travel. 24 is the value that makes a comfortable quarter-turn (90°) advance 6 rows — three-quarters of the 8 visible rows, so a quarter turn nearly pages. |
| **Detents per revolution — fine (scrub, volume)** | **48** (7.5° per detent) | Fine controls need double resolution; the real device switched to finer increments in the scrub context. |
| **Detent threshold hysteresis** | `±1.8°` | Prevents a thumb resting exactly on a boundary from chattering. |
| **Tick feedback latency budget** | **≤ 16 ms** from threshold crossing to visual + audio + haptic dispatch | One frame. Above this the wheel feels laggy, which is the one thing a click wheel may not feel. |
| **Tick sound** | 8 ms sample, −18 dB, pitch jitter **±30 cents** (human) / fixed pitch (agent) | Jitter is what stops a fast spin from sounding like a machine gun. Its absence is an agent attribution channel. |
| **Tick haptic** | `navigator.vibrate(6)` list / `4` fine. Coalesced: if more than 12 detents fire per second, only every 3rd vibrates. | Best-effort on web; the design never depends on it. |
| **Inertia model** | On release, angular velocity ω decays per frame: `ω *= 0.940` at 60fps (normalised to `ω *= 0.940^(dt/16.67ms)`). Stop when `|ω| < 0.35 °/frame` (≈21 °/s). | 0.940 gives a ~1.1s glide from a hard flick — long enough to feel like a flywheel, short enough not to feel out of control. |
| **Maximum ω** | Clamped at **1440 °/s** (4 rev/s) | Beyond this, detent ticks exceed the audio budget and the list becomes unreadable. |
| **Accelerated scroll** | Engages when `|ω| > 720 °/s` **and** the list exceeds 40 items. Detents-per-revolution drops from 24 to 24 but the **step multiplier** rises: `×1` below 720 °/s, `×4` at 720–1080, `×12` above 1080. A `panel/section-header`-sized letter-index overlay appears centred in the panel (a 44 × 44 panel px rounded square, `--ui-statusbar-0/1` gradient, 1px `--ui-divider-strong` border, radius 6 panel px, the current initial in Source Sans 3 700 at 28 panel px `--ui-text-1`). | This is the real 5G behaviour, and it is the reason the wheel beats a flat list on a 4,000-item library. Reproducing it is not nostalgia; it is the functional argument for the whole design. |
| **Overscroll** | At either list end, further rotation produces a **2 panel px** rubber-band on the list plus a 1px `--ui-divider-strong` line at the boundary; ω is killed to 0 immediately (no bounce-back glide). | A physical scroll list at its end resists. |
| **Reduced motion** | Inertia is **disabled entirely**: release stops the list at the current detent. Accelerated scroll still engages (it is a rate behaviour, not an animation) but the letter overlay appears/disappears with a 100ms opacity fade instead of the default 140ms scale. Detent visual feedback is the opacity cross-fade variant from §8.10. |
| **Keyboard / VoiceOver equivalents** | See §11.5. |

### 9.5 Motion class → token map (the checkable table)

| Event class | Actor | Token | Notes |
| --- | --- | --- | --- |
| Detent advance | human | `spring/detent` | — |
| Detent advance | agent | `dur/step` `linear` | discrete |
| Control press in | human | `60ms cubic-bezier(0.4,0,1,1)` | fast in |
| Control press out | human | `spring/press` | slow out |
| Control press (simulated) | agent | `dur/micro` `linear`, 0.4 strength | — |
| Select / commit | human | `spring/select` | — |
| Select / commit | agent | `dur/micro` + `dur/commit` | — |
| Panel navigation | human | `spring/panel` | slide |
| Panel navigation | agent | `dur/instant` + ghost outline `dur/step` | cut |
| Bloom / celebrate | human | `spring/bloom` | — |
| Trace / reach-in | agent | `dur/trace` | — |
| Sheet / sidecar | either | `spring/panel` | glass springs; its *seam* does not |
| Expose flip | human | `spring/flip` | overshoot 4.5° |
| Expose flip | agent | `dur/flip-agent` | terminal v = 0 |
| Idle presence | agent | 16.7 s `ease-in-out` loop | ±4% opacity |
| Pending | agent | 1.4 Hz, max 3 loops | then static + label |
| Ticker travel | agent | 26 px/s `linear` | — |
| Braid travel | co-pilot | 18 px/s `linear` | direction = next holder |
| Error | human | `2 × 90ms ease-in-out` shake | — |
| Error | agent | `dur/micro` solidify + freeze | — |

---

## 10. Anti-slop guard

Ten named failure modes specific to this design, each with the mechanism that prevents it and a test that catches it.

### 10.1 Skeuomorphism sliding into kitsch

**The failure.** Bevels on things that are not raised. Textures that describe no real material (linen, leather, felt, brushed metal on a plastic part). Aqua-style lozenge buttons. Pinstripes. Reflections that reflect nothing. "Retro" as a pose rather than as a consequence.

**Prevented by:** LAW 1 (only the device is skeuomorphic — the app chrome physically cannot acquire bevels) and LAW 2 (every bevel must be justifiable as an edge under the stated light). Plus one hard rule: ⚑ **every skeuomorphic layer in §5 must correspond to an identifiable physical fact** — a chamfer, a groove, a specular reflection, a light transmission through a translucent part. Decorative layers with no physical referent are deleted, not toned down.

**Test.** Point at any bevel, gradient or texture in a render and name the physical feature it depicts in one clause. Failures: "it looks nicer with it", "it adds depth", "it's more tactile". Any layer that cannot be named is slop. Run this over §5 layer by layer — all 74 layers pass, which is why they are enumerated rather than described.

### 10.2 Gradient banding

**The failure.** The 8-stop black polycarbonate gradient and the 10-stop steel gradient span large areas with small per-stop luminance deltas — precisely the condition that produces visible Mach bands in 8-bit sRGB. The steel back at 390 × 653px with an 11-unit delta between stops 4 and 5 will band on any display.

**Prevented by:**
1. **Micro-noise on every large gradient surface**, at `opacity 0.016–0.022`, blend `overlay`, tiled 128px (§5.1 L10, §5.2 L9, §5.3 L10, §5.4 L7). Noise dithers the boundary below the perceptual threshold. Never above `0.03` — above that it reads as dirt or JPEG artefacting.
2. **Interpolation in OKLab where supported:** `linear-gradient(in oklab, …)`. Perceptually uniform interpolation removes the mid-band compression that causes banding in the first place. sRGB interpolation is the fallback.
3. **No gradient stop pair with a luminance delta below 3 units across more than 30% of the gradient's length.** The steel gradient's stops were spaced non-uniformly (7, 9, 13, 14, 7, 8, 13, 14, 9, 6 percentage points) specifically to avoid long, flat, low-delta runs.
4. **A 1px `#000000 / 0%` → `#FFFFFF / 0%` dither pass** is *not* used; it does nothing in a compositor. Noise is the only real fix.

**Test.** Render at 100%, screenshot, apply a +60 contrast / +40 clarity adjustment. Bands become obvious. Also test on a 6-bit TN panel and in Safari's `Reduce Motion` mode (which changes compositing paths). Zero visible bands at +60 contrast is the pass condition.

### 10.3 Muddy shadows

**The failure.** Large-blur, low-opacity, pure-black shadows. They do not read as depth; they read as fog. The object appears to hover in smog rather than sit on a surface. This is the most common single defect in "premium" web UI.

**Prevented by:**
1. ⚑ **Every elevation is two shadows, never one:** a tight **contact** shadow (small offset, small blur, higher opacity) plus a broad **ambient** shadow (larger offset, larger blur, lower opacity). §5.1 L1 is `0 4px 10px -2px` at 22% *and* `0 24px 48px` at 38%. One shadow cannot describe both contact and occlusion.
2. ⚑ **Shadow colour is never `#000000` in the light room.** `--room-contact` is `#4A443C / 38%` — a warm dark neutral, because a shadow is the absence of the *key* light while the *fill* light still reaches the surface, and the fill light has a colour. Pure black shadows on a warm-neutral floor read as holes.
3. **Negative spread on contact shadows** (`-2px`, `-1px`) so the shadow does not peek out around the object's silhouette and halo it.
4. **Blur budget:** contact blur ≤ 12px, ambient blur ≤ 48px. Nothing above 48px, ever. `0 40px 120px rgba(0,0,0,0.1)` is the canonical mud recipe and it is banned.

**Test.** Take a render, delete the object, look at the shadow alone. It should read as two distinct forms — a sharp footprint and a soft halo. If it reads as one soft grey blob, it is mud.

### 10.4 Chrome that reads as grey plastic

**The failure.** A metal surface rendered with a monotonic two-or-three-stop grey gradient. This is not a subtle miss; it is the difference between "steel" and "a grey rectangle", and it is the single highest-risk element in the whole design because the entire back of the device is metal.

**Prevented by:**
1. ⚑ **Non-monotonic luminance with a dark horizon band.** `--steel-4 #656E78` at 43% is *darker than both its neighbours*, and the curve rises again to `--steel-7 #E1E7EC` at 71%. A mirror shows the room's bright half, its dark half, and the floor. Monotony is the tell.
2. **A localised sky-reflection blob** (§5.2 L3), because a mirror reflects a *scene*, not a ramp. A gradient alone can never look like a reflection.
3. **A hard horizon line** (§5.2 L5) — 1px, `blur(0.5px)`. Reflections have edges.
4. **Off-axis gradient angle** `168deg`. Perfectly axial metal reads as a printed swatch.
5. **Anisotropic single-direction grain** at ≤5% (§5.2 L6). Cross-hatched grain would read as brushed aluminium, a different material.
6. **Conic-gradient strokes on curved metal edges** (§5.3 L1, §5.6 L3) — a metal edge running around a rounded rectangle presents a different angle to the light at every point, and a flat stroke flattens it.
7. **Corner glints** (§5.6 L5). A rolled edge concentrates light where its curvature peaks.

**Test.** Desaturate the steel back to greyscale and plot a vertical luminance histogram. It must be **non-monotonic with at least two local maxima and one clear local minimum**. A monotonic curve is a fail regardless of how it looks. This is the one anti-slop test in the document that is fully automatable.

### 10.5 Glass that reads as a white diagonal stripe

**The failure.** The universal fake-glass tell: a hard-edged, uniform-opacity white parallelogram laid diagonally across a rectangle. It says "someone added a highlight layer", not "there is glass here".

**Prevented by:**
1. ⚑ **The specular is a skewed quadrilateral with non-parallel edges**, not a parallelogram. Vertices `(0.00,0.00) (0.62,0.00) (0.34,1.00) (0.00,1.00)` — the top edge is 62% of the width, the bottom 34%. A real reflection converges because the reflected source is at a finite distance.
2. ⚑ **The fill is graded, not uniform:** `--glass-specular-1 0.15` → `#FFFFFF / 6%` at 44% → transparent at 82%. A uniform fill is the giveaway.
3. ⚑ **`filter: blur(9px)`.** A reflection off a smooth surface of a soft source has soft edges. A hard-edged specular implies a point source and a perfect mirror, which glass is not.
4. **`screen` blend, not `normal`.** Additive light adds light; a white overlay at 15% just greys out what is underneath and kills the panel's contrast.
5. **A second, weaker counter-sheen** from the fill light (§5.5 L10), positioned lower-right. One highlight is a sticker; two lights make a room.
6. **Chromatic edge refraction** — cool on top/left, warm on bottom/right (§5.5 L12–13). This is the detail that no fake-glass treatment ever has, and it costs two 3px bands.
7. **A separate 1px hard top cut-edge line** (§5.5 L11) — the *only* hard-edged element in the glass stack, and it is 1px, so it reads as a physical edge rather than a highlight.

**Test.** Hide the panel content and look at the glass stack alone over flat `#0B0D11`. It should read as a sheet of glass with an implied room. If it reads as a white shape, restart.

### 10.6 Drop shadows that fog rather than lift

Distinct from §10.3 (which is about shadow *quality*); this is about shadow *semantics*. A shadow's job is to communicate a specific height above a specific surface. A shadow applied to everything communicates nothing.

**Prevented by:** a strict, enumerated elevation ladder. Only these things cast:

| Elevation | What casts it | Contact | Ambient |
| --- | --- | --- | --- |
| 0 | The panel, the wheel ring, anything recessed | **nothing** | **nothing** |
| 1 | Center Select button, toggle thumb, hardware push button | `0 1.5px 4px -1px / 36%` | `0 0 2px / 24%` |
| 2 | Album art in the panel split-pane | `0 2px 4px / 60%` | — |
| 3 | Sidecar glass panel, toast | `0 4px 8px -2px / 14%` | `0 12px 32px / 18%` |
| 4 | Consent interrupt sheet | `0 6px 12px -3px / 18%` | `0 24px 56px / 26%` |
| 5 | The device itself | `0 4px 10px -2px --room-ao` | `0 24px 48px --room-contact` |

⚑ **Recessed elements cast no shadow. Ever.** They receive inner shadows. Every FX mark (blooms, traces, hexagons, ticks) casts **no shadow at all** — it is light, not matter. Applying a drop shadow to a glow is the purest form of this failure.

**Test.** Count the distinct shadow recipes in a render. It must be ≤ 6. Then check: does anything have a shadow that is not in the ladder above? Delete it.

### 10.7 Nostalgia over usability

**The failure.** Keeping a 2005 constraint that was a *limitation*, not a *feature*, and calling it authenticity. The 2005 iPod had: 8 visible rows, no search, no lyrics, no artwork above 200px, a 5-level-deep menu tree for reaching a playlist, and no way to see a queue.

**Prevented by** a stated dividing line: ⚑ **the click wheel and its detent/inertia/accelerated-scroll model are kept because they were better. Everything the 2005 device lacked because of hardware limits is provided in the glass layer, not forced into the panel.**

| 2005 constraint | Kept? | Where the modern capability lives |
| --- | --- | --- |
| Click wheel navigation | **Kept** — it was better | On the device |
| Accelerated scroll + letter index | **Kept** — it was better | On the device |
| 8 visible rows | Kept on the panel | Full-length lists in the sidecar |
| Split-pane with artwork right | **Kept** — it was good | Panel; 320px artwork in the desktop left column |
| No search | **Rejected** | Sidecar search field, `⌘K` |
| No lyrics | **Rejected** | Desktop left column / mobile sidecar sheet |
| No visible queue | **Rejected** | Sidecar, always visible on desktop |
| 5-deep menu to reach a playlist | **Rejected** | Sidecar direct access; the panel keeps the tree for those who want it |
| 200px max artwork | **Rejected** | 320px in the desktop left column |
| Cover Flow (a later-generation idea) | **Adopted, as a panel mode** | A wheel-driven horizontal artwork browser rendered *inside* the 320 × 240 panel, in the panel's own grammar — no blur, no glass, 3 visible covers, perspective faked with a 2-step scale ladder (1.00 / 0.78) and a 1px reflection strip. It earns its place because it is the one 2005-lineage interaction where the wheel's continuous input maps better than a swipe. |
| No agent surface | **Rejected** | Entirely in the glass layer (LAW 1) |

**Test.** For any panel-only limitation, ask: "is the modern capability reachable in ≤ 2 actions from the sidecar?" If not, the design is prioritising the costume over the person wearing it.

### 10.8 The agent FX becoming a distracting light show

**The failure.** An agent that fires 40 tool calls in 6 seconds produces 40 traces, 40 hexagons, 40 ticker chips and 40 relay clicks. The result is a strobe, and the user's response is to disable the agent — which kills the feature.

**Prevented by five compounding mechanisms:**

1. ⚑ **Attenuation (§8.4).** Same event within 400ms → peak opacity × 0.5 (floor 0.30), duration × 0.7, sound −6dB (floor −30dB).
2. ⚑ **Batch coalescence.** More than **3 tool calls of the same name within 900ms** collapse into **one** trace, one hexagon, and one ticker chip bearing a `machine/counter` count (`music.addToLibrary ×14`). Individual entries still land in the provenance trail — the record is complete, the *display* is summarised.
3. ⚑ **The one-loop budget.** At most **one** looping animation may be on screen at a time, and only two things are allowed to loop at all: the rail's travelling light and the pending dot's 1.4Hz pulse. The pulse caps at **3 loops**, then goes static and gains a `PENDING` label. Nothing else loops, ever.
4. ⚑ **The persistence ceiling.** Nothing above `0.40` opacity persists beyond **900ms** — with exactly two exceptions, both of which are *states* rather than flourishes: the arbitration collar (§8.9) and the consent interrupt (§8.8), which is supposed to block.
5. ⚑ **The audio floor.** Total agent audio is capped at **one event per 180ms**; excess is dropped, not queued. Agent clicks sit 4–6dB below the equivalent human clicks throughout §8.3, so the agent is always quieter than the person.

**Test.** Script 40 `addToLibrary` calls over 6 seconds and record. Pass conditions: ≤ 4 traces drawn, ≤ 1 looping element on screen at any frame, ≤ 34 audio events, and a first-time viewer can still read the ticker.

### 10.9 Compositing budget blowout

**The failure.** Specific to this design: the device stack contains 74 enumerated layers, several with `filter: blur()` and `mix-blend-mode`, and the glass layer adds `backdrop-filter`. `liquid-glass.md` caps this at **4 backdrop-filter compositing layers per screen** and **40px max blur** on mobile Safari. Naively implemented, webPod would blow both.

**Prevented by:**

| Rule | Detail |
| --- | --- |
| **`backdrop-filter` census: 4 max** | (1) sidecar glass, (2) ticker, (3) consent sheet *or* toast — never both, (4) the Select button's `blur(3px)`. Nothing else may use it. The device's specular, gloss and refraction layers use `filter: blur()` on **static, pre-composited** elements, which is a paint-time cost, not a per-frame one. |
| **Static-layer flattening** | The entire device material stack (§5.1–5.6) except the pressed states and the FX layer is rendered once into a single composited layer and only re-rasterised on breakpoint or room change. `will-change: transform` on the device container only; removed after the flip settles. |
| **Blur ceiling** | 40px on mobile (`--lg-blur 24px` is well inside it). The steel's `blur(0.4px)` grain and the glass's `blur(9px)` specular are on static layers. |
| **Flip-time degradation** | During the expose flip: panel bloom (§5.5 L14) off, panel content frozen, sub-pixel and scanline overlays off, ticker `backdrop-filter` → solid. Restored on settle. |
| **No animated blur** | Per `motion-animation.md`: blur is never animated. The mid-flip crossfade animates opacity and brightness; the specular sweep animates opacity. |
| **FX layer isolation** | All §8 FX render in one `isolation: isolate` layer above the device, so an FX repaint never invalidates the device's raster. |

**Test.** Chrome DevTools Layers panel: ≤ 4 layers with a backdrop-filter, ≤ 12 composited layers total. Then a 6-second scroll+agent-burst trace on a throttled mid-tier device: ≥ 55fps sustained, zero frames above 20ms.

### 10.10 The two languages bleeding into each other

**The failure, unique to this design.** LAW 1 is easy to state and easy to erode. The erosion goes both ways: someone adds a subtle bevel to a sidecar button "for affordance"; someone adds a `backdrop-filter` to a panel overlay "for hierarchy". Ten such decisions and the composition collapses into a single mushy language that is neither convincing as an object nor clean as an interface.

**Prevented by a checklist run on every new element:**

| Question | DEVICE answer | GLASS answer |
| --- | --- | --- |
| Does it have a gloss or specular layer? | may | **never** |
| Does it have a bevel / inner highlight + inner shadow pair? | may (if it depicts an edge) | **never** |
| Does it use `backdrop-filter`? | **never** (one exception: the Select button, §5.4 L2) | yes |
| Is it translucent? | **never** (same exception) | yes |
| Which type family? | Source Sans 3 | Inter Tight, or IBM Plex Mono in agent surfaces |
| Which radius family? | superellipse n=4.2 on the silhouette; ≤ 6px inside the panel | circular `border-radius`, 8–26px |
| Which spacing scale? | `--psp-*` (2px grid) inside the panel | `--sp-*` (8px grid) |
| Does it cast a shadow? | only per the §10.6 ladder | elevation 3–4 only |
| Which motion vocabulary? | springs (human) / durations (agent) | `spring/panel` for the container, `dur/*` for its machine seams |

⚑ An element that would answer "both" or "neither" to more than one row is a design error, and the resolution is to move it fully into one layer — not to invent a hybrid.

**Test.** Take any screenshot. Draw the boundary between device and glass with one continuous line. If the line has to detour, or if any element straddles it, that element is the bug.

---

## 11. Accessibility

Targets: WCAG 2.2 AA as the floor (4.5:1 body text, 3:1 large text and non-text UI, 44 × 44 targets), with AAA (7:1) achieved wherever it did not cost Material Honesty.

### 11.1 Contrast ratios — every text-on-material pairing

All ratios computed from the sRGB relative-luminance formula. **Every value below is measured, not estimated.**

#### On the panel — dark mode (`--ui-bg #0A0F16`)

> ⚑ **R2:** ratios below are recomputed against the themed dark tint `#0A0F16` (was `#0B0D11`); the shift is ≤0.5% and no verdict changes. Light-mode panel ratios are in §4.14. Actor rows supersede R1's crimson/cyan.

| Foreground | Token | Ratio | AA body | AA large | AAA | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| `#F2F4F7` | `--ui-text-1` | **17.65:1** | ✓ | ✓ | ✓ | pass |
| `#A8AEB8` | `--ui-text-2` | **8.72:1** | ✓ | ✓ | ✓ | pass |
| `#7C838E` | `--ui-text-3` | **5.09:1** | ✓ | ✓ | ✗ | pass |
| `#767A81` | `--ui-text-4` (disabled) | **4.51:1** | ✓ | ✓ | ✗ | pass |
| `#8A9199` | `--ui-chevron` | **6.10:1** | ✓ | ✓ | ✗ | pass (non-text, needs 3:1) |
| `#38BDF8` | `--human-400` `sky-400` | **8.97:1** | ✓ | ✓ | ✓ | pass — dark-surface human **text** |
| `#0EA5E9` | `--human-500` `sky-500` | **6.93:1** | ✓ | ✓ | ✗ | pass — dark-surface human fill/stroke |
| `#0284C7` | `--human-600` `sky-600` | **4.69:1** | ✓ | ✓ | ✗ | pass — dark co-occurrence tier |
| `#86EFAC` | `--agent-300` `green-300` | **13.69:1** | ✓ | ✓ | ✓ | pass — dark-surface agent **text** |
| `#4ADE80` | `--agent-400` `green-400` | **11.03:1** | ✓ | ✓ | ✓ | pass — dark-surface agent stroke/hexagon/orbit |
| `#BBF7D0` | `--agent-200` `green-200` | **15.86:1** | ✓ | ✓ | ✓ | pass — dark co-occurrence tier |
| `#FA243C` | `--brand-am` | **4.93:1** | ✓ | ✓ | ✗ | ⚑ **brand fill/glyph only**, not an actor, never text on light |
| `#C4A9FA` | `--copilot-300` | **9.63:1** | ✓ | ✓ | ✓ | pass |
| `#9C6CF0` | `--copilot-500` | **5.39:1** | ✓ | ✓ | ✗ | pass |
| `#FF6A55` | `--destructive-onDark` | **6.89:1** | ✓ | ✓ | ✗ | pass |
| `#E02D1B` | `--destructive-500` | **4.22:1** | ✗ | ✓ | ✗ | **fill/icon only — see note B** |
| `#30D158` | `--success-500` | **9.62:1** | ✓ | ✓ | ✓ | pass |
| `#F5A524` | `--warning-500` | **9.53:1** | ✓ | ✓ | ✓ | pass |
| `#767A81` | `--offline-500` | **4.51:1** | ✓ | ✓ | ✗ | pass |
| `#2E333B` | `--ui-divider` | 1.53:1 | — | — | — | non-text decorative; exempt (SC 1.4.11 applies to *required* UI boundaries; rows are also separated by 26px rhythm) |
| `#3A4049` | `--ui-divider-strong` | 1.86:1 | — | — | — | as above; used in `prefers-contrast: more` |
| `#5A616B` | `--ui-scrollbar-thumb` | 3.11:1 | — | ✓ | — | pass (SC 1.4.11, 3:1) |

> **Note A (R1, superseded).** The demoted brand crimson `#FA243C` at 4.93:1 passes AA for text on the panel, but it is nonetheless declared **fill-and-glow only** by token policy (§4.8), because at 11–12 panel px through a 7% scanline overlay its effective ratio drops to ≈4.6:1 — inside tolerance but with no margin. Crimson *text* on the panel uses `--human-300` (8.32:1).
>
> **Note B.** `--destructive-500` at 4.22:1 fails AA for body text and is therefore **never** used as a text colour. Destructive text uses `--destructive-onDark #FF6A55` (6.89:1) on dark and `--destructive-onLight #B01F0C` (6.04:1) on light. `--destructive-500` appears only as an icon fill (≥ 24px, so it is a graphical object needing 3:1) and as a button background under white text.

#### On the selection highlight

The highlight is a gradient, so the **worst-case stop** governs.

| Foreground | Background stop | Ratio | Verdict |
| --- | --- | --- | --- |
| `#FFFFFF` | `--ui-hl-0 #4478BC` (lightest, worst case) | **4.51:1** | pass AA — binding constraint |
| `#FFFFFF` | `--ui-hl-1 #2F63A8` | **6.05:1** | pass |
| `#FFFFFF` | `--ui-hl-2 #1A4076` | **10.30:1** | pass |
| `#F2F4F7` | `--ui-hl-0` | **4.09:1** | ✗ **FAIL** |

⚑ Selected-row text is **`#FFFFFF`, pure**, not `--ui-text-1`. This is why `--ui-hl-text` exists as a separate token. The 0.42-ratio difference between `#F2F4F7` and `#FFFFFF` is the difference between pass and fail, and it is exactly the kind of thing that gets lost without the number written down.

Selected-row *secondary* text `--ui-hl-text-2 #D4E2F4` measures **3.43:1** against the worst-case top stop `--ui-hl-0` and **4.61:1** against `--ui-hl-1`. It is therefore constrained by geometry rather than by an exception: ⚑ secondary text on a selected row is only permitted **below 58% of the row's height**, where the highlight gradient has reached `--ui-hl-1` or darker and the ratio is ≥ 4.61:1. In a 26-panel-px row the primary line occupies panel px 3–16 (on `--ui-hl-0` → `--ui-hl-1`, pure white, ≥ 4.51:1) and the secondary line occupies panel px 17–24 (on `--ui-hl-1` → `--ui-hl-2`, ≥ 4.61:1). Both pass. This is why the highlight gradient runs light-to-dark and not the reverse: the type hierarchy and the luminance ramp are aligned, so the smaller, lighter-weight text always sits on the darker half.

#### On the device body

| Foreground | Background | Ratio | Verdict |
| --- | --- | --- | --- |
| `--poly-k-ink #FFFFFF` | black poly `#0C0D0F` | **19.44:1** | pass AAA |
| `--poly-k-ink-2 #A9AFB7` | black poly | **8.80:1** | pass AAA |
| `--poly-w-ink #1A1C20` | white poly `#E2E5E8` | **13.49:1** | pass AAA |
| `--poly-w-ink-2 #4A4F57` | white poly | **6.52:1** | pass AA |
| `--human-700 #B00F22` | white poly | **5.65:1** | pass AA |
| `--agent-700 #066A80` | white poly | **4.91:1** | pass AA |
| `--human-500 #FA243C` | white poly | 3.09:1 | **fill only**, fails text |
| `--hold-active #DC4E0E` | white poly | **3.23:1** | pass SC 1.4.11 (non-text UI, 3:1) |
| `--hold-active #DC4E0E` | black poly `#1A1C1F` | **4.18:1** | pass SC 1.4.11 |

#### On the click wheel

| Foreground | Background | Ratio | Verdict |
| --- | --- | --- | --- |
| `--wheel-w-label #5E646D` | white ring `#E9EBED` | **4.99:1** | pass AA |
| `--wheel-w-label-hc #3E434A` | white ring | **8.34:1** | pass AAA (`prefers-contrast: more`) |
| `--wheel-k-label #A9AFB7` | black ring `#23262B` | **7.73:1** | pass AAA |
| `--wheel-k-label-hc #E4E7EA` | black ring | **13.76:1** | pass AAA (`prefers-contrast: more`) |

> The real 5G's screen-printed wheel labels were *deliberately* low-contrast — a light grey on white. Reproducing that literally would give ≈2.7:1 and fail. We ship `#5E646D` at 4.99:1: still visibly a soft printed grey, still Material-Honest as screen-printed ink, and legible. This is the correct trade: authenticity yields to legibility on any element carrying a label.

#### On the steel back

| Foreground | Background | Ratio | Verdict |
| --- | --- | --- | --- |
| `--steel-label-ink #2B3037` | `--steel-base #C4CBD2` | **8.11:1** | pass AAA — **all functional labels** |
| `--steel-label-ink-2 #4C535B` | `--steel-base` | **4.76:1** | pass AA |
| `--steel-engrave-lo #5A626B` | `--steel-base` | **3.78:1** | logotype exemption only |
| Engraved `iPod` wordmark composite | `--steel-base` | ≈**2.51:1** | logotype exemption only |

⚑ **The engraved Apple logo and the `iPod` wordmark do not meet 4.5:1 and are not required to.** WCAG 2.2 SC 1.4.3 explicitly exempts *"text that is part of a logo or brand name"*. They carry zero information; both have `aria-hidden="true"` and the device's accessible name is supplied on the container (`aria-label="webPod, iPod-style music player"`). Every label on the steel back that a user must *read* — the Settings list — uses `--steel-label-ink` at 8.11:1 with **no** engrave treatment, because the engrave recipe costs ~2 stops of contrast (§5.7).

Steel-back Settings rows additionally sit on a `#FFFFFF / 62%` flat plate rather than directly on the reflective gradient, because a large-amplitude non-monotonic background makes *any* fixed text colour unreliable across its length. The plate is the honest solution: real product labels are printed on a solid field, not onto a mirror.

#### On Liquid Glass (composited against `--lg-surface`)

| Foreground | Light glass `#EEF0F3` | Dark glass `#191B1F` |
| --- | --- | --- |
| `--lg-ink-1` | **15.57:1** (`#16181C`) | **15.65:1** (`#F2F4F7`) |
| `--lg-ink-2` | **5.90:1** (`#565C66`) | **7.73:1** (`#A8AEB8`) |
| `--human-700 #B00F22` / `--human-300 #FF8494` | **6.26:1** | **7.37:1** |
| `--human-500 #FA243C` | 3.42:1 — **fill only** | **4.42:1** — text permitted |
| `--agent-700 #066A80` / `--agent-300 #7CE7FA` | **5.44:1** | **12.04:1** |
| `--agent-900 #033844` | **11.13:1** | — |
| `--agent-500 #1EC8E6` | 1.76:1 — **stroke/fill only** | **8.59:1** |
| `--copilot-700 #5B2FB0` / `--copilot-300 #C4A9FA` | **7.42:1** | **8.54:1** |
| `--destructive-onLight/onDark` | **6.04:1** | **6.89:1** |
| `--success-onLight #157A34` / `--success-500` | **4.76:1** | **8.53:1** |
| `--warning-onLight #8A5A00` / `--warning-500` | **5.19:1** | **8.45:1** |
| `--offline-onLight #5F646B` / `--offline-500` | **5.22:1** | 4.00:1 → use `#8A9099` (**5.36:1**) on dark glass |

⚑ Glass contrast is computed against `--lg-surface` (the **opaque fallback**), not against the translucent composite, because the composite varies with whatever is behind it. That is the only safe way to guarantee a ratio on a translucent surface. Where a glass panel can sit over bright album artwork, `--lg-scrim` is applied beneath it, which brings the composite within 0.4:1 of the opaque value.

#### On the agent ticker (`--agent-ticker-bg #08161B`)

| Foreground | Ratio | Verdict |
| --- | --- | --- |
| `--agent-300 #7CE7FA` | **12.86:1** | pass AAA — the default ticker text |
| `--agent-500 #1EC8E6` | **9.17:1** | pass AAA |
| `--destructive-onDark #FF6A55` | **6.53:1** | pass AA |

#### In the environment

| Foreground | Background | Ratio |
| --- | --- | --- |
| `--room-ink #1E2126` | light room `--room-1 #E8E6E2` | **12.95:1** |
| `--room-ink-2 #5C6169` | light room `--room-1` | **5.00:1** |
| `--room-ink #EDEFF2` | dark room `--room-2 #0E0F12` | **16.64:1** |
| `--room-ink-2 #C4C9D0` | dark room `--room-2` | **11.51:1** |

#### The co-occurrence finding (R2)

| Pair | Greyscale | Tritan ΔE | Consequence |
| --- | --- | --- | --- |
| `sky-400` vs `green-400` (naive) | **1.23:1** | **4.7** | ⚑ **Banned as a co-occurring pair.** Indistinguishable in greyscale and under tritanopia. |
| `sky-500` vs `green-200` (dark rule) | **2.29:1** | **22.6** | The enforced dark pair (§4.9) |
| `sky-700` vs `green-900` (light rule) | **1.54:1** | **12.7** | The enforced light pair (§4.9) — still not attribution; form carries it |
| `sky-300` vs `green-300` | 1.19:1 | 5.8 | ⚑ **Banned.** |
| `sky-800` vs `green-800` | 1.06:1 | 2.6 | ⚑ **Banned.** |

⚑ **This table is why LAW 3 exists in its R2 form.** No pair of steps from these two ramps reaches 3:1 in greyscale while both remain text-legible on the same surface. That is a property of the hues, not of the choice of steps, and it cannot be engineered away — so it is engineered *around*, via channels 1–5.

### 11.2 44px target verification — every control

Measured at the mobile breakpoint (the smaller of the two), device **330 × 552px**, `wheelR` 106.

| Control | Geometry | Smallest dimension | vs 44px | Verdict |
| --- | --- | --- | --- | --- |
| Wheel quadrant (×4) | annular sector, r 45.5 → 119px, 90° span | radial depth **73.5px**; inner arc length **71.5px** | +67% / +62% | ✓ |
| Center Select | circle Ø 91px | **91px** | +107% | ✓ |
| Hold switch | 44 × 22px visual, **44 × 44px** hit area (12px vertical padding, `pointer-events` extended) | **44px** | exact | ✓ |
| Sidecar list row | full width × 44px | **44px** | exact | ✓ |
| Sidecar icon button | 44 × 44px (28px glyph + 8px padding) | **44px** | exact | ✓ |
| Sidecar toggle | 51 × 31px visual, 51 × 44px hit | **44px** | exact | ✓ |
| Consent Allow / Deny | 190 × 44px | **44px** | exact | ✓ |
| Ticker chip | 24px tall visual, **44px** hit area (10px above/below) | **44px** | exact | ✓ |
| Ticker expand handle | 44 × 36px visual, 44 × 44px hit | **44px** | exact | ✓ |
| Steel-back Settings row | full width × 48px | **48px** | +9% | ✓ |
| Steel-back toggle | as sidecar toggle | **44px** | exact | ✓ |
| Flip affordance (Apple logo region) | 88 × 88px | **88px** | +100% | ✓ |
| Panel row (touch-through on glass) | 280 × 26 panel px → **280 × 22.75 device px** | **22.75px** | −48% | ✗ **see below** |
| Provenance trail row | full width × 52px | **52px** | +18% | ✓ |
| Sidecar close / drag handle | 40 × 4px visual, **56 × 44px** hit | **44px** | exact | ✓ |

⚑ **The panel rows are the one control that cannot meet 44px, and they are deliberately not touch targets.** A 26-panel-px row at 0.875 scale is 22.75 device px — half the minimum. Rather than inflate the rows (which would break Panel Discipline and reduce the visible row count from 8 to 4), **the panel is not a touch surface.** Row selection happens exclusively through the wheel, whose quadrants exceed 44px by 62%. Tapping the panel does exactly one thing: it activates the wheel's focus (equivalent to a mouse entering the control), announced to VoiceOver as "Click wheel, adjustable." Direct row tapping is available in the **sidecar**, where every row is 44px.

This is the correct resolution, not a workaround: the real device had no touchscreen either, and forcing one produces both an accessibility failure and a worse interaction. The 8-row panel plus a 44px-plus wheel beats a 4-row panel with tappable rows on every axis.

Desktop targets are all ≥ the mobile values (the device is 15% larger and the sidecar rows are unchanged at 44px), so mobile verification is sufficient.

### 11.3 The non-colour attribution channel — strengthened for R2

The R2 hue change makes this section the load-bearing one. Measured evidence first.

#### What the hue pair actually delivers

Simulations use the Machado (2009) severity-1.0 matrices applied in linear RGB; ΔE is OKLab Euclidean ×100, where ~2 is a just-noticeable difference and ≥10 is unambiguous.

| Pair (as co-occurring) | Greyscale | Deuteranopia ΔE | Protanopia ΔE | Tritanopia ΔE |
| --- | --- | --- | --- | --- |
| `sky-400` / `green-400` (naive same-step) | **1.23:1** | 20.5 | 20.7 | **4.7** |
| `sky-400` / `green-500` | **1.06:1** | 20.6 | 21.4 | **5.4** |
| Dark co-occurrence pair `sky-500` / `green-200` | **2.29:1** | 30.2 | — | **22.6** |
| Light co-occurrence pair `sky-700` / `green-900` | **1.54:1** | 17.7 | — | **12.7** |
| *(R1 reference: crimson / cyan)* | *1.94:1* | *collapses* | *collapses* | *good* |

**Read this honestly.** Red-green deficiency — the common case, ~8% of men — is comfortably handled: every ΔE is ≥17, well above unambiguous. The R2 pair is genuinely **better than R1 here**, because crimson collapses toward ochre under protanopia and sky does not. The failures are elsewhere:

- **Greyscale: 1.06–2.29:1.** Two actor marks side by side, printed in black and white or seen by a user with achromatopsia, are the same value. Enforcing the co-occurrence pair lifts the worst case from 1.06 to 2.29 — an improvement, and still not attribution.
- **Tritanopia: ΔE 4.7 at the naive steps.** Blue and green converge under blue-yellow deficiency. Rare congenitally (~0.01%) but *acquired* tritan defects from diabetes, glaucoma, and normal ageing are common. The co-occurrence pair lifts this to 22.6 (dark) and 12.7 (light), which is why the pair is mandatory rather than advisory.

⚑ **Conclusion, stated as a rule: no attribution decision may depend on hue.** Hue is ranked 6th of 7 and never counts toward the three-channel minimum. What follows is not defence-in-depth; it is the actual mechanism.

#### The seven channels

| # | Channel | Human | Agent | Grey | CVD | Motion off | 50% scale | Screen reader |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Locus & occlusion** | **on the rim** — emissive halo straddling the edge, `r ≈ wheelR + 1` | **inside** the wheel — slatted band, `r ≈ 0.66 · wheelR` | ✓ | ✓ | ✓ | ✓ | ✓ |
| 2 | **Continuity** | an unbroken field with no edges at all | **18 discrete dashed segments**, hard-edged | ✓ | ✓ | ✓ | ✓ | ✗ |
| 3 | **Geometry** | annular bloom / radial falloff / 150° trailing smear | **hexagon** / arc segments / ticks | ✓ | ✓ | ✓ | ✓ | ✗ |
| 4 | **Motion physics** | spring, visible overshoot | duration, linear, terminal velocity zero (LAW 4) | ✓ | ✓ | ✗ | ✓ | ✗ |
| 5 | **Typeface + label** | **no label, ever** | **always** labelled, IBM Plex Mono uppercase `+0.06em` | ✓ | ✓ | ✓ | partial | ✓ |
| 6 | **Hue** | `sky` ≈233° | `green` ≈152° | ✗ **1.23:1** | ✗ **ΔE 4.7 tritan** | ✓ | ✓ | ✗ |
| 7 | **Sound / haptic** | pitched, soft attack, **vibrates** | unpitched relay tick, 4–6 dB quieter, **never vibrates** | ✓ | ✓ | ✓ | ✓ | ✓ |

⚑ **Any three of channels 1–5 must independently suffice.** Channels 6 and 7 never count toward the three.

**The audit.** Every FX in §8.3 was checked against this. Worst case is the panel selection band, which naturally carries only channels 3 (band geometry is identical) and 6 — so the dashed outline (`--ui-hl-agent-dash`) was made **mandatory** on agent-driven selection specifically to add channel 2. There is no FX in the system carrying fewer than three form channels.

#### Why channel 1 is now the strongest

Inside-versus-outside (LAW 3, R3) replaces R2's contact-versus-hover, which itself replaced R1's device-versus-glass. It is better than both on every axis:

- It is **self-evidencing.** The halo exists *because* a thumb is blocking the middle; the trail is legible *because* nothing is. Each actor's position is explained by the presence or absence of the hand, so the rule teaches itself on first use and needs no legend. Neither predecessor could say that.
- It is **ergonomically forced**, not chosen. §7.6 shows human feedback drawn inside the wheel is 0% visible to the person producing it. There is no version of this design where the human mark stays inside.
- It is **visible in the same eye fixation** as the wheel, where the user is already looking.
- It survives **every** transform: greyscale, all three CVD types, motion off, 4fps, 20% scale, still frame.
- It is **nameable in one clause**: "the glow outside is me; the dashes inside are the assistant."
- ⚑ It carries **two** sub-cues, not one: radial position *and* primitive class (field vs stroke). Even if a viewer somehow could not judge radius, a diffuse field and a dashed stroke are not confusable.

#### Deuteranopia and greyscale proof

Take any frame of any interaction and apply, in order: (1) desaturate to greyscale, (2) simulate deuteranopia, (3) freeze motion, (4) scale to 50%. After all four, a first-time user must still attribute every mark. They can, because:

- the agent's trail is **dashed** and the human's halo is a **continuous field** (channel 2 — invariant under all four),
- the agent's marks are **hexagons and arc segments**, the human's is a **radial bloom with a 150° trailing smear** (channel 3 — invariant),
- the agent is **deep inside** the wheel (r 47–93) and the human is **on its rim** (r 96–118) — non-overlapping radial bands (channel 1 — invariant, and the single most robust of the set),
- the agent's mark **carries mono uppercase text** and the human's carries none (channel 5 — invariant to 1–3, degrades at 4).

Three of those four survive step 4 intact. The requirement is three. ⚑ This is the proof, and it is why the hue change cost the system nothing it could not afford.

#### The colour-independent mode

⚑ **Ship a real setting, not a hypothetical.** "Attribution without colour" (Settings → Accessibility, on the steel back) drops actor hue entirely: both actors render in `--foreground`, distinguished only by channels 1–5 and 7. It is **on by default** when `prefers-contrast: more` is set. Two reasons to ship it: it is the correct accommodation for achromatopsia and acquired tritan defects, and it is the only honest way to *verify* that the form channels carry the load — if the product is usable in that mode, LAW 3 is real; if it is not, LAW 3 is a claim.

#### Screen reader attribution

Unchanged from R1 and still mandatory. Every state change names its actor:

```
role="status" aria-live="polite"    — agent:    "Assistant: added 14 songs to your library."
role="status" aria-live="polite"    — human:    "Added to library."   (no prefix; the user knows)
role="alert"  aria-live="assertive" — consent:  "Assistant requests permission: ..."
role="status"                       — co-pilot: "You asked, assistant completed: playlist Late Night created."
```

The `Assistant:` prefix is mandatory, never abbreviated, and never replaced by an audio icon.

#### Other non-colour cues

- **Sound texture, not pitch:** human = pitched, soft-attack, wood/rubber; agent = unpitched, hard-attack, relay/tick, always 4–6 dB quieter.
- **Haptics:** human actions vibrate; agent actions **never** do. Nothing touched the device.
- **Provenance borders** (§8.7): human-created = 2px **solid** left border; agent-created = 1.5px **dashed**; co-created = **braided**. A three-way distinction with zero colour dependency.


### 11.4 Reduced-transparency and increased-contrast variants

```css
@media (prefers-reduced-transparency: reduce) {
  /* Glass layer only. The device is untouched — see §8.10. */
  .lg { backdrop-filter: none; background: var(--lg-surface); border-width: 2px; }
  .ticker { background: var(--agent-ticker-bg); backdrop-filter: none; }
  .agent-rail { background: var(--agent-900); }
  /* Elevation shadows are retained: shadow is not transparency. */
}

@media (prefers-contrast: more) {
  --ui-text-3: #A8AEB8;            /* 5.09 → 8.72 */
  --ui-text-4: #8A9099;            /* 4.51 → 6.05 */
  --ui-divider: #3A4049;           /* → divider-strong */
  --wheel-w-label: #3E434A;        /* 4.99 → 8.34 */
  --wheel-k-label: #E4E7EA;        /* 7.73 → 13.76 */
  --agent-500: #7CE7FA;            /* strokes lighten */
  --human-500-stroke: #FF8494;     /* strokes lighten; fills unchanged */
  --lg-bg: #FFFFFF / 92%;  --lg-border: #000000 / 30%;
  /* Structural changes */
  .panel { --panel-scanline-opacity: 0; --panel-subpixel-opacity: 0; }  /* recovers ~0.3:1 */
  .fx-agent { stroke-width: 2px; }                                      /* 1.5 → 2 */
  .fx-any   { filter: drop-shadow(0 0 1px rgb(0 0 0 / .6)); }           /* contour every mark */
  .high-attribution { display: initial; }                               /* §11.3, auto-on */
}

@media (prefers-reduced-motion: reduce) { /* see §8.10 — a full substitution table, not a kill switch */ }
```

Additionally supported: **Bold Text** (`font-weight` +100 across all roles, verified not to overflow any 320-panel-px row — the panel scale has 4px of horizontal slack at the longest label), and **Dynamic Type**. Dynamic Type applies to the **glass layer only**; the panel is a fixed 320 × 240 hardware surface and scaling its type would break it. The user-facing equivalent is the panel scale control (`0.875 / 1.0 / 1.25`), surfaced in Settings as "Screen size", which scales the whole panel coherently — which is what a hardware display would do.

### 11.5 The wheel with VoiceOver and with a keyboard only

The click wheel is the hardest accessibility problem in the design: a continuous rotary control with four discrete press zones and a centre button, driving a list.

**Semantics.** The wheel is exposed as **two** nested things, because it is two things:

```html
<div role="group" aria-label="Click wheel">
  <div role="slider"
       aria-label="Scroll list"
       aria-valuemin="1" aria-valuemax="212" aria-valuenow="14"
       aria-valuetext="14 of 212, Anthology 3"
       aria-orientation="vertical"
       tabindex="0"></div>
  <button aria-label="Menu, go back"></button>
  <button aria-label="Previous track"></button>
  <button aria-label="Play or pause"></button>
  <button aria-label="Next track"></button>
  <button aria-label="Select"></button>
</div>
```

`role="slider"` (not `listbox`) is correct because the wheel's job is *rate-controlled traversal of a large set*, which is a slider's semantics. The list itself is separately exposed as a `listbox` in the sidecar with full row semantics, so a screen-reader user has a conventional list to work with and never has to operate a metaphor.

**VoiceOver.** The wheel slider responds to VoiceOver's standard adjustable gestures (swipe up / swipe down, or rotor increment) — one detent per gesture, matching the visual model exactly. Announcement per detent is throttled to one per 250ms and uses `aria-valuetext` (`"14 of 212, Anthology 3"`), so a fast rotor sweep announces positions rather than every item. Accelerated scroll announces the letter index instead: `"Jumping: M"`. The four quadrant buttons and Select are ordinary buttons in the focus order, in the physical order MENU → Previous → Play/Pause → Next → Select, so the mental model of the object survives.

**Keyboard only.** Full parity, no wheel required:

| Key | Action | Equivalent |
| --- | --- | --- |
| `Tab` / `Shift+Tab` | Move between wheel group, panel, sidecar, ticker | — |
| `↑` / `↓` | One detent | one wheel detent |
| `Page Up` / `Page Down` | 8 detents (one full panel of rows) | a quarter-turn |
| `Home` / `End` | First / last item | accelerated scroll to end |
| Any letter key | Jump to first item with that initial | the letter index overlay |
| `Enter` / `Space` | Select | centre button |
| `Escape` / `Backspace` | Menu (back) | MENU quadrant |
| `←` / `→` | Previous / Next track | Prev / Next quadrants |
| `K` or `Space` (on Now Playing) | Play / Pause | Play/Pause quadrant |
| `,` / `.` | Scrub −5s / +5s | fine-detent scrub |
| `-` / `=` | Volume down / up | fine-detent volume |
| `F` | Flip to back / front | expose flip |
| `⌘K` / `Ctrl+K` | Sidecar search | — |
| `⌘\` / `Ctrl+\` | Toggle sidecar | — |
| `A` | Focus the provenance trail | — |
| `Y` / `N` | Allow / Deny a focused consent interrupt | — |

Holding `↑`/`↓` engages **key-repeat acceleration** mirroring the wheel's inertia model: 1 detent per repeat for the first 500ms, then ×4, then ×12 above 1200ms — so a keyboard user gets the accelerated-scroll behaviour and the letter overlay too, which is the actual functional benefit of the wheel and not merely its shape.

**Focus visibility.** `:focus-visible` on a wheel quadrant renders `--quad-focus-ring #FFFFFF / 74%`, 2px, offset 2px **outward** from the quadrant's outer arc (never inward — an inward ring would sit on the printed label). On the Select button, a 2px ring at the button's outer edge + 2px. On glass-layer controls, `outline: 2px solid var(--ring); outline-offset: 2px` — ⚑ the focus ring is the **human sky** (`sky-700` light / `sky-400` dark), because focus is a *human* state. An agent's ghost cursor is never a focus ring and never steals focus.

**Focus and the agent.** ⚑ **An agent action never moves keyboard focus and never steals it.** Agent-driven selection changes update `aria-valuenow`/`aria-valuetext` and fire a polite announcement, but the DOM focus stays exactly where the human left it. The one exception is the consent interrupt, which is an `alertdialog` and *must* take focus — and returns it to the exact prior element on dismissal.

**Screen reader + panel.** The panel's visual content is mirrored into an off-screen live region structured as a proper list, so a VoiceOver user can browse the *content* conventionally while the visual panel stays 2005. The panel's decorative layers (specular, scanlines, sub-pixel, glass, engraving, wheel labels' `text-shadow`) are all `aria-hidden="true"`. The device container carries `aria-label="webPod, iPod-style music player"` and `aria-roledescription="Music player"`.

---

## Appendix A — Token summary count

| Group | Tokens |
| --- | --- |
| Environment (2 rooms) | 26 |
| Black polycarbonate | 13 |
| White polycarbonate | 13 |
| Chrome / steel | 24 |
| Click wheel (2 variants + Select + quadrants) | 39 |
| Display glass + panel texture | 20 |
| Screen UI + selection highlight | 27 |
| Human ramp (`sky`, 9 steps + usage) | 9 |
| Agent ramp (`green`, 9 steps + usage) | 9 |
| Co-pilot | 8 |
| Semantic (`red`/`amber`/`slate`) | 13 |
| Brand (Apple Music) | 3 |
| shadcn semantic mapping | 17 |
| Themed panel (×2 modes) | 30 |
| Now Playing bloom/scrim (×2 modes) | 32 |
| Agent orbit / presence | 14 |
| Liquid Glass | 11 |
| Type roles | 44 |
| Radii | 24 |
| Spacing | 15 |
| Springs | 7 |
| Durations | 12 |
| **Total** | **~430** |

## Appendix B — Implementation order

1. **Environment + device silhouette + one body variant** (§4.1, §5.1, §7.3). Nothing else works until the object sits in a room correctly. Validate against §10.2, §10.3.
2. **Glass + panel + type scale** (§5.5, §4.6, §4.7, §6.4). Validate against §10.5 and every ratio in §11.1.
3. **Wheel + Select + detent model** (§5.3, §5.4, §9.4). Validate against §11.2 and facet 2.
4. **Human FX only** (§8.3 human column, §9.1). Ship this. It is a complete, delightful product with no agent.
5. **Liquid Glass sidecar + ticker + rail** (§4.12, §8.5, §8.7). Establishes LAW 1 in code.
6. **Agent FX + ghost cursor + provenance** (§8.3 agent column, §8.6, §8.7). Validate against §10.8 with the 40-call burst test.
7. **Consent + arbitration** (§8.8, §8.9). The hardest and least visible work; do not defer it, because retrofitting arbitration into an FX system is a rewrite.
8. **Steel back + expose flip** (§5.2, §9.3). Validate against §10.4's automatable luminance-histogram test.
9. **Full accessibility pass** (§11) and the §8.10 fallback table, every row.
10. **Compositing audit** (§10.9) and the §10.10 boundary checklist over every element shipped.


---

# PART II — ENGINEERING HANDOVER

**Stack, fixed:** Tailwind v4 (`@theme`) · shadcn/ui · react-three-fiber · `html-in-canvas` *(evaluation only)* · Jotai · TanStack Start. Both colourways ship.

## 12. Token export

### 12.0 Reconciliations — canvas wins

Three canvas NOTE layers and the R5 geometry supersede parts of Part I. Recorded here rather than silently absorbed.

| Canvas state | Supersedes | Action |
| --- | --- | --- |
| **NOTE · No co-pilot, no idle presence** | §4.10 (co-pilot braid), §8.5 idle/thinking rows | ⚑ **Co-pilot braid and the agent idle-presence states are CUT.** `--copilot-*` tokens are removed from the export below. The agent trail exists only while the agent is *acting*. Consequence: the α ≤ 0.18 persistent-state cap (§8.5) becomes **moot** — there is no persistent agent state to cap — but the rule is retained as a guard in case an idle state is ever reintroduced. |
| **NOTE · No permissions surface / No confirmation surface on the front** | §8.8 consent interrupt | ⚑ The consent sheet is **not a front surface**. Permission handling moves off the device face entirely. |
| **NOTE · Staged diff is app behaviour** | §8.3 event 9 | "Up Next — Staged" is application state, not an FX. Rendered as ordinary panel DOM with provenance borders, not as a motion effect. |
| **wheelR 106 → 115** | §7.3, §8.5 R4 radii | Adopted — this is the 5G-fidelity correction I recommended. Wheel/body = 230/330 = **0.697** vs real 0.699. All fractions hold; pixel columns below are re-derived. |
| **Labels measured r 77–79 at wheelR 115** | §5.3 L8 | ⚑ The constant is **`innerR + ringW × 0.493`**, not ×0.57 (which would give r 83.6) and certainly not ×0.30 (my original error, r 53–65). Corrected. |

**R5 geometry, re-derived at `wheelR` 115 / body 330 × 552:**

| | Value | Clearance |
| --- | --- | --- |
| Select r / lip | **42** / to **46** | — |
| Label band | **r 77 – 79** | — |
| Recess-shadow reach | **r 104** | — |
| **Human halo** centreline | **r 116** (`wheelR + 1`) | head 22px → r **105–127**; inner **+1px** past recess reach; outer **38px** to silhouette |
| — tail | 9px → r 111.5–120.5 | — |
| **Agent trail** centre | **r 76** (`0.660 · wheelR`) | head 46px → r **53–99**; inner **+7px** past select lip; outer **+5px** inside recess reach |
| — tail | 16px → r 68–84 | ⚑ head span **contains** labels 77–79 — intentional (§8.5) |
| Co-occurrence repeater | **r 143** | **+16px** clear of halo outer; 22px to silhouette |

**Tiling, re-derived — one correction:**

| | Human | Agent |
| --- | --- | --- |
| Arc length | 176° × r116 = **356.3px** | 112° × r76 = **148.6px** |
| Steps | 44 | 18 |
| Step arc | **8.10px** | **8.25px** |
| Min blur for smoothness (`0.5 × step`) | **4.05px** | 4.13px |
| Ships at | ⚑ **4.25px** *(4.0 is 0.494× — a hair under; raise it)* | ⚑ **1.8px** — deliberately **0.218×**, i.e. deliberately unsmoothed |
| Gaps | 0 (exact tiling) | **1.4° = 1.86px** |

⚑ **Why they must not converge.** The agent's blur is not an unfinished version of the human's. If agent blur rises to ~4.1 the band becomes as smooth as the halo and **LAW 3 channel 2 collapses** — continuity is one of only five greyscale- and CVD-safe attribution channels, and with the actor hues just 1.23:1 apart in luminance the system cannot afford to lose one. The human halo must read as **one continuous field**; the agent trail must read as **a stack of discrete slats**. Any PR that changes either blur value is an attribution change, not a visual tweak.

### 12.1 `globals.css` — Tailwind v4

```css
@import "tailwindcss";

/* Mode is an explicit attribute, not prefers-color-scheme:
   the colourway is a product variant (LAW 5), not a system preference. */
@custom-variant dark (&:where([data-mode="dark"], [data-mode="dark"] *));

/* ─────────────────────────────────────────────────────────────
   1. STATIC TOKENS — build-time, generate utilities
   Tailwind v4 ships sky/green/slate/red/amber as --color-*.
   DO NOT redeclare them. Alias them semantically instead.
   ───────────────────────────────────────────────────────────── */
@theme {
  /* -- type families -- */
  --font-panel:   "Source Sans 3", "Segoe UI", system-ui, sans-serif;
  --font-ui:      "Inter Tight", Inter, system-ui, -apple-system, sans-serif;
  --font-machine: "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace;

  /* -- panel type scale (authored in PANEL px; container is scaled 0.85) -- */
  --text-panel-caption:   11px;  --text-panel-caption--line-height: 1.18;
  --text-panel-meta:      12px;  --text-panel-meta--line-height: 1.25;
  --text-panel-status:    13px;  --text-panel-status--line-height: 1.23;
  --text-panel-artist:    14px;  --text-panel-artist--line-height: 1.29;
  --text-panel-row:       15px;  --text-panel-row--line-height: 1.27;
  --text-panel-track:     17px;  --text-panel-track--line-height: 1.18;

  /* -- glass/UI type scale -- */
  --text-badge:  11px;  --text-meta:  12px;  --text-row-2: 13px;
  --text-row:    15px;  --text-title: 22px;  --text-sheet: 20px;
  --text-hero:   96px; --text-hero--line-height: 0.94; --text-hero--letter-spacing: -0.035em;

  /* -- spacing: v4 derives spacing-N from this base -- */
  --spacing: 4px;                 /* sp-1=4 sp-2=8 sp-3=12 sp-4=16 sp-6=24 sp-8=32 */
  --spacing-panel: 2px;           /* panel micro-grid (§7.2) */

  /* -- radii -- */
  --radius: 0.875rem;             /* 14px — sidecar card; shadcn derives sm/md/lg/xl */
  --radius-panel-row:   3px;
  --radius-panel-max:   6px;      /* ⚑ hard ceiling inside the panel (Panel Discipline) */
  --radius-glass-panel: 22px;
  --radius-sheet:       26px;
  --radius-device:      33px;     /* superellipse n=4.2 — see §7.1, not a border-radius */

  /* -- easing -- */
  --ease-ios-out:    cubic-bezier(0.33, 1, 0.68, 1);
  --ease-press-in:   cubic-bezier(0.40, 0, 1, 1);
  --ease-agent:      cubic-bezier(0.20, 0, 0.40, 1);   /* ⚑ y1=0, y2=1 — LAW 4 */
  --ease-agent-flip: cubic-bezier(0.35, 0, 0.35, 1);

  /* -- durations -- */
  --dur-instant: 0ms;    --dur-tick: 100ms;   --dur-micro: 140ms;
  --dur-trace: 200ms;    --dur-step: 220ms;   --dur-commit: 260ms;
  --dur-fade-in: 160ms;  --dur-fade-out: 220ms; --dur-crossfade: 240ms;
  --dur-flip-agent: 520ms; --dur-dismiss: 1400ms;

  /* -- FX geometry (consumed by JS/SVG, exported here as one source of truth) -- */
  --fx-wheel-r:        115px;
  --fx-select-r:       42px;
  --fx-halo-c:         116px;   /* wheelR + 1 — straddles the rim */
  --fx-halo-head:      22px;   --fx-halo-tail: 9px;
  --fx-halo-lead:      34deg;  --fx-halo-trail: 142deg;
  --fx-halo-core:      30px;
  --fx-halo-steps:     44;     --fx-halo-blur: 4.25px;  --fx-halo-gap: 0deg;
  --fx-agent-c:        76px;
  --fx-agent-head:     46px;   --fx-agent-tail: 16px;
  --fx-agent-span:     112deg;
  --fx-agent-steps:    18;     --fx-agent-blur: 1.8px;  --fx-agent-gap: 1.4deg;
  --fx-repeater-r:     143px;
  --fx-taper-gamma-w:  1.6;    --fx-taper-gamma-a: 2.0;
  --fx-peak-rotate:    0.52;   --fx-peak-press: 0.68;
  --fx-agent-alpha-persist-max: 0.18;   /* ⚑ guard, §8.5 */
  --fx-rt-scale-human: 0.558;  /* reduced-transparency width multiplier */
  --fx-rt-scale-agent: 0.30;

  /* -- panel -- */
  --panel-scale: 0.85;          /* desktop overrides to 1 */
  --panel-w: 272px;  --panel-h: 204px;
}

/* Semantic aliases onto Tailwind's own palette. `inline` so they
   resolve to the palette var, not a copied literal. */
@theme inline {
  --color-human-100: var(--color-sky-100);
  --color-human-200: var(--color-sky-200);
  --color-human-300: var(--color-sky-300);
  --color-human-400: var(--color-sky-400);
  --color-human-500: var(--color-sky-500);
  --color-human-600: var(--color-sky-600);
  --color-human-700: var(--color-sky-700);
  --color-human-800: var(--color-sky-800);
  --color-human-900: var(--color-sky-900);

  --color-agent-100: var(--color-green-100);
  --color-agent-200: var(--color-green-200);
  --color-agent-300: var(--color-green-300);
  --color-agent-400: var(--color-green-400);
  --color-agent-500: var(--color-green-500);
  --color-agent-600: var(--color-green-600);  /* ⚑ restricted: <3:1 on white poly */
  --color-agent-700: var(--color-green-700);
  --color-agent-800: var(--color-green-800);
  --color-agent-900: var(--color-green-900);

  --color-brand-am: #FA243C;                  /* exempt: licensed brand value */
  --color-brand-am-light: #FC3C44;
  --color-brand-am-text: var(--color-rose-700);
}

/* ─────────────────────────────────────────────────────────────
   2. MODE-FLIPPING TOKENS — runtime, NOT in @theme
   ───────────────────────────────────────────────────────────── */
:root {
  /* -- environment (the room) -- */
  --room-0: #F1F3F7;  --room-1: #E7EBF1;  --room-2: #DDE2EA;  --room-3: #D4DAE3;
  --room-floor: #CDD4DE;  --room-floor-far: #BAC2CF;
  --room-contact: color-mix(in srgb, var(--color-slate-700) 34%, transparent);
  --room-ao:      color-mix(in srgb, var(--color-slate-800) 20%, transparent);
  --room-rim: rgb(255 255 255 / 0.62);

  /* -- panel (272x204 DOM) -- */
  --ui-bg: #F2F6FB;   --ui-bg-alt: #E9EEF6;
  --ui-statusbar-0: #DCE4EF;  --ui-statusbar-1: var(--color-slate-300);
  --ui-text-1: var(--color-slate-900);   /* 16.45:1 */
  --ui-text-2: var(--color-slate-700);   /*  9.54:1 */
  --ui-text-3: var(--color-slate-600);   /*  6.98:1 */
  --ui-text-4: var(--color-slate-500);   /*  4.39:1 — inactive only, SC 1.4.3 */
  --ui-divider: var(--color-slate-300);
  --ui-divider-strong: var(--color-slate-400);
  --ui-chevron: var(--color-slate-500);
  --ui-scrollbar-track: var(--color-slate-200);
  --ui-scrollbar-thumb: var(--color-slate-400);
  --ui-artwork-frame: rgb(15 23 42 / 0.10);
  --ui-artwork-shadow: rgb(51 65 85 / 0.22);
  --panel-scanline: rgb(15 23 42 / 0.03);
  --panel-vignette: rgb(51 65 85 / 0.10);

  /* -- selection band = the human's cursor -- */
  --ui-hl-0: var(--color-sky-700);   /* worst-case stop: 5.93:1 with #fff */
  --ui-hl-1: var(--color-sky-800);
  --ui-hl-2: var(--color-sky-900);
  --ui-hl-topline: var(--color-sky-500);
  --ui-hl-botline: var(--color-sky-950);
  --ui-hl-text: #FFFFFF;             /* ⚑ pure white; #F2F4F7 measures 4.09 and fails */
  --ui-hl-agent-0: var(--color-green-700);
  --ui-hl-agent-1: var(--color-green-800);
  --ui-hl-agent-2: var(--color-green-900);
  --ui-hl-agent-dash: var(--color-green-800);

  /* -- actor role aliases, surface-correct (§4.8/4.9) -- */
  --actor-human-text:   var(--color-sky-700);
  --actor-human-fill:   var(--color-sky-600);
  --actor-human-glow:   color-mix(in srgb, var(--color-sky-500) 55%, transparent);
  --actor-agent-text:   var(--color-green-800);  /* ⚑ green-700 fails on white poly */
  --actor-agent-fill:   var(--color-green-700);
  --actor-agent-glow:   color-mix(in srgb, var(--color-green-500) 18%, transparent);

  /* -- Liquid Glass -- */
  --lg-bg: rgb(255 255 255 / 0.72);
  --lg-bg-clear: rgb(255 255 255 / 0.45);
  --lg-border: rgb(255 255 255 / 0.28);
  --lg-surface: #EEF0F3;             /* opaque fallback; ALL glass ratios computed on this */
  --lg-blur: 24px;  --lg-saturate: 1.8;
  --lg-scrim: rgb(0 0 0 / 0.35);
  --lg-shadow: 0 12px 32px rgb(30 33 38 / 0.18);

  /* -- shadcn semantic layer -- */
  --background: var(--room-0);
  --foreground: var(--color-slate-900);
  --card: var(--lg-bg);              --card-foreground: #16181C;
  --popover: rgb(255 255 255 / 0.80); --popover-foreground: var(--color-slate-900);
  --primary: var(--color-sky-700);   --primary-foreground: #FFFFFF;
  --secondary: var(--color-slate-200); --secondary-foreground: var(--color-slate-900);
  --muted: var(--color-slate-200);   --muted-foreground: var(--color-slate-600);
  --accent: var(--color-green-700);  --accent-foreground: #FFFFFF;
  --destructive: var(--color-red-700); --destructive-foreground: #FFFFFF;
  --border: var(--color-slate-300);
  --input: var(--color-slate-500);   /* ⚑ slate-300 is 1.37:1 — fails SC 1.4.11 for a
                                        required boundary. slate-500 = 3.5:1. */
  --ring: var(--color-sky-700);      /* ⚑ focus is a HUMAN state */
}

[data-mode="dark"] {
  --room-0: #16171C;  --room-1: #101216;  --room-2: #0B0D10;  --room-3: #07080A;
  --room-floor: #0D0F13;  --room-floor-far: #060709;
  --room-contact: rgb(0 0 0 / 0.66);
  --room-ao: rgb(0 0 0 / 0.48);
  --room-rim: rgb(203 213 225 / 0.42);

  --ui-bg: #0A0F16;   --ui-bg-alt: #0E141C;
  --ui-statusbar-0: #1B222C;  --ui-statusbar-1: #12181F;
  --ui-text-1: var(--color-slate-50);    /* 18.37:1 */
  --ui-text-2: var(--color-slate-300);   /* 12.94:1 */
  --ui-text-3: var(--color-slate-400);   /*  7.49:1 */
  --ui-text-4: var(--color-slate-500);   /*  4.04:1 — inactive only */
  --ui-divider: var(--color-slate-800);
  --ui-divider-strong: var(--color-slate-700);
  --ui-chevron: var(--color-slate-400);
  --ui-scrollbar-track: #161C25;
  --ui-scrollbar-thumb: var(--color-slate-600);
  --ui-artwork-frame: rgb(255 255 255 / 0.12);
  --ui-artwork-shadow: rgb(0 0 0 / 0.60);
  --panel-scanline: rgb(255 255 255 / 0.03);
  --panel-vignette: rgb(0 8 22 / 0.18);

  --ui-hl-topline: var(--color-sky-400);
  --ui-hl-agent-dash: var(--color-green-300);

  --actor-human-text:  var(--color-sky-400);
  --actor-human-fill:  var(--color-sky-500);
  --actor-human-glow:  color-mix(in srgb, var(--color-sky-500) 52%, transparent);
  --actor-agent-text:  var(--color-green-300);
  --actor-agent-fill:  var(--color-green-400);
  --actor-agent-glow:  color-mix(in srgb, var(--color-green-400) 16%, transparent);

  --lg-bg: rgb(15 17 20 / 0.68);
  --lg-bg-clear: rgb(15 17 20 / 0.35);
  --lg-border: rgb(255 255 255 / 0.08);
  --lg-surface: #191B1F;
  --lg-scrim: rgb(0 0 0 / 0.48);
  --lg-shadow: 0 12px 32px rgb(0 0 0 / 0.40);

  --background: var(--room-2);
  --foreground: var(--color-slate-100);
  --card: var(--lg-bg);              --card-foreground: #F2F4F7;
  --popover: rgb(20 22 25 / 0.76);   --popover-foreground: var(--color-slate-100);
  --primary: var(--color-sky-500);   --primary-foreground: #04283C;
  --secondary: var(--color-slate-800); --secondary-foreground: var(--color-slate-100);
  --muted: var(--color-slate-800);   --muted-foreground: var(--color-slate-400);
  --accent: var(--color-green-400);  --accent-foreground: #052E16;
  --destructive: var(--color-red-400); --destructive-foreground: #450A0A;
  --border: var(--color-slate-700);
  --input: var(--color-slate-600);
  --ring: var(--color-sky-400);
}

/* Bridge the runtime layer back into utility generation. */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);              --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);        --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);        --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);    --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);            --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);          --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-ui-bg: var(--ui-bg);
  --color-ui-text-1: var(--ui-text-1);
  --color-ui-text-2: var(--ui-text-2);
  --color-ui-text-3: var(--ui-text-3);
}

/* ─────────────────────────────────────────────────────────────
   3. MATERIAL TOKENS — ⚑ NOT CSS-consumed. See §12.3.
   Exported only so design and the R3F material rig share
   one source of truth. Never write `background: var(--mat-*)`.
   ───────────────────────────────────────────────────────────── */
:root {
  --mat-poly-w-albedo: #E2E5E8;  --mat-poly-k-albedo: #0C0D0F;
  --mat-steel-albedo:  #C4CBD2;
  --mat-wheel-w-albedo:#E9EBED;  --mat-wheel-k-albedo:#23262B;
  --mat-select-w:      #F1F3F5;  --mat-select-k:      #262A30;
  --mat-glass-tint:    #05060A;
  --mat-label-w: var(--color-slate-500);   /* 4.99:1 on white wheel */
  --mat-label-k: #A9AFB7;                  /* 7.73:1 on black wheel */
}

/* ── accessibility ── */
@media (prefers-reduced-transparency: reduce) {
  :root { --lg-bg: var(--lg-surface); --lg-bg-clear: var(--lg-surface); --lg-blur: 0px; }
}
@media (prefers-contrast: more) {
  :root { --ui-text-3: var(--ui-text-2); --ui-divider: var(--ui-divider-strong);
          --border: var(--color-slate-500); }
}
```

**Springs are not CSS.** No CSS primitive expresses stiffness/damping/mass. Springs ship as a TS module consumed by Motion and R3F; a `linear()` approximation is provided only for CSS-only paths.

```ts
// motion-tokens.ts  — the single source for spring physics (§9.1)
export const spring = {
  detent: { stiffness: 900,  damping: 34, mass: 0.6 },
  press:  { stiffness: 700,  damping: 30, mass: 0.8 },
  select: { stiffness: 480,  damping: 26, mass: 1.0 },
  panel:  { stiffness: 320,  damping: 28, mass: 1.0 },
  bloom:  { stiffness: 260,  damping: 18, mass: 0.9 },
  flip:   { stiffness: 180,  damping: 22, mass: 1.4 },
  settle: { stiffness: 1200, damping: 48, mass: 0.5 },
} as const;
// ⚑ LAW 4: never pass any of these to an agent-originated animation.
export const agentEase = {
  micro: { duration: 140, easing: "cubic-bezier(.2,0,.4,1)" },
  step:  { duration: 220, easing: "linear" },
  flip:  { duration: 520, easing: "cubic-bezier(.35,0,.35,1)" },
} as const;
```

### 12.2 shadcn semantic mapping

| shadcn var | Light | Dark | Ratio (L / D) | Note |
| --- | --- | --- | --- | --- |
| `--background` | `--room-0` `#F1F3F7` | `--room-2` `#0B0D10` | — | the room, not the device |
| `--foreground` | `slate-900` | `slate-100` | **14.92** / **17.11** | — |
| `--card` | `#FFF/72%` | `#0F1114/68%` | — | glass; ratios computed on `--lg-surface` |
| `--card-foreground` | `#16181C` | `#F2F4F7` | **15.57** / **15.65** | — |
| `--popover` | `#FFF/80%` | `#141619/76%` | — | denser than card |
| `--popover-foreground` | `slate-900` | `slate-100` | 15.6 / 15.7 | — |
| `--primary` | `sky-700` | `sky-500` | **5.20** / **6.22** | ⚑ **the human actor** |
| `--primary-foreground` | `#FFFFFF` | `#04283C` | 5.93 / 8.1 | — |
| `--secondary` | `slate-200` | `slate-800` | — | neutral surface |
| `--muted-foreground` | `slate-600` | `slate-400` | **6.98** / **7.49** | — |
| `--accent` | `green-700` | `green-400` | **4.39** / **9.90** | ⚑ **the agent actor** |
| `--accent-foreground` | `#FFFFFF` | `#052E16` | 4.6 / 9.9 | — |
| `--destructive` | `red-700` | `red-400` | **5.96** / **6.95** | red is unowned now |
| `--border` | `slate-300` | `slate-700` | 1.37 / 1.86 | decorative only |
| `--input` | ⚑ `slate-500` | `slate-600` | **3.50** / 3.0 | ⚑ `slate-300` fails SC 1.4.11 |
| `--ring` | `sky-700` | `sky-400` | 5.20 / 8.05 | ⚑ focus is a human state |

⚑ **`--primary` = human, `--accent` = agent is load-bearing.** Any shadcn component dropped in unmodified is then already correctly attributed. Do not remap for visual variety.

### 12.3 ⚑ CSS-consumable vs three.js — the boundary

The single most important table in this handover. Three layers, three rendering models.

| Layer | Renderer | Colour source | Notes |
| --- | --- | --- | --- |
| **DEVICE** | react-three-fiber | ⚑ **material params + light rig + env map** | Gradients are *never* painted. One key light at 12 o'clock; the accelerometer drives the light vector so specular is **computed**. |
| **PANEL** | real DOM, 272 × 204, `scale(0.85)` | CSS custom properties | ⚑ Real DOM because this is the layer **WebMCP actuates** — a texture cannot be focused, labelled, or read by a screen reader. |
| **GLASS** | DOM + Tailwind/shadcn | CSS custom properties | blur / translucency / 1px border only. No gloss, no bevel (LAW 1). |

#### What is CSS-consumable

Everything in §12.1 blocks 1 and 2: semantic + shadcn tokens, panel text ramps, dividers, the selection band (a 3-stop `linear-gradient` — fine), Liquid Glass, type, spacing, radii, durations, easings, and all actor colours **as used in the panel and glass** (dashed outlines, row provenance borders, text).

#### What must be handed to R3F as material parameters

| Surface | Material | Parameters |
| --- | --- | --- |
| Black polycarbonate | `MeshPhysicalMaterial` | `color #0C0D0F` · `roughness 0.28` · `clearcoat 1.0` · `clearcoatRoughness 0.06` · `reflectivity 0.55` · `sheen 0.15` · `sheenColor #6E4A2E` |
| White polycarbonate | `MeshPhysicalMaterial` | `color #E2E5E8` · `roughness 0.34` · `clearcoat 1.0` · `clearcoatRoughness 0.08` · `reflectivity 0.5` |
| Stainless back | `MeshStandardMaterial` | `color #C4CBD2` · `metalness 1.0` · `roughness 0.08` · `anisotropy 0.75` · `anisotropyRotation 0` · **`envMap` required** |
| Wheel ring (black / white) | `MeshPhysicalMaterial` | `color #23262B` / `#E9EBED` · `roughness 0.42` · `clearcoat 0.6` |
| Select button | `MeshPhysicalMaterial` | `transmission 0.35` · `thickness 1.2` · `ior 1.52` · `roughness 0.18` · `clearcoat 1.0` |
| Cover glass | `MeshPhysicalMaterial` | `transmission 0.92` · `ior 1.52` · `thickness 0.6` · `roughness 0.02` · `clearcoat 1.0` |
| Panel emissive | `MeshBasicMaterial` | `map = panelTexture` · `toneMapped false` |

⚑ **The §4.2 / §4.3 / §4.4 gradient stop tables do not disappear — they become the acceptance criterion.** Tune the light rig and env map until a vertical luminance sample through the render matches the stop table within ±4 units. That is how a 2D spec survives into 3D without being thrown away.

#### ⚑ Recipes that CANNOT be CSS — shader or texture

| # | Recipe | Why CSS fails | Implementation |
| --- | --- | --- | --- |
| 1 | **Steel 10-stop non-monotonic gradient** (§4.4) | The dark horizon band is a *reflection of the room's dark half*, not a ramp. A painted gradient on a metal is the exact "chrome reads as grey plastic" failure (§10.4). | ⚑ **Env map.** Generate a 512×256 equirect from the §4.4 stop table + sky blob + horizon line; feed as `envMap`. Non-monotonic luminance emerges from the reflection, not from a fill. |
| 2 | **Anisotropic brush grain** (§5.2 L6) | Directional micro-roughness has no CSS analogue. | **Anisotropy map** — tangent-space texture, 1024², `anisotropy 0.75`. |
| 3 | **Chromatic edge refraction** (§5.5 L12–13, cool top-left / warm bottom-right) | Dispersion needs two hue-split fresnel terms; CSS can only fake it with two overlaid bands, which is unavailable inside the 3D layer. | ⚑ **Custom shader** — fresnel term split into two sampling offsets, cool `#BFD8F0` / warm `#F0D8BF`. |
| 4 | **Black-poly sub-surface warmth** (§5.1 L4) | `sheen` alone will not reproduce light entering the bottom edge and scattering. | **Fake-SSS shader** or a baked emissive gradient texture at 10% on the lower edge. |
| 5 | ⚑ **Halo & agent trail — width-tapered arcs** | **Not a CSS primitive at all.** `conic-gradient` varies colour along an arc but cannot vary a stroke's **width** along it, and the taper is the direction cue. | **SVG `<path>` per tile** (44 human / 18 agent) in the panel/glass DOM overlay, or a single R3F ring shader. SVG is the recommended default — it is inspectable and keeps the FX in the actuatable layer. |
| 6 | **Panel scanline / sub-pixel triad** (§5.5 L5–6) | Works as `repeating-linear-gradient` in DOM, but relies on `mix-blend-mode: overlay`, which does **not** survive rasterisation into a canvas texture. | **Shader overlay on the screen mesh** — keeps it correct in both the DOM path and the `html-in-canvas` path. |
| 7 | **Engraved text on steel** (§5.7) | `text-shadow` cannot describe a groove under a moving light. With the accelerometer driving the light vector, a baked shadow points the wrong way. | ⚑ **Normal map** (or displacement) on the back plate. This is why the engrave recipe must not ship as CSS. |
| 8 | **Micro-noise dithering** (§10.2) | CSS noise cannot modulate a 3D material's roughness. | **Roughness map**, 128² tiled, amplitude 0.02. |
| 9 | **Wheel recess conic rim** (§5.3 L1) | Conic gradients are CSS-able, but the wheel is geometry in the 3D layer. | **Geometry + AO** — a real chamfer, not a painted ring. |

#### `html-in-canvas` — progressive enhancement only

⚑ **It is behind a Chromium flag, so it is never a dependency.** The DOM-panel path is built **first** and must be fully functional alone: the 272 × 204 panel is a positioned DOM layer over the canvas, aligned to the screen mesh.

⚑ **The good news, and it is a direct payoff of LAW 1:** the panel was already authored to be canvas-safe. Panel Discipline forbids `backdrop-filter`, translucency, and blur inside the panel — which are exactly the features that do not survive rasterisation. The only casualty is `mix-blend-mode` on the scanline/sub-pixel layers, which item 6 above already moves to a shader.

| Feature | Survives rasterisation? | Mitigation |
| --- | --- | --- |
| `backdrop-filter` | ✗ | ⚑ Not used in the panel (LAW 1). No action. |
| `mix-blend-mode` | ✗ unreliable | Scanline/sub-pixel → shader overlay (item 6) |
| Sub-pixel text AA | ✗ | Accept greyscale AA; panel type is ≥11px at weight ≥500 |
| `position: fixed` | ✗ | Not used in the panel |
| Web fonts | ✓ if loaded | Preload Source Sans 3 before first raster |
| Focus ring / a11y tree | ✗ | ⚑ **The reason DOM is primary** — never regress to texture-only |

---

## 13. Component inventory

Keyed to the canvas. **Layer**: `3D` = react-three-fiber · `PANEL` = DOM at 272 × 204 · `GLASS` = DOM + shadcn.

### 13.1 Device components

| Canvas name | Component | Layer | Kind | Props | States |
| --- | --- | --- | --- | --- | --- |
| `Device / Mobile` | `<DeviceShell>` | **3D** | bespoke | `colorway: "white"\|"black"` · `mode` · `face: "front"\|"back"` · `panelTexture?` · `lightVector` | idle · flipping · flipped |
| `Device / Back Steel` | `<DeviceBack>` | **3D** | bespoke | `colorway` · `settings` · `activity` | idle · scrolled |
| `Display Well` + `Glass Edge` + `Glass Gloss` | `<CoverGlass>` | **3D** | bespoke | `lightVector` | — (fully computed) |
| `Display Panel` | `<PanelSurface>` | **3D** + **PANEL** | bespoke | `children` · `scale` | dom · texture *(enhancement)* |
| `Bezel Seam` | `<BezelSeam>` | **3D** | bespoke | `colorway` | — |
| `Inlay Recess` + `Center` | `<ClickWheel>` | **3D** | bespoke | `colorway` · `onRotate` · `onQuadrantPress` · `onSelect` · `detents` | idle · pressed(q) · rotating · focused |
| `Label Menu/Play/Skip` | `<WheelLabels>` | **3D** | bespoke | `colorway` · `contrast` | default · high-contrast |
| `Mirror Band` + `Brush Sheen` | `<SteelSurface>` | **3D** | bespoke | `envMap` | — |
| `Etched Mark` / `Etch Path` | `<EngravedMark>` | **3D** | bespoke | `normalMap` | ⚑ `aria-hidden`; logotype exemption |

### 13.2 Screen components (PANEL layer — all real DOM)

| Canvas name | Component | Kind | Props | States |
| --- | --- | --- | --- | --- |
| `M1 · Now Playing — Human` / `M1L · Light Mode` | `<NowPlayingScreen>` | bespoke | `track` · `progress` · `artwork` · `bloomMesh` · `mode` | playing · paused · scrubbing · loading |
| `M2 · Music Menu — Human` **and** `Screen / Music Menu — Agent` | ⚑ `<MusicMenuScreen>` | bespoke | `items` · `selectedIndex` · **`selectionActor: "human"\|"agent"`** | — |
| `M4 · Cover Flow — Human` | `<CoverFlowScreen>` | bespoke | `covers` · `index` | browsing · settled |
| `M5 · Up Next — Agent Staged` | `<UpNextScreen>` | bespoke | `queue` · `staged: StagedDiff[]` | clean · staged · committing |
| `M6 · Search — Agent Typing` | `<SearchScreen>` | bespoke | `query` · `results` · `agentTyping: boolean` | idle · typing · results · empty |
| `M3 · Expose Flip — Settings` | `<SettingsBack>` | bespoke | `sections` | — |

⚑ **`Music Menu` and `Music Menu — Agent` are one component, not two.** They differ only by `selectionActor`, which swaps the band gradient and adds the mandatory dashed outline. Forking them into two components is how attribution drifts out of sync — the agent variant gets a fix the human one doesn't. Same rule for `Now Playing` / `Now Playing — Light Mode`: one component, `mode` prop.

### 13.3 Shared sub-parts

| Canvas name | Component | Layer | Kind | Props | States |
| --- | --- | --- | --- | --- | --- |
| `Header` / `Batt` / `Battery` | `<PanelTitleBar>` | PANEL | bespoke | `title` · `battery` · `agentActive` | default · agent-active |
| `List` / `Row *` / `Chevron` | `<PanelListRow>` | PANEL | bespoke | `label` · `secondary?` · `selected` · `actor` · `provenance` · `chevron` | default · selected(human) · selected(agent) · provenance(human/agent/co) |
| `Preview` / `Preview Art` / `Album Art` | `<SplitPanePreview>` | PANEL | bespoke | `artwork` · `meta` | loaded · loading · unavailable(hatch) |
| `Mini Transport` / `Play` `Pause` `Next` `Prev` | `<Transport>` | PANEL | bespoke | `state` · `actor` | playing · paused · skipping |
| `Progress` / `Elapsed` / `Remaining` | `<ProgressBar>` | PANEL | bespoke | `value` · `scrubbing` · `actor` | idle · scrubbing · agent-seek |
| `Agent Sigil` / `Origin Agent` / `Origin Human` | `<ActorSigil>` | PANEL/GLASS | bespoke | `actor` · `size` | ⚑ hexagon(agent) · none(human) |
| `FX Ghost Trail — Human` | `<HumanHalo>` | ⚑ **SVG overlay** | bespoke | `contactAngle` · `direction` · `peak` · `mode:"rotate"\|"press"\|"select"` | — |
| `FX Ghost Trail — Agent` | `<AgentTrail>` | ⚑ **SVG overlay** | bespoke | `headAngle` · `span` · `alpha` | acting · error |
| `FX Halo Press Bloom` / `FX Halo Fill Ring — Long Press` | `<PressBloom>` / `<LongPressRing>` | SVG overlay | bespoke | `angle` · `progress` | — |
| `FX Agent Commit Flash` | `<AgentCommitFlash>` | SVG overlay | bespoke | `target` | — |
| `FX Screen Tint Human/Agent` / `FX Screen Spill` | `<ScreenTint>` | PANEL | bespoke | `actor` · `intensity` | — |
| `Review Bar` / `Btn Commit` / `Btn Discard` | `<ReviewBar>` | GLASS | ⚑ **shadcn** `Button` | `onCommit` · `onDiscard` · `count` | idle · committing |
| `Field` / `Field Wrap` / `Caret` | `<SearchField>` | GLASS | ⚑ **shadcn** `Input` | `value` · `agentTyping` | idle · focused · agent-typing |
| `Results` / `Group Head` | `<ResultsList>` | GLASS | ⚑ **shadcn** `Command` | `groups` | — |
| `Badge` / `Chip a` | `<ProvenanceBadge>` | GLASS | ⚑ **shadcn** `Badge` | `actor` | human · agent · system |
| `Rail` / `Radiate` / `Live Line` | `<AgentRail>` | GLASS | bespoke | `state` | ⚑ **desktop only** — cut on mobile |

### 13.4 ⚑ Components at risk under canvas rasterisation

| Component | Risk | Resolution |
| --- | --- | --- |
| `<PanelListRow>` | Focus ring and a11y tree vanish in a texture | ⚑ **DOM is primary, always.** Texture path is decoration only. |
| `<SearchField>` | Caret, IME, autofill do not rasterise | Never rasterise — the field is GLASS, not PANEL |
| `<ScreenTint>` | `mix-blend-mode` unreliable | Pre-composite in the tint's own colour; no blend mode |
| Panel scanline / sub-pixel | `mix-blend-mode: overlay` fails | Shader overlay (§12.3 item 6) |
| `<HumanHalo>` / `<AgentTrail>` | Tapered arcs are not a CSS primitive | SVG paths — never attempt `conic-gradient` |
| `<SplitPanePreview>` | Large artwork raster cost | Cap at 200 panel px; `content-visibility: auto` |

---

## 14. Motion & FX implementation contract

`R3F` = `useFrame` inside the 3D layer · `CSS/WAAPI` = DOM · `SVG+RAF` = SVG path attributes driven by a spring integrator.

| Effect | Layer | Renderer | Token | Reduced-motion substitution |
| --- | --- | --- | --- | --- |
| **Human halo** (rotate) | SVG overlay | SVG+RAF | `spring.detent` 900/34/0.6 | Tracking retained (it is live positional feedback); mask holds 176°, **jumps per detent** with 100ms cross-fade; taper static |
| **Human halo** (press) | SVG overlay | SVG+RAF | `spring.press` 700/30/0.8, peak `0.68` | alpha `0→peak` 100ms, hold, `→0` 160ms; no radius animation |
| **Long-press fill ring** | SVG overlay | SVG+RAF | linear 600ms fill, then `spring.bloom` | linear fill retained (it is a **progress indicator**, not decoration); completion flash → static |
| **Press bloom** | SVG overlay | SVG+RAF | `spring.bloom` 260/18/0.9 | static circle at 70% peak radius, 120ms in / 200ms out |
| **Agent trail** | SVG overlay | SVG+RAF | ⚑ `agentEase.step` 220ms `linear` — **never a spring (LAW 4)** | tiles appear at once; static at `0.55`; `PENDING` badge replaces motion |
| **Agent commit flash** | SVG overlay | CSS/WAAPI | `--dur-micro` 140ms `--ease-agent` | dash-gap collapse `3 3 → 6 0` rendered as end state, no tween |
| **Wheel detent** | 3D | R3F `useFrame` | `spring.detent` | inertia **disabled**; stops at current detent; tick = 100ms opacity cross-fade |
| **Expose flip** (human) | 3D | R3F `useFrame` | `spring.flip` 180/22/1.4, ≈720ms, overshoot 4.5° | ⚑ pure 240ms opacity cross-fade, **no transform, no perspective, no Z-lift** |
| **Expose flip** (agent) | 3D | R3F `useFrame` | `agentEase.flip` 520ms, terminal v = 0 | same cross-fade |
| **Screen transitions** (human) | PANEL | CSS/WAAPI | `spring.panel` 320/28/1.0, 340ms slide | cross-fade 160ms + static 3px sky left border 400ms |
| **Screen transitions** (agent) | PANEL | CSS/WAAPI | ⚑ `--dur-instant` — a **cut**, plus 200ms ghost outline | ghost outline persists 600ms as a static mark |
| **Artwork crossfade** | PANEL | CSS/WAAPI | `--dur-crossfade` 240ms `linear` | unchanged (already a cross-fade) |
| **Bloom mesh recolour** | PANEL | CSS/WAAPI | 400ms `--ease-ios-out` | instant swap |
| **Accelerometer shimmer** | 3D | R3F `useFrame` | continuous lerp, `α 0.08`/frame | ⚑ **disabled entirely**; light vector pinned to LAW 2 (12 o'clock) |
| **Select press** | 3D | R3F `useFrame` | 70ms in `--ease-press-in`, out `spring.press` | gradient inversion retained (a **state**); `translateY` removed |
| **Consent / review bar** | GLASS | CSS/WAAPI | `spring.panel` | fade in 200ms at final position |

### 14.1 ⚑ The frame-budget rule

> **`<Canvas frameloop="demand">`. The render loop is off by default. Nothing runs per-frame unless a gesture or a bounded animation is in flight, and every one of them terminates.**

The device is static the overwhelming majority of the time and this is a battery-sensitive mobile-first product. A 60fps loop rendering an unchanged object is the single largest avoidable power cost in the build.

| Effect | Per-frame? | Trigger → termination |
| --- | --- | --- |
| Wheel rotation | ✅ yes | `pointerdown` → `invalidate()` per detent; stops when inertia ‖ω‖ < 0.35°/frame |
| Expose flip | ✅ yes | gesture/tool start → spring settle (≈720ms), then stop |
| Select / quadrant press | ✅ yes | `pointerdown` → spring settle (≈130ms) |
| Accelerometer shimmer | ⚠️ **throttled** | ⚑ sample `deviceorientation` at **20 Hz, not 60**; lerp toward target; **auto-suspend after 2s** below a 0.4°/s threshold. Never an unconditional `useFrame`. |
| Agent trail rotation | ⚠️ **event-driven** | only while a tool call is pending; steps at **220ms**, so `invalidate()` ~4.5×/s — ⚑ **not 60fps** |
| Halo / agent trail geometry | ❌ **never R3F** | SVG in the DOM overlay; RAF only during an active gesture |
| Panel content | ❌ never | DOM; repaints on state change only |
| Idle device | ❌ **zero renders/s** | ⚑ hard target. Verified in DevTools: an untouched device must produce **0 rAF callbacks**. |

**Three hard rules:**

1. ⚑ **No unconditional `useFrame`.** Every `useFrame` body must early-return when its driving state is inert, and the component must call `invalidate()` only while animating.
2. ⚑ **Slow oscillations never drive the 3D loop.** Anything below ~4 Hz belongs in CSS on a DOM overlay. (The now-cut agent idle breathe at 0.06 Hz would have meant a 16.7-second render loop — 1,000 frames to move 3% of opacity.)
3. ⚑ **Budget: ≤ 4 `backdrop-filter` layers and ≤ 12 composited layers** (§10.9). During the flip, degrade: panel bloom off, panel content frozen, scanline/sub-pixel off, ticker `backdrop-filter` → solid.

### 14.2 Carried-over primitives — implementable form

```ts
// Width taper (§8.5) — direction via extent, survives greyscale & reduced transparency.
const GAMMA_W = 1.6, GAMMA_A = 2.0;
const w = (t: number, head: number, tail: number) =>
  tail + (head - tail) * Math.pow(1 - t, GAMMA_W);   // t = θ / trailingSpan
const a = (t: number, peak: number) => peak * Math.pow(1 - t, GAMMA_A);

export const HALO  = { c:116, head:22, tail:9,  lead:34, trail:142,
                       steps:44, blur:4.25, gap:0,   core:30 };
export const TRAIL = { c:76,  head:46, tail:16, span:112,
                       steps:18, blur:1.8,  gap:1.4 };
```

- ⚑ **Exact-tiled arcs, never overlapping.** Overlaps accumulate as `1 − (1 − a)ⁿ` — non-linear, bright seams, the v1 blotchiness. Tiles abut and share edges; each drawn once.
- ⚑ **`blur ≥ 0.5 × step arc length`** is the seam-disappearance threshold. Human: 356.3px / 44 = 8.10px step → min 4.05 → **ships 4.25**. Agent: 148.6px / 18 = 8.25px step → smoothness would need 4.13 → **ships 1.8 (0.218×), deliberately quantised.**
- ⚑ **The two must not converge.** Human = one continuous field; agent = a stack of discrete slats. If agent blur rises toward 4, **LAW 3 channel 2 collapses** — and with the actor hues only **1.23:1** apart in luminance and **ΔE 4.7** under tritanopia, the system cannot afford to lose a form channel. Blur values are attribution, not aesthetics. Guard them in review.
- ⚑ **α ≤ 0.18 on any persistent agent state.** Above it the wheel's printed labels fall below 3:1 (measured: 3.37:1 @ 0.16, 2.46:1 @ 0.30, 1.53:1 @ 0.72). Transient acting states may exceed it; persistent ones may not. Moot while idle presence is cut, retained as a guard.
- ⚑ **Reduced transparency: same geometry, no blur, no bloom — and scale widths by mean cross-sectional alpha.** Human ×0.558 → 22→**12px** head, 9→**5px** tail. Agent ×0.30 → 46→**14px**, 16→**5px**. Without the scaling the solid substitute carries ~1.8× the visual weight of the bloom and becomes the heaviest object on the device.

