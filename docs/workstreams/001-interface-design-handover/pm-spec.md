# webPod — Product Specification

**Version** 6.0 · **Date** 2026-08-28 · **Owner** Product (PM) · **Audience** Visual Designer, Frontend Engineer

> **v2 revisions (client review).** (1) The persistent agent-status pill and the bottom activity tray are **cut** from the mobile shell; their functions are re-homed in **§8.7**, governed by the **Bezel Rule (§8.3.1)** and the **Show-Your-Work rule (§8.8)**, with ambient signal carried by the **two-orbit FX system (§8.3.2–8.3.3)**. One function does not survive; it is named and priced in §8.7. (2) **Light and dark are now two first-class colourways** — white and black polycarbonate — specified in **§4.8** and carried as an explicit axis through the whole of **§10**. (3) **Actor colours changed**: human = sky-400, agent = green-400, Apple Music crimson demoted to brand-only. Green can no longer mean success; the replacement is **§8.3.6**. The tighter hue separation forces the restated non-negotiable in **§8.3.7 #4**.
>
> Unchanged and still approved: the 18-tool surface (§7), the click-wheel mapping (§4.3–4.7), Hold-as-kill-switch (§5.3), the flip system and R1–R6 (§6), and the six journeys (§9, edited only where the revisions force it).
>
> **v3 revisions (grounding correction).** v1 and v2 modelled WebMCP as though it carried MCP's per-tool permission and consent model. **It does not, and re-reading the normative spec showed the error ran deeper than a wrong table: the page cannot even detect that an agent is present.** §7.0 is the new corrected ground truth, with citations. Consequences: the consent legend and scope model are **deleted** (§7.2, §8.5); the eleven-state machine collapses to **five states plus two actor-agnostic app modes** on the client's flag model (§8.2); "Agent & Permissions" (B04) becomes a **read-only Assistant window** with one real switch; the **Away Mandate (B10) is deleted outright**; confirmations are reframed as **webPod's own application dialogs that appear identically for a human** (§8.5, §11.4); and the back-plate engraving is corrected (§11.4b). A new law **L0 — never imply a permission that does not exist** (§8.1) governs the whole document.
>
> **v4 revisions.** (1) **S26 and the `CONFIRMING` state are deleted outright.** v3 kept a pre-action prompt and merely relabelled it; the premise — the agent pausing to ask — is unimplementable, because `registerTool()` makes a tool permanently callable and the page learns of a call *by being called*. §8.5 is rewritten as the single explicit answer: **gate nothing · show everything · make it undoable**, with `Assistant changes · Review first / Apply directly` governing bulk results. One confirm survives, human-only and irreversible-only (`Sign out`, `Reset All Settings`), in-place on B08, with no actor attribution and no agent path. (2) **New §4.9 Tactility** — accelerometer-driven shimmer, `web-haptics` across its seven triggers, and the clicker — carrying the load-bearing rule that **agent actions are silent and never vibrate**, now attribution channel 7 in §8.3.7. This corrects v1–v3, which had the agent's detents click at 40% volume.
>
> **v5 revisions (FX inversion).** The two FX regions are **swapped on ergonomic grounds**: the **human's halo now blooms outward, outside the wheel**, and the **agent's ghost thumb traces inside it**, in the thumb-travel band (§8.3.2). A thumb occludes the inner ring, so human feedback drawn there was invisible to the one person who must see it; the inner band is never occluded during agent action and is exactly the path a thumb would sweep. New **§4.4b** carries the Occlusion Rule, a corrected feedback location for every wheel control, and rulings on input-path consistency and handedness. New **§8.3.2b** guarantees the Center button can never appear pressed by an agent. Device states (`HOLD_ENGAGED`, `DISCONNECTED`, `REVIEW_PENDING`) move **off the wheel** onto the panel and the physical switch, leaving the two FX regions a pure actor channel.
>
> **v6 additions (engineering handover).** **§14 The provider abstraction** — a `MusicProvider` interface both Apple Music and Spotify can satisfy, a 30-row capability parity table with per-row confidence labels and one of four named fallback postures on every divergence, the `TrackRef` identity strategy, and the ruling that an unsupported capability means the WebMCP tool is **not registered**. **§15 Definition of Done** — 15 universal gates, per-screen and per-system pass/fail criteria with `grep` commands where mechanisable, and a reviewer-strictness section naming the 14 failure modes this project has already produced. Three §14 findings change existing sections and are flagged there: **5-star ratings have no API on either provider** (local-only, §14.3 row 22); **Apple's playlist track removal/reorder is `UNVERIFIED` and may not exist**, which would break `pod-edit-playlist` on the launch provider (rows 10–11); and **Spotify's queue cannot be reordered or cleared at all**, making S17 a two-design screen (row 18).
**Primary viewport** 390 × 844 (mobile-first) · **Secondary viewport** 1440 × 900 (centered + sidecar)
**Backend** Apple Music / MusicKit-shaped · **Agent protocol** WebMCP (`document.modelContext`)

**Grounding sources consulted**
- `ios-hig` skill: `visual-design.md`, `motion-animation.md`, `components-patterns.md`, `accessibility.md`, `liquid-glass.md` (iOS 26)
- `/Users/vinicius/code/agentic-context/webmcp/README.md` — imperative `registerTool`, `getTools`, `executeTool`, `toolchange`, `AbortSignal` cancellation, `exposedTo`, permissions policy
- `/Users/vinicius/code/agentic-context/webmcp/declarative-api-explainer.md` — `toolname` / `tooldescription` / `toolparamdescription` / `toolautosubmit`, `:tool-form-active`, `:tool-submit-active`, `toolactivated` / `toolcanceled`, `SubmitEvent#respondWith()`, `SubmitEvent#agentInvoked`
- `/Users/vinicius/code/agentic-context/webmcp/implementation-status.md` — Chrome 149 / Edge 150 origin trial, ChatGPT Desktop, Brave Leo; Safari and Firefox unshipped → **WebMCP is a progressive enhancement, never a dependency**
- iPod 5th generation (Video), 2005, software 1.0–1.3: 320×240 QVGA display, click wheel, Hold switch, split-pane main menu (added in 1.2), Search (added in 1.2), Screen Lock, Clicker

---

## 1. Product thesis

webPod is a browser music player for Apple Music built as a working, physically-modelled iPod 5th-generation Video — a 320×240 screen and a real click wheel that scrolls, seeks, rates and selects — extended with a second, agent-facing control surface exposed through WebMCP so that a browser-integrated AI can drive the same device the human drives, visibly, on the same screen. The iPod metaphor earns its place because the click wheel is the best one-handed, eyes-free, single-affordance controller ever shipped for a music library, and the modern streaming UI has replaced it with a grid of 40 tap targets that all look alike: a wheel gives you speed proportional to intent, a haptic detent for every unit of movement, and exactly one thing under your thumb, which is what a phone held in one hand on a train actually needs. It earns its place a second time for the agent, because a device with a finite, enumerable state machine — a screen ID, a highlighted row, a wheel position, a face — is something an AI can actuate precisely and a human can watch it actuate, which is the whole promise of WebMCP and something no infinite-scroll grid can offer.

---

## 2. The five personas / modes

Each persona is a *mode the product must be good at*, not a market segment. Every screen in section 3 is scored against all five.

### P1 — Thumb (one-handed mobile human)

| | |
|---|---|
| **Context** | Standing, moving, one hand, phone at 390×844, thumb pivoting from the bottom-right. Often not looking at the screen — pocket, coat, gym. |
| **Needs** | Reach: every primary control inside the bottom 45% of the viewport. Eyes-free operation: haptic + audible detent per unit of movement, so "three clicks down" is countable without looking. Get to audio in ≤ 5 physical inputs from cold. Interruption tolerance: a mis-tap must never destroy state. |
| **What breaks for them** | A faithful-scale iPod (screen at top of a 600px body) puts the wheel at 54% viewport height — outside the comfortable thumb arc, causing hand re-grips. Small list rows (26px) at the top of the screen are unhittable by direct tap. Modal dialogs that require two-handed dismissal. Any flow that needs the top 250px of the viewport. |
| **Design response** | The pod body is **bottom-anchored**, not centered: wheel centre sits at 78% viewport height (see §4.1 geometry). The wheel is the primary input and direct tapping of rows is a secondary, additive path — never the only path. Menu-back is also a right-swipe anywhere. |

### P2 — Desk (desktop human)

| | |
|---|---|
| **Context** | 1440×900, mouse + full keyboard, second monitor, music is background to other work. Tab may be unfocused for hours. |
| **Needs** | Peripheral legibility — reads the pod from 70cm away, so at 1× the 320×240 screen is too small. Wants the *extra* information the 2005 device could not show: full queue, synced lyrics, a wide library browser, the agent transcript. Wants keyboard control without the tab focused where possible, and a real shortcut map. Wants to not lose their place when they alt-tab away for 40 minutes. |
| **What breaks for them** | A phone layout stretched to 1440 (the "big iPhone" failure). Scaling the pod to fill 900px height, which makes the skeuomorphism look like a toy rather than an object. Hiding the queue behind a wheel-driven modal when there are 900 vertical pixels going spare. Wheel rotation via drag-arc only — mice do not arc comfortably; scroll must work. |
| **Design response** | Pod renders at **1.5× (screen 480×360)** and is offset left of centre; a **sidecar** panel to its right carries the four surfaces that benefit from width (queue, lyrics, agent, library). Sidecar is a *companion*, never a replacement: everything in the sidecar is also reachable on the pod screen, because the pod must remain the source of truth. |

### P3 — Delegate (agent acting alone, user away)

| | |
|---|---|
| **Context** | Human has left the tab or the machine. A browser-integrated agent holds a task ("build me a 45-minute run playlist", "queue up something like this album"). Zero human available to answer a prompt. |
| **Needs** | An enumerable, readable device state (`pod-read-screen`) so it is not guessing from pixels. Tools with narrow, typed inputs. Results that are reviewable rather than silently applied. *(v3: this persona never needed permission — every registered tool was always callable (§7.0). What it needs is legibility on return, not authorisation before leaving.)* A trail the returning human can audit in under 30 seconds. |
| **What breaks for them** | A destructive action taken unattended with no way back. A confirmation dialog is *fine* unattended — it simply waits, harmlessly (§9 J6a) — but an irreversible write is not. Tools that only return "OK" with no state snapshot, forcing a screenshot loop. Silent success — the human returns and cannot tell what changed or why. Rate limits that are invisible until they fire. |
| **Design response** | **Staged review** — an agent-invoked bulk or library mutation lands as a reviewable *draft* (`REVIEW_PENDING`), local and playable, not yet written to Apple Music. Plus the **Engraving** (B07): an append-only provenance log on the back of the device. *(v3: the second mechanism, an "Away Mandate" pre-authorisation, is deleted — it pre-authorised a gate that never existed. See §8.5.)* Note this persona never needed a consent workaround: **the agent could always call every registered tool.** What it needs is for the results to be reviewable, not permitted. |

### P4 — Duet (agent + human co-piloting simultaneously)

| | |
|---|---|
| **Context** | Human is browsing the library with the wheel while the agent is reading the screen and writing context into it. Both are live within the same second. |
| **Needs** | To know instantly *who did that*. To never have the thing under their thumb move because of the agent. A clear division of writing surface so the two do not fight over the same pixels. Cheap, non-blocking interruption in both directions. |
| **What breaks for them** | Shared cursor: agent moves the highlight while the human is counting detents — this is the single most infuriating failure and must be structurally impossible. Undifferentiated FX: if agent-caused and human-caused motion look identical, the human loses trust in the device permanently. Confirmation dialogs that steal focus mid-scroll. Agent writes that land on a surface the human already navigated away from. |
| **Design response** | **The Split Law**: in any split-pane screen, the **left list is the human's locus of control and the right pane is the agent's writing surface**. Agent may never move the human's highlight while a human input is in flight (L1, §8.2.6). Two-region FX (§8.3.2): the human's **halo blooms outward, outside the wheel**, escaping around the thumb that would otherwise cover it; the agent's **ghost thumb traces inside the wheel**, in the band a thumb would have swept — the gesture you did not make, drawn where you would have made it. **Position, not hue, is the primary actor channel.** *(v5: inverted from v1–v4 on occlusion grounds, §4.4b. v3: the two never render simultaneously — the agent flag is binary.)* Agent writes to a surface are invalidated, not queued, when the human navigates away from it. |

### P5 — Quiet (accessibility / reduced-motion / assistive-tech user)

| | |
|---|---|
| **Context** | Any of: VoiceOver or NVDA, `prefers-reduced-motion: reduce`, `prefers-reduced-transparency`, `prefers-contrast: more`, Dynamic Type at maximum, switch control, keyboard-only, vestibular disorder, low vision, or simply a laptop on battery. |
| **Needs** | Every state reachable and announced without motion, without colour, and without the wheel. Deterministic, countable movement — one keypress equals one row, always, with no acceleration curve to fight. Text that scales to 200% without clipping. Colour-coded actor FX that also carry a text label and a shape, because actor identity is safety-relevant information and must never be colour-only. |
| **What breaks for them** | A `<canvas>` pod — no DOM, no focus, no screen reader, no Dynamic Type. A 520ms 3D flip as the only route to Settings. Scroll acceleration applied to arrow keys, which makes counted navigation impossible. Sky-vs-green as the *only* signal of who acted — those two hues sit on the deutan/protan confusion axis and converge under the commonest colour vision deficiencies. Live-region spam: 30 detents per second announced individually. A 320×240 raster that clips at 200% text. |
| **Design response** | **The pod screen is DOM; the pod body is CSS. No canvas, no WebGL for any UI.** Arrow keys are always exactly one detent, no acceleration, ever. Flip degrades to a 120ms cross-dissolve with a "Back of device" header chip. Actor identity is carried by **position first** (human halo outside the wheel, agent trail inside it — achromatic, motion-free, legible at 4% opacity), then sigil shape (● / ○ / ▪ / ◐), then a lightness separation of ΔL ≥ 0.06, then a text label in S25, and hue **last**. Detent announcements are debounced to a single `aria-live="polite"` summary 350ms after motion settles ("Row 4 of 18, Bad Blood"). Dynamic Type ≥ 130% forces `airy` density and **scales the pod raster up (1.0 → 1.25) rather than clipping the text**. |

### Cross-persona conflicts and rulings

| Conflict | Ruling | Why |
|---|---|---|
| P1 wants the wheel low; P2 wants the pod to look like a real object | Bottom-anchor on mobile, centre-with-sidecar on desktop. Two layouts, one component tree, geometry driven by CSS custom properties. | The pod is an object at both sizes; only its *placement in the frame* differs. Faithfulness to the object survives; reachability wins where it matters. |
| P3 needs to complete work; P4/P5 need control to be real | **Staged review, not permission.** An agent-invoked library or bulk mutation lands as a draft; nothing reaches Apple Music without a human commit. | The platform offers no permission to withhold (§7.0), so control has to live in what happens to the *result*. WebMCP's own explainer models exactly this ("uncommitted changes in the UI, allowing Jen to review or adjust them"). |
| P5 needs no-motion; the product promise is "maximally tactile" | Motion is removed; **materiality is not**. Reduced motion keeps depth, specular highlights, bevels, shadow, and the clicker audio (which is separately toggleable). It removes translation, rotation, and parallax. | Per HIG: motion must be optional and never the only way to communicate. Skeuomorphism is mostly static rendering, not animation — the loss is small and the gain is a usable product. |
| P4 wants instant agent feedback; P1 wants nothing to move under the thumb | Agent FX render in the ring, the bezel, the right pane, and the status ribbon — never in the row under the human's finger. | Separates the "notify" channel from the "manipulate" channel spatially. |

---

## 3. Screen inventory

Notation: **Density** = row metrics on the 320×240 logical raster (`compact` 26px rows / 8 visible / 13px text; `medium` 32px / 6 / 15px; `airy` 44px / 4 / 17px). **Dominant region** names where the eye and the input should land. Every screen answers exactly ONE dominant question.

### 3.1 Front surfaces — mobile (390×844) and shared

| # | ID | Name | Viewports | The ONE question it answers | Primary action | Dominant region | Density |
|---|---|---|---|---|---|---|---|
| 1 | S01 | Cold Boot | mobile, desktop | "Is it on?" | none (auto-advance ≤ 1.4s) | Screen centre — Apple mark, then a battery/loading chip | airy |
| 2 | S02 | Connect to Apple Music | mobile, desktop | "Whose music is this?" | `Sign in with Apple Music` | Screen lower third — single full-width button | airy |
| 3 | S03 | **Main Menu** (split-pane) | mobile, desktop | "What kind of thing am I looking for?" | Center = descend into highlighted row | Left column, rows 1–6; right pane is art/context | medium |
| 4 | S04 | Music | mobile, desktop | "How do I want to slice my library?" | Center = descend | Left column | medium |
| 5 | S05 | Playlists | mobile, desktop | "Which of my lists?" | Center = open; Play = play list | Left column (includes Draft rows) | medium |
| 6 | S06 | Artists | mobile, desktop | "Which artist?" | Center = open | Left column + index rail | compact |
| 7 | S07 | Artist → Albums | mobile, desktop | "Which record by them?" | Center = open; Play = play artist shuffled | Left column; right pane = album art | medium |
| 8 | S08 | **Album → Tracks** | mobile, desktop | "Which song on this record?" | Center = play from here; Play = play album | Left column with track numbers; right pane = art + year/length | compact |
| 9 | S09 | Songs (all) | mobile, desktop | "Where is this one song?" | Center = play | Left column + alphabetic index overlay during fast scroll | compact |
| 10 | S10 | Genres | mobile, desktop | "What mood?" | Center = descend | Left column | medium |
| 11 | S11 | Composers | mobile, desktop | "Whose writing?" | Center = descend | Left column | compact |
| 12 | S12 | **Search** | mobile, desktop | "Is this thing anywhere — mine or Apple's?" | Commit query → grouped results | Top: query field; below: grouped results (Library / Apple Music) | compact |
| 13 | S13 | **Now Playing** | mobile, desktop | "What is playing and where am I in it?" | Center = cycle NP mode | Full screen: art left 40%, metadata + progress right 60% | airy |
| 14 | S14 | Now Playing · Scrub | mobile, desktop | "Can I move to a different part of this?" | Rotate = seek | Progress bar, enlarged to 12px with a grabbed thumb | airy |
| 15 | S15 | Now Playing · Rate | mobile, desktop | "How do I feel about this song?" | Rotate = set 0–5 | Five dots, centred, 28px | airy |
| 16 | S16 | Now Playing · Lyrics | mobile, desktop | "What are the words, right now?" | Rotate = scroll (breaks sync); Center = re-sync | Full screen, current line at 40% height, 17px, dimmed neighbours | airy |
| 17 | S17 | **Up Next (Queue)** | mobile, desktop | "What is coming, and can I change it?" | Center = jump to; long-press/⏭ = reorder grab | Full-screen list; "Now" row pinned at top with a rule under it | compact |
| 18 | S18 | Radio & Stations | mobile, desktop | "What should play when I stop choosing?" | Center = start station | Left column: live stations, then Made-For-You stations | medium |
| 19 | S19 | Cover Flow | mobile, desktop | "What does my library *look* like?" | Rotate = flip; Center = open track list | Full screen: 3D album carousel, centre card 140px | airy |
| 20 | S20 | Extras | mobile, desktop | "What else does this thing do?" | Center = descend | Left column | medium |
| 21 | S21 | Extras · Clock & Sleep Timer | mobile, desktop | "When should the music stop?" | Rotate = set duration; Center = arm | Analog clock face left, duration list right | medium |
| 22 | S22 | Extras · Brick | mobile, desktop | "Can I waste four minutes?" | Rotate = paddle | Full screen game field | compact |
| 23 | S23 | Music Videos | mobile, desktop | "Is there a video for this?" | Center = play video | Left column; right pane = video still | medium |
| 24 | S24 | Shuffle Songs (transient) | mobile, desktop | "Just play something." | auto — no dwell | Screen: a 700ms shuffle-shear transition into S13 | — |
| 25 | S25 | **Agent Console** | mobile (**front-panel screen**), desktop (sidecar D03) | "What is the agent doing to my device?" | Send message / Stop | **In-raster**: transcript + tool-call chips, 8 rows. Reached from Extras → Agent Console, `A`, or a swipe up from the pod's bottom edge. Not a sheet — a sheet over the wheel would be page chrome (§8.3.1). | compact |
| ~~26~~ | ~~S26~~ | ~~Confirm Card~~ | — | **DELETED in v4.** A pre-action prompt has no place in a WebMCP product: there is no moment at which the page can pause a tool call. `registerTool()` makes a tool permanently callable, `execute()` runs, and the page finds out *by being called*. v3's "it's an app-level confirm, not a protocol prompt" fixed the label and kept the premise — a screen whose whole reason to exist is the agent pausing to ask. **There is nothing to gate, so there is no prompt.** Replaced by §8.5. The one surviving confirm is human-only, irreversible-only, and lives in-place on the back plate (B08) — never on the front face, never in an agent flow. | — | — | — |
| 27 | S27 | Interruption Screen (offline / auth / error) | mobile, desktop | "What is broken and what plays anyway?" | Primary recovery button | Screen centre: icon, one-line cause, one-line consequence, one button | airy |
| 28 | S28 | Hold Engaged (overlay chip) | mobile, desktop | "Why is nothing responding?" | none — human must throw the switch back | Orange padlock chip, screen top-right; orange stripe in the switch cutout | — |
| 29 | S29 | Volume HUD (overlay) | mobile, desktop | "How loud?" | Rotate = adjust | Horizontal bar over the lower third of the screen, 1.2s auto-dismiss | — |
| 30 | S30 | Attract / Backlight Off | mobile, desktop | "Is it asleep or dead?" | any input = wake | Dark: panel 4%, art ghost 12%, illegible. Light: unlit LCD, faintly legible (§4.8). Agent's ghost thumb stays lit inside the wheel in both | — |

### 3.2 Back surfaces — the Expose Flip set

All back surfaces render on the pod's **rear face**: an anodised aluminium plate with laser-etched type, a mirror-finish upper third, and physical toggle hardware. Same 320×240 raster region for lists, but the material and typography are engraved rather than backlit.

| # | ID | Name | Viewports | The ONE question it answers | Primary action | Dominant region | Density |
|---|---|---|---|---|---|---|---|
| 31 | B01 | **Settings (root)** | mobile, desktop | "What can I change about this device?" | Center = descend | Engraved list, left; serial-number etch, bottom | medium |
| 32 | B02 | Settings · Playback | mobile, desktop | "How should audio behave?" | Center = toggle/cycle in place | Rows with physical throw-switches on the right | airy |
| 33 | B03 | Settings · Display & Feel | mobile, desktop | "How should the device look and feel?" | Center = toggle/cycle | Rows + a live preview swatch at bottom | airy |
| 34 | B04 | **Settings · Assistant** | mobile, desktop | "What can an assistant do here, and what has it done?" | Center = read; one real switch at the bottom | **Read-only window**: live list of registered tools with `RO`/`RW` hints, then recent activity. One control: `Expose tools to assistants · On/Off`. | compact |
| 35 | B05 | Settings · Account & Apple Music | mobile, desktop | "Who am I signed in as and is it working?" | `Reconnect` / `Sign out` | Account block top; storefront + subscription state; Sign out at bottom, destructive | airy |
| 36 | B06 | Settings · About | mobile, desktop | "What is this thing, exactly?" | none (read-only) | Etched spec block: songs, playlists, storefront, version, agent protocol status | compact |
| 37 | B07 | **The Engraving (Provenance Log)** | mobile, desktop | "Who did that, and can I take it back?" | Center = expand entry; `Undo` on expanded entry | Reverse-chronological etched list; sigil column ●/○/▪ at left | compact |
| 38 | B08 | Legal & Reset | mobile, desktop | "How do I start over?" | `Reset All Settings` (human-only, double-confirm) | Legal text scroll; Reset at the bottom, red etch | compact |
| 39 | B09 | Shortcut Card | desktop primarily; mobile shows gestures | "How do I drive this from the keyboard?" | none | Two-column etched key map | compact |
| ~~40~~ | ~~B10~~ | ~~Away Mandate~~ | — | **DELETED in v3.** It granted standing permission for actions that were never gated, and its absence implied a prohibition that never existed — a safety-relevant lie. Replaced by one row in B02: `Assistant changes · Review first / Apply directly`. See §8.5. | — | — | — |

### 3.3 Desktop shell surfaces (1440×900)

| # | ID | Name | The ONE question it answers | Primary action | Dominant region | Density |
|---|---|---|---|---|---|---|
| 41 | D01 | **Desktop Shell** (pod 1.5× + sidecar) | "Where is everything?" | — (frame) | Pod at x 210–738; sidecar at x 770–1230 | — |
| 42 | D02 | Sidecar · Up Next | "What is the full shape of what's coming?" | Drag to reorder | Full sidecar height; drag handles; source chips per row | medium |
| 43 | D03 | Sidecar · Agent | "What is the agent thinking and doing?" | Send / Stop / Allow / Deny | Transcript + expandable tool-call inspector showing raw JSON args | compact |
| 44 | D04 | Sidecar · Lyrics | "What are the words, at reading size?" | Click a line = seek to it | Full height, 22px type, active line at 38% | airy |
| 45 | D05 | Sidecar · Library | "What do I own, seen wide?" | Click = set pod highlight and descend | Three columns: Artist / Album / Track (Finder-style) | compact |
| 46 | D06 | Sidecar · Activity | "What has happened in this session?" | Undo on hover | Live mirror of B07, grouped by minute | compact |
| 47 | D07 | Desktop Flipped | "Can I configure it without losing the sidecar?" | as per B-surface | Pod shows back face; sidecar becomes the **Toolbox** — a read-only window: the tools currently registered, each with its `RO`/`RW` hint and invocation count, plus a live call log | — |

### 3.4 The eight to design first — ranked

| Rank | ID | Name | Why this one, before the others |
|---|---|---|---|
| **1** | S13 | Now Playing (mobile) | The destination of every journey and the screen that defines the entire material language: backlight bloom, LCD subpixel texture, bezel depth, art treatment, the progress bar's physicality. Everything else inherits from it. If this is not beautiful, nothing is. |
| **2** | S03 | Main Menu (split-pane) | Defines the list-and-highlight system, the split-pane law (human left / agent right), the wheel's feel, and the detent-to-row relationship. Screens 4–11, 18, 20, 23 are all skins of this. |
| **3** | D01 | Desktop Shell (pod 1.5× + sidecar) | Highest layout risk in the product. Gets the second viewport wrong and we ship a stretched phone. Must be proven early because it constrains the pod's own proportions and material rendering at 1.5×. |
| **4** | B01 | Settings (back plate) | Proves the Expose Flip — the single most novel and most expensive idea in the spec. If the back face does not read as a genuinely different physical surface (engraved vs. backlit), the flip is a gimmick and should be cut. Decide this in week one, not week six. |
| **5** | S25 | Agent Console | Proves the dual-audience thesis. Defines the green agent FX vocabulary, the agent's written voice, tool-call chips, and the agent's written voice. Without this the WebMCP surface is invisible and the product is just a nostalgia toy. |
| **6** | S08 | Album → Tracks | The workhorse. Highest-traffic list in the app, the tightest density (`compact`, 8 rows in 212px), and the screen where fast-scroll acceleration, the index overlay, and long-press actions must all coexist. Stress-tests the §2 rank-2 system. |
| **7** | S12 | Search | The highest-value modernisation and the only screen with text entry — a genuinely new interaction for the device that must not feel bolted on. Also the agent's most-used tool surface (`pod-search`), so it is where human and agent output must share one result list. |
| **8** | S17 | Up Next (Queue) | Second-highest-value modernisation and the agent's principal *output* surface: staged inserts, provenance chips, reorder. The screen where §8's staged-changes model becomes visible. |

**Deliberately not in the first eight, with reasons:** S19 Cover Flow and S22 Brick are delight, and delight is designed after the spine works. S02 and S27 are template applications of the `airy` single-button layout, derivable once S13 exists. B07 The Engraving is high-value but reads as a variant of B01 once the engraved material is settled.

---

## 4. Navigation model

### 4.1 Physical geometry (the substrate the navigation lives on)

**Mobile — 390 × 844, bottom-anchored.** The pod is *not* a scale model; it is a re-proportioned instrument that keeps the real screen raster and enlarges the wheel's share of the body, because on a phone the wheel must live in the thumb arc.

| Element | Value | Why |
|---|---|---|
| Body | 352 × 552, centred horizontally (19px side margins), **bottom edge at y = 810** (34px above viewport bottom for the home indicator) | Bottom-anchoring, not centring, is what puts the wheel in the thumb arc |
| Body top | y = 258 | Leaves a 258px "shelf" above the pod |
| Screen (raster) | **320 × 240 at 1:1**, at y = 270–510 | True raster. 1:1 means 13px type is genuinely 13px — no scaling blur, no fractional pixels, and the 11px HIG minimum is honoured |
| Wheel outer Ø | 240px, centre at (195, 658) — **78% viewport height** | Dead centre of the one-handed thumb arc for a 6.1" phone |
| Wheel ring band | outer Ø 240, inner Ø 132 → 54px band | 54px band ≫ 44px HIG minimum, and the four cardinal buttons (Menu / ⏭ / Play / ⏮) each get a 54 × 60 hit area |
| Center button Ø | 132px | The most-pressed control in the product gets 3× the minimum |
| Shelf (y 0–258) | **Album-art bloom only. No text, no status, no controls, no chrome of any kind.** | The shelf is *light*, not UI. Every status pill and activity tray v1 put here is cut (§8.7). The device is the hero; nothing on the page competes with it. The bloom survives because it is the album art's light spilling off the object — it belongs to the device, not to the page. |
| Hold switch | Top edge of body, 56 × 14, at x 240–296 | Physically on top, as on the real device |
| Flip grip | Bottom-right body corner, 44 × 44 invisible drag zone | Reachable by the same thumb without a re-grip |

**Desktop — 1440 × 900.**

| Element | Value | Why |
|---|---|---|
| Pod scale | **1.5×** → body 528 × 828, screen 480 × 360, wheel Ø 360 | Legible at 70cm without becoming a toy. Integer-friendly 1.5 keeps the raster crisp at 480×360 = 320×240 × 1.5 |
| Pod position | x 210–738, y 40–868 | Left of centre, so the sidecar balances the composition rather than hanging off it |
| Sidecar | x 770–1230, y 40–868, width 460, Liquid Glass (`backdrop-blur-xl backdrop-saturate-[1.8]`) | 460px holds a 3-column library browser and 22px lyrics comfortably |
| Right gutter | x 1230–1440 (210px) | Symmetry with the left margin; the composition is a single centred object, not a left-aligned app |
| Below 1180px width | Sidecar collapses to a 64px rail of surface icons; expands as an overlay on click | One breakpoint, one behaviour, no intermediate mush |
| Below 900px width | Falls back entirely to the mobile bottom-anchored layout | The mobile layout is the universal fallback |

### 4.2 Menu hierarchy

```
iPod  (S03 — split-pane: list left, contextual pane right)
├── Music                                              (S04)
│   ├── Playlists                                      (S05)
│   │   ├── <user playlist>                            → track list (S08 variant)
│   │   ├── <draft playlist ⚑ agent>                    → staged track list (S08 + REVIEW_PENDING)
│   │   ├── Made for You ▸ (agent-augmented pane)      (S05)
│   │   └── Recently Added                             (S05)
│   ├── Artists                                        (S06)
│   │   └── <artist> ── All Albums | <album>           (S07 → S08)
│   ├── Albums                                         → <album>              (S08)
│   ├── Songs                                          (S09)
│   ├── Genres        → <genre> → Artists | Albums      (S10 → S06/S07)
│   ├── Composers     → <composer> → <songs>            (S11)
│   ├── Search                          ★ modernised   (S12)
│   └── Cover Flow                      ★ from 6G      (S19)
├── Radio                               ★ modernised   (S18)
│   ├── Apple Music 1 / Hits / Country  (live)
│   └── Made For You Stations
├── Music Videos                        ◂ narrowed     (S23)
├── Up Next                             ★ new          (S17)
├── Extras                                             (S20)
│   ├── Clock & Sleep Timer                            (S21)
│   ├── Brick                                          (S22)
│   ├── Screen Lock                     ◂ → Hold        (S28)
│   └── Agent Console                   ★ new          (S25)
├── Settings ⟳                          ▶ FLIPS to back (B01)
├── Shuffle Songs                       (action)       (S24)
└── Now Playing                         (present only when audio is loaded) (S13)

═══ BACK FACE (Expose Flip) ═══
Settings                                               (B01)
├── Playback ── Shuffle · Repeat · EQ · Sound Check · Volume Limit · Crossfade   (B02)
├── Display & Feel ── Backlight · Brightness · Clicker · Dynamic shimmer · Reduce Motion
│                     · Contrast · Density · Theme                               (B03)
├── Assistant ── Tools exposed (read-only) · Recent activity
│                · Expose tools to assistants: On/Off                            (B04)
├── Account & Apple Music ── Identity · Storefront · Subscription · Reconnect
│                            · Sign out                                          (B05)
├── About ── read-only spec block                                                (B06)
├── The Engraving ── provenance log, newest first, per-entry Undo                (B07)
├── Shortcuts ── key map                                                         (B09)
└── Legal & Reset ── Reset All Settings (human-only)                             (B08)
```

**Removals from the 2005 tree, and why:** Photos (not a music product — a distraction with a real design cost), Podcasts (Apple Podcasts is a separate service with a separate MusicKit surface; a half-implemented podcast tab is worse than none), Audiobooks, Contacts, Calendars, Notes, Games beyond Brick, Video Playlists / Movies / TV Shows (not in the Apple Music catalogue). Composers is **kept** despite low traffic — see §5.

### 4.3 Click wheel mapping — canonical

The wheel emits exactly one event type: `detent({ delta: ±n, source })`. Every input path in §4.4 compiles down to it. Context determines what a detent means.

| Control | Context | Action | Rationale |
|---|---|---|---|
| **Rotate CW** | any list screen | Highlight moves **down** by `n` rows (with acceleration on touch/mouse only) | Clockwise = forward = down. Matches the 2005 device and every rotary control since. |
| **Rotate CCW** | any list screen | Highlight moves **up** by `n` | |
| **Rotate** | S13 Now Playing (default mode) | **Volume** ±1 per detent, HUD S29 appears | Exactly as the real device. Volume is the thing you most often want to change while not looking. |
| **Rotate** | S14 Scrub mode | Seek. 1 detent = 1% of duration, or 1s if duration < 100s. Accelerates to 5% above 300°/s. | Percentage-based so the gesture cost is the same for a 2-minute and a 20-minute track. |
| **Rotate** | S15 Rate mode | 0 → 5 stars, 1 detent per star, hard stops at both ends with an elastic bump | |
| **Rotate** | S16 Lyrics | Scroll lines; **breaks auto-sync** and shows a "Following you" chip | The human taking manual control of a synced surface must be explicit and reversible |
| **Rotate** | S19 Cover Flow | Flip albums, 1 detent = 1 album, momentum coasting preserved | |
| **Rotate** | S12 Search (field focused) | Cycle the character wheel (A–Z, 0–9, space, delete) — **fallback only** | The soft keyboard is primary (§5). The character wheel exists so the wheel is never a dead end. |
| **Rotate** | S22 Brick | Paddle position, 1:1 with angle, no detents (continuous) | The only continuous-rotation context in the product |
| **Rotate** | B08 irreversible confirm row | **Nothing.** Wheel is locked to Center/Menu while the row is armed. | A rotary control must never be able to change which option an irreversible confirmation is about |
| **Center** tap | list screen | **Select / descend.** Push transition: outgoing screen slides left 30% and dims, incoming slides in from right. | |
| **Center** tap | S13 Now Playing | **Cycle NP mode**: Volume → Scrub → Rate → Lyrics → Volume. Mode name flashes for 700ms on entry. | The real 5G cycled Volume → Scrub → Rate. Lyrics is inserted as the fourth stop because it is the single most-wanted modern addition and it belongs in the same "things about this song" cycle. |
| **Center** hold 600ms | any track/album/playlist row | **Action sheet** (Play Next, Play Last, Add to Library, Start Station, Share, Show Lyrics, Go to Album, Go to Artist) | The modernised route to everything the 2005 device could not do, without adding a single new top-level affordance. Per iOS 26, the sheet originates *from the row*, not the screen edge. |
| **Center** tap | B08 armed confirm row | **The verb** (`Sign out`, `Reset everything`) | Center = commit, consistently, everywhere |
| **Menu** tap | any screen below root | **Up one level.** Pop transition: reverse of push. | |
| **Menu** hold 600ms | anywhere | **Jump to Main Menu** S03 | As the real device |
| **Menu** tap | S03 Main Menu (root) | **No-op with an elastic bump** — 6px rightward rubber-band, 90ms, plus one clicker tick | The device is the whole app. There is no "exit". The bump communicates "this is the top" physically rather than by doing nothing (which reads as a broken button). |
| **Menu** tap | S13 Now Playing | Return to the screen you came from, preserving its highlight index | |
| **Menu** tap | B08 armed confirm row | **Cancel** | Menu = back out. Consistent with "Menu is always the safe direction." |
| **Menu** tap | back face (any B surface at root) | **Flip back to front**, restoring the exact front screen and highlight | The flip is a level in the hierarchy, so Menu ascends out of it |
| **⏭ Next** tap | S13, S16, S17 | Next track | |
| **⏭ Next** hold | S13, S16 | Fast-forward, accelerating: 2× for 0–1s, 8× for 1–3s, 30× beyond. Audio remains audible and pitch-preserved to 8×, then scrub-ticks. | Audible seek is a core tactile pleasure of the original and is trivially better than a silent scrubber |
| **⏭ Next** tap | any list screen | **Page down** — jump one full viewport of rows (8 / 6 / 4 by density) | The 2005 device did nothing here. Paging is the highest-value use of a dead button and — critically — is *not* "select", so the mental model "only Center commits" survives intact. |
| **⏮ Prev** tap | S13 | If elapsed > 3s → restart track; else → previous track | The universal convention; the 3s window is what makes double-press-to-go-back work |
| **⏮ Prev** hold | S13 | Rewind, same acceleration curve | |
| **⏮ Prev** tap | any list screen | **Page up** | |
| **Play/Pause** tap | S13, S16, S17 | Toggle play/pause | |
| **Play/Pause** tap | any list screen | **Play the highlighted thing now** — track plays from there in album order; album/playlist/artist/genre plays from its first track and replaces the queue | Kept exactly from the real device. It is the reason "play something" is 5 inputs, not 8. |
| **Play/Pause** hold 2s | anywhere | **Sleep** — backlight off, S30 attract. Audio continues. | As the real device. Also the fastest route to a dark screen in a cinema or a bedroom. |
| **Play/Pause** hold 2s | during `AGENT_ACTIVE` | **STOP the agent** — aborts the in-flight tool via its `AbortSignal`, enters AGENT_THROTTLED for 20s | The human's panic button is the biggest, most familiar, most muscle-memorised control on the device. Do not make it a small red square in a panel. |
| **Hold switch** | anywhere | Lock: all human input and **all mutating agent tools** refuse. `pod-read-screen` still works. | See §5 — this is the best single mapping in the product |

### 4.4 Wheel rotation across four input paths

All four converge on `detent({ delta, source })`. **Only the acceleration curve and the FX differ.** This table is the engineering contract.

| | **A. Swipe arc** (touch) | **B. Scroll** (wheel / trackpad) | **C. Arrow keys** | **D. Mouse drag arc** |
|---|---|---|---|---|
| **Trigger** | `pointerdown` inside the ring band, `pointerType: touch` | `wheel` event anywhere over the pod (ring *or* screen) | `ArrowDown` / `ArrowUp` with focus anywhere in the pod | `pointerdown` in the ring band, `pointerType: mouse` |
| **Measure** | Angle of the pointer about the wheel centre; accumulate `Δθ` | Accumulate `deltaY`, normalised for `deltaMode` (LINE → ×16, PAGE → ×viewport) | Discrete keydown events, including OS auto-repeat | Same as A |
| **Detent size** | **15° = 1 detent** (24 detents/revolution) | **40px accumulated = 1 detent** | **1 keydown = exactly 1 detent** | 15° = 1 detent |
| **Dead zone** | First detent requires ≥ 18° total travel | 24px | none | ≥ 12° (mice are steadier than thumbs) |
| **Acceleration** | Yes. `|ω| < 240°/s` → 1 row/detent; 240–540°/s → 3; > 540°/s → 7. Row multiplier is *smoothed* over 3 detents so it never jumps mid-flick. | **No velocity multiplier.** Trackpad momentum already supplies acceleration; multiplying twice makes lists uncontrollable. | **Never. 1 keydown = 1 row, always.** `Shift+Arrow` = 7 rows (one page). | Yes, same curve as A but thresholds ×1.4 (mouse arcs are jerkier; a lower threshold produces false fast-scroll) |
| **Release** | Inertial coast: remaining angular velocity decays at 0.94/frame, firing a detent every 15° until `|ω| < 60°/s`. Every coasted detent still clicks. | Ends when `wheel` events stop; residual accumulator < 40px is discarded (never fires a phantom detent) | Ends on keyup | Coast, same as A |
| **Index overlay** | Appears when multiplier ≥ 3 on an indexed list (S06, S09, S11): a 96px letter, centred, 60% opacity, `Q` | Appears at ≥ 5 detents/second | Never — keyboard users get the debounced live-region announcement instead | Same as A |
| **FX** | **The halo — sky, outside the wheel** (§8.3.2). Full-perimeter bloom, intensity peaking **opposite** the contact point; per detent it steps outward +4px for 90ms and back. Greatest emphasis, per HIG for direct touch. | **The halo, uniform**, 0.7α, smaller radius, one pulse per detent — so the user *learns* that scroll maps to the wheel. Uniform because there is no occluding contact patch to bloom around. | **The halo at fixed low intensity, pulsing once per keypress but never travelling** — nothing pretends to be a gesture that was not one — plus a hard 2px `:focus-visible` ring on the panel row. | The halo, uniform, 0.7α (as B) |
| **Clicker** | 1 tick per detent, ±2% random pitch jitter, hard-limited to 30/s | same | same | same |
| **Haptics** | `haptic.trigger("selection")` per detent, suppressed above 12 detents/s (§4.9) | none (no hardware) | none | none |
| **A11y announcement** | Debounced: 350ms after motion settles, `aria-live="polite"` → "Row 4 of 18. Bad Blood, Taylor Swift." | same | **Immediate** per keypress (deterministic movement deserves immediate confirmation), debounced only during auto-repeat | same as A |

**Why arrow keys never accelerate:** acceleration makes movement non-deterministic. A keyboard or switch-control user navigates by counting, and a screen-reader user navigates by listening to each stop. An acceleration curve turns "press down four times" into "arrive somewhere near row 4", which is unusable. `Shift+Arrow` provides the speed, deterministically. This is non-negotiable and applies to agent-driven navigation too (§4.6).

### 4.4b Feedback location and the Occlusion Rule

**v5.** The FX inversion (§8.3.2) forces a re-audit of every piece of feedback the wheel produces, because the thumb that causes an interaction is sitting on top of the place v1–v4 drew the response to it.

#### The rule

> **The Occlusion Rule.** Under the contact patch, render **material** state only — depression, bevel, shadow. The finger supplies that feedback haptically, so it does not need to be seen. Any feedback that carries **information** — that an input was received, counted, or committed — must render where the finger is not: **in the halo outside the wheel, or on the panel above it.**

The corollary is that a physically depressing button under a thumb is *correct and should stay* — it is felt, and it makes the object real. It simply may not be the **only** channel, because it is never the visible one.

#### Corrected feedback location, per control

| Control | v1–v4 (defective) | v5 corrected | Why |
|---|---|---|---|
| **Rotate** | 40° arc in the seam trailing the contact point, specular tracking the finger, 1px inward notch per detent | **Halo detent pulse** — 90ms bloom outward, intensity peaking opposite the contact point. Panel: the highlight moves. | Every element of the old spec was drawn at or beside the contact patch — the single worst place. The new pulse is unmissable regardless of approach angle. Direction is not encoded and does not need to be: the human already knows which way they turned, and the list moving says it again. |
| **Menu press** (top quadrant) | quadrant lights | **Quadrant depresses** (material, felt) + **uniform halo press-bloom** + the panel's pop transition | The top quadrant is the least-occluded of the four for a bottom-approaching thumb, but the rule is applied uniformly rather than per-quadrant so behaviour is predictable. |
| **⏭ press** (right quadrant) | quadrant lights | Depression + uniform halo bloom + the panel changes track / pages the list | |
| **⏮ press** (left quadrant) | quadrant lights | Depression + uniform halo bloom + the panel changes track / pages the list | |
| **Play/Pause press** (bottom quadrant) | quadrant lights | Depression + uniform halo bloom + the transport glyph swaps on the panel | **The worst case and the reason for the rule**: a right thumb approaching from the bottom-right covers the bottom quadrant completely. Lighting the thing being pressed lights it for nobody. |
| **Center select** | *(unspecified; a lit centre was the obvious implementation)* | **Button depresses** (material) + **uniform halo bloom** + the panel's push transition. **No light inside the wheel** — that is now agent territory, and it is occluded anyway. | Doubly corrected by the inversion: the one place a Center press could have been drawn is both covered by the thumb and reserved for the agent (§8.3.2b). |
| **Long-press → action sheet** (600ms) | *(no progress indication; any contact-point ring would be covered)* | **Halo fill ring** — a progressive radial wipe from 12 o'clock clockwise, completing exactly at fire; releasing early drains it back. Then the sheet opens from the row, on the panel. | The best case for the halo: a progress ring you physically cannot cover, replacing a hold with no feedback at all. |

**Why sectored press feedback is rejected outright.** Two variants were considered and both fail. *Same-angle* (press the bottom, the halo blooms at the bottom) is occluded by the hand approaching from that side — the identical defect, moved 30px outward. *Opposite-angle* (press the bottom, the halo blooms at the top) is visible but reads as wrong: the device appears to respond somewhere other than where it was touched. **Uniform bloom is the only variant that is both always visible and never misleading.** Continuous rotation keeps its contact-relative bias because there the bias means something physical — light spilling past an obstruction — and it is read as brightness, not as location.

#### Ruling: the halo stays outside for all four input paths

Touch is the only path with occlusion, so fidelity would argue for letting mouse, trackpad and keyboard use the unoccluded inner band. **Rejected. The halo is outside on every path.** The reasoning is not consistency for its own sake:

| Argument | Weight |
|---|---|
| **The inner band is the agent's territory.** If non-touch human input also lit the inner band, then "light inside the wheel" would mean *human or agent, depending on input device* — which destroys the single most valuable property of the whole system: that **position is the primary actor channel**, the one that survives greyscale, colour blindness and 4% opacity (§8.3.7 #4). | **Decisive on its own.** |
| Desktop is where co-presence is most likely — sidecar open, agent console visible, long sessions — so it is the worst possible place to make position ambiguous. | Strong |
| A hybrid device (touchscreen laptop, iPad with a trackpad) would have the meaning of a region change under the user mid-session, depending on which input they last reached for. | Strong |
| **The halo means "you", not "you, by touch."** | The framing that settles it |
| Cost: a marginal loss of fidelity for mouse users, who can see the band but do not get to use it. | Low — the halo is perfectly visible to them |

What *does* vary by path is **emphasis, never location** — per HIG, direct touch gets greater emphasis and pointer input is subdued (see the §4.4 FX row). That is the correct axis for input-path differentiation, and it leaves the actor channel untouched.

#### Ruling: webPod never models handedness

**No setting, no inference, no storage.** The question dissolves rather than being answered, because **the halo's bias is contact-relative**: it peaks diametrically opposite wherever the finger actually is, computed per frame from the live pointer position. A right thumb contacting at 5 o'clock and a left thumb at 7 o'clock and an index finger on a desk at 12 o'clock are all handled correctly by the same rule, without webPod ever knowing which it is.

| Case | Behaviour |
|---|---|
| Any single contact | Bloom peaks 180° opposite the contact angle. Correct for every hand, every digit, every grip. |
| No contact point — scroll, keyboard, mouse off the ring | **Uniform bloom.** No bias is needed because nothing is occluding anything. |
| Multi-touch | Bias off the **primary (first) pointer**; ignore the rest. |
| Before any contact this session | Uniform. |

**Nothing else in the product needs handedness.** The flip grip (bottom-right corner) has three non-positional alternatives — two-finger long-press, the `Settings ⟳` row, and `F` — so it needs no mirrored variant. If some future surface genuinely requires handedness, derive it per-gesture from the contact angle (right thumbs cluster 3–7 o'clock, left thumbs 5–9) and **never persist it**: a stored guess is wrong the moment the user switches hands, which people do constantly, and a settings row for it would be a permanent tax to fix a problem that solves itself.

---

### 4.5 Touch gestures beyond the wheel

The wheel is primary. These exist because (a) HIG conventions must be honoured and (b) P5 requires that the wheel is never the *only* path.

| Gesture | Action | Why it is allowed |
|---|---|---|
| Swipe right, anywhere on the pod | **Menu** (up one level) | iOS back-swipe is muscle memory at the OS level. Refusing it would feel broken, not authentic. |
| Tap a visible row on the screen | Move the highlight to that row, then descend after 80ms | Direct manipulation is an accessibility requirement. The 80ms delay is deliberate: the human *sees* the highlight land, so the wheel's model stays coherent rather than being bypassed. |
| Vertical swipe on the **screen** | Scrolls the list with rubber-band, driving the same `detent` reducer (source `arc`), so the clicker fires and the highlight tracks | Purism loses to reachability. The screen sits at y 270–510 — mid-thumb-arc — so it will be swiped whether we support it or not. |
| Long-press a row, 600ms | Action sheet, originating from the row (iOS 26) | The modernised route to queue/library/share/station actions |
| Pinch out on S13's album art | → S19 Cover Flow. Pinch in → back. | The one gesture that could not exist in 2005 and is unarguably better than a menu item |
| Two-finger long-press on the pod, 400ms | **Flip** | Two fingers = "handle the whole object", not "operate a control on it". Never fires accidentally. |
| Drag inward from the bottom-right body corner | **Interactive flip** — `rotateY` tracks drag distance 1:1; release past 50% snaps over, under 50% snaps back | The delightful one. Reachable one-handed. Fully reversible mid-gesture, which is what makes it feel like an object rather than a transition. |
| Swipe up from the pod's bottom edge | Agent Console S25 to its 48% detent | Puts the agent one gesture from the thumb without giving it a permanent tab |
| Swipe down on S25 | Dismiss the console | Standard sheet dismissal |
| Two-finger tap on the pod | Toggle backlight (wake / S30) | Mirrors the 2005 backlight behaviour |

**Explicitly rejected gestures:** long-press on the wheel ring (conflicts with fast-scroll intent), horizontal swipe on the screen for next/prev track (collides with back-swipe; the ⏭/⏮ buttons are right there), double-tap anything (unreliable and a 300ms tax), shake (no).

### 4.6 Keyboard map

| Key | Action | Note |
|---|---|---|
| `↓` / `↑` | Rotate CW / CCW — exactly one detent | Never accelerates |
| `Shift+↓` / `Shift+↑` | One page (8/6/4 rows by density) | |
| `Enter` | **Center** — select / descend / cycle NP mode / Allow | Enter commits |
| `Space` | **Play/Pause** | The universal media convention outranks "Space = activate button" here, and `Enter` covers activation. `Space` on a focused non-pod button behaves normally. |
| `Escape` | **Menu** — up one level / Deny | |
| `Shift+Escape` or `Home` | Jump to Main Menu S03 | |
| `→` / `←` | ⏭ / ⏮ (next/prev in NP; page in lists) | |
| `Shift+→` / `Shift+←` | Fast-forward / rewind while held | |
| `]` / `[` | Volume up / down (1 detent) | |
| `M` | Mute toggle | |
| `/` | Jump to Search S12, field focused | |
| `Q` | Up Next S17 | |
| `L` | Lyrics S16 | |
| `R` | Rate mode S15 | |
| `S` | Scrub mode S14 | |
| `C` | Cover Flow S19 | |
| `F` | **Flip** (front ⟷ back) | |
| `,` | Settings — flips and lands on B01 | Mirrors ⌘, |
| `A` | Focus the Agent Console (S25 / D03) | |
| `.` | **Hold switch** toggle | |
| `Z` | Undo the last mutation (human-only; 30s window, or from B07) | |
| `Shift+/` (`?`) | Shortcut card B09 | |
| `1`–`5` | Set rating directly (in NP contexts) | |
| `Tab` | Cycles the four pod focus zones: Screen → Ring → Center → Transport. Sidecar is a fifth zone on desktop. | Not 60 individual controls. Zone-based focus is what makes a physical instrument keyboard-navigable. |

### 4.7 How the agent navigates, and why it must be the same machine

The agent does **not** get a private navigation API. `pod-navigate` (§7) compiles to the identical `detent()` and `press()` reducers, with `source: 'agent'`.

| Property | Value | Why |
|---|---|---|
| Acceleration for `source: 'agent'` | **None**, like arrow keys — but the agent may request `delta: 14` in one call | Determinism. An agent that says "down 14" must land on row 15, not "somewhere near it". |
| Visible motion | The highlight animates through the intermediate rows at 45ms/row, capped at 400ms total (beyond ~9 rows it eases straight to the target with a motion-blur streak) | The human must be able to *see* that the agent moved, and roughly how far, without waiting. A teleporting highlight destroys the sense that one device is being shared. |
| Clicker and haptics during agent motion | **Neither fires. Agent actions are silent and never vibrate** (§4.9). | v1–v3 had the agent's detents click at 40% volume and −40Hz. That was wrong, and it cost the product its best attribution channel: **touch and sound are the signature of a hand.** If the device buzzed in a pocket nobody was holding, the human would reach for it. Silence is the correct agent signature and it is load-bearing. |
| FX | **Green, as the ghost thumb, inside the wheel only** — the band r 76–120, never outside it and never within r 76 (§8.3.2, §8.3.2b). | |
| Blocked when | The human is mid-gesture (L1, §8.2.6) — deferred 2500ms then dropped. Under Hold the tool is **unregistered**, so there is nothing to block. | The human's thumb outranks every tool call |
| Reduced motion | Highlight jumps instantly; the live region announces "Agent moved to row 15 of 42, Vienna." | |

---

### 4.8 Colourways: light and dark, both first-class

The real 5G shipped in **black and white polycarbonate**. That is the mode system — not a theme applied to an app, but **two manufactured colourways of one object, each photographed in its own room**. Neither is the design and the other the port.

| | **Dark colourway** — black polycarbonate, dark room | **Light colourway** — white polycarbonate, bright room |
|---|---|---|
| Body | High-gloss black. Specular highlights are small, hard, bright. Silhouette is defined by its highlights. | High-gloss white. Highlights are broad, soft, **low-contrast**. Silhouette is defined by its **shadow and its seams**, not its highlights. |
| Back face | **Polished stainless steel — identical in both colourways.** Only the room it reflects changes: deep grey vs. bright white. Engraved type stays dark-incised in both. | *(same)* |
| Wheel | Charcoal wheel on black body. **Seam reads as a bright hairline.** | Pale grey wheel on white body. **Seam reads as a dark hairline.** |
| Panel ground | Deep blue-black `oklch(0.16 0.02 250)` — a transmissive LCD in a dark room | **Pale backlit `oklch(0.90 0.012 140)`** — the faint warm green of a real backlit STN panel in daylight |
| Panel ink | Pale sky-tinted `oklch(0.94 0.01 226)` | **Near-black `oklch(0.22 0.01 240)`** |
| **Polarity** | Light type on dark ground | **Dark type on pale ground — an inversion, not a recolour.** Every glyph, scrim, shimmer, chip and FX flips its *luminance direction*, not just its hue. This is the most expensive line in the spec and it must be honoured literally. |
| Emission model | `--fx-render: glow`. FX are **additive**: outer glow, screen blend, bloom. | `--fx-render: ink`. FX are **subtractive**: saturated solid strokes, 1px darker inner edges, tinted shadows. **Nothing glows** — nothing can out-emit a white body in a bright room. |
| FX opacity floors | idle 22%, active 100% | **idle 45%, active 100%** — 22% sky on white is invisible. Light mode needs more ink to say the same thing. |
| Scrim | `black / 40%` | `white / 62%` **plus a 1px `black / 12%` hairline** on the floated element so it does not dissolve into the page |
| Shimmer (skeletons) | `white / 18%` sweep | `black / 8%` sweep |
| Artwork bloom | `mix-blend-mode: screen`, α 0.35, 40px blur — the art **emits** into the shelf | `mix-blend-mode: multiply`, α 0.22, 40px blur, +12% saturation — the art **casts a coloured shadow** |
| "It's alive" beat (J1·5, J6c·5) | Backlight ramps to **120% luminance** for 90ms | Backlight **saturation pops**: the ground's green tint deepens 40% for 90ms — what a real backlight surge looks like in daylight |
| S30 Attract | Panel at 4% luminance, art ghost at 12%. **Illegible** — the device reads as off. | Unlit LCD: flat `oklch(0.78 0.015 140)`, art ghost at 10% multiply, ink at 30%. **Faintly legible** — exactly how an unlit panel behaves in daylight, and the nicer of the two states. The modes are permitted to differ *in kind* here. |
| Chips (`☁︎/`, padlock, `LOSSLESS`, `⚑ Draft`) | Filled, glowing, 1px inner light edge | 1px solid outline + 6% tint fill, ink text. **4.5:1 in both.** |
| Cover Flow floor | Reflection α 0.30, 120px | α 0.16, 72px — a bright room has no dark floor to reflect into |
| `prefers-contrast: more` | Ground → pure black, ink → pure white, FX → 2px solid, no glow | Ground → **pure white** (green tint dropped entirely), ink → pure black, FX → 2px solid |
| Desktop sidecar | `bg-neutral-950/68 backdrop-blur-xl backdrop-saturate-[1.8]` | `bg-white/72 …` — already dual-mode per the HIG Liquid Glass tokens; no new ruling needed |

**Rules.** (1) Define every colour on bare `:root` (light) first; override under `@media (prefers-color-scheme: dark)` guarded as `:root:not([data-theme="light"])`; override again under `:root[data-theme="dark"]` so the B03 `Theme` switch wins in both directions. (2) **No colour may have its only definition inside a media query.** (3) `body` carries an explicit token background. (4) Review every priority screen in both colourways *in the same sitting, at the same size* — §10 carries mode as an explicit axis for exactly this reason.

---

### 4.9 Tactility: shimmer, haptics, and sound

The device must behave like a physical object, which means three systems that are usually decoration are load-bearing here. **Read this section as one system with a single governing rule:**

> ⚑ **Agent actions are silent and never vibrate.**
> The clicker and the haptic engine are the signature of a hand. Every human detent ticks and buzzes; no agent detent ever does. This is attribution channel 7 (§8.3.7) and it does real work: **if the device buzzed for something nobody touched, the human would reach for a phone no one is using.** It is also the only actor cue that reaches someone whose phone is in their pocket.

#### 4.9.1 Dynamic shimmer — the accelerometer drives the light

Every specular highlight, gloss sweep and steel reflection is **driven by device orientation, not baked into the asset.** A highlight that never moves is a painted highlight, and the eye reads it as a texture rather than as light.

| Surface | What the light vector drives |
|---|---|
| Body (polycarbonate gloss) | The broad sweep down the body's face; its centre tracks the tilt |
| Wheel ring | The specular band around the ring, and the wheel-to-body seam's brightness on the lit side |
| Center button | Its dome highlight — the most sensitive surface, because a dome exaggerates tilt |
| Screen glass | A faint reflection layer above the panel, at 6% in dark / 10% in light |
| **Back plate (steel)** | The mirror gradient's angle. This is the surface where shimmer matters most — a static mirror is obviously a gradient, a moving one is obviously metal. |
| Flip, mid-arc | The travelling specular line along the 3px edge (§6.5) |

**Mechanics.** `DeviceOrientationEvent` → `beta` (front-back, −180…180) and `gamma` (left-right, −90…90) → a normalised light vector `(lx, ly)`. Low-pass filtered per frame: `smoothed += (raw − smoothed) × 0.08`, a ≈200ms time constant, so the light **glides rather than jitters** — raw accelerometer data is far too noisy to drive a specular directly and reads as a fault. The resulting highlight offset is **clamped** to `±(surfaceHalfExtent − highlightRadius)` so a specular can never leave the surface it belongs to.

**Permission and fallback chain — ask once, at first wheel touch, never on load:**

| Step | Condition | Action |
|---|---|---|
| 1 | Page load | **Never request.** Render the static fallback. iOS rejects a `requestPermission()` not made from a user gesture, and burning the one attempt on load loses it permanently. |
| 2 | `prefers-reduced-motion: reduce` | **Stop here.** Static highlight, no listener attached at all — which also saves battery. |
| 3 | B03 `Dynamic shimmer` is `Off` | **Stop here.** Static highlight. |
| 4 | First `pointerdown` on the wheel ring | The gesture we ask on: it is the first deliberate touch of the object, it happens within seconds, and it is not the tap the user is trying to complete. |
| 5 | `typeof DeviceOrientationEvent.requestPermission === "function"` *(iOS 13+ Safari)* | `await DeviceOrientationEvent.requestPermission()` inside `try/catch`. **Once per session. If denied, never re-ask** — nagging is hostile and iOS will not re-prompt anyway. |
| 6 | Not a function *(Android Chrome, others)* | Attach `deviceorientation` directly; no permission exists. Requires HTTPS. |
| 7 | `"granted"` | Attach the listener, filter, clamp, drive the light vector. |
| 8 | `"denied"`, throws, or no `deviceorientation` events within 1.5s of attaching | **Static highlight fallback: a fixed key light at the canonical 135° top-left.** Full specular rendering is retained — bevels, gloss, mirror gradient all still render. **Never a dead flat surface.** |
| 9 | Desktop / no sensor | **Pointer position substitutes**: normalised cursor x/y over the viewport → the same light vector, same filter, same clamp. Before the pointer has moved, the static default. |
| 10 | Re-enable | B03 `Dynamic shimmer · On` re-requests from *that tap*, which is itself a user gesture, so a user who declined at step 5 has a way back. |

#### 4.9.2 Haptics — `web-haptics`, seven triggers

`npm i web-haptics` (`~/code/agentic-context/web-haptics`). Zero dependencies, Web Vibration API, **silently no-ops on desktop — so no feature detection and no guards anywhere in webPod's code.** React: `import { useWebHaptics } from "web-haptics/react"`. Every webPod interaction maps onto exactly one of its seven triggers.

| Trigger | webPod interactions | Why |
|---|---|---|
| **`selection`** | **Every wheel detent, all four input paths** (§4.4) · volume step · scrub step · rating star increment · Cover Flow album flip · settings value cycle (`Off → Songs → Albums`) · S12 scope-chip switch · ⏭/⏮ page jump *(one per page, never per row)* | The library's own mapping — "picker scroll, stepper increment, slider detent". This is the highest-volume haptic in the product by an order of magnitude and it is what makes "three clicks down" countable without looking. **Suppressed above 12/sec**: past that the motor cannot resolve individual pulses and it degrades into a buzz. |
| **`light`** | Play/Pause · ⏭ · ⏮ · Menu (back) · B02/B03 toggle switches · Hold switch **disengage** · elastic bump at the root menu · pinch threshold into Cover Flow · sheet dismiss | "Secondary button = light." The transport buttons are secondary to Center, which is the primary commit — differentiating them is what stops every press feeling identical. |
| **`medium`** | **Center button — select, descend, commit, cycle NP mode** · action-sheet appearance · queue row snapping into place after a drag-reorder · flip crossing 50% of its arc | "Primary button tap = medium", "drag-drop snap = medium", "modal appear = medium". Center is the most-pressed control in the product and earns the heavier hit. |
| **`heavy`** | **Expose-flip settle**, both directions · long-press opening a row's action sheet · Hold switch **engage** · the cold-boot "it's alive" beat | "Long press = heavy", "major state change". The flip is the largest physical event in the product; arriving is more definite than passing, which is why the settle is `heavy` and the mid-arc is `medium`. |
| **`success`** | Committing a `REVIEW_PENDING` draft · **undo completing** · human-initiated add-to-library succeeding · sign-in completing | Rule 7: fire when the *result* of something the human started arrives, synced to the visual change. Note `success` never fires for an agent-caused success — see the governing rule. |
| **`warning`** | Arming an irreversible confirm on B08 (`Sign out`, `Reset All Settings`) · **volume hitting the Volume Limit ceiling** | "Destructive action ahead, approaching limit, irreversible step" — exactly these two. Kept scarce so it retains meaning. |
| **`error`** | Sign-in failing · reconnect failing · a **human-initiated** search or library write failing | **Only for the failure of something the human just did.** A track auto-advancing and failing, or a system-caused skip, fires **nothing** — a haptic for an event the user did not initiate is invasive and, in a pocket, alarming. |

**Suppression and precedence.** One haptic per event, never stacked. Where two would coincide — a detent landing on a hard stop — the more significant wins (`warning` over `selection`). `Clicker · Off` or `Sound` disables haptics entirely; `Haptic` or `Both` enables them. Haptics **supplement and never replace** visual feedback: every state above is fully legible with the motor dead.

#### 4.9.3 Sound — the clicker

Not optional flavour. **It is how the human counts**, and it is half of the actor signature.

| Event | Sound |
|---|---|
| Wheel detent | Web Audio synthesised click: a 3kHz filtered impulse, 8ms, **±2% random pitch jitter**, hard-limited to **30/sec** |
| Expose-flip | One **90ms low "case pivot" thunk** at 50% of the arc, −18dB. **A thunk, not a whoosh** — a whoosh is a cartoon; a thunk is an object. |
| Everything else | Silence. No confirmation chimes, no error tones, no startup sound. |

**The pitch jitter is the entire point.** A perfectly identical click thirty times a second sounds like a machine gun and gives away that it is software; real detents are never identical. **Setting: `Clicker · Off / Sound / Haptic / Both`, default `Both`** — the same four-way choice the 2005 device offered, with an honest new mechanism (§5.1 row 17). Autoplay policy means the first click cannot fire before a user gesture, so by construction the first sound is consented.

#### 4.9.4 The silence rule, restated for engineering

| Actor | Clicker | Haptic |
|---|---|---|
| Human — touch, mouse, keyboard | Yes | Yes |
| **Agent — every tool, without exception** | **No** | **No** |
| System — auto-advance, crossfade, sleep timer, token refresh | No | No |

The `detent({ delta, source })` reducer (§4.4) already carries `source`. **Gate both the clicker and `haptic.trigger()` on `source !== "agent" && source !== "system"` at the single call site inside the reducer** — one condition, in one place, impossible to forget at a later one. An agent-driven `pod-navigate` of fourteen detents produces fourteen visible highlight steps, a travelling orbit head, and **absolute silence and stillness in the hand.**

---

## 5. Modernizations

### 5.1 What we change from the 2005 device

| # | Area | 2005 device | webPod | WHY |
|---|---|---|---|---|
| 1 | **Search** | Software 1.2 added a wheel-driven character selector: rotate to a letter, click, repeat. Roughly 6 physical actions per character. | Full-text search across catalogue **and** library in one field, grouped results (Library first, then Apple Music), with the platform soft keyboard as primary input. The wheel character selector survives as a documented fallback for keyboard-hostile contexts. | Streaming means the searchable universe went from ~5,000 owned songs to ~100M catalogue tracks. Browsing scales sub-linearly with catalogue size; search scales linearly. A wheel-driven text field over 100M items is not a design choice, it is a defect. |
| 2 | **Queue** | None. Playing a song replaced the playback context wholesale; "Play Next" did not exist. | First-class **Up Next** (S17): reorderable, insertable, with per-row provenance chips showing whether the human or the agent put it there. Promoted to a top-level menu item. | The queue is the single most-used feature of every streaming client of the last decade, and it is the agent's principal output surface — an agent that cannot say "play these three after this one" cannot help with music at all. Without a visible queue, agent actions become invisible mutations of an opaque state. |
| 3 | **Lyrics** | None. | Time-synced lyrics as the **fourth stop in the Now Playing center-button cycle** (S16), plus a full-width sidecar surface on desktop (D04). Click/tap a line to seek to it. | It is the most requested music-app feature of the streaming era and it costs zero new navigation: it slots into an existing rotary cycle the user already knows. Note it is deliberately *not* a top-level menu item — lyrics are a property of the playing song, not a place you go. |
| 4 | **Sync → Streaming** | Library was a static mirror of a desktop iTunes library, changed only by cable. Capacity in GB was the defining spec. | Live Apple Music library and catalogue. "About" (B06) reports songs, playlists, storefront and subscription state instead of a disk capacity. | The product is a client for a streaming service; pretending to have a 30GB drive would force us to invent a fake sync ritual, which is cosplay rather than design. This is exactly the line between "the metaphor earns its place" and "the metaphor is a costume". |
| 5 | **Album art resolution** | 320×240 screen, art delivered at 100×100 and 200×200. | Art at up to 1400×1400, rendered into the raster's art region at device pixel ratio, with an **off-raster bloom**: a 40px-blurred copy of the current art painted into the mobile shelf (y 0–258) and behind the desktop sidecar — `screen` blend at α 0.35 in the dark colourway, **`multiply` at α 0.22 with +12% saturation in the light colourway**, where the art casts a coloured shadow instead of emitting light (§4.8). | The 320×240 raster is a deliberate constraint on *layout and type*, not on *image fidelity*. Blurring modern art down to 2005 fidelity would be a worse image with no honesty gained. The bloom lets the art be gorgeous at full size without violating the raster — the constraint is preserved exactly where it creates value and abandoned where it only destroys it. |
| 6 | **Cover Flow** | Absent on 5G (shipped on iPod Classic 6G and nano 3G, 2007). | Included (S19), reachable by pinch-out on the Now Playing art and by `C`. | The best-loved music browsing interface Apple ever shipped, and the only one that answers "what does my library *look* like". We are recreating an idea, not a serial number; borrowing forward two years from the same product line is within the frame. |
| 7 | **Radio / stations** | A single "Radio" item existed only with the (accessory) FM tuner; there were no algorithmic stations. | Top-level **Radio** (S18): live Apple Music 1 / Hits / Country stations plus Made-For-You and seeded stations (`pod-start-station` from any track, artist or genre). | Answers "what should play when I stop choosing", which is a genuine and constant user need that the owned-library model never had to solve because a 30GB library ran out. |
| 8 | **Sharing** | None. | Share from any long-press action sheet: a Web Share Target payload with an `apple.co` deep link plus a rendered 1080×1080 "now playing" card that reproduces the pod screen. | Music is social; a player with no share button in 2026 reads as broken. The card is worth building because it is free marketing for the aesthetic — the screen *is* the graphic. |
| 9 | **Collaborative playlists** | Impossible. | Read and write Apple Music collaborative playlists. In S08 each row carries a 12px contributor avatar; agent-added rows carry the ○ sigil alongside. | It is a real MusicKit capability and it makes the provenance system (§8) do double duty: the same "who put this here" column serves human collaborators and the agent, so we build one mechanism and get two features. |
| 10 | **Offline** | The library was inherently local; offline was the default state. | Explicit **Downloaded** state: a download glyph per row, a "Downloaded only" filter that survives the offline transition, and a Service Worker holding the shell, the art cache, and the last 200 rows of every visited list. | The default flipped. Not designing for offline in a streaming client means the product simply stops existing on the Underground — and the 2005 device would have kept playing. Regressing on that is unacceptable. |
| 11 | **Agent control** | Inconceivable. | Full WebMCP surface: 18 tools (§7), every one of which actuates visible UI, with colour-coded provenance, an honest agent flag, and webPod's own confirmations (§8). | The second half of the product thesis. The wheel is a great *human* interface precisely because the device has a small, enumerable state — which is also what makes it a great *agent* interface. Same property, two audiences. |
| 12 | **Spatial / lossless audio** | 128–320kbps AAC through a 3.5mm jack. | Surface the Apple Music audio-quality state as a passive badge on S13 (`LOSSLESS`, `SPATIAL`) in the metadata region's 11px etched style. Quality is **not** user-configurable in webPod. | The badge is honest information about what you are hearing and it flatters the skeuomorphism (real hardware has status LEDs). Making it configurable is not: browser playback quality is decided by MusicKit and the network, and a control that lies about its effect is worse than no control. |
| 13 | **Ratings** | 5-star ratings, synced to iTunes. | Star ratings **kept** (S15) *and* Apple Music's Love / Suggest-Less added to the same surface: the wheel sets stars, and a Center press on the stars toggles Love. | Stars are the better *interaction* (rotary, granular, eyes-free) and Love is the one that actually influences Apple Music's recommendations. Keeping both costs one screen and gives the rotary control something meaningful to do. |
| 14 | **Backlight timeout** | Off / 2 / 5 / 10 / 15 / 20 s / Always On, to save a battery. | Kept as a setting (B03) with the same options, defaulting to **Always On**, and repurposed: the timeout now drives the S30 attract state, which is a *deliberate aesthetic* and an ambient-display mode rather than a power measure. | Deleting it would delete one of the loveliest things about the object — a dark, faintly-glowing screen with the album art ghosting through at 12%. The setting survives with a new justification; the default flips because browsers do not have the 5G's battery problem. |
| 15 | **Screen Lock** | A 4-digit combination entered with the wheel, to stop a sibling reading your Notes. | Removed as a PIN; the concept is **re-pointed onto the Hold switch**, which now also gates the agent (§5.3). | A PIN protecting a browser tab's music player protects nothing. The *idea* — a physical lock on the device — is worth keeping, so it moves to where it now protects something real. |
| 16 | **Videos** | Movies, TV Shows, Video Podcasts, Video Playlists. | Narrowed to **Music Videos** (S23) only. | Everything else left the Apple Music catalogue. A menu of four items that are all empty is worse than one item that works. |
| 17 | **Clicker** | Off / Speaker / Headphones / Both, via a piezo. | Web Audio synthesised click (a 3kHz filtered impulse, 8ms, ±2% pitch jitter) plus `web-haptics` `selection` where available (§4.9). Setting becomes Off / Sound / Haptic / Both, defaulting to **Both**. Suppressed above 30 ticks/s. | The pitch jitter is the entire point: a perfectly identical click 30 times a second sounds like a machine gun and gives away that it is software. Real detents are never identical. Same four-way setting, honest new mechanism. |
| 18 | **Hierarchy depth** | Deep and slow: Music → Artists → Artist → Album → Track is five levels, each a push transition. | Kept at five levels, but every list screen gains **⏭/⏮ paging**, fast-scroll acceleration with an index overlay, and a Play button that plays the highlighted container without descending into it. | Depth is not the problem; *traversal speed* was. Flattening the hierarchy would destroy the mental model that makes the device predictable and the agent's `path` addressing legible. Fix the speed, keep the shape. |
| 19 | **Now Playing entry** | Appeared in the main menu only when audio was loaded. | Kept exactly, and extended: when audio is loaded the S03 right pane shows the current art with a 2px progress hairline under it, so the main menu itself is a Now Playing glance. | Uses the split-pane (a 1.2-software feature) to solve a real modern need — knowing what is playing without navigating — with zero added navigation. |

### 5.2 What we deliberately keep, even though it is "worse"

| # | We keep | The modern "fix" we refuse | WHY keeping it is right |
|---|---|---|---|
| 1 | **The click wheel as the primary input** | A scrolling touch list with tap targets | It is the product. But the real argument is functional: the wheel gives *speed proportional to intent* from a single 240px affordance in the thumb arc, works without looking, and produces a countable, haptic unit of movement. No touch list does any of that. Direct tap is supported *additionally* (§4.5) so nothing is gated behind it. |
| 2 | **Menu = up one level, everywhere. Center = commit, everywhere.** | Contextual back buttons and per-screen primary CTAs | Two buttons whose meaning never changes across 47 surfaces is worth more than 47 locally-optimal buttons. It is why the device can be operated in a pocket, and it is why an agent's `pod-navigate` can be trusted: `press('menu')` has exactly one meaning. |
| 3 | **A 320×240 logical raster with hard row limits (8/6/4)** | Fluid, responsive, infinite lists | The raster is a forcing function. It makes the designer choose 8 rows' worth of the right information instead of 40 rows' worth of everything, and it makes the agent's `pod-read-screen` return a *bounded, honest* description of what the human can actually see. Shared context between human and agent requires that "the screen" be a finite thing. |
| 4 | **The five-level hierarchy** (Music → Artists → Artist → Album → Track) | A flat search-first home screen | Depth is what makes the device *addressable*. `path: ["Music","Artists","Vienna Teng","Aims"]` is a stable, human-readable, agent-writable address. A search-first home is faster for the query you can name and useless for the library you want to wander. Both are supported; wandering is the default because that is what a music library is for. |
| 5 | **Composers as a top-level slice of Music** | Delete it — sub-1% traffic | It is the one item in the tree that signals the library belongs to someone with a record collection rather than a recommendation feed. It costs one row and 40 lines of code. Keep it. |
| 6 | **The Hold switch** | An auto-lock timeout | A physical, visible, human-only kill switch is a better security primitive than any timeout, and in webPod it does real work (§5.3). Its state is legible from across the room via an orange stripe — which is exactly what you want from a switch that disables an AI. |
| 7 | **Rotate = volume on Now Playing** (not scrub) | Rotate = scrub, since scrubbing is more "useful" | Volume is what you reach for without looking; scrub is what you reach for while looking. The default rotary action should serve the eyes-free case. Scrub is one Center press away, and that press is worth its cost because it means you cannot destroy your position in a track by fumbling for volume in a pocket. |
| 8 | **Play/Pause hold = sleep** | Nothing; browsers do not sleep | It is the fastest route to a dark screen, it makes the S30 attract state discoverable, and — repurposed — it is the human's abort button for the agent (§4.3). One gesture, three justifications. |
| 9 | **The clicker, on by default** | Silence, because the web should not make noise unprompted | Autoplay policy means it cannot fire before the first user gesture anyway, so by construction the first click *is* consented. And the detent click is the single highest-value piece of feedback in the product: it is how the human counts. |
| 10 | **Shuffle Songs as a top-level menu item** | Fold it into a Radio or For-You surface | It is the shortest path in the product to audio — two detents and one press from cold — and it is the correct answer to "I do not want to choose". Every modern client buries this behind three taps and a recommendation shelf. |
| 11 | **No account switcher, no profile tab, no social feed** | The standard streaming-app chrome | The device belongs to one person. Every pixel spent on identity is a pixel not spent on music. Account state lives on the *back* (B05) precisely because it is not something you do while listening. |
| 12 | **The push/pop transition on every navigation** (30% slide + dim) | Instant screen swaps for speed | It is 260ms and it is what makes the hierarchy feel spatial rather than random — the reason a user can remember where things are. It is fully removed under `prefers-reduced-motion`, where the hierarchy is instead announced. |

### 5.3 One modernisation that deserves its own note: Hold as the agent kill switch

The 2005 Hold switch existed to stop your pocket from pressing Play. In webPod it does that *and* becomes the human's physical veto over the AI.

| Property | Behaviour | Why |
|---|---|---|
| Engaged by | Human only: dragging the switch, or `.` | If a tool could engage it, an agent could lock the human out |
| Disengaged by | **Human only.** There is no tool to call — and while Hold is engaged, the tools are *unregistered*, not refused (§7.3). | This is the only agent control in the product an agent genuinely cannot work around, because it removes the capability rather than declining to use it. Everything else webPod does is a policy an honest implementation chooses to follow. |
| While engaged | All human wheel/transport input is inert (as 2005). **All mutating and playback tools refuse** with a retryable refusal naming the cause. `pod-read-screen` continues to work. | Reads are harmless and refusing them makes the agent guess from pixels, which is strictly worse for everyone. Writes are exactly what the switch is for. |
| Visual | Orange stripe fills the switch cutout; an orange padlock chip at the panel's top-right; **the whole wheel ring desaturates and the halo is disabled** (§8.3.3) | The desaturated wheel is the truthful rendering — the control is dead — and it changes *saturation and behaviour*, not just hue, so it survives greyscale and colour blindness (P5) |
| Audio | Continues playing | A lock is not a stop |
| Words | S25 only: `Locked. Nothing can change the device — including me.` | The agent explicitly acknowledging its own constraint is the most reassuring sentence in the product |

---

## 6. The Expose Flip system

### 6.1 The mental model, in one sentence

**The pod is a physical object with two faces on a left-edge hinge: the front is for *listening* and the back is for *the device itself*.**

The test for which face a surface belongs to is a single question: **"Would I ever need this while audio is playing and I am not looking at the screen?"** If yes, it is on the front. If no, it can go on the back. This test is not a heuristic — it is the acceptance criterion for every future surface added to the product.

Supporting rules:

| Rule | Statement | Why |
|---|---|---|
| R1 | **Audio never stops, pauses, ducks, or glitches during a flip.** | The flip is a change of *view*, not of *state*. If it interrupted audio it would be a modal, and modals over playback are a defect. |
| R2 | **Transport survives the flip.** At flip start, a 320×44 mini-transport (art thumb, title, ⏮ ⏯ ⏭, progress hairline) detaches from the pod and docks: on mobile into the shelf at y 200–244, on desktop into the sidecar header. It dissolves back into the pod when the flip returns. | The flip's whole cost is "you lose the front". Paying that cost for playback control is unacceptable, so we do not pay it. |
| R3 | **The flip is a level in the hierarchy, not a mode.** `Menu` from any B-surface root flips back to the exact front screen and highlight index you left. | Preserves "Menu is always the safe direction" across the most disorienting transition in the product. |
| R4 | **The back is a different material, not a different theme.** Front is a backlit transmissive LCD (glow, subpixel texture, bloom). Back is engraved anodised aluminium (no glow, incised type with a 1px dark top edge and a 1px light bottom edge, mirror-finish upper third with a real reflection gradient). | If the back looks like the front with different content, the flip is decoration. The material difference is what makes the spatial model land in under a second. This is the single highest-risk visual bet in the product and it is why B01 is rank 4 in §3.4. |
| R5 | **Nothing is *only* behind the flip for keyboard and AT users.** Every B-surface is also directly addressable: `,` lands on B01, and every setting is in the DOM with a stable id. | A 3D rotation must never be load-bearing for access. |
| R6 | **The flip is never automatic.** No timeout, no "helpfully flipped for you", no flip on error. | An object that turns over by itself is not an object you trust. |

### 6.2 What lives on the back

| Surface | Why it passes the test |
|---|---|
| B01 Settings root | You configure a device between listening sessions, not during one |
| B02 Playback (shuffle, repeat, EQ, Sound Check, volume limit, crossfade) | Borderline — you *might* change shuffle mid-session. Resolved: shuffle and repeat are **also** togglable from the front via the S13 long-press action sheet and the `pod-set-setting` tool, so the front is not deprived. The back holds the full, labelled panel. |
| B03 Display & Feel (backlight, brightness, clicker, dynamic shimmer, reduced motion, contrast, density, theme) | Set-and-forget. **Exception: reduced motion and contrast also honour OS-level media queries automatically**, so no user is ever required to flip to get an accessible experience. |
| B04 Assistant | A read-only window onto what is exposed and what happened, plus one switch you set rarely. The *operational* control — Stop, and the Hold switch — is on the front and the top edge. |
| B05 Account & Apple Music | Identity is not a listening activity. **Exception: sign-in and re-auth failures surface on the FRONT via S27**, with a button that flips you here — the error must never be hidden behind a gesture you might not know. |
| B06 About | Read-only curiosity |
| B07 The Engraving (provenance) | Audit, review, undo-after-the-fact. Time-shifted by nature. The etched-metal metaphor is unusually apt: a permanent record, physically inscribed on the object. |
| B08 Legal & Reset | Legal text and a once-in-a-lifetime destructive action belong as far from the play button as the geometry allows |
| B09 Shortcuts | Reference material |
| ~~B10 Away Mandate~~ | **Deleted (§8.5).** |

### 6.3 What must NEVER be behind the flip

| Never on the back | Why |
|---|---|
| Play / pause, next / previous, volume, scrub | The reason for R2. These are reflex actions. |
| Now Playing information | It is the answer to the most-asked question in the product |
| Up Next / the queue | You edit the queue *while listening*; that is its entire purpose |
| Search | The fastest path to audio cannot be behind a 520ms 3D rotation |
| **Any agent-caused change** | Every agent mutation shows itself on the front, on the surface it changed, with its undo (§8.5). *(v4: v3's "any confirmation" row is moot — there are no front-face confirmations left. The two irreversible human-only confirms are deliberately **on** the back, next to the buttons they guard.)* |
| **Any error that blocks playback** (offline, auth expired, playback failure) | If the music stopped, the reason must be on the face you are looking at. S27 lives on the front and may offer a button that flips. |
| Sign-in (S02) | A first-run user does not know the device has a back |
| The Hold switch and its state | It is physical hardware on the top edge, visible from both faces |
| The agent's ghost thumb and the Stop control | The wheel is physical hardware, present and identical on both faces, so the agent's trail is visible whichever way up the device is — without occupying a pixel of either panel. Stop is Play/Pause-hold, which works on every screen and both faces. |
| The Agent Console S25 | It is a live conversation surface. Conversations do not go in drawers. |

### 6.4 Triggering the flip

| Actor / viewport | Trigger | Notes |
|---|---|---|
| **Mobile human** | Two-finger long-press on the pod, 400ms, then release | Deliberate, un-fireable by accident, works anywhere on the body |
| **Mobile human** | Drag inward from the bottom-right body corner (44×44 grip) | The delightful one. `rotateY` tracks the drag 1:1 (180° over 240px of travel), specular highlight sweeps the edge, releases past 50% snap over and under 50% snap back. Fully reversible mid-gesture. |
| **Mobile human** | `Settings ⟳` row on Main Menu S03, Center press | The discoverable one. The row carries a ⟳ glyph and its right pane shows a 3D-rotating ghost of the pod, so the flip is previewed before it happens. **This is how a first-run user learns the back exists.** |
| **Mobile human** | Long-press the Menu button, 900ms, from S03 | Power-user shortcut, documented in B09 |
| **Desktop human** | `F` key, or `,` (lands on B01) | |
| **Desktop human** | Click the engraved ⟳ affordance at the pod body's bottom-right | Always visible on desktop (there is room); a 24px etched glyph |
| **Desktop human** | Drag the pod's right edge leftward with the mouse | Same interactive physics as the mobile corner drag |
| **Agent** | `pod-flip({ face, surface? })` | A view change is not a mutation, so it is never confirmed — but it is always logged to B07 and S25 and always animated at full duration so the human sees it happen. Unregistered under Hold. Any *write* reached from a back surface still goes through that tool's own rules. |
| **Agent, exception** | `pod-flip`'s `surface` enum simply **does not include** `legal-reset`. | Not a refusal — an absence. The only prohibition the platform honours is one that was never offered (§7.0 lever 1). An enum value that does not exist cannot be requested. |

### 6.5 Flip motion specification

| Property | Value | Notes |
|---|---|---|
| Transform | `rotateY(180deg)` on the pod body, `transform-style: preserve-3d`, `perspective: 1200px` on the stage, `perspective-origin` at the hinge | Hinge is the body's **left edge** (`transform-origin: 0% 50%`), so the pod swings like a door and the wheel stays roughly in the thumb arc throughout |
| Spring | `gentle` — stiffness 200, damping 20 (≈ 520ms settle) | Per `motion-animation.md`; a large element gets a gentle spring. Snappy on a 552px object reads as a flinch. |
| Depth cue | Body scales to 0.94 at 90° and back to 1.0, plus a 24px shadow that shortens and darkens through the arc | Sells rotation-in-space rather than a CSS trick |
| The edge | At 88–92° the silhouette is a 3px anodised edge with a 1px specular line travelling along it | The 80ms detail that makes the whole thing believable. Design it explicitly. |
| Backlight | Front backlight ramps to 20% over the first 40% of the arc, back face's ambient reflection ramps in over the last 40% | Light behaves as light: the screen turns away from you |
| Audio | One 90ms low "case pivot" thunk at 50% of the arc, −18dB, if `Clicker` is Sound or Both. **Human-initiated flips only.** | Not a whoosh. A whoosh is a cartoon; a thunk is an object. |
| Haptic | `medium` at 50% of the arc, `heavy` on settle (§4.9). **Human-initiated flips only** — an agent `pod-flip` is silent and still. | The settle is heavier because arriving is more definite than passing |
| Interruptibility | A new pointerdown during the animation grabs the rotation at its current angle and hands control to the drag | Per HIG: let people cancel motion |
| **Reduced motion** | **No rotation.** 120ms cross-dissolve, front → back, plus a persistent 24px header chip reading `Back of device` with a ⟳ glyph and a `Front` return button in the chip. Material still changes (glow → engraved). | Preserves the spatial *information* and the material distinction while removing the vestibular trigger entirely. The chip is the compensating affordance. |
| Screen reader | `aria-live="polite"`: "Back of device. Settings. Row 1 of 8, Playback." Focus moves to the B-surface's first row. On return: "Front of device. Now Playing, Vienna, The Fray." | |
| Desktop specialisation | The pod flips; the **sidecar does not**. It cross-dissolves into the **Toolbox** (D07): the tools currently registered, with live invocation counts and `readOnlyHint` / `untrustedContentHint` flags. **Read-only — there are no per-tool scopes to show** (§7.0); the only control is B04's single exposure switch. | The sidecar is a wall-mounted panel, not part of the object. Flipping it too would break the spatial model — and the Toolbox is genuinely the most useful thing to look at while you are on the back. |

---

## 7. WebMCP tool surface

### 7.0 What WebMCP actually specifies — and what it does not

> **v3 correction.** v1 and v2 of this spec modelled WebMCP as though it carried MCP's per-tool permission and consent model. **It does not.** The error propagated into §7.2's consent legend, §8.2's state machine, §8.5's whole consent model, B04 and B10. This section is the corrected ground truth; everything downstream now derives from it. Where the spec settles a question, it is quoted.

#### What the normative spec (`index.bs`) does provide

| Capability | What it actually is | Citation |
|---|---|---|
| **Tool registration** | `registerTool()` adds a tool to the document's tool map. It rejects "if a tool with the same name is already registered, if the given `name` or `description` are empty strings, or if the `inputSchema` is invalid." | `index.bs` §ModelContext |
| **Tool removal** | Abort the `AbortSignal` passed as `options.signal`. This is the **only** way a page withdraws a tool. | `README.md`; `index.bs` |
| **Roster change notification** | The `toolchange` event fires on `document.modelContext` when tools are registered or unregistered. | `index.bs` §ModelContext, `ontoolchange` |
| **Origin / frame gating** | A policy-controlled feature `"tools"` with a "default allowlist of `'self'`". Cross-origin frames need `allow="tools"`; `Permissions-Policy: tools=()` disables it. This gates **whether a frame may use the API at all** — not whether a given call is allowed. | `index.bs` §Permissions policy integration |
| **Secure context** | `[Exposed=Window, SecureContext]`; registration rejects on non-potentially-trustworthy origins. | `index.bs` IDL |
| **Cross-origin exposure** | `exposedTo: [origins]` on registration and `getTools({fromOrigins})` for discovery — for **in-page** agents. The browser's built-in agent "uses a different internal mechanism". | `index.bs`, `README.md` |
| **Cancellation** | `executeTool(tool, input, {signal})`; the `execute` callback receives `options.signal`. | `index.bs` §ToolExecuteCallbackOptions |
| **Annotations — exactly two, both hints** | `readOnlyHint` (default `false`) — "the tool does not modify any state and only reads data. This hint can help agents make decisions about when it is safe to call the tool." And `untrustedContentHint` (default `false`). | `index.bs` §ToolAnnotations |

#### What the spec does **not** provide — the corrections

| Assumption in v1/v2 | Reality | Citation |
|---|---|---|
| Per-tool consent grants (`ASK` / `SESSION` / `ALWAYS` / `NEVER`) | **Do not exist.** There is no grant, no scope, no per-tool state in the platform. **A registered tool is always callable.** Availability *is* registration. | Absent from `index.bs` entirely |
| A protocol-level consent prompt | **Does not exist.** Elicitation / user prompting is an explicitly *open question*, not a feature. | `README.md` Open Questions: "**User prompting and elicitation**: *Exploring* a way for a tool to prompt the user for confirmation…" (issues #165, #50) |
| A `destructiveHint` | **Does not exist in WebMCP.** MCP has it; WebMCP's `ToolAnnotations` has been trimmed to two booleans, neither of which flags danger. | `index.bs` §ToolAnnotations |
| Some normative safety floor for high-privilege tools | **There is none, and the spec says so outright:** "As of now, the spec does not include normative guidance against the misuse of tools that expose sensitive or high-privilege operations." A "hint for consequential actions" is only *intended* (issue #176). | `security-privacy-questionnaire.md` Q04 |
| A user-gesture requirement on tool calls | **None.** The strings "user activation", "transient activation" and "user gesture" **do not appear anywhere in the normative spec.** A tool can be called with no interaction at all. | `index.bs`, grep: zero hits |
| The platform mediates who may prompt | **The agent decides, opaquely.** "agents rely on natural language descriptions to decide whether to invoke a tool **and whether to prompt the user for permission**, but cannot verify the tool's actual effects before execution." The page has no visibility into, or control over, this. | `index.bs` §Misrepresentation of Intent |
| The page can detect that an agent is present | **It cannot.** `getTools()` is for in-page agents; the browser's built-in agent "uses a different internal mechanism to retrieve the tools exposed to it." **There is no attach event, no presence signal, no idle signal.** A page learns an agent exists only when a tool executes. | `index.bs` §ModelContext |
| The declarative form API is available | **It is a proposal, not normative.** `toolname`, `tooldescription`, `toolautosubmit`, `:tool-form-active`, `:tool-submit-active`, `SubmitEvent.agentInvoked` and `respondWith()` appear **only in the explainer**, which is littered with "TODO" and "TBD", and Chromium "is implementing a loose version". They do **not** appear in `index.bs`. | `declarative-api-explainer.md`; grep of `index.bs`: zero hits |
| The three normative mitigations are a safety model | They are: input-length limits, shared attack-eval datasets, and the untrusted-content annotation. **Not one of them is a consent mechanism.** | `index.bs` §Mitigations |

#### Therefore: the page's real levers

webPod has exactly **three** controls over agent behaviour, and it must not pretend to more:

1. **What it registers.** Registration is the whole of availability. Not registering a tool is the only absolute prohibition available.
2. **What its own code does when a tool is called.** Inside `execute`, webPod is ordinary application code and may do anything a click handler could — including refusing, deferring, staging a change for review, or **showing its own confirmation UI**.
3. **When it unregisters.** Aborting the signal removes the tool and fires `toolchange`, so the agent learns immediately.

Everything else — confirmations, review gates, rate limits, the Hold switch — is **webPod's own application behaviour**, not a protocol feature, and this spec will now say so wherever it appears.

**The one thing the spec does give an author for review-before-commit** is in the *proposed* declarative API: omitting `toolautosubmit` means "the browser brings the submit button into focus, and the agent should then tell the user to check the form contents, and submit it manually", with `:tool-form-active` / `:tool-submit-active` to highlight it. This is the correct model — **the agent fills, the human presses the site's own button** — and webPod adopts its *shape* even where the attribute is unavailable. But because it is non-normative and unshipped, webPod must implement the same behaviour in its own code and treat the attributes as an enhancement.

### 7.1 Ground rules

| # | Rule | Basis |
|---|---|---|
| G1 | **Every tool actuates visible UI, on the surface it actually affected.** If the affected surface is off-screen, the tool navigates there, acts in view, dwells, and returns (**Show-Your-Work**, §8.8). No tool returns data without moving something on the panel. A tool that runs invisibly is indistinguishable from a backend integration, which is what WebMCP exists to avoid. | `README.md` Goals |
| G2 | **Registration is imperative and dynamic.** One `AbortController` per tool, aborted on unmount. The roster tracks device state — `pod-seek` exists only when audio is loaded; `pod-edit-playlist` only when a playlist is open — and every change fires `toolchange`. **Since registration is the only real prohibition the platform offers, §7.3 is now a safety mechanism, not a tidiness measure.** | `index.bs` |
| G3 | **Declarative forms are an enhancement, never a dependency.** Where supported, S12's field carries `toolname` / `tooldescription` / `toolparamdescription`, and destructive confirmations are real `<form>`s **without `toolautosubmit`** so the browser focuses the site's own submit button and the human presses it. Where unsupported — which today is everywhere but Chromium's trial — webPod reproduces the identical behaviour in its own code. **Do not ship a flow that only works if the proposal lands.** | `declarative-api-explainer.md`; `implementation-status.md` |
| G4 | **Every tool is cancellable.** Each `execute` receives `options.signal` and aborts its MusicKit fetch and its settle animation. Play/Pause-hold and S25's Stop call `controller.abort()`. | `index.bs` §ToolExecuteCallbackOptions |
| G5 | **`outputSchema` is not spec'd**, so every tool returns a `content: [{type:"text", text}]` block whose text is a compact, stable summary, plus a `structuredContent` field populated optimistically. Engineering must not depend on the latter. | `README.md` Open Questions (#9) |
| G6 | **webPod confirms; the protocol does not.** There is no consent handshake to hook (§7.0). Where webPod confirms a destructive action it is doing so as an application, in its own UI, on its own judgement — **and it shows the identical confirmation to a human performing the same action.** Any copy implying the browser or the protocol is asking permission is a lie and must be rewritten. | `security-privacy-questionnaire.md` Q04 |
| G7 | **Set `readOnlyHint: true` on tools that touch no user data and no playback.** It is a genuine, spec-defined signal that "helps agents make decisions about when it is safe to call the tool", and it is the only machine-readable safety hint webPod can offer. Changing which menu is displayed is not a modification of state, any more than scrolling is — so navigation and search are read-only; anything touching library, queue, playback or settings is not. | `index.bs` §ToolAnnotations |
| G8 | **Set `untrustedContentHint: true` on every tool returning catalogue text** — track titles, artist names, playlist descriptions, lyrics, station names. This is third-party, user-influenced content and is a live output-injection vector. This is the single most under-used real safety feature in the spec. | `index.bs` §Mitigations, §Output Injection Attacks |
| G9 | **No `exposedTo`.** Tools go to same-origin frames and the built-in agent only. | `index.bs` |
| G10 | **WebMCP is a progressive enhancement.** Safari and Firefox have not shipped. If `document.modelContext` is undefined, every agent-facing surface is simply absent and the product is a complete human music player. | `implementation-status.md` |
| G11 | **No tool exists for: undo, sign-out, sign-in, reset-all-settings, delete-playlist, purchase, disengaging Hold, or re-enabling tool exposure.** These are human-only, enforced by **never registering them** — the only absolute prohibition available. An agent that can undo can erase its own trail; one that can re-expose tools can defeat the Hold switch. | §7.0 lever 1 |

### 7.2 The 18 tools

**Legend** — `RO` `readOnlyHint: true` · `RW` `readOnlyHint: false` · `UC` `untrustedContentHint: true` · `REVIEW` the result lands as a staged draft the human commits (§8.5) · `UNDO` the result is committed and carries a 30s in-raster undo · `⚠` destructive · `H` unregistered while Hold is engaged

**Nothing in this column gates a call.** Every registered tool executes when invoked, with no gesture and no prompt (§7.0). `RO` / `UC` are hints webPod sets for the agent's benefit; `REVIEW`, `UNDO`, `⚠` and `H` describe **what webPod does with a result that has already happened** (§8.5). **There is no `CONFIRM` token — v3 had one, and it is deleted with S26.**

#### Group A — Playback

| Tool | Description | Input schema | Returns | Hints · webPod gate | UI surface it actuates |
|---|---|---|---|---|---|
| `pod-play` | Start or resume playback of a specific item, or of whatever is currently highlighted. | `itemId?: string`, `itemType?: enum(song,album,playlist,artist,station)`, `startAtMs?: number`, `replaceQueue?: boolean` (default `true` for containers) | `{ trackId, title, artist, album, durationMs, positionMs, queueLength, state:"playing" }` | `RW` `UC` · H | **S13 Now Playing** pushes into view; album art cross-fades over 300ms; transport glyph animates ▶→⏸; art bloom repaints the mobile shelf / desktop backdrop |
| `pod-pause` | Pause playback, keeping position. | *(none)* | `{ trackId, positionMs, state:"paused" }` | `RW` · H | **S13** transport glyph ⏸→▶; progress bar stops with a 1px sky-to-neutral tick; art desaturates 8% |
| `pod-skip` | Move to the next or previous track in the queue. | `direction: enum(next,previous)` *(required)*, `count?: number` (1–20, default 1) | `{ trackId, title, artist, positionMs, skippedCount, state }` | `RW` `UC` · H | **S13** art slides out in the travel direction and the next slides in; **S17 Up Next** rows shift up with the played row falling into a History divider |
| `pod-seek` | Move the playhead within the current track. | `positionMs?: number`, `positionPercent?: number` (0–100), `relativeMs?: number` — exactly one required | `{ trackId, positionMs, durationMs }` | `RW` · H | **S14 Scrub mode** is entered for the duration of the seek (the mode chip flashes), thumb travels, **and the wheel visibly rotates by the equivalent detents, with the ghost thumb tracing the same arc inside it,** so the human sees the control being used |
| `pod-set-volume` | Set output volume, absolutely or relatively. | `level?: number` (0–100), `relative?: number` (−100…100) — exactly one required | `{ level, muted }` | `RW` · H | **S29 Volume HUD** overlays the panel's lower third for 1.2s; the wheel rotates and the orbit head travels with it; if a Volume Limit is set and clamps the request, the HUD shows the limit line and the return value reports the clamp |

#### Group B — Navigation & browse

| Tool | Description | Input schema | Returns | Hints · webPod gate | UI surface it actuates |
|---|---|---|---|---|---|
| `pod-read-screen` | Report exactly what is currently on the device screen: face, screen id, title, visible rows, highlight index, and now-playing state. The agent's eyes. | `includeOffscreenRows?: boolean` (default `false`) | `{ face, screenId, title, density, rows:[{index,label,sublabel,glyphs,provenance}], highlightIndex, totalRows, agentActive }` | `RO` `UC` · **stays registered under Hold** | **The panel bezel pulses green once, 220ms** — and that is all; per §8.8 this tool never navigates. It is the one tool whose only job is to read, so it is the one place where the visible-actuation rule is satisfied by an acknowledgement rather than a change. `includeOffscreenRows` additionally lights the scrollbar track green, because reading beyond what the human can see is a bigger thing to do and must look like one. |
| `pod-navigate` | Move the wheel highlight and/or push a menu screen, by screen id, by hierarchy path, or by relative detents. | `screenId?: string`, `path?: string[]` (e.g. `["Music","Artists","Vienna Teng"]`), `highlightIndex?: number`, `detents?: number` (−200…200), `press?: enum(center,menu,next,previous)` | `{ screenId, title, highlightIndex, totalRows, visibleRows }` | `RO` `UC` · H | **Whatever screen results.** The highlight animates through intermediate rows at 45ms/row capped at 400ms; the ghost thumb traces the equivalent rotation inside the wheel. **Silent — no clicker, no haptic** (§4.9). Push/pop transitions run at full duration. |
| `pod-search` | Search the Apple Music catalogue and the user's library, returning grouped results. | `query: string` *(required)*, `scope?: enum(library,catalog,both)` (default `both`), `types?: array<enum(song,album,artist,playlist,station,music-video)>`, `limit?: number` (1–25, default 10) | `{ query, groups:[{ scope, type, items:[{id,type,title,subtitle,durationMs,inLibrary,downloaded}] }], totalByGroup }` | `RO` `UC` · H | **S12 Search.** Registered **both** imperatively and declaratively: the agent fills the human's real `<form>` field, which visibly types the query character-by-character at 24ms/char, and `:tool-form-active` marks the field green (glow in dark, stroke in light). `toolautosubmit` is present (search is non-destructive and idempotent) so results render without a human press. |
| `pod-flip` | Turn the device over to the front or the back, optionally landing on a specific back surface. | `face: enum(front,back)` *(required)*, `surface?: enum(settings,playback,display,agent,account,about,engraving,shortcuts)` | `{ face, surface, screenId }` | `RO` · H | **The full 520ms flip animation** (§6.5), narrated. The `surface` enum omits `legal-reset` entirely, so it cannot be requested. Deferred while the human is mid-gesture (L1). Mini-transport docks per R2. |

#### Group C — Library mutation

| Tool | Description | Input schema | Returns | Hints · webPod gate | UI surface it actuates |
|---|---|---|---|---|---|
| `pod-add-to-library` | Add a song, album or playlist to the user's Apple Music library. | `itemId: string` *(required)*, `itemType: enum(song,album,playlist)` *(required)* | `{ itemId, libraryId, added:boolean, alreadyPresent:boolean }` | `RW` · `UNDO` · H | **The row's `+` glyph rotates into a ✓ in panel ink**, a 200ms green actor pulse fires, and a 20px in-raster footer row reads `Added to your library.  ⟲ Undo` for 30s (§8.3.6); **S05/S06/S07 counts increment visibly**. If already present the tool returns `alreadyPresent: true` and does nothing — no confirmation, no animation. Confirming a no-op trains people to dismiss confirmations without reading. |
| `pod-create-playlist` | Create a playlist with an optional initial tracklist. | `name: string` *(required, ≤ 100)*, `description?: string` *(≤ 300)*, `trackIds?: array<string>` *(≤ 200)* | `{ playlistId, name, trackCount, totalDurationMs, staged:boolean }` | `RW` · `REVIEW` · H | **S05 Playlists** — the new row slides in at the top and takes the highlight, then the screen pushes into its track list **S08**. **Agent-invoked calls always land as a Draft** (3px dashed green left border, `⚑ Draft · built by the agent` sublabel, playable locally, not written to Apple Music) and enter `REVIEW_PENDING` with a 28px in-raster `Review 1 change · Commit · Discard` footer row. This is webPod's own choice, not a permission gate: the tool succeeded, and its result is a draft. A human creating a playlist by hand skips the draft step, because they are already looking at what they made. |
| `pod-edit-playlist` | Add, remove or reorder tracks in a playlist. | `playlistId: string` *(required)*, `add?: array<string>`, `remove?: array<string>`, `reorder?: array<{ trackId, toIndex }>` | `{ playlistId, added, removed, moved, trackCount, staged:boolean, undoToken }` | `RW` · `REVIEW` ⚠ *(when `remove`/`reorder` present)* · H | **S08 as a reviewable diff** — added rows green-tinted with a `+` gutter, removed rows struck through in **ink** (not crimson: a staged removal is a proposal, not a destruction — §10.6) and *still visible*, moved rows with a ↕ and a ghost at the old index. A 28px in-raster `Review N changes · Commit · Discard` footer row. **Playback never uses staged data.** Mirrors the WebMCP explainer's "uncommitted changes" pattern exactly. |
| `pod-rate-track` | Set a star rating and/or the Apple Music Love state for a track. | `itemId?: string` *(defaults to now playing)*, `stars?: number` (0–5), `love?: enum(love,dislike,none)` — at least one required | `{ itemId, stars, love, undoToken }` | `RW` · H | **S15 Rate mode** is entered: dots fill one at a time at 60ms intervals with the wheel rotating and the orbit head travelling with it; the mode chip reads the value. No confirmation, because it is single-field, instantly visible, trivially reversible, and *the whole point of a rating is that it is cheap*. |

#### Group D — Queue

| Tool | Description | Input schema | Returns | Hints · webPod gate | UI surface it actuates |
|---|---|---|---|---|---|
| `pod-queue-insert` | Put tracks into the Up Next queue. | `itemIds: array<string>` *(required, ≤ 100)*, `itemType?: enum(song,album,playlist)`, `position?: enum(next,end,index)` (default `next`), `index?: number` | `{ inserted, queueLength, displacedCount, undoToken }` | `RW` · `UNDO`; `REVIEW` if `> 10` items or `displacedCount > 3` · H | **S17 Up Next / D02 Sidecar** — inserted rows expand in from 0 height at 40ms stagger with a green left border (3px solid in the light colourway) and an ○ provenance sigil; the queue length badge counts up. The `> 10 items` threshold exists because a 60-track insert *is* a queue rewrite even when it is technically additive. |
| `pod-queue-clear` | Empty the Up Next queue. | `keepCurrent?: boolean` (default `true`), `keepHistory?: boolean` (default `true`) | `{ removedCount, undoToken }` | `RW` · `UNDO` ⚠ · H | **S17** — rows collapse upward at 30ms stagger; the empty state appears; a 12s `Undo · N songs removed` pill sits above the wheel. **No confirmation, for either actor** (§8.5). The clear happens, in view, on S17, and a 12s `Removed 14 songs.  ⟲ Undo` footer row sits under it — the window matched to the collapse animation so the two read as one event. A human clearing by hand gets exactly this. |

#### Group E — Discovery

| Tool | Description | Input schema | Returns | Hints · webPod gate | UI surface it actuates |
|---|---|---|---|---|---|
| `pod-start-station` | Start an Apple Music station seeded from a track, artist, genre, or a named live station. | `seedType: enum(track,artist,genre,station)` *(required)*, `seedId: string` *(required)*, `replaceQueue?: boolean` (default `true`) | `{ stationId, stationName, firstTrack, state:"playing" }` | `RW` `UC` · H | **S18 Radio** pushes in and the station row takes the highlight with a radiating-ring animation, then **S13** with a `STATION` chip in the metadata region and **S17** rebuilt as a rolling station queue |
| `pod-get-lyrics` | Fetch time-synced lyrics for a track and show them. | `itemId?: string` *(defaults to now playing)*, `display?: boolean` (default `true`) | `{ itemId, synced:boolean, lines:[{ startMs, text }], language }` | `RO` **`UC`** · H | **S16 Lyrics / D04 Sidecar Lyrics** — the surface is entered and scroll-locked to the playhead; the current line lifts to 100% opacity. With `display:false` the lyrics are returned without navigating, but the S13 metadata region still shows a green `LYRICS READ` micro-chip for 2s — G1 admits no exceptions. |

#### Group F — Device & settings

| Tool | Description | Input schema | Returns | Hints · webPod gate | UI surface it actuates |
|---|---|---|---|---|---|
| `pod-set-setting` | Change one device setting. | `key: enum(shuffle,repeat,eq,soundCheck,crossfade,volumeLimit,backlight,brightness,clicker,shimmer,reduceMotion,contrast,density,theme)` *(required)*, `value: string \| number \| boolean` *(required)* | `{ key, value, previousValue, undoToken }` | `RW` · `UNDO` · H | **Flips to B02 or B03** (via an implicit `pod-flip`) and the physical toggle **visibly throws** — the switch travels, the detent clicks, the value label cross-fades. Then flips back after 900ms unless the human touched the pod during the dwell. **No key is confirmed** (§8.5). `volumeLimit`, `reduceMotion` and `contrast` are the consequential ones, and what protects them is Show-Your-Work at its most literal: the pod flips, the switch throws in view, and for `reduceMotion` the entire device's motion model visibly changes. All three carry a 30s undo footer row. |
| `pod-set-hold` | *(Deliberately absent — documented here so nobody adds it.)* | — | — | — | Hold is human-only in both directions (§5.3), enforced by never registering a tool for it. Since registration is the only absolute prohibition the platform offers (§7.0), *not existing* is the entire mechanism. |
| `pod-get-provenance` | Report the session's action log: who did what, when, and what is undoable. | `limit?: number` (1–100, default 20), `actor?: enum(human,agent,system)`, `since?: string` (ISO) | `{ entries:[{ ts, actor, sigil, action, target, argsSummary, outcome, undoable, undoToken }], totalEntries }` | `RO` · **stays registered under Hold** | **Flips to B07 The Engraving** and highlights the returned range with a green bracket in the left gutter. The agent reading its own record is a healthy act and should be visible; note there is deliberately no `pod-undo` counterpart (G11). |

**Count: 18 registered tools** (`pod-set-hold` is a documented non-tool and is not registered).

### 7.3 Contextual registration matrix

The roster is dynamic; `toolchange` fires on every transition. **This table is now a safety mechanism, not a tidiness measure.** Since a registered tool is always callable and no grant exists (§7.0), *not registering* is webPod's only absolute prohibition — so the roster is the primary control surface and must be treated as security-relevant code.

| Tool | Registered when |
|---|---|
| `pod-read-screen`, `pod-navigate`, `pod-search`, `pod-flip`, `pod-get-provenance`, `pod-set-setting` | Always (after successful Apple Music auth for `pod-search`) |
| `pod-play`, `pod-start-station` | Always after auth |
| `pod-pause`, `pod-skip`, `pod-seek`, `pod-set-volume`, `pod-rate-track`, `pod-get-lyrics` | Only while a track is loaded (`nowPlaying !== null`) |
| `pod-queue-insert`, `pod-queue-clear` | `queue-insert` always after auth; `queue-clear` only while `queueLength > 0` |
| `pod-add-to-library`, `pod-create-playlist` | Only with an active Apple Music subscription |
| `pod-edit-playlist` | Only while a user-owned or collaborative playlist is the current or parent screen |
| **All except `pod-read-screen` and `pod-get-provenance`** | Unregistered entirely while `HOLD_ENGAGED`, and re-registered only when a **human** releases the switch. The roster shrinking to two tools, plus the `toolchange` event, *is* the Hold switch in its agent-legible form — and because it is real unregistration rather than a refusal, it is the one control in this product that an agent genuinely cannot work around. |
| **All catalogue tools** | Unregistered while `DISCONNECTED` (offline/auth-expired); library-and-downloaded tools remain |

### 7.4 Rate limits — webPod's own defensive policy

**Not a protocol feature.** The spec offers no throttling; these buckets are ordinary application code inside `execute`, and an exhausted bucket produces an ordinary tool *return value* saying so. They exist because a runaway agent loop is a real failure mode and refusing politely is cheaper than unregistering.

| Bucket | Capacity | Refill | Rationale |
|---|---|---|---|
| Reads (`pod-read-screen`, `pod-get-provenance`) | 30 | 30 / 10s | Reading is cheap and refusing reads makes the agent guess from screenshots, which is worse for the human |
| Navigation & playback | 8 | 8 / 10s | Above ~1/s the device becomes a strobe and the human cannot follow |
| Mutations (Groups C, D, F) | 2 | 2 / 10s | A mutation the human cannot notice is a mutation they cannot object to |
| Session ceiling | 40 mutations | per 30 min | A hard stop on runaway loops that individually respect the buckets |
| On exhaustion | Enter `AGENT_THROTTLED`; return a **retryable** refusal naming the exact seconds remaining | An agent told "retry in 4s" behaves; an agent told "error" retries immediately and forever. This is a return value, not a rejection — a rejected promise reads as a bug and invites a retry storm. |

---

## 8. Dual-mode interaction contract

### 8.1 The five laws

| Law | Statement | Consequence |
|---|---|---|
| **L0 — Never imply a permission that does not exist** *(new in v3)* | WebMCP has no consent model (§7.0). Every registered tool is callable at any moment, with no gesture and no prompt. **No copy, no chip, no setting and no surface in webPod may suggest otherwise** — and in particular **nothing in an agent flow may ask, wait, request, or be granted.** The agent does not pause; webPod chooses what to do with a result that already happened. | §8.5, §11.4, B04, the deletion of B10 and S26 |
| **L1 — The human wins** | When a human input and a tool call target the same control at the same moment, the human's input executes and the tool call is deferred, then dropped. Never the reverse. | §8.2.6, an implementation rule rather than a state |
| **L2 — Nothing invisible** | Every agent action must satisfy all three: **(a)** it changes the panel or the device's physical state, animated ≥ 240ms, **on the surface where the change happened**, navigating there first if off-screen; **(b)** the ghost thumb reflects that the agent was the last actor; **(c)** an entry lands in B07. | §8.7, §8.8, B07 |
| **L3 — The split** | In split-pane screens the **left column is the human's locus of control**; the **right pane is the agent's writing surface**. An agent write to a surface is invalidated when the human navigates away from it. | §9 J4 |
| **L4 — Undo is human-only** | Undo, sign-in/out, reset, Hold-release and re-exposing tools have no tool, **enforced by never registering one** — the only absolute prohibition the platform offers. An actor must not be able to erase evidence of its own actions, or to undo the switch that stopped it. | G11, §7.0 |

### 8.2 The agent flag — the whole model

> **v3 correction.** v1 and v2 specified an eleven-state machine whose states were largely permission states for a permission model that does not exist, and one of which — "an agent is attached and idle" — **the page cannot detect at all**: the browser's built-in agent "uses a different internal mechanism to retrieve the tools exposed to it" (`index.bs`), so there is no attach event, no presence signal and no idle signal. A page learns an agent exists **only when a tool executes.** Six states are deleted below.

#### 8.2.1 The mechanism, in full

```js
let agentActive = false;

// Set from inside every tool's execute callback, first line:
function noteAgentCall() {
  if (!agentActive) { agentActive = true; onActorChange("agent"); }
}

// Cleared by any direct user interaction:
for (const type of ["pointerdown", "keydown", "wheel", "touchstart"]) {
  addEventListener(type, (e) => {
    if (!e.isTrusted) return;
    if (agentActive) { agentActive = false; onActorChange("user"); }
  }, { capture: true, passive: true });
}
```

**That is the entire model.** A flag that turns **on** when a tool call happens and it is currently off, and **off** when a direct user interaction happens and it is currently on. It is binary, mutually exclusive by construction, and needs no timers, no thresholds and no reconciliation.

| Property | Value | Note |
|---|---|---|
| Meaning | **Who acted most recently** — not who is present, not who is permitted | The honest reading, and the only one the platform supports |
| Default at load | `false` (`USER_ACTIVE`) | The device belongs to the human until something proves otherwise |
| Transitions fire | Only on *change*, never on repeat | A burst of twelve tool calls is one transition, so nothing strobes |
| `isTrusted` | Filters synthetic events dispatched by page script | **Honest caveat: it is not a reliable human/agent discriminator.** Input injected by browser automation is `isTrusted: true`. The flag is a best-effort attribution heuristic for display, **never a security boundary.** Nothing in webPod's safety model may rest on it. |
| Persistence | None. In-memory, per page load. | |

#### 8.2.2 The surviving states

Five device states, one active at a time, on the root as `data-actor-state`.

| State | Meaning | Entry | Exit | Orbit (§8.3.3) | Panel |
|---|---|---|---|---|---|
| **`USER_ACTIVE`** | Flag off. The human acted most recently, or nothing has happened yet. **This is the ordinary music player and the overwhelmingly common state.** | Page load; any trusted user interaction while the flag is on | A tool call executes | **Band empty.** No green anywhere. The halo responds normally to the hand, outside the wheel. | Unchanged |
| **`AGENT_ACTIVE`** | Flag on. A tool call executed and no human has touched the device since. | A tool `execute` runs while the flag is off | Any trusted user interaction | **Ghost thumb**: *tracing* while a call is in flight, settling to a *resting trail* between calls (§8.3.3) | 1px inset green border while a call is in flight; green scrim on the actuated element; Show-Your-Work (§8.8) |
| **`AGENT_THROTTLED`** | webPod's own rate limiter is refusing (§7.4). A sub-mode of `AGENT_ACTIVE`, **not a protocol state.** | A §7.4 bucket empties; or the human pressed Stop (20s) | Bucket refills; or a user interaction clears the flag | **Static hatch** filling the band, no motion | Nothing. The exact seconds go to the agent in the refusal payload. |
| **`HOLD_ENGAGED`** | The physical switch is on. **Implemented by unregistering every tool but the two read-only ones** (§7.3), so it is the only agent control in the product that cannot be worked around. | Human drags the switch, or `.` | **Human only.** No tool, ever — there is no tool to call (G11). | **Not on the wheel** — the ring desaturates and the halo is disabled | Orange padlock chip, top-right; orange stripe in the switch cutout |
| **`DISCONNECTED`** | Apple Music unreachable: offline, 401, or MusicKit init failure. **Nothing to do with agents.** | `navigator.onLine === false`; a 401; three consecutive network failures | Reconnect + successful token refresh | **Not on the wheel** — device state renders on the panel | `☁︎/` chip; unavailable rows dim with `☁︎`, never hidden; S27 only if playback actually stopped |

#### 8.2.3 The orthogonal app mode

One app mode. It is ordinary application UI, actor-agnostic by design, and can be true alongside any state above. *(v4: `CONFIRMING` is deleted with S26 — see §8.5.)*

| Mode | Meaning | Entry | Exit | Rendering |
|---|---|---|---|---|
| **`REVIEW_PENDING`** | A bulk or agent-originated change is staged as a reviewable draft rather than applied. | `pod-create-playlist` or `pod-edit-playlist` with removals/reorders returns; a human bulk edit | `Commit` → written to Apple Music · `Discard` → dropped · 30 min idle → discarded, logged, reported | Staged rows: 8%/12% green tint, 3px dashed green left border, gutter glyphs (`+` · `−` struck in **ink** · `↕` with a ghost). 28px in-raster footer: `Review 3 changes · Commit · Discard`, plus a persistent 11px **`⚑ 3` chip in the panel's top-right** carried across screens. **Nothing on the wheel and nothing on the Center button** (§8.3.3). |

**Hard rule, unchanged:** playback never reads staged data. A draft playlist is playable, but pressing Play on it plays the draft's tracks **without committing it**.

#### 8.2.4 What was deleted, and why

| Deleted state | Why it goes |
|---|---|
| `SOLO_HUMAN` | **Merged into `USER_ACTIVE`.** It claimed to mean "no agent attached", which the page cannot know. `USER_ACTIVE` means the honest thing: the human acted last. |
| `AGENT_ATTACHED_IDLE` | **Unimplementable.** There is no presence signal. The "watching but idle" resting state — the most-seen visual in v2, with its breathing rest arc and drift particles — was rendering a fact the browser never tells the page. **This is the most consequential deletion in v3: v2's single prettiest idea was a fiction.** Its visual survives only as the *resting trail* in `AGENT_ACTIVE`, which means "the agent acted recently", not "an agent is here". |
| `AGENT_PENDING_CONSENT` | **No such protocol state exists**, and its v3 replacement `CONFIRMING` is deleted too (v4): a pre-action prompt is unimplementable in either framing, because the page cannot pause a call it only learns about by being called. Replaced by `REVIEW_PENDING` and undo (§8.5). |
| `AGENT_STAGED` | **Renamed to `REVIEW_PENDING` and de-coupled from consent.** Its v2 justification was "a consent-gated tool with no human to consent" — a justification for a gate that never existed. It survives purely on design merit, and it is now actor-agnostic. |
| `CO_PILOT` | **Structurally impossible.** The flag is binary: a user interaction turns it off. There is no simultaneous state to render. **This kills the converged orbits and the violet seam**, which were among v2's best visuals — and v5's inversion would have killed them regardless, since the two regions are now concentric rather than adjacent and have no seam to meet at. The 8px violet bloom, the standoff contraction and the two-line stacked attribution are all deleted. Violet survives only on B08's armed irreversible-confirm row. |
| `HUMAN_PRIORITY_LOCK` | **Demoted from a state to an implementation rule** (§8.2.6). By definition the flag is already *off* the instant a human touches the device, so "the human is mid-gesture" needs no separate state — it is `USER_ACTIVE` with a tool call arriving. |
| `AGENT_DENIED` | **No consent means no denial.** A tool call webPod declines is an ordinary failed call that returns a refusal string. The receipt card, the struck-through chip and the 60s same-argument nag cooldown are deleted; the refusal appears in S25 and B07 like any other outcome. |

**Eleven states → five, plus one actor-agnostic mode.**

#### 8.2.5 Consequences for the orbit vocabulary

Twelve forms become five agent forms and four halo events, with device state moved off the wheel entirely — see §8.3.3, which supersedes this paragraph after the v5 inversion.

The two-region *geometry* survives intact and its accessibility argument gets stronger, not weaker: with colour semantics simplified to "green means the agent acted last", **position** — outside the wheel for the human, inside it for the agent — is doing even more of the work (§8.3.7 #4).

#### 8.2.6 L1 as an implementation rule

Not a state. Inside every mutating tool's `execute`:

| Condition | Behaviour |
|---|---|
| A human pointer is down on the wheel, a transport key is held, the scrub thumb is grabbed, or text is being typed | Defer the call up to **2500ms**. If the gesture ends in time, execute. If not, **drop it** and return a retryable refusal. |
| The call targets something the human is not touching | Execute immediately. |
| Always | `pod-read-screen` is never deferred. |
| On drop | A 4s in-raster footer row on the current surface — `Dropped a skip.` — because otherwise the human wonders why the track did not change. B07 logs `deferred, then dropped`. |

**The canonical case, unchanged:** an agent calls `pod-skip` while the human is scrubbing. Both target the playhead. The human wins, the skip is held then dropped, and the drop is logged. What changed is only the bookkeeping: there is no `HUMAN_PRIORITY_LOCK` state to enter, because the flag is already off.

### 8.3 The two-orbit FX system

#### 8.3.1 The Bezel Rule

The chrome cut is governed by one line, and every future surface is tested against it:

> **Anything inside the 320×240 panel is content and survives. Anything outside the device silhouette is page chrome and is cut.**

The two orbits are the **sole exception**, and they earn it because they carry **no text, no numerals and no controls**. They are light, not UI. The moment an orbit needs a word or a number, it has become a status pill and the answer is that the word goes in-raster or into S25 instead.

#### 8.3.2 Geometry — position is the actor channel *(inverted in v5)*

> **v5 correction.** v1–v4 put the human's light in the wheel seam (inside) and the agent's outside the body. **That was ergonomically backwards.** A thumb on the wheel physically occludes the inner ring, so human feedback drawn there is invisible to the very person causing it — the one viewer who must see it. Meanwhile the inner band is *never* occluded during agent action, because no thumb is there, and it is exactly the path a thumb would sweep. The assignment is now inverted.

| | **The Halo — the human** | **The Ghost Thumb — the agent** |
|---|---|---|
| **Where** | **Outside the wheel.** An annulus blooming outward from the wheel's outer edge (r 120 mobile / 180 desktop) into the body face and past the silhouette into the page margins. | **Inside the wheel, in the thumb-travel band** — the ring band, inner bound **r 76**, outer bound r 120. |
| **Form** | A full-perimeter bloom. **Not an arc at the contact point** — that is the one place guaranteed to be covered. | An elongated, soft, moving form that traces the arc a thumb would have swept, with a leading head. |
| **Contact bias** | Intensity peaks **diametrically opposite the contact point** and falls off toward it: *light escaping around my thumb*, brightest where the thumb is not. With no contact point (scroll, keyboard) the bloom is uniform. | None — there is no contact point to work around. |
| **What it means** | **Light escaping around my thumb.** The device answering a touch, where the touch is not. | **The gesture I did not make**, drawn where I would have made it. |
| **Why it survives occlusion** | A 360° bloom always presents visible arc regardless of where the hand approaches from. A localised highlight never does. | Nothing occludes it: during agent action the human's hand is not on the device. |
| **Colour** | Sky-400 `oklch(0.76 0.13 226)` | Green-400 `oklch(0.80 0.18 149)` |
| **Dark colourway** | Emissive outward bloom | Emissive trail in the band |
| **Light colourway** | **Subtractive** — a sky-tinted contact shadow spreading outward, α 0.18 | **Subtractive** — a green-tinted trail darkening the band, α 0.18 |
| **Desktop** | Same, at 1.5× (from r 180) | Band r 114–180 |
| **Never** | Inside the wheel. Ever. | Outside the wheel, on the Center button, or inside **r 76**. Ever. |

**The 10px keep-out, and why it is load-bearing.** The Center button ends at r 66. The ghost thumb's inner bound is **r 76**, leaving a 10px dead band that no agent FX may enter. See §8.3.2b — this is a correctness rule, not a margin.

#### 8.3.2b The Center button must never look pressed

Center is the commit affordance across the entire product. With the agent's trail now adjacent to it, a green form near the middle of the wheel could be misread as *"a commit just happened"* — which would be a serious misattribution, not a cosmetic one. Four independent guarantees, all required:

| # | Guarantee |
|---|---|
| 1 | **Hard keep-out.** No agent FX renders inside **r 76**. The Center button and its rim are never tinted, lit, outlined or overlapped by anything green. |
| 2 | **The press appearance is human-exclusive.** A Center press = a physical depression (bevel inverts, shadow shortens) **plus a halo bloom**. The agent renderer produces neither: it cannot depress the button, and the halo is human territory. "Center looks pressed" is unreachable by agent code. |
| 3 | **Opposite shapes.** A Center press is *static, circular, hard-edged, centred*. The ghost thumb is *moving, elongated, soft-edged, off-centre*. They are not confusable in peripheral vision, in greyscale, or at 4% opacity. |
| 4 | **An agent commit has its own form.** When `pod-navigate` carries `press: "center"`, the ghost thumb converges and the **band flashes once, full-ring, 120ms, r 76–120** — then the panel runs the push transition. A ring flash, never a depression, never a halo. **The human's commit is a button going down; the agent's is a ring lighting up.** |

#### 8.3.3 Forms — the ambient vocabulary

**v5 restructure.** The old vocabulary mixed *actor* forms and *device* forms on one contour. With the inversion, that contour is the human's halo, and putting device states there would reintroduce exactly the ambiguity the position channel exists to remove. So **device states move off the wheel entirely, onto the panel and the physical switch, where they always belonged.** The two FX regions are now purely an actor channel.

**Ghost thumb — the agent's band (r 76–120):**

| Form | Geometry | State |
|---|---|---|
| **Absent** | nothing in the band | `USER_ACTIVE` |
| **Tracing** | elongated soft trail with a leading head, sweeping the band; direction encodes rotation; one lap per 2400ms for non-rotational tools | `AGENT_ACTIVE`, call in flight |
| **Resting trail** | the trail settles to a steady dim arc at the last position it reached | `AGENT_ACTIVE`, between calls |
| **Ring flash** | full-band flash, 120ms, r 76–120 | an agent `press: "center"` commit (§8.3.2b #4) |
| **Static hatch** | 12px diagonal hatch filling the band, no motion | `AGENT_THROTTLED` |

**Halo — the human's annulus (outside r 120):**

| Form | Geometry | Event |
|---|---|---|
| **Absent** | nothing | at rest |
| **Detent pulse** | 90ms bloom step outward (+4px) and back, intensity peaking opposite the contact point | one per wheel detent, any input path |
| **Press bloom** | 90ms uniform bloom | any quadrant press, or Center |
| **Fill ring** | progressive radial wipe from 12 o'clock clockwise, completing at 600ms | long-press arming an action sheet |

**Device states — panel and hardware, not the wheel:**

| State | Where it renders now | Was (v4) |
|---|---|---|
| `HOLD_ENGAGED` | Orange stripe in the switch cutout; orange padlock chip in the panel's top-right; **the whole wheel ring desaturates and the halo is disabled** — the truthful rendering, because the wheel is dead | ~~orange lock arc~~ |
| `DISCONNECTED` | `☁︎/` chip in the panel's top-left; rows dim with `☁︎` | ~~slashed contour~~ |
| `REVIEW_PENDING` | Staged rows + the 28px in-raster footer + a persistent 11px **`⚑ 3` chip in the panel's top-right**, carried across screens until commit or discard | ~~notched contour + a green ring on the Center button~~ |

**Why `REVIEW_PENDING` had to move.** v4 marked pending drafts with a 2px green ring on the Center button. With the agent's trail now abutting that button, two adjacent green things would have meant two different things — "there is a draft" and "the agent is moving" — which breaks §8.3.2b #1 outright. Moving it to the panel is also more honest: **a pending draft is a state of the content, not of an actor**, and content state belongs in the raster. The `⚑ N` chip that v3 deleted as page chrome returns legitimately, because in-raster is content (§8.3.1 Bezel Rule) and it now carries an exact count instead of countable notches.

**Fade-out decay.** The flag flips instantly; the ghost thumb's *rendering* fades over **400ms** when it clears, so fast alternation (J4) reads as pulsing rather than strobing. Rendering only — `data-actor-state` is truthful on the same frame. The halo has no decay: it is event-driven and brief by nature.

**Deleted across v3–v5:** `rest arc`, `drift`, `stopped + violet line`, `double contour`, `converged`, `solid sky`, `crimson notch`, `notched`, `orange lock arc`, `slashed`. Twelve forms → **five agent forms and four halo events**, with device state off the wheel entirely.

#### 8.3.4 Token table

| Meaning | Token | Value | Sigil | Renders as | Never |
|---|---|---|---|---|---|
| **Human** (touch) | `--fx-human` | sky-400 `oklch(0.76 0.13 226)` | ● filled dot | **The halo, outside the wheel.** Full-perimeter bloom, intensity peaking opposite the contact point, largest radius, greatest emphasis per HIG for direct touch | **Inside the wheel. Ever.** |
| **Human** (mouse drag on the ring) | `--fx-human` @ 0.7α | same hue, subdued per HIG | ● | The halo, **uniform** (a mouse has no occluding contact patch to bias away from), smaller radius | inside the wheel |
| **Human** (scroll / trackpad) | `--fx-human` @ 0.7α | subdued | ● | The halo, uniform, one pulse per detent — so the user *learns* that scroll maps to the wheel | inside the wheel |
| **Human** (keyboard) | `--fx-human` + `--focus-ring` | sky + hard 2px ring | ● | The halo at a fixed low intensity, pulsing once per keypress but **never travelling** — nothing pretends to be a gesture that was not one — plus `:focus-visible` on the panel row | inside the wheel |
| **Agent** | `--fx-agent` | green-400 `oklch(0.80 0.18 149)` | ○ open ring | **The ghost thumb, inside the wheel, r 76–120.** Plus: in-panel 1px inset border; actuated-element scrim; staged dashed borders; S25 tool chips; right-pane border | Outside the wheel; on or inside the Center button (r < 76); on the Hold switch; **as a success signal (§8.3.6)** |
| **Irreversible** | `--fx-irreversible` | violet `oklch(0.66 0.17 300)` | ◐ | **B08's armed confirm row, and nothing else** — two buttons in the entire product (`Sign out`, `Reset All Settings`). *(v4: violet now marks the two actions undo cannot reach. It appears on no front-face surface and in no agent flow.)* | Anywhere else |
| **Apple Music brand** | `--brand` | crimson `oklch(0.58 0.21 18)` | ♥ filled | **Filled shapes only**: progress-bar fill, Loved heart, station chips | As a stroke; as an actor colour; anywhere it could read as danger |
| **Destructive / failure** | `--fx-destruct` | crimson `oklch(0.58 0.21 18)` | ✕ / ⚠ | **Strokes and strikes only**: 2px left edge, struck-through text, the denial receipt's border, `Reset All Settings`, `Sign out` | As a fill; on any confirm button |
| **Locked** | `--fx-hold` | orange `oklch(0.70 0.17 55)` | 🔒 | Hold stripe in the switch cutout, padlock chip in the panel. **Not on the wheel** — Hold instead desaturates the ring and disables the halo (§8.3.3) | Anywhere else — orange means exactly one thing |
| **System / automatic** | `--fx-system` | neutral `oklch(0.72 0.01 250)` | ▪ square | Auto-advance, crossfade, sleep-timer stop, token refresh, a skipped unavailable row | — |
| **Amber** | — | *(freed, deliberately unspent)* | — | Nothing | **Anything.** A freed colour left unused is a resource; re-spending it the moment it frees up is how palettes rot. It is held in reserve for a need we do not yet have, and it is adjacent to orange, which now means one thing only. |

#### 8.3.5 Crimson carries two meanings, disambiguated by shape

Crimson is now brand *and* destructive. That is a deliberate, monitored overload rather than a sixth colour, and the disambiguator is **shape, not hue**:

| | Brand | Destructive |
|---|---|---|
| Rendering | **Filled** — a solid field or a filled glyph | **Stroked** — a 2px edge, an outline, or a strike-through |
| Instances | Progress-bar fill, the Loved heart, station chips | Removal strikes, the denial receipt border, `Sign out`, `Reset All Settings` |
| Always accompanied by | Nothing (it is ambient brand) | The word — `remove`, `clear`, `sign out`, `reset` — adjacent, never colour alone |

The two never appear in the same 44px region. If a future surface would put a filled crimson heart next to a stroked crimson warning, that surface is wrong and must be re-laid-out.

#### 8.3.6 Green can no longer mean success — the replacement

Green is the agent. A green tick on a human-caused success would read as *"the agent did this"* on every single confirmation in the product. So:

> **The success token is deleted, not recoloured. Success has no colour of its own.**

Success is confirmed by three achromatic-or-actor-coloured mechanisms:

| Channel | Mechanism | Why |
|---|---|---|
| **1. The object is different** | The primary confirmation, on every screen: the art cross-fades, the switch physically throws, the row's `+` rotates into a `✓`, the queue badge counts up, the rows expand in. | This was always the real confirmation. The green tick was decoration on top of it. |
| **2. A single 200ms actor pulse** | The changed element pulses **once** in the colour of whoever caused it — **sky** if the human, **green** if the agent. | The pulse now answers **"who"** instead of "did it work", and "did it work" is answered by channel 1. Strictly more information in the same pixels — this is the rare cut that adds meaning. |
| **3. An in-raster footer row** | Where a discrete receipt is needed: a 20px row in **panel ink**, achromatic, with the undo affordance — `Added to your library.  ⟲ Undo` | Replaces the cut toast/pill. It is panel content, so it survives the Bezel Rule, and it lands exactly where Show-Your-Work has just navigated the human. |

The `✓` glyph stays and is rendered in **panel foreground ink**, never green, never crimson.

**Failure keeps its colour; success does not.** That asymmetry is the point: **success is the expected case and should be quiet, failure is the exception and should be marked.** A product that celebrates every ordinary success is a product that cannot signal an extraordinary problem.

#### 8.3.7 Non-negotiables

1. **Position outranks hue.** **Human light blooms outside the wheel; agent light traces inside it** (v5 inversion, §8.3.2). Achromatic, motion-free, legible at 4% opacity — and now also ergonomically correct, because the human's own cue is the one that must survive their own thumb.
2. Under `prefers-contrast: more`, all FX drop glow and render as 2px solid strokes, with sigils at 1.4× size.
3. Under `prefers-reduced-transparency`, every scrim becomes a solid tint at equivalent luminance and all `backdrop-filter` is dropped.
4. **(Restated for sky + green.)** Sky-400 (≈226°) and green-400 (≈149°) are ~77° apart — far tighter than the ~164° the previous pair enjoyed — both are light, both are cool, and they sit **directly on the deutan/protan confusion axis**, where they converge toward the same pale blue-grey under the two commonest colour vision deficiencies. **Colour is therefore demoted from a primary identity channel to a reinforcing one.** Actor identity must be carried, in strict order of precedence, by:
   1. **Position** — inside vs. outside the silhouette (§8.3.2). *The two-orbit system is not a stylistic choice; it is the accessibility mechanism, and it is the reason the palette change is survivable.*
   2. **Motion and shape** — the twelve orbit forms (§8.3.3) are distinguishable with colour removed entirely.
   3. **Sigil** — ● human · ○ agent · ▪ system · ◐ both.
   4. **Lightness** — enforce **ΔL ≥ 0.06** between `--fx-human` and `--fx-agent` in each colourway (green lighter in dark mode, sky lighter in light mode, inverted so both stay separable against their own ground), so the pair separates in greyscale.
   5. **Text label** — in S25, D03, B07 and D06.
   6. **Hue** — last, and never load-bearing alone.
   7. **Touch and sound — by their absence.** ⚑ **Agent actions are silent and never vibrate** (§4.9). The clicker and the haptic engine are the signature of a hand: every human detent ticks and buzzes, and no agent detent ever does. This channel is listed seventh but is **first in practice for the eyes-free case** — it is the only attribution cue that reaches a human whose phone is in a pocket, and the only one that needs no screen at all. It is also self-enforcing: if the device buzzes for something nobody touched, the human reaches for a phone that no one is using, and the bug reports itself.

   **Acceptance test.** Force the stylesheet's hue channel to a single value and desaturate to greyscale. A human must still be able to tell who acted, on every priority screen, in both colourways. If they cannot, the design is wrong and ships nothing.
5. No FX animates longer than 800ms except the rest arc's breathing and the travelling head's lap.
6. Every FX value is a token pair — one per colourway — and neither is derived from the other by a filter (§4.8).

---

### 8.4 Attribution and the provenance trail

| Concern | Design |
|---|---|
| **Actor tagging** | Every state mutation carries `actor: 'human:touch' \| 'human:mouse' \| 'human:key' \| 'agent:<agentOrigin>' \| 'system'`. It is set by the reducer, not by the caller — a tool cannot claim to be a human. |
| **Row-level attribution** | Any row whose presence is attributable (queue entries, playlist tracks, library additions) renders a 10px sigil in its right gutter: ● human, ○ agent, ▪ system, plus a contributor avatar for collaborative playlists. Persistent, not a transient toast. |
| **The Engraving (B07)** | Append-only log, session + last 7 days, IndexedDB, 500-entry ring buffer, exportable as JSON from D06. Per entry: ISO timestamp, actor + sigil, action (tool name or gesture name), target (screen + item), a ≤ 60-char argument summary, outcome (`ok` / `denied` / `dropped` / `expired` / `error`), and an `undoToken` where applicable. Rendered as laser-etched type on the back plate; mirrored live in the desktop sidecar (D06). |
| **Reads are logged too** | `pod-read-screen` writes an entry. Grouped by minute so 30 reads collapse to one line: `○ 14:32 — read the screen ×12`. Knowing the agent looked matters, but not 30 times. |
| **Undo** | Every mutating tool and every destructive human action returns an `undoToken`. The v1 floating undo pill was page chrome and is cut. Undo now lives as a **20px in-raster footer row on the surface where the change happened** — `Added to your library.  ⟲ Undo` — for **30s** (12s for `pod-queue-clear`, matched to the collapse animation). Because Show-Your-Work (§8.8) has just navigated the human to exactly that surface, the undo is always in front of them at the moment it exists. After the window: the last **20** mutations are undoable from B07 or D06 indefinitely within the session, and `Z` undoes the most recent from anywhere. **There is no `pod-undo` tool** (G9). |
| **Provenance survives commit** | Committing staged work does not erase the ○ sigils. A playlist an agent built still says so, forever, in its track rows and in the Engraving. |

### 8.5 How a destructive agent action is made safe

> **Gate nothing · Show everything · Make it undoable**

This is the **single, explicit answer** to the question, and it replaces every prompt, card, scope, grant and mandate that v1–v3 invented.

#### Why there is no prompt

There is no moment at which webPod can pause an agent. `registerTool()` makes a tool **permanently callable**; the agent calls it; `execute()` runs; **the page finds out that anything is happening by being called.** By the time webPod has an opinion, the request has already arrived and the only question left is what to do with it.

v3 tried to keep the screen by relabelling it — "an app-level confirm, not a protocol prompt". That fixed the wording and kept the lie, because the premise of the screen was still *the agent pausing to ask*, and the agent never pauses. **S26 is deleted. `CONFIRMING` is deleted. There is no pre-action prompt anywhere in an agent flow.**

#### The three clauses

| Clause | Mechanism | Where |
|---|---|---|
| **1 · Gate nothing** | Every registered tool executes when called. webPod does not defer, does not ask, does not withhold. The only prohibition is *not registering a tool at all* (G11), decided at design time, and the only withdrawal is unregistering (Hold, B04's switch) — which removes the capability rather than declining to use it. | §7.0, §7.3 |
| **2 · Show everything** | **Show-Your-Work** (§8.8): navigate to the surface the change landed on, perform it in view, animate ≥ 240ms, leave a receipt, dwell 900ms, return. The human sees the change happen on the thing that changed. | §8.8 |
| **3 · Make it undoable** | Every mutating tool returns an `undoToken`. A 20px in-raster footer row on that surface carries `⟲ Undo` for 30s; the last 20 mutations stay undoable from B07 / D06 for the session; `Z` undoes the most recent. **Undo is human-only — there is no `pod-undo` tool** (L4). | §8.4 |

#### The fourth thing, for changes too big to take in at a glance

Clause 3 is sufficient for a skip, a rating, a volume change, a station. It is not sufficient for eleven tracks appearing in a new playlist. So for **bulk and library mutations**, webPod's choice is to land the result as a **proposal rather than a committed change**:

| | |
|---|---|
| **Applies to** | `pod-create-playlist`, `pod-edit-playlist` with removals or reorders, `pod-queue-insert` above 10 items or displacing more than 3 |
| **Behaviour** | The call **succeeds**. Its result is a draft: staged rows with a dashed green left border and gutter glyphs, a `⚑ Draft` sublabel, playable locally, **not written to Apple Music**. `REVIEW_PENDING` (§8.2.3). |
| **The human's move** | `Commit` writes it; `Discard` drops it; 30 min idle discards and says so. |
| **Governed by** | **`Assistant changes · Review first / Apply directly`** on B02. Default **Review first**. |
| **What this setting is** | A statement about **what webPod does with a result**, never about what the assistant is permitted to attempt. Set to `Apply directly`, the agent's capabilities are *identical* — only webPod's handling of the outcome changes. |
| **Why it is honest** | It cannot mislead. There is no reading of "Review first" under which a user could conclude the assistant is blocked from doing something, because the review happens *after* the doing. |

#### The audit rule

**In any agent flow, no surface, string, animation or state may imply that the agent asks, waits, requests, is granted, is allowed, is denied, or is permitted.** The agent acts; webPod responds. Forbidden vocabulary in agent-flow copy: *allow, deny, permit, permission, grant, granted, authorise, request (as a noun), ask, waiting for approval, pending, approved, blocked*. Any occurrence is a merge-blocking defect (M3 exit criterion, §13).

#### The one surviving confirm — human-only, irreversible-only

Two actions in the entire product cannot be made undoable, because **they destroy the undo trail itself**:

| Action | Why undo cannot reach it |
|---|---|
| `Sign out` | Drops the Apple Music session; downloads stop; the session's undo tokens die with it |
| `Reset All Settings` | Wipes the settings **and the Engraving**, which is where undo lives |

Both are **human-only** — no tool is registered for either (G11), so neither can appear in an agent flow by construction. Their confirm is therefore **not a prompt about an actor**; it is the last stop before an action that has no way back.

| Property | Ruling |
|---|---|
| **Form** | Not a modal and not a screen. An **in-place armed row on B08**: the first Center press arms the row, which expands to show the consequence and a violet 2px left edge; the second press commits. Menu at any point disarms it. |
| **Location** | On the **back plate only**, adjacent to the buttons it guards. The front face has no confirmation surface of any kind. |
| **Actor attribution** | **None, ever.** No tool name, no `Requested by the assistant.` sub-line, no agent sigil. There is no agent path to this row. |
| **Second-press label differs from the first** | `Sign out` → `Sign out of Apple Music?` → `Sign out`; `Reset All Settings` → `Reset everything?` → `Reset everything`. Muscle memory cannot complete a double-press blind. |
| **Haptic** | `warning` on arming — "irreversible step ahead" (§4.9). The only `warning` in the product besides hitting a volume limit. |
| **Everything else** | **No confirm.** Clearing a 14-song queue by hand does what an agent clearing it does: it happens, it shows, and a footer row offers `⟲ Undo` for 30s. A modal in front of a fully undoable action is friction with no safety in it, and it would put back — for humans — exactly the pause the agent flow no longer has. |

### 8.6 Interruption

| Direction | Mechanism | Guarantee |
|---|---|---|
| Human interrupts agent | Any trusted input. Never blocked, never queued, never "please wait". **The flag clears on the same frame** and any in-flight call targeting what they touched is deferred then dropped (L1). | Zero-latency. The wheel responds on the same frame as the pointer event regardless of what the agent is doing. |
| Human aborts agent hard | **Play/Pause hold 2s** during agent activity, or `Stop` in S25/D03, or `Escape` twice. Calls `controller.abort()` on the in-flight tool's `AbortSignal`; the tool cancels its MusicKit fetch and its settle animation. → `AGENT_THROTTLED` 20s. | The abort path uses the spec's own cancellation primitive, so it is honest rather than cosmetic. |
| Agent interrupts human | It cannot. It may only *notify* — via the ghost thumb, the right pane, and S25 when summoned. It may never open a sheet, steal focus, or move the highlight while the human is live. | Structural: the notify channel and the manipulate channel are spatially disjoint. |
| Agent cancels itself | `toolcanceled` → the UI rolls the settle animation backwards and logs `cancelled by the agent`. | A half-applied visual state is never left on screen. |
| Mid-flip interruption | A pointerdown grabs the rotation at its current angle. An agent flip interrupted by a human touch **snaps to whichever face the human's drag ends nearer** — the human finishes the gesture the agent started. | Per HIG: let people cancel motion. |

### 8.7 Where the cut chrome went

The client cut the persistent agent-status pill from the app bar and the bottom-of-page activity tray. Both were page chrome under the Bezel Rule (§8.3.1). Every function they carried is re-homed below. **Nothing is deleted silently; one thing is deleted openly.**

| Cut function | Where it lives now | Summon cost | Assessment |
|---|---|---|---|
| ~~Agent presence — "an agent is here"~~ | **Deleted in v3 — not re-homed.** The page cannot detect agent presence (§7.0), so v2's rest arc was rendering a fact the browser never supplies. The ghost thumb now means **"the agent acted most recently"**, which is knowable and true. | Zero | **Corrected.** A quieter and smaller claim, honestly made. |
| **Agent idle tag — "idle"** | **Deleted in v3.** With no presence signal there is no idle to report. Surviving distinction: **tracing** (call in flight) vs. **resting trail** (acted recently) vs. **absent** (human acted last). | Zero | **Corrected.** The v2 casualty below is superseded — see the note. |
| **Agent status line — "what is it doing"** | **The panel itself, via Show-Your-Work (§8.8)**; exact wording in **S25** | Zero to watch it happen; one gesture for the words | **Better.** You watch the device do the thing instead of reading a label about it. This is the single largest polish gain from the cut. |
| **Tool name in words** | **S25 transcript** (mobile, an in-raster front-panel screen) and **D03 sidecar** (desktop) | One gesture (swipe up from the pod's bottom edge, `A`, or Extras → Agent Console) | Acceptable. Words are the rarely-needed channel; making them deliberate is correct. |
| **`Review N changes` bar** | **A 28px in-raster footer row on the affected surface** + **N notches in the orbit** + a **2px green ring on the Center button** | Zero to know work is pending; one press to review | **Better.** The v1 bar floated over the device; the footer row is *on the thing that changed*, which is where a review control belongs. |
| **Staged-work `⚑ N` badge** | **Restored in v5, in-raster.** An 11px chip in the panel's top-right (§8.3.3). v3 deleted it as page chrome, correctly — but *outside the body* was the problem, not the badge. In-raster is content under the Bezel Rule, and it now carries an exact count rather than countable notches. | Zero | **Better.** Forced by the inversion: the notched contour is now the human's halo, and the green Center ring would violate §8.3.2b. |
| **Throttle countdown** | **Static hatch filling the agent's band.** The exact seconds go to the *agent*, in the refusal payload. | Zero | **Better.** The human needs "not now", not a number. The number always belonged to the party that could act on it. |
| **30s undo pill** | **20px in-raster footer row** on the surface where the change happened, plus `Z`, plus B07 / D06 permanently | Zero — Show-Your-Work has already put the human there | **Better.** v1's pill could appear while the human was on an unrelated screen, offering to undo something they could not see. |
| **Success toast** | **Deleted as a form.** Replaced by the three-channel model in §8.3.6. | — | **Better.** See §8.3.6. |
| ~~Confirmation dialog~~ | **Deleted in v4** (§8.5). There is no pre-action prompt to re-home. The receipt-and-undo footer row, already listed above, is what a destructive agent action produces. | — | **Corrected.** The chrome cut removed the tray; v4 removed the modal. The front face now has no floating surface at all. |
| **Provenance / activity tray** | **B07 The Engraving** (flip, or `,`), **D06 sidecar** on desktop, and the **persistent ○ / ● / ▪ sigils on rows**, which are in-raster content | One flip, or zero for row-level attribution | **Better.** Row-level attribution was always the useful part and it survives; a scrolling feed of events belongs on a surface you open to audit, not under your thumb while you listen. |
| **Agent Console S25 as a bottom sheet** | **Promoted to a front-panel screen** rendered inside the 320×240 raster, reached from Extras → Agent Console or the summon gesture | One gesture | **Better and more consistent.** A sheet over the wheel was chrome; a panel screen is the device. A terse 8-row transcript is also a better transcript than a chatty one. |

#### The one casualty, named plainly

> **v3 note.** The casualty below was analysed under v2's assumption that webPod could see an idle agent. It cannot (§7.0), so the loss is larger than v2 admitted and is not the chrome cut's fault: **webPod never had access to "the agent is thinking" in the first place.** The `drift` form proposed as its mitigation is deleted. What remains is stated honestly here.

**The agent's *reasoning narration* does not survive.** v1's status line could distinguish, for free and at a glance, between three different silences: *idle because finished*, *idle because thinking*, and *idle because waiting on your scrub to clear*. An orbit can say "not acting". It cannot say **why** it is not acting.

- **~~Partial mitigation~~:** the `drift` form is **deleted** — it depended on a presence signal that does not exist. There is no mitigation. webPod knows only that a tool call happened and then stopped happening.
- **Residual cost:** a human who has just delegated something and is watching for progress cannot tell a thinking pause from a completed task without opening S25 — one extra gesture, occasionally, at the exact moment they are most curious. In the delegation journey (J3) this is felt most, because that is where pauses are longest and interest is highest.
- **The alternative I considered and rejected:** a single 11px word in the panel's top-right corner (`thinking` / `done`). It is in-raster, so it would technically pass the Bezel Rule — but it would occupy the panel's status row on **every screen, forever**, which is the same sloppy tag the client cut, merely moved inside the bezel. Refusing it is correct.
- **Verdict:** worth paying. The cut buys a device with nothing competing with it on a 390px viewport, and costs one gesture in one situation.

### 8.8 The Show-Your-Work rule

The mechanism that lets L2 survive with zero ambient chrome, and the reason the cut made the product better rather than merely quieter.

> **An agent mutation that affects an off-screen surface must navigate to that surface, act in view, dwell, and return.**

| Step | Behaviour |
|---|---|
| 1 — Navigate | The agent's tool performs an implicit `pod-navigate` (or `pod-flip`) to the affected surface, at **full transition duration**. Never faster: the human must see the travel, or the arrival is a teleport and reads as a glitch. |
| 2 — Act | The change is performed in view and animated for **≥ 240ms**, even if it completed in 4ms. The actuated element carries a green scrim; the panel carries a 1px inset green border. |
| 3 — Receipt | A 20px in-raster footer row appears on that surface: the confirmation string in panel ink plus `⟲ Undo` where applicable, for 30s. |
| 4 — Dwell | **900ms.** Long enough to read a short row, short enough not to feel hostage. |
| 5 — Return | The device returns to the screen the human was on, with its highlight index restored exactly. |
| **Human override** | **Any human input during the dwell cancels the return** and leaves them on the surface, in control. This is the same rule as the flip's auto-return (J5) and it is deliberately identical — one behaviour, one expectation. |
| **Coalescing** | Consecutive mutations on the same surface within 4s **batch into one visit**. Three queue inserts are one trip to S17, not three. Without this the rule becomes a strobe. |
| **Pacing** | The §7.4 navigation bucket (8 per 10s) already limits visits to a rate a human can follow. No additional throttle is needed. |
| **Exemptions** | Mutations whose surface is *already on screen* skip steps 1 and 5 entirely. `pod-read-screen` never navigates — it pulses the bezel green for 220ms and stays put. |
| **Reduced motion** | Steps 1 and 5 are instant cross-fades; steps 2–4 are unchanged, and the dwell extends to **1400ms** to compensate for the lost travel time that would otherwise have carried the change into awareness. |
| **Precedent** | This generalises the implicit-flip behaviour v1 already specified for `pod-set-setting` (J5, agent variant). It was the best idea in v1's tool table; the chrome cut promoted it from a special case to the governing rule for every agent mutation. |

---

## 9. User journeys

### J1 — First run / empty state
**Mode** Human (P1) · **Viewport** 390×844 · **Screens** S01 → S02 → S03 → S18 → S13 · **Success metric** audio playing within 40s of first paint, with no dead end

| # | Actor | Input | System response | Screen | State |
|---|---|---|---|---|---|
| 1 | — | Cold load | Pod assembles: body fades in over 200ms, then the backlight ramps 0→100% over 420ms with the Apple mark centred. A 30ms scanline sweep sells the LCD. | S01 | `USER_ACTIVE` |
| 2 | — | 1.4s | Auto-advance. No auth token found. | → S02 | |
| 3 | Human | reads | `Your music, on a wheel.` / one 44px full-width button `Sign in with Apple Music` / an 11px footnote `You'll need an Apple Music subscription.` Wheel ring is dark and un-glowing — **the wheel does not pretend to work before there is anything to scroll.** | S02 | |
| 4 | Human | Center press or tap | MusicKit `authorize()` opens the Apple OAuth popup. Pod dims to 40%; the screen shows a 3-dot progress with `Waiting for Apple…`. | S02 | |
| 5 | Human | completes OAuth | Backlight flashes to 120% for 90ms (the "it's alive" beat), one clicker tick, then the halo ignites: a 360° sky bloom outward from the wheel, 500ms — **the first time the device answers a touch is the moment it introduces itself.** | → S03 | |
| 6 | — | library fetch | S03 renders the full menu immediately. Empty slices are **present but dimmed to 45% with a `0` count**, not hidden: `Playlists 0`, `Artists 0`, `Albums 0`. `Search`, `Radio`, `Shuffle Songs`, `Extras`, `Settings ⟳` are fully lit. Right pane shows a 3D ghost of the pod rotating slowly — a wordless hint that it has a back. | S03 | |
| 7 | — | empty-state copy | Footer, 11px: `Nothing in your library yet. Try Radio, or search for anything.` `Shuffle Songs` relabels itself to `Shuffle from Apple Music`. | S03 | |
| 8 | Human | rotate 1 detent | Highlight lands on `Radio`. Clicker ticks, `selection` haptic fires, the halo pulses outward — brightest on the far side from the thumb. | S03 | |
| 9 | Human | Center | Push into Radio. Live stations listed, `Apple Music 1` highlighted. | → S18 | |
| 10 | Human | Play/Pause | Station starts. Art cross-fades in. Push to Now Playing. Total: **4 physical inputs after auth.** | → S13 | |
| 11 | Agent | **first tool call ever** | **The orbit fades in over 900ms, once**, with a one-time in-raster 2-line chip: `An assistant just used this device. You'll see its light around the edge.` Dismisses on any input, never returns. **v3: this fires on the first tool *call*, not on attach — the page cannot detect an agent's presence** (§7.0), so an introduction shown "when an agent connects" was unimplementable. It also cannot say "can use", only "just used". | S13 | → `AGENT_ACTIVE` |

**Failure branches:** No subscription → S27 `You'll need an Apple Music subscription to play music. You can still browse.` + `Learn more` and browse-only mode with all playback tools unregistered. OAuth popup blocked → S27 `Your browser blocked the Apple sign-in window.` + `Try again` (retriggered from a direct user gesture). User cancels OAuth → return to S02 with no error styling at all — cancelling is not a failure.

---

### J2 — Mobile one-handed "play something I like"
**Mode** Human (P1) · **Viewport** 390×844, right thumb only, phone in one hand, walking · **Screens** S03 → S04 → S05 → S08 → S13 · **Success metric** ≤ 8 inputs, zero hand re-grips, executable without looking after the second time

| # | Input | Thumb travel | System response | Screen |
|---|---|---|---|---|
| 1 | Wake (any touch) | tap the ring at rest position | Backlight ramps 0→100% in 180ms. S03 restored with the highlight exactly where it was left. | S30 → S03 |
| 2 | Rotate CW ~15° | thumb arc, 1 detent | `Music` highlighted (row 1 — it is row 1 for exactly this reason). Right pane fills with a 4-up art collage of recent listening. | S03 |
| 3 | Center | 132px target, dead centre of the arc | Push into Music. `Playlists` highlighted. | → S04 |
| 4 | Center | no travel — Center twice in a row | Push into Playlists. `Made for You` highlighted (pinned to row 1). | → S05 |
| 5 | Rotate CW ~45° | 3 detents | Highlight lands on `Favourites Mix`. Right pane shows its mosaic art and `50 songs · 3h 12m`. | S05 |
| 6 | **Play/Pause** | 54×60 target at 6 o'clock | **Plays the highlighted playlist without descending into it.** Queue replaced. Art cross-fades. Push to Now Playing. | → S13 |
| 7 | *(optional)* Rotate | ring | Volume. The default rotary action on S13 is the one you want while not looking. | S13 |

**Total: 5 inputs (wake + 4).** The alternative one-handed path is shorter still: from S03, rotate to `Shuffle Songs` (7 detents down, or 1 detent *up* because the list wraps) → Center → S24 → S13 = **3 inputs**. Both paths are documented in B09.

**What was designed away:** no tab bar to aim at, no "For You" carousel to scroll horizontally, no album-art grid where every target is 96px and identical, no re-grip to reach the top of the screen. The thumb never leaves an area of about 240×300 px.

---

### J3 — Agent alone: "build me a 45-minute run playlist" while the user is away
**Mode** Agent (P3) · **Screens** S13 → S12 → S05 → S08(staged) → S30 · **States** `USER_ACTIVE` → `AGENT_ACTIVE` + `REVIEW_PENDING` · **Success metric** work completed, fully reversible, auditable in < 30s on return

Context: the human said this to their browser agent and then walked away. Music is playing. **v3 note: there was never anything to authorise.** Every registered tool was callable the whole time (§7.0). What makes this journey safe is not a grant the human gave, but that the *result* lands as a reviewable draft.

| # | Actor | Tool call | Visible result | State |
|---|---|---|---|---|
| 1 | Agent | `pod-read-screen` | Panel bezel pulses green 220ms; orbit shows the travelling head for one lap. No navigation (§8.8 exemption). Returns `{screenId:"S13", nowPlaying:{...}, agentActive:true}`. **This call is what set the flag** — before it, webPod had no idea an agent existed. | → `AGENT_ACTIVE` |
| 2 | Agent | `pod-get-provenance {limit:20}` | Flips to **B07 The Engraving**, green bracket over the returned range, 900ms dwell, flips back (§8.8). The agent is establishing what the human has been listening to. | ACTING |
| 3 | Agent | `pod-search {query:"uptempo indie rock 150 bpm", scope:"both", limit:25}` | **S12** pushes in. The query **types itself into the human's real `<form>` field at 24ms/char** — `:tool-form-active` gives the field a green inner glow (a green *stroke* in the light colourway — nothing glows on white, §4.8), `toolautosubmit` fires the search, results render grouped Library-then-Catalogue. S25, if summoned: `Searching for "uptempo indie rock 150 bpm".` | ACTING |
| 4 | Agent | `pod-search` ×3 more | Three more queries, each visibly typed, each ~2.4s apart. **After the 4th call the navigation bucket is at 4/8** — the agent is well inside its limits and the pacing is visibly deliberate rather than a strobe. | ACTING ⇄ IDLE |
| 5 | Agent | *reasoning, no tool* | 6s pass. The ghost thumb settles to its **resting trail** — steady, no motion. **v3: webPod cannot tell thinking from finished**, because it only ever sees tool calls. The `drift` form is deleted along with the presence model it depended on. The honest signal is "the agent acted recently", nothing more. | `AGENT_ACTIVE` |
| 6 | Agent | `pod-create-playlist {name:"45-Minute Run", trackIds:[…11]}` | **The call succeeds immediately — there is nothing to ask.** webPod's own code chooses to land an agent-invoked playlist as a draft: **S05** pushes in and a new row slides to the top — `45-Minute Run` with a 3px dashed green left border and the sublabel `⚑ Draft · 11 songs · 44:51 · built by the agent`. Screen pushes into **S08** showing the 11 tracks, each with an ○ sigil. A 28px in-raster footer row: `Review 1 change · Commit · Discard`. | + `REVIEW_PENDING` |
| 7 | Agent | — | **Two signals, both in-raster:** a `⚑ 1` chip in the panel's top-right, carried across screens; and the staged S08 with its `Review 1 change · Commit · Discard` footer row. **Nothing on the wheel** (§8.3.3). The words `Built a 45-minute run playlist — 11 songs. Review when you're ready.` wait in S25. | `REVIEW_PENDING` |
| 8 | — | 20 min pass | Backlight timeout → **S30 attract**: screen at 4%, album art ghosting at 12%, playback continuing. **The ghost thumb's resting trail stays lit inside the wheel, and the `⚑ 1` chip stays on the panel.** The device looks asleep; the record of the work does not. In the light colourway the orbit is a green-tinted shadow rather than a haze, and the unlit panel stays faintly legible (§4.8), so the draft's footer row is *still readable* on a sleeping white pod — a small, real advantage of light mode. | STAGED |
| 9 | Human | returns, touches the pod | Backlight ramps. **The touch clears the flag** → `USER_ACTIVE`; the ghost thumb fades out over 400ms. S30 → the staged S08. The `⚑ 1` chip pulses once and **stays** — `REVIEW_PENDING` is orthogonal to the flag and outlives it. | `USER_ACTIVE` + `REVIEW_PENDING` |
| 10 | Human | reads | 11 rows, each with the ○ sigil and a `+` gutter glyph, `44:51` total in the header, and a one-line rationale in the right pane: `Steady 148–156 bpm, no long intros, ends on a cooldown.` | STAGED |
| 11 | Human | Rotate to `Commit`, Center | Writes to Apple Music. Rows' dashed borders solidify one by one at 40ms stagger; the `⚑` chip clears; **the ○ sigils remain — permanently.** Confirmation per §8.3.6: the rows visibly change, a single 200ms **sky** pulse marks it as the *human's* commit, and a 20px in-raster footer row reads `Saved "45-Minute Run" to your library. 11 songs, 44:51.  ⟲ Undo` for 30s. | → IDLE |

**Alternative, if the human prefers no review gate:** B02 → `Assistant changes · Apply directly`. Step 6 then writes straight to Apple Music and step 11 becomes an entry in the Engraving rather than a review. **This is a setting about what webPod does with a result, not a permission the agent holds** — the agent's capabilities are identical either way. Default is `Review first`.

**What v2 got wrong here.** v2 ran this journey on an "Away Mandate" the human granted before leaving, and framed the un-mandated path as the agent being unable to commit. Both were fiction: the tool was always callable and always would have succeeded. Worse, the design implied to a user who had granted nothing that the agent therefore could do nothing — the most dangerous kind of false comfort. The draft is the real safeguard, and it works without pretending.

---

### J4 — Co-pilot: human is browsing, agent enriches
**Mode** Alternating (P4) · **Viewport** 1440×900 · **Screens** D01 / S06 → S07 / D05 · **States** `USER_ACTIVE` ⇄ `AGENT_ACTIVE`, alternating · **Success metric** the human never once wonders whether they or the agent moved something

**v3 reframing.** v2 called this "co-pilot" and gave it a simultaneous `CO_PILOT` state with converged orbits and a violet seam. Under the flag model that state is **structurally impossible**: a user interaction turns the flag off, a tool call turns it on, and the two cannot be true at once. What actually happens is **fast alternation**, and the 400ms fade-out decay (§8.3.3) is what makes that legible instead of a strobe. The journey is better for the correction — attribution is now unambiguous at every instant.

Context: human is scrolling Artists with the trackpad, looking for something to listen to. Agent has been told "help me find something I haven't played in a while."

| # | Actor | Action | Visible result | State |
|---|---|---|---|---|
| 1 | Human | trackpad scroll over the pod | S06 Artists scrolls. The halo pulses uniformly per detent, 0.7α (subdued FX — this is a trackpad, per HIG, and there is no contact patch to bloom around). Clicker ticks. Highlight walks down. | IDLE |
| 2 | Agent | `pod-read-screen` | Bezel pulses green, 220ms. Returns the 8 visible artist rows and the highlight index. **Flag flips on**; the ghost thumb fades in inside the wheel. | → `AGENT_ACTIVE` |
| 3 | Human | scrolls again | **Flag flips off**; the ghost thumb begins its 400ms fade. The halo pulses outside the wheel. **Only ever one light at a time, and never in the same place** — which is the honest picture, and needs no violet seam to explain it. The words `You: browsing Artists.` / `Me: filling in play counts.` wait in D03. | → `USER_ACTIVE` |
| 4 | Agent | writes to the right pane | **Flag on again**, the trail re-lights mid-fade. **L3 in force:** the **right pane** fills with per-artist context — `Last played 14 months ago · 41 plays all time · 2 albums you've never opened` — with a 1px green border. **The left list, the human's locus of control, is untouched.** | → `AGENT_ACTIVE` |
| 5 | Human | keeps scrolling | The highlight moves to a new artist. **The agent's pane write is invalidated, not queued**: it cross-fades out over 120ms and shows a 1px green skeleton for the new row. **Flag off.** | → `USER_ACTIVE` |
| 6 | Agent | `pod-read-screen` + pane write | New pane content, ~400ms behind the human. **The pane is always allowed to lag; never to lead.** Flag on. | `AGENT_ACTIVE` |
| 7 | Human | Center | Push into S07 Artist → Albums. **The agent's in-flight pane write for S06 is discarded outright** — the surface it was writing to no longer exists. Nothing half-rendered survives the transition. Flag off on the keypress. | `USER_ACTIVE` |
| 8 | Agent | `pod-queue-insert {itemIds:[3 tracks], position:"end"}` | Ungated (3 items, `end`). **D02 Sidecar Up Next** grows three rows from 0 height at 40ms stagger, each with a green left border and an ○ sigil. Queue badge 12 → 15. Because D02 is already visible on desktop, §8.8 steps 1 and 5 are skipped. Flag on. | `AGENT_ACTIVE` |
| 9 | Human | grabs the S14 scrub thumb | **Flag off on `pointerdown`**; the trail fades and the halo takes over. L1 (§8.2.6) arms: any call targeting the playhead will be deferred. *(v2's `solid sky` orbit is deleted — there is no lock state to render, and the absent orbit already says the human is in charge.)* | → `USER_ACTIVE` |
| 10 | Agent | `pod-skip {direction:"next"}` | **Target collision — both want the playhead. L1: the human wins.** The skip is deferred up to 2500ms. **No chip, no countdown, nothing inside the wheel** — the flag stays off, because a deferred call is not an action. | `USER_ACTIVE` |
| 11 | Human | holds the scrub for 3.1s | Lock exceeds 2500ms. **The skip is dropped.** A 4s in-raster footer row on S13 reads `Dropped a skip.` — without it the human is left wondering why the track did not change. B07 logs `○ deferred, then dropped`; the fuller `Dropped a skip — you were scrubbing.` waits in D03. The track does not change; the playhead is exactly where the human put it. | LOCK |
| 12 | Human | releases | Nothing to unwind: the flag is already off and stays off until the next tool call. The ghost thumb is already gone. **Simpler than v2's 350ms debounce plus a 3s quiet timer plus two state transitions — for identical observable behaviour.** | `USER_ACTIVE` |

**Why step 11 is still the most important row in this document:** the alternative — the agent's skip firing the instant the human lets go — would mean the human's carefully-placed playhead is destroyed 350ms after they finish placing it, by an action they had already forgotten was pending. Dropping is correct. Logging the drop is what makes dropping honest.

---

### J5 — Settings change via Expose Flip
**Mode** Human (P1), with an agent variant · **Viewport** 390×844 · **Screens** S13 → *flip* → B01 → B02 → *flip* → S13 · **Success metric** audio never interrupted, transport never unreachable, change visibly reflected on return

| # | Actor | Input | System response | Screen |
|---|---|---|---|---|
| 1 | Human | on S13, music playing | Wants shuffle by album, not by song. | S13 |
| 2 | Human | drag inward from the body's bottom-right corner | Pod's `rotateY` tracks the thumb 1:1 (180° over 240px). A specular line sweeps the leading edge. Front backlight ramps down to 20% as the screen turns away. **At the gesture's start, a 320×44 mini-transport detaches and docks into the shelf at y 200–244** — art thumb, title, ⏮ ⏯ ⏭, progress hairline. Audio unbroken. | flipping |
| 3 | Human | releases past 50% | Snaps over on a `gentle` spring (200/20, ~520ms). One low 90ms case-pivot thunk at −18dB. `medium` at 50%, `heavy` on settle. **B01** in engraved anodised aluminium: incised type, mirror-finish upper third, serial-number etch at the bottom. **Material, not theme.** | → B01 |
| 4 | Human | rotate 1 detent, Center | `Playback` highlighted, push into B02. Rows carry **physical throw-switches** on the right, not iOS toggles — this is the back of a device. | → B02 |
| 5 | Human | rotate 1 detent | `Shuffle · Songs` highlighted. | B02 |
| 6 | Human | Center | **Cycles in place**, no push: `Songs` → `Albums`. The switch physically throws with a 90ms travel; the detent clicks; the value label cross-fades. The live queue reshuffles by album **immediately** — settings are not staged. | B02 |
| 7 | Human | Menu ×2 | B02 → B01 → **flip back to front**, restoring S13 and its exact prior mode. The mini-transport dissolves back into the pod. | → S13 |
| 8 | — | on arrival | The S13 metadata region's shuffle glyph is now the album-shuffle variant and it **pulses sky once, 200ms** — the actor pulse of §8.3.6, marking it as the human's change. The change is confirmed on the surface the human came from, not just on the one they changed it on. | S13 |

**Agent variant (steps 2–7 collapse to two tool calls):** `pod-set-setting {key:"shuffle", value:"albums"}` — ungated, because shuffle is trivially visible and trivially reversible. The tool performs an **implicit flip**: the pod turns over on its own at full 520ms duration (never faster — the human must see it), lands on B02, the switch **throws itself** with the same 90ms travel in green, a 20px in-raster footer row reads `Shuffle is by album now.  ⟲ Undo`, it dwells 900ms, and flips back. **This journey is the origin of the Show-Your-Work rule (§8.8), which the chrome cut promoted from a special case to the governing rule for every agent mutation.** S25 holds the words. B07 logs `○ 14:52 — set shuffle = albums`. **If the human touches the pod during the 900ms dwell, the auto-flip-back is cancelled** and they are left on B02, in control.

**Accessibility-setting variant:** `pod-set-setting {key:"reduceMotion", value:true}` is **not confirmed and not gated** — it runs, like every other call. What protects the human is Show-Your-Work at its most literal: the pod flips to B03, the switch throws itself in view, the whole device's motion visibly changes, and a footer row reads `Reduced Motion is on.  ⟲ Undo` for 30s. **An accessibility setting changing is the most self-announcing event in the product** — the animation model of the entire device alters in front of you. A modal asking first would have added nothing except a false impression that the agent needed leave to try.

---

### J6 — Failure paths
**Mode** all · **Success metric** the human always knows *what broke*, *what still works*, and *what to press* — in three lines or fewer

#### J6a — A destructive agent action lands, and is undone

**v4 reframing.** v2 ran this as "the agent's permission request is denied". v3 ran it as "webPod's own confirm dialog is cancelled". **Both were wrong in the same way:** they staged a moment where the agent pauses and the human answers. That moment does not exist. The call arrives already made.

| # | Actor | Action | Response | State |
|---|---|---|---|---|
| 1 | Agent | `pod-queue-clear {keepCurrent:true}` | **The call executes.** There is nothing to gate (§8.5 clause 1). The flag flips on; the ghost thumb fades in inside the wheel. | → `AGENT_ACTIVE` |
| 2 | — | Show-Your-Work | The device **navigates to S17 Up Next** at full transition duration — the human watches it travel — and the 14 rows **collapse upward at 30ms stagger, in view.** The `Now` row stays. Silent: no clicker, no vibration (§4.9). | `AGENT_ACTIVE` |
| 3 | — | receipt | A 20px in-raster footer row, panel ink: `Removed 14 songs.  ⟲ Undo` — held for **12s**, matched to the collapse so the two read as one event. Dwell 900ms, then the device returns to S13. | `AGENT_ACTIVE` |
| 4 | Human | notices, presses `⟲ Undo` within 12s | **The flag flips off on the keypress**; the ghost thumb begins its 400ms fade and the halo blooms. The 14 rows expand back in at 30ms stagger. Footer row: `Put it back.` Haptic: `success` — this was the human's action and it worked (§4.9). | → `USER_ACTIVE` |
| 5 | — | log | B07 holds two lines: `○ 15:04 — cleared Up Next · 14 songs` and `● 15:04 — undid it`. **Both actors, same log, same format.** | `USER_ACTIVE` |
| 6 | Agent | — | The tool's return value already reported success — because it succeeded. S25 shows `Cleared Up Next — 14 songs.` and, beneath it, `Undone by the user.` The agent learns it was reversed the same way it learns anything: by reading. | `USER_ACTIVE` |

**If the human was away.** Nothing waits. The queue clears, the receipt appears, the 12s undo window elapses, and the change stands — recoverable from B07 for the rest of the session, because the last 20 mutations stay undoable there indefinitely (§8.4). **This is the honest trade and it should be stated to the designer plainly:** an unattended destructive call *does* take effect. What protects the human is that it is visible, logged, and reversible — not that it was blocked, because blocking was never on offer.

**Why this is better than either earlier version.** v2 and v3 both implied a gate. A user who saw those dialogs would reasonably conclude that an assistant *cannot* clear their queue without asking — which is false, and dangerous precisely because it is reassuring. v4 tells the truth: it can, it will, you will see it, and you can put it back.

#### J6b — Offline mid-playback
| # | Trigger | Response | State |
|---|---|---|---|
| 1 | Buffer underrun + `navigator.onLine === false` | Audio finishes the buffered ~8s rather than cutting mid-word. | → **DISCONNECTED** |
| 2 | — | A `☁︎/` slashed-cloud chip appears at the panel's top-left. Device faults render on the panel, not the wheel (§8.3.3), so the chip is the whole signal. All catalogue tools **unregistered**; `toolchange` fires so the agent learns immediately rather than by failing. | DISCONNECTED |
| 3 | — | **S27** if playback actually stopped: `You're offline.` / `214 downloaded songs still play.` / `Play downloads` (primary) · `Retry` (secondary). If a downloaded track was playing, **no S27 at all** — just the chip. Do not interrupt working audio to announce a problem it does not have. | S27 |
| 4 | — | Streaming-only rows across every list **dim to 40% and gain a `☁︎` glyph. They are never hidden.** A library that appears to have been deleted is a far worse failure than one that is visibly unavailable. | all lists |
| 5 | — | S12 Search auto-switches its scope chip to `Downloaded only` and says so: `Searching downloads only.` | S12 |
| 6 | Human | `Play downloads` | Queue rebuilt from downloaded tracks. Playback resumes. | → S13 |
| 7 | — | reconnect | Chip cross-fades out. `toolchange` re-registers catalogue tools. Toast: `Back online.` Queued mutations from the offline period are presented as **staged work requiring a human commit** — never replayed silently. | → prior state |

#### J6c — Apple Music auth expired
| # | Trigger | Response | State |
|---|---|---|---|
| 1 | 401 from any MusicKit call | One silent token-refresh attempt. If it succeeds, the human never learns anything happened — and that is correct. | — |
| 2 | Refresh fails | **DISCONNECTED**. Downloaded audio continues. | → DISCONNECTED |
| 3 | — | **S27 on the FRONT face** (never behind the flip, per §6.3): `Apple Music needs you to sign in again.` / `Downloads keep playing.` / `Sign in` (primary, opens the OAuth popup from a real user gesture) · `Later` (secondary, dismisses to a persistent 11px chip). | S27 |
| 4 | Agent | any catalogue tool | Refused, **retryable**, with a cause the agent can relay: `Apple Music sign-in expired — the person needs to sign in again.` S25 surfaces it verbatim so an away human returns to a legible explanation rather than a stalled task, and S27 carries the same cause on the front panel. | DISCONNECTED |
| 5 | Human | `Sign in` | OAuth popup. On success: backlight flashes to 120% for 90ms (the same "it's alive" beat as J1 step 5 — the product uses one gesture for one meaning), tools re-register, the previously-playing track resumes **at its exact position**, and staged offline mutations surface for review. | → prior state |
| 6 | Human | `Later` | Dismisses to a chip. Full browse of downloads, no nagging, no repeat modal. The chip is the only reminder, and it is enough. | DISCONNECTED |

#### J6d — Playback failure on a single track (the quiet one)
| # | Trigger | Response |
|---|---|---|
| 1 | A track 404s or is region-restricted | **Auto-advance to the next queue item after 400ms.** Do not stop the music for one bad row. |
| 2 | — | The failed row in S17 dims to 40% with a `✕` and a `▪` system sigil (the *system* skipped it, not the human and not the agent — attribution matters even for machines). |
| 3 | — | In-raster footer row, 11px, non-modal, 4s: `"Vienna" isn't available here — skipped it.` No dialog. No sound. No orbit change — the *system* skipped it, not the agent. |
| 4 | — | Three consecutive failures → **S27**: `Something's wrong with playback.` / `Skipped 3 songs in a row.` / `Reload` · `Play downloads`. Escalation is by count, not by severity. |

---

## 10. System states matrix

Seven states × eight priority screens × **two colourways**. Mode is an explicit axis: every cell must hold on a **white polycarbonate pod with a pale backlit LCD in a bright room** as well as on a black pod in a dark one. Copy in `code` style is **final and shippable** — set it as written.

### 10.0 The four mode rulings that apply to every screen

Resolve these once, globally, so the per-screen tables only carry genuine deltas.

| # | Ruling | Why |
|---|---|---|
| **M1** | **Dimming is toward the ground, and the value differs.** A de-emphasised row is 45% in dark, **52% in light**. Ink on a pale ground loses legibility faster than light type loses it on black, so the same opacity is not the same emphasis. | Perceptual, not arithmetic. Applies to every `☁︎`, locked, and unavailable row in the product. |
| **M2** | **No glow in light mode, anywhere.** Every FX that is an outer glow, a screen blend or a bloom in dark becomes a **saturated solid stroke with a 1px darker inner edge**, or a tinted shadow. Idle FX opacity floors rise from 22% to **45%**. | Nothing can out-emit a white body in a bright room (§4.8). |
| **M3** | **Scrims invert.** `black / 40%` becomes `white / 62%` **plus a 1px `black / 12%` hairline** on the floated element, or it dissolves into the page. | A pale card on a pale ground has no silhouette. |
| **M4** | **The light-mode panel ground's chroma is capped at 0.010 and its hue pinned to 105.** The agent's green-400 sits at hue 149, chroma 0.18. | **Caught late and it matters:** the light panel's backlit LCD tint is *green*, and so is the agent. Separating them by hue alone would fail. An 18× chroma separation makes them unmistakable — the ground is a barely-tinted grey, the agent is saturated. Never let the ground's chroma drift up "to make it feel more like an LCD". |

---

### 10.1 S13 — Now Playing *(priority 1)*

| State | Dark colourway | Light colourway |
|---|---|---|
| **Loading** | Art frame is a 1px light-bordered empty box with a `white / 18%` shimmer sweep (1.5s); metadata as three `white / 12%` bars at true row heights so **nothing reflows**. Progress bar present but flat. `aria-busy="true"`, sr-only `Loading the song.` | Shimmer becomes a `black / 8%` sweep; bars are `black / 10%`. **The art frame gains a 1px `black / 12%` edge** — a pale empty box on a pale ground has no silhouette and reads as a rendering failure. |
| **Empty** | Unregistered from the menu when `nowPlaying === null`. Via a stale deep link: `Nothing is playing.` / `Shuffle Songs` · Menu returns. | Same copy. **The button must be a filled ink button, not an outline** — a 44px outline button on a pale ground is too weak to read as the primary action. |
| **Error** | `✕` in ink at 40% over the art frame. `Couldn't play "Vienna".` / `The next song is queued.` / auto-advances in 400ms, no button. Three in a row → S27. | Same copy and timing. **`✕` at 55%, not 40%** (M1). Crimson renders as a *stroke* here, per §8.3.5. |
| **Offline** | `☁︎/` chip, top-left, filled and glowing. Streaming track: halts, `You're offline.` / `214 downloaded songs still play.` / `Play downloads`. Downloaded track: **chip only, no interruption.** | Chip becomes a 1px outline + 6% tint fill with ink text, 4.5:1. Behaviour and copy identical. |
| **Permission-denied** | Lock glyph at 40% over the art. `Playback needs an Apple Music subscription.` / `Learn more` · `Browse anyway` | Lock at 55%. Same copy. |
| **Agent-active** | **Ghost thumb tracing inside the wheel** (r 76–120), never within r 76; 1px inset green border on the panel; a green scrim at 14% on the changed field (art / progress / dots / volume). | Trail is a **green-tinted darkening** of the band at α 0.18 — no glow. Inset border is a **2px solid green stroke**. Field scrim rises to **10% multiply**. |
| **Success-confirmation** | **No toast.** S13 confirms by being correct: art cross-fade, plus a single 200ms **actor pulse** — sky if the human, green if the agent (§8.3.6). Ratings are the exception, with a 20px in-raster footer row `Rated 4 stars.` for 1.4s because the dots are small. | Identical mechanism, but **the pulse is a saturation-and-darkening pulse, not a brightness pulse** — brightening a pale field reads as nothing happening. |

**Highest light-mode risk:** the **artwork bloom**. It flips from `screen` α 0.35 to `multiply` α 0.22 +12% saturation (§4.8), so the art casts a coloured shadow into the shelf rather than emitting light. Get this wrong and the hero screen's entire atmosphere is grey mush. Design it first, in light, before dark.

---

### 10.2 S03 — Main Menu *(priority 2)*

| State | Dark colourway | Light colourway |
|---|---|---|
| **Loading** | Menu rows render **immediately** — they are static and known. Only counts and the right pane shimmer. **Never block a known-static menu on a network call.** sr-only `Loading your library counts.` | Identical. Shimmer polarity per M2. |
| **Empty** | All rows present, empty slices at 45% with a `0`. Footer 11px: `Nothing in your library yet. Try Radio, or search for anything.` `Shuffle Songs` → `Shuffle from Apple Music`. | Same copy; dim to **52%** (M1). |
| **Error** | Rows stay live and navigable. Right pane: `Couldn't load your library.` / `Retry`. Counts render `—`, never `0` — an unknown count must not read as an empty library. | Identical. |
| **Offline** | `☁︎/` chip. `Radio` and catalogue search dim with `☁︎`. A **`Downloads` row is inserted at position 2** and lit. Footer: `Offline. 214 songs are downloaded.` | Identical behaviour; chip and dim per M1/M2. |
| **Permission-denied** | `Radio` and `Shuffle from Apple Music` dim with a lock. Footer: `Browsing only — a subscription is needed to play.` | Identical. |
| **Agent-active** | Highlight walks at 45ms/row (≤ 400ms); the ghost thumb traces the equivalent arc inside the wheel; **silent, no haptic** (§4.9). **Right pane gains a 1px green border while the agent writes to it (L3).** | Border becomes a **2px green stroke**. Everything else identical. |
| **Success-confirmation** | The push transition is the confirmation. Returning from a mutation pulses the affected row's left edge once, 200ms, in the actor's colour. | Same, as a darkening pulse (see S13). |

**Highest light-mode risk:** **the split-pane divider.** On black, the luminance difference between list and pane separates them for free. On a pale ground it vanishes. **Ruling: light mode adds a 1px `black / 10%` vertical rule at the column boundary, and the right pane's ground drops 3% in lightness below the left column's.** Two cheap cues, because one is not enough.

---

### 10.3 D01 — Desktop Shell *(priority 3)*

| State | Dark colourway | Light colourway |
|---|---|---|
| **Loading** | Pod assembles first (it is CSS and needs nothing); sidecar renders its rail plus a skeleton at final row heights. The two never wait on each other. | Identical. |
| **Empty** | Sidecar defaults to **D03 Agent**, not Up Next, when the queue is empty: `Nothing queued yet.` / `Play something, or ask me to.` | Identical. |
| **Error** | Pod and sidecar fail **independently**. A sidecar failure shows `Couldn't load Up Next.` / `Retry` in the sidecar only; the pod stays fully operable. Never take the instrument down for a panel. | Identical. |
| **Offline** | `☁︎/` chip on the pod. Sidecar header gains an 11px neutral rule and `Offline — showing downloads.` D05 filters to downloaded and says so in its column header. | Identical; chip per M2. |
| **Permission-denied** | Working surfaces shown; unavailable ones grey out in the rail with a lock and a tooltip naming the reason. | Identical. |
| **Agent-active** | Ghost thumb traces the desktop wheel's band (r 114–180). **Sidecar auto-switches to D03 on the first tool call of a burst — once per session, never again** (helpful the first time, patronising the fourth). Tool chips stream with expandable raw-JSON inspectors. | Trail as a tinted darkening. Sidecar's left edge picks up a **2px** green inner rule instead of 1px, because Liquid Glass over a pale page has less contrast to spend. |
| **Success-confirmation** | A 3s green-to-neutral fading strip along the sidecar's top edge plus a D06 Activity entry. **No modal ever appears on desktop for a success.** | Strip becomes a 2px solid stroke fading to neutral. |

**Highest light-mode risk — and the single biggest light-mode risk in the product: a white pod on a white page has no silhouette.** **Ruling: the light-mode desktop page ground is not white.** It is a warm light grey `oklch(0.94 0.004 90)`, and the pod carries a longer, softer contact shadow (`0 24px 60px black/14%`) plus a 1px `black / 8%` body edge. The object must read as an object sitting *on* a surface, not as a cut-out. Mobile inherits the same page ground. **If this is got wrong, the light colourway fails entirely and no other ruling can rescue it.**

---

### 10.4 B01 — Settings back plate *(priority 4)*

| State | Dark colourway | Light colourway |
|---|---|---|
| **Loading** | **Never loads.** All settings are local (`localStorage` + IndexedDB) and render on the same frame the flip completes. A back plate that spins is a broken illusion. | Identical. |
| **Empty** | Never empty — eight fixed rows. | Identical. |
| **Error** | A failed setting write: that row's switch **springs back** with a 90ms recoil and an 11px etched note beneath it: `Couldn't save that. Try again.` | Identical. |
| **Offline** | Fully functional — every setting is local. `Account & Apple Music` gains a `☁︎` and its sublabel reads `Offline`. **A feature: the back of the device always works.** | Identical. |
| **Permission-denied** | `Account & Apple Music` sublabel `Signed out`. **The row stays lit and navigable** — the route to fixing it must never be dimmed. | Identical. |
| **Agent-active** | Ghost thumb traces the wheel band exactly as on the front — the wheel is physical hardware and reads identically whichever face is showing, which is what makes the agent channel face-invariant. An agent-driven arrival flashes the landed row's engraving with a green specular sweep, 300ms. | Sweep becomes a green *ink* wipe across the incised type, 300ms — no specular, because a bright room's steel already carries the specular. |
| **Success-confirmation** | **Physical only:** the switch throws, the detent clicks, the value label cross-fades. **No toast on the back face, ever** — the mechanism is the receipt. | Identical. |

**Light-mode ruling — and it is a gift:** the real 5G's back was **polished stainless steel in both colourways**. The back face is therefore **mode-invariant**: same material, same dark-incised type, same mirror gradient. Only the *room it reflects* changes — deep grey vs. bright white. Zero extra design work, and it reinforces R4 ("the back is a different material, not a different theme") in both modes at once. The one thing to verify: **incised type must clear 4.5:1 against steel under the bright-room reflection**, which is the harder of the two cases.

---

### 10.5 S25 — Agent Console *(priority 5)*

| State | Dark colourway | Light colourway |
|---|---|---|
| **Loading** | *(connecting)* Three green dots pulsing at 22%, and `Connecting.` | Dots at 45% (M2). |
| **Empty** | `Nothing to report.` / 11px `Ask me to find something, build a playlist, or queue a few songs.` + three tappable example prompts, each ≤ 40 chars. | Identical. |
| **Empty — no WebMCP** | **S25 is not registered, the `A` shortcut does not exist, and the Extras row is absent.** No teaser, no "coming soon", no dimmed tab. Per G8 the product is complete without it. | Identical. |
| **Error** | *(tool threw)* The chip takes a **crimson stroke** and a `✕` with an expandable one-line cause. Transcript: `That didn't work — "Vienna" isn't in the catalogue here.` Raw error lives in the expanded chip, never in the transcript. | Identical — crimson-as-stroke reads correctly on both grounds (§8.3.5). |
| **Offline** | Header `Offline — I can only work with your downloads.` Catalogue chips grey with `☁︎`. | Identical; dim per M1. |
| **Undone** | The chip settles as normal, then gains an 11px `Undone by the user.` beneath it. **Chips persist in the transcript, and a completed call is never retro-labelled as refused** — it succeeded, and was then reversed. *(v4: replaces v2's "Permission-denied" and v3's "Cancelled at confirmation". Nothing is denied and nothing is confirmed; §8.5.)* | Identical. |
| **Agent-active** | The active chip carries a travelling green underline. **A Stop button sits in the console header, always, from the first frame.** Transcript streams in the agent's voice. | Underline is a 2px solid stroke that fills left-to-right rather than glowing. |
| **Success-confirmation** | The chip settles to a solid green check **with the outcome inline** — `Queued 3 songs.` — and an `Undo` link for 30s. Note this is the **one place green may accompany a success**, because here green means *"the agent did it"*, which is exactly what the chip is for. | Identical. |

**Highest light-mode risk:** an 8-row transcript at `compact` density in ink on a pale ground is a wall of text where dark mode had luminance-grouped bubbles. **Ruling: light mode groups turns with a 1px `black / 8%` left rule per turn rather than a background fill** — fills at this density on a pale ground muddy fast.

---

### 10.6 S08 — Album → Tracks *(priority 6)*

| State | Dark colourway | Light colourway |
|---|---|---|
| **Loading** | **8 skeleton rows at exact `compact` height (26px)** so the list cannot reflow, plus a shimmering art frame in the right pane. Track numbers render immediately when known from the parent screen. | Shimmer polarity per M2; art frame edge per S13's ruling. |
| **Empty** | `Nothing here plays in your region.` / `Search for it` · `Go to artist` | Identical. |
| **Error** | Rows stay skeletons. Right pane `Couldn't load this album.` / `Retry`. **Menu still works — an error never traps the human on a screen.** | Identical. |
| **Offline** | Downloaded rows lit with a `⤓`; streaming rows at 45% with `☁︎`. Header sublabel `4 of 12 downloaded`. | Dim to 52% (M1). |
| **Permission-denied** | All rows lit and browsable; Play produces the S13 subscription state rather than failing silently. **Browsing is never gated.** | Identical. |
| **Agent-active** | Highlight walks; the read row carries a green scrim. In `REVIEW_PENDING`: added rows green-tinted **8%** with `+`; removed rows struck in **ink** with `−`, still visible; moved rows `↕` with a ghost at the old index; a 28px in-raster footer `Review 3 changes · Commit · Discard`. | Staged tint rises to **12% multiply**. Everything else identical. |
| **Success-confirmation** | The row's `+` rotates into a `✓` in **panel ink** over 200ms, a single actor pulse fires, and a 20px in-raster footer row reads `Added to your library.  ⟲ Undo` for 30s. | Identical mechanism; pulse as darkening. |

**Note on the two crimsons (§8.3.5):** a staged removal is struck in **ink**, not crimson, because it is a *proposal* and nothing has been destroyed yet. Crimson-as-stroke is reserved for removals that have actually happened and for denial receipts. This is not a contradiction of §8.3.5 — it is the boundary of it, and it must be honoured in both colourways.

---

### 10.7 S12 — Search *(priority 7)*

| State | Dark colourway | Light colourway |
|---|---|---|
| **Loading** | Field keeps focus and stays typeable. 6 skeleton rows under a **live** group header (`Your library` / `Apple Music`) so grouping is legible before content is. Debounce 280ms. | Identical. |
| **Empty — no query** | `Search your library and all of Apple Music.` + `Recent` (last 5, Center to re-run) + `Try:` with three 11px suggestions. | Identical. |
| **Empty — no results** | `Nothing for "daydream nashun".` / `Check the spelling, or search Apple Music instead.` + a scope chip. **Always offer a widened scope before offering nothing.** | Identical. |
| **Error** | `Search isn't responding.` / `Retry` · `Search downloads`. **The typed query is preserved verbatim.** | Identical. |
| **Offline** | Scope chip locks to `Downloaded only` with `Searching downloads only.` The `Apple Music` group header renders with `☁︎` at 45% **rather than disappearing** — the human must see that a whole category exists and is unavailable. | Dim to 52% (M1). |
| **Permission-denied** | Catalogue results shown and browsable with a lock on Play: `Preview only — a subscription is needed to play.` | Identical. |
| **Agent-active** | **The flagship moment.** The agent types into the human's real field at 24ms/char; `:tool-form-active` gives a green inner glow; `:tool-submit-active` pulses the submit control; results render grouped as normal. | Glow → **2px green stroke + 6% green fill** on the field; submit pulses by stroke weight (2px → 3px), not by luminance. |
| **Success-confirmation** | Results appearing **is** the confirmation. Agent-run searches leave an 11px green `run by the agent` label on the group header until the next human keystroke. | Identical. |

**Highest light-mode risk — and M4 exists because of this screen.** The light panel ground is a faintly green-tinted LCD and the agent's colour is green; a green-glowing field on a green-tinted ground is invisible. **Ruling: ground chroma capped at 0.010 / hue 105, agent at chroma 0.18 / hue 149 — an 18× chroma separation.** Verify on this screen specifically, with the field in its `:tool-form-active` state, before signing off the light palette.

---

### 10.8 S17 — Up Next *(priority 8)*

| State | Dark colourway | Light colourway |
|---|---|---|
| **Loading** | The `Now` row renders first (already known from S13) with its rule beneath; the rest skeleton at 26px. | Identical. |
| **Empty** | `Nothing up next.` / `When this song ends, I'll keep going with a station.` + `Start a station` · `Turn that off` (flips to B02 autoplay). **Name the default behaviour rather than letting a blank list imply silence.** | Identical. |
| **Error** | `Couldn't load what's next.` / `Retry`. The `Now` row and all transport keep working. | Identical. |
| **Offline** | Undownloaded rows at 45% with `☁︎`, **skipped on arrival visibly** — the row greys and takes a `▪` system sigil as it is passed. Header `9 of 15 will play offline.` | Dim to 52% (M1). |
| **Permission-denied** | Queue browsable; Play shows the S13 subscription state. | Identical. |
| **Agent-active** | Inserted rows expand from 0 height at 40ms stagger with a green left border and an `○` sigil; the queue badge counts up; the ghost thumb traces inside the wheel. Staged removals stay visible, struck in ink, until commit. | Left border becomes a **3px solid green stroke** (a 1px stroke on a pale row edge disappears). |
| **Success-confirmation** | A 20px in-raster footer row: `Queued 3 songs.  ⟲ Undo` for 30s. For `pod-queue-clear`: rows collapse upward at 30ms stagger and the footer reads `Removed 14 songs.  ⟲ Undo` for **12s**, matched to the animation so the two read as one event. | Identical. |

**Highest light-mode risk:** the `Now` row's separation from the queue. Dark mode gives it a brighter ground; light mode cannot go brighter than the ground. **Ruling: light mode marks `Now` with a 2px ink left bar and a semibold label, not a fill.**

---

### 10.9 Sign-off gate

No priority screen is approved until it has been reviewed **in both colourways, in the same sitting, at the same size**, in all seven states, plus the §8.3.7 #4 acceptance test (hue channel forced to a single value, desaturated to greyscale, actor identity still legible). A screen that has only been designed in dark is **not designed**.

---

## 11. Copy deck

### 11.0 Voice

**Warm, confident, specific. Never cutesy.** Six rules:

1. **Name the concrete thing and the exact number.** `Queued 3 songs.` not `Added to queue!`
2. **No exclamation marks. Anywhere.** Not one, in the entire product.
3. **State consequence before remedy.** `You're offline. 214 downloaded songs still play.` — reassure, then instruct.
4. **Never apologise twice, and never apologise for the human's decision.** A denial gets `Understood.`, not `Sorry!`
5. **Sentence case everywhere**, including buttons. Title Case is 2005 chrome and we are not recreating the *typography* of 2005 dialogs, only the object.
6. **No em-dash-joined marketing clauses, no "seamlessly", no "effortlessly", no "magic", no "just".**
7. **Never celebrate an ordinary success.** Success copy states what is now true and offers the undo. It does not congratulate. Failure gets the colour and the emphasis; success gets a sentence (§8.3.6).
8. **Never name a colour in copy.** v1's onboarding said "you'll see it in blue" — blue is now the human. Point at **where** a thing is ("around the edge", "at the top of the screen"), never at what colour it is. Colour is the last identity channel (§8.3.7 #4) and copy must not promote it.

### 11.1 Menu labels

| Screen | Strings |
|---|---|
| S03 Main Menu | `Music` · `Radio` · `Music Videos` · `Up Next` · `Extras` · `Settings ⟳` · `Shuffle Songs` · `Now Playing` |
| S04 Music | `Playlists` · `Artists` · `Albums` · `Songs` · `Genres` · `Composers` · `Search` · `Cover Flow` |
| S05 Playlists | `Made for You` · `Recently Added` · `Favourites Mix` · *(user playlists)* · *(drafts, suffixed)* `⚑ Draft` |
| S18 Radio | `Apple Music 1` · `Apple Music Hits` · `Apple Music Country` · `Made For You` · `Stations by Genre` |
| S20 Extras | `Clock & Sleep Timer` · `Brick` · `Agent Console` |
| B01 Settings | `Playback` · `Display & Feel` · `Agent & Permissions` · `Account & Apple Music` · `About` · `The Engraving` · `Shortcuts` · `Legal & Reset` |
| B02 Playback | `Shuffle: Off / Songs / Albums` · `Repeat: Off / One / All` · `EQ` · `Sound Check` · `Crossfade` · `Volume Limit` · `Autoplay a station when the queue ends` · `Assistant changes: Review first / Apply directly` |
| B03 Display & Feel | `Backlight` · `Brightness` · `Clicker: Off / Sound / Haptic / Both` · `Dynamic shimmer: On / Off` · `Reduce Motion` · `Increase Contrast` · `Row Density: Compact / Medium / Airy` · `Theme: Light / Dark / System` |
| B04 Assistant | `Tools exposed` *(read-only list)* · `Recent activity` · `Expose tools to assistants` |
| Empty-slice suffix | `Playlists 0` · `Artists 0` — the count, not the word "empty" |
| Now Playing modes | `Volume` · `Scrub` · `Rating` · `Lyrics` |

### 11.2 Buttons and controls

| Context | String | Note |
|---|---|---|
| Auth | `Sign in with Apple Music` | Apple's required wording |
| Auth retry | `Try again` | Never `Retry?` |
| Generic recovery | `Retry` | One word, always this word |
| Offline primary | `Play downloads` | |
| Irreversible confirm *(B08 only, human-only)* | The **verb**, never `Allow`: `Sign out` · `Reset everything` | Two buttons in the whole product. Grant vocabulary (`Allow`, `Deny`, `Permit`) implies a permission model that does not exist (L0); the verb says what will happen. **No destructive *agent* action has a confirm button, because none has a confirm** (§8.5). |
| Cancel it | `Cancel` | Left position, same size and weight. Menu also disarms. |
| Staged work | `Commit` / `Discard` | Not "Save"/"Cancel" — these are staged changes, and the words should say so |
| Undo | `⟲ Undo` | Never `Undo?`, never a countdown in the label. Lives as a **20px in-raster footer row on the surface that changed** (§8.7), never as a floating pill. |
| Stop the agent | `Stop` | Never `Cancel`. Stop is a verb about the agent; Cancel is about a dialog. |
| Flip back | `Front` | On the reduced-motion chip |
| Empty queue | `Start a station` / `Turn that off` | |
| Destructive human | `Clear Up Next` · `Sign out` · `Reset All Settings` | Reset keeps Title Case — it is a literal 2005 string and the one place the reference is worth the inconsistency |
| Double-confirm reset | `Reset everything` | The second press's label differs from the first, so muscle memory cannot complete it |
| Permission fix | `Change this in Settings` | |
| Subscription | `Learn more` / `Browse anyway` | |
| Assistant exposure | `Expose tools to assistants` *(switch)* | Describes what webPod does — registers tools — not what the assistant is permitted to do. |

### 11.3 Agent voice — S25 (mobile panel) and D03 (desktop sidecar)

**These strings no longer render ambiently.** The persistent status line was cut (§8.7); the agent's ambient channel is now the ghost thumb inside the wheel, which carries no text at all. Everything below lives in **S25 / D03**, which the human summons deliberately — one gesture on mobile, always-visible on desktop. Two exceptions render on the panel without a gesture, because they are not agent speech: **webPod's own confirmation dialogs** (§11.4) and **device faults** (§11.5).

**Voice** — first person singular. Present tense in flight, past tense on completion. Names the object and the count. **Never** "I'll try", "Let me", "Working on it", "Great question", or any apology beyond one word. Target ≤ 64 characters (one line in the 320-wide panel); hard cap two lines.

| Situation | String |
|---|---|
| Idle | `Standing by.` |
| Idle after work | `Done. Standing by.` |
| Idle, staged work pending | `2 changes waiting for you.` |
| Thinking, no tool in flight | `Working out the running order.` |
| Reading | `Reading the screen.` |
| Reading beyond the viewport | `Reading the whole list — 214 rows.` |
| Searching | `Searching for "uptempo indie rock 150 bpm".` |
| Navigating | `Opening Playlists.` · `Moving down to row 15.` |
| Flipping | `Turning the device over to Settings.` |
| Playing | `Playing "Aims" by Vienna Teng.` |
| Queuing | `Queuing 3 songs after this one.` |
| Skipping | `Skipping to "Bad Blood".` |
| Volume | `Turning it down to 30.` |
| Building | `Built a 45-minute run playlist — 11 songs. Review when you're ready.` |
| Committed | `Saved "45-Minute Run" to your library. 11 songs, 44:51.` |
| Setting changed | `Done. Shuffle is by album now.` |
| Waiting on the human's input | `Waiting for you.` |
| Dropped a call after the wait | `Dropped a skip — you were scrubbing.` |
| Co-pilot, two lines | `You: browsing Artists.` / `Me: filling in play counts.` |
| Co-pilot, catching up | `Me: catching up.` |
| Declined by webPod (rate limit, Hold, missing subscription) | `I can't do that right now — the device is locked.` |
| Tools withdrawn mid-task | `Those controls just went away — the device is locked.` |
| Cancelled at a confirmation | `Cancelled — the queue is unchanged.` |
| Stopped by the human | `Stopped. I'll wait 20 seconds.` |
| Rate-limited | `Slowing down — I can act again in 6 seconds.` |
| Hold engaged | `Locked. Nothing can change the device — including me.` |
| Offline | `Offline — I can only work with your downloads.` |
| Auth expired | `Apple Music sign-in expired — the person needs to sign in again.` |
| Draft left for review | `That's a draft until you commit it.` |
| Human took over mid-task | `You've got it.` |
| Staged work expired | `Discarded the draft playlist — it sat for 30 minutes.` |
| Tool failed | `That didn't work — "Vienna" isn't in the catalogue here.` |
| Introduction, one time only *(in-raster chip, not S25)* | `An assistant can use this device too. You'll see its light around the edge.` |

### 11.4 Destructive-action copy

**There are no confirmation dialogs in agent flows** (§8.5). What a destructive agent action produces is a **receipt with an undo**, in panel ink, in an in-raster footer row on the surface that changed.

| Action | Footer row *(20px, panel ink, 30s)* |
|---|---|
| Queue cleared | `Removed 14 songs.  ⟲ Undo` *(12s, matched to the collapse animation)* |
| Queue added to | `Queued 3 songs.  ⟲ Undo` |
| Added to library | `Added to your library.  ⟲ Undo` |
| Playlist committed | `Saved "45-Minute Run". 11 songs, 44:51.  ⟲ Undo` |
| Playlist edited | `Updated "Road Trip". 4 added, 6 removed.  ⟲ Undo` |
| Volume limit set | `Volume limited to 60%.  ⟲ Undo` |
| Reduced Motion turned on | `Reduced Motion is on.  ⟲ Undo` |
| Draft awaiting review | `Review 3 changes · Commit · Discard` *(28px, persists)* |

**Identical strings for either actor.** The receipt describes what is now true; it never names who did it. Attribution is the orbit, the row sigil (● / ○ / ▪) and the Engraving — never the sentence.

#### The two irreversible confirms — human-only, B08, in-place

| Step | `Sign out` | `Reset All Settings` |
|---|---|---|
| Resting row | `Sign out` | `Reset All Settings` |
| Armed (first Center press) | `Sign out of Apple Music?` / `Downloads stop playing. Your library stays in your account.` | `Reset everything?` / `Everything on the back of the device goes back to how it shipped. This also clears the Engraving, so nothing here stays undoable. Your music isn't touched.` |
| Commit label (second press) | `Sign out` | `Reset everything` |
| Disarm | Menu, or 8s of no input | same |

**No actor sub-line on either. No tool exists for either.**

#### Deleted from v1–v3, with reasons

| String | Why it goes |
|---|---|
| `Allow the agent to add "Aims" to your library?` | Confirming a one-song, undoable add trains people to dismiss dialogs unread. |
| `Deny` · `Allow once` · `Allow this session` · `Always allow` | Grant vocabulary for grants that never existed (L0). |
| `The agent wants to remove 14 songs from your queue.` | **The agent does not want; it did.** By the time webPod could render this sentence, the call had already arrived. |
| `Requested by the assistant.` *(v3 sub-line)* | v3's attempt to keep the card honest by labelling it. The card itself was the problem. |
| `Clear Up Next?` *(as a card, either actor)* | Deleted. Clearing is undoable; it now happens and offers `⟲ Undo`. |
| `Let the agent work while you're away?` | Away Mandate, deleted (§8.5). |
| `You said no to this a moment ago.` | Policed a nag cooldown for a consent model that does not exist. |
| `Understood — I left your queue alone.` | Implies the agent sought and was refused leave. |

### 11.4b Back-plate engraving

The engraved block at the foot of B01. **v3 correction: the v2 line `MCP-2026-A · 18 tools · 5C4B 9A11` is wrong and must not ship** — `MCP-2026-A` reads as a provisioned protocol grant, and `18 tools` beside it reads as an allowance that was issued to something. Neither exists. Corrected copy, etched small caps, three fixed lines plus one live line:

```
webPod
Designed for the browser · Plays Apple Music
Model WP-5G · Display 320 × 240 · Wheel 24 detents per turn
```

The live fourth line, which reflects actual registration state and nothing else:

| Condition | Line |
|---|---|
| `document.modelContext` present, tools registered | `Assistant tools exposed · 18 · Session 5C4B 9A11` |
| B04 switch off, or Hold engaged | `Assistant tools withdrawn · Session 5C4B 9A11` |
| `document.modelContext` undefined | `Assistant tools unsupported in this browser · Session 5C4B 9A11` |

**Why this wording.** "Exposed" describes what webPod did — it registered tools — and implies no counterparty and no grant. "Withdrawn" is the true opposite, because unregistration is the actual mechanism (§7.0). The session id is honest: it correlates the Engraving's entries and nothing more, and it is *this tab's* id, not a credential. **Never use: granted, allowed, permitted, authorised, provisioned, licensed, or a protocol version string.**

### 11.5 Errors and interruptions

| Situation | Title | Body | Actions |
|---|---|---|---|
| Offline, playback stopped | `You're offline.` | `214 downloaded songs still play.` | `Play downloads` · `Retry` |
| Offline, downloaded track playing | *(chip only)* | `Offline` | — |
| Back online | *(in-raster footer row, 2.4s)* | `Back online.` | — |
| Auth expired | `Apple Music needs you to sign in again.` | `Downloads keep playing.` | `Sign in` · `Later` |
| No subscription | `Playback needs an Apple Music subscription.` | `You can still browse everything.` | `Learn more` · `Browse anyway` |
| OAuth popup blocked | `Your browser blocked the Apple sign-in window.` | `Allow pop-ups for this site, then try again.` | `Try again` |
| Single track unavailable | *(in-raster footer row, 4s)* | `"Vienna" isn't available here — skipped it.` | — |
| Three consecutive failures | `Something's wrong with playback.` | `Skipped 3 songs in a row.` | `Reload` · `Play downloads` |
| Library load failed | `Couldn't load your library.` | *(counts render as `—`)* | `Retry` |
| Album load failed | `Couldn't load this album.` | — | `Retry` |
| Search failed | `Search isn't responding.` | *(query preserved)* | `Retry` · `Search downloads` |
| No results | `Nothing for "daydream nashun".` | `Check the spelling, or search Apple Music instead.` | *(scope chip)* |
| Region-locked album | `Nothing here plays in your region.` | — | `Search for it` · `Go to artist` |
| Setting write failed | *(etched note under the row)* | `Couldn't save that. Try again.` | — |
| Tool threw | *(chip + transcript)* | `That didn't work — "Vienna" isn't in the catalogue here.` | *(expand for detail)* |
| Rate limit hit | *(S25 only — the device shows a static hatch in the agent's band)* | `Slowing down — I can act again in 6 seconds.` | — |
| Staged work expiring | *(in-raster footer row on the staged surface, at 28 min)* | `The draft playlist expires in 2 minutes.` | `Commit` · `Discard` |

### 11.6 Empty states

| Screen | String |
|---|---|
| S03 no library | `Nothing in your library yet. Try Radio, or search for anything.` |
| S05 no playlists | `No playlists yet.` / `Made for You has a few, or ask the agent to build one.` |
| S06 no artists | `No artists in your library.` / `Search Apple Music` |
| S09 no songs | `No songs in your library.` / `Search Apple Music` |
| S12 no query | `Search your library and all of Apple Music.` |
| S16 no lyrics | `No lyrics for this one.` |
| S17 empty queue | `Nothing up next.` / `When this song ends, I'll keep going with a station.` |
| S25 agent, nothing said | `Nothing to report.` / `Ask me to find something, build a playlist, or queue a few songs.` |
| B07 empty log | `Nothing has happened yet.` |
| B04, tools exposed | `18 controls are exposed to assistants. Any of them can be used while this page is open.` |
| B04, tools off | `No controls are exposed. Assistants can't operate this device.` |
| Cover Flow, empty | `Add some albums and they'll show up here.` |

### 11.7 Success confirmations

**Mechanism, per §8.3.6 — green can no longer mean success, because green is the agent.** The success token is **deleted, not recoloured**. Every string below is delivered by three channels and no colour of its own:

1. **The object visibly changes** — art cross-fades, the switch throws, `+` rotates into a `✓` in panel ink, rows expand, the badge counts up. This was always the real confirmation.
2. **One 200ms actor pulse** on the changed element — **sky** if the human caused it, **green** if the agent did. The pulse answers *who*, not *whether*; *whether* is answered by channel 1. In the light colourway it is a darkening-and-saturation pulse, never a brightening one.
3. **A 20px in-raster footer row** on the surface that changed, in panel ink, carrying the string and `⟲ Undo`. This replaces every cut toast and pill, and Show-Your-Work (§8.8) has already put the human in front of it.

The only place green may accompany a success is the **S25 tool chip**, where green means *"the agent did this"* — which is precisely what that chip exists to say.

| Action | String *(in-raster footer row, panel ink)* | Undo window |
|---|---|---|
| Added to library | `Added to your library.` | 30s |
| Playlist created | `Saved "45-Minute Run" to your library. 11 songs, 44:51.` | 30s |
| Playlist edited | `Updated "Road Trip". 4 added, 6 removed.` | 30s |
| Queued | `Queued 3 songs.` | 30s |
| Queue cleared | `Removed 14 songs.` | **12s** *(matched to the animation)* |
| Rated | `Rated 4 stars.` | 30s |
| Loved | `Loved. You'll hear more like this.` | 30s |
| Station started | `Playing a station based on "Aims".` | — |
| Setting changed | *(mechanism only — the switch throws. No toast on the back face.)* | 30s via `Z` |
| Tools withdrawn | `Assistant tools withdrawn.` | — |
| Undo performed | `Put it back.` | — |
| Shared | `Link copied.` | — |

### 11.8 Accessibility strings

| Element | String |
|---|---|
| Wheel ring | `aria-label="Click wheel. Use up and down arrows to scroll."` `role="slider"` on the ring, `aria-valuenow` = highlight index. Each keyboard detent fires `selection` haptics and the clicker like any human input (§4.9). |
| Center | `aria-label="Select"` |
| Menu | `aria-label="Back"` |
| Next / Prev | `aria-label="Next track"` / `aria-label="Previous track"` |
| Play/Pause | `aria-label="Play"` / `aria-label="Pause"` |
| Hold switch | `role="switch"` `aria-label="Hold. Locks the device and stops the assistant from changing anything."` |
| Flip control | `aria-label="Turn the device over to Settings"` |
| Detent settle *(polite, 350ms debounce)* | `Row 4 of 18. Bad Blood, Taylor Swift.` |
| Agent moved the highlight *(polite)* | `Agent moved to row 15 of 42. Vienna.` |
| Flip complete *(polite)* | `Back of device. Settings. Row 1 of 8, Playback.` |
| Flip return *(polite)* | `Front of device. Now Playing. Vienna, The Fray.` |
| Agent acted *(polite)* | `Assistant queued 3 songs. Undo available.` |
| Destructive agent action *(polite, with the receipt)* | `Assistant removed 14 songs from Up Next. Undo available for 12 seconds.` |
| Irreversible confirm armed *(assertive, `role="alertdialog"`, B08 only)* | `Sign out of Apple Music? Downloads stop playing. Press again to confirm, or Menu to cancel.` |
| Loading | `aria-busy="true"` + sr-only `Loading the song.` |
| Error *(assertive)* | `Error. Couldn't play Vienna. Skipping to the next song.` |
| Draft awaiting review *(polite)* | `3 changes from the assistant, not yet saved. Commit or discard.` |
| Hold engaged *(assertive)* | `Device locked. Controls and the assistant are disabled.` |
| Provenance row | `Agent. 3:04 PM. Queued 3 songs to Up Next. Undoable.` |

---

## 12. Open questions for the designer

Not hedges — these are the four decisions that belong to the visual designer, with my recommendation stated.

| # | Question | My recommendation |
|---|---|---|
| 1 | Does the back face read as genuinely different material at 320×240, or does engraved type become mud? | Prototype B01 **first among the back surfaces** (§3.4 rank 4). If incised type is illegible at 13px, go to a **brushed-metal-with-silkscreen** treatment rather than abandoning the two-face model. Do not fall back to "the front with a dark theme" — that kills the flip. |
| 2 | Is 1.5× the right desktop scale, or does the pod look like a prop at that size? | Test 1.5× and 1.75×. 1.5× keeps `480×360 = 320×240 × 1.5` integer-crisp, which is worth defending. If 1.5× reads small, keep the raster at 1.5× and enlarge the **body's bezel and wheel** instead — real iPods had generous bezels. |
| 3 | The ghost thumb is the agent's *only* ambient channel in both colourways, and after the v5 inversion it lives in a 44px band rather than a long body-length contour. Is green at 22% (dark) / 45% (light) visible enough there to be trusted, and quiet enough to live with for four hours? | Tune against a **four-hour session in both colourways**, never a screenshot. **The inversion cost the agent channel most of its path length** — a 240px-circumference band instead of an 1850px contour — so if it disappears, add **trail length and softness** before opacity or brightness. An ambient indicator that gets brighter to be noticed becomes a thing you resent. |
| 4 | Does the S16 lyrics surface survive the 320×240 raster, or does it need to break the frame? | Keep it in the raster at `airy` density: current line at 17px/100%, neighbours at 15px/40%, three lines above and below. If it fails, **let lyrics be the one front surface that expands past the bezel** on mobile — a deliberate, single, memorable exception rather than a general escape hatch. |
| 5 | How green should the light-mode panel ground actually be? M4 caps it at chroma 0.010 / hue 105 to keep it clear of the agent's green, but that is nearly a neutral grey and may lose the backlit-LCD character entirely. | Build the light panel at chroma 0.010 first and only push higher if it reads as dead. **If it must go above 0.014 to feel like an LCD, move the ground's hue to 85 (warm/amber-grey) rather than raising chroma at 105** — amber is freed (§8.3.4) and warm-vs-green is a far safer separation from the agent than tint-vs-more-tint. Do not solve this by darkening the agent's green; that breaks the ΔL rule in §8.3.7 #4. |
| 6 | Does the white pod hold its silhouette on the light page ground ruled in §10.3? | Validate at 1440×900 **and** at 390×844 on a real phone in daylight, not on a calibrated monitor. The mobile case is harder: less shadow room and more ambient glare. If `oklch(0.94 0.004 90)` is not enough separation, darken the page ground before you darken the pod — **the pod is white polycarbonate and must stay white**, or the light colourway stops being a colourway and becomes a grey theme. |

| 7 | **The honesty question, and the one I most want challenged.** webPod's confirmations, review gates, rate limits and Hold switch are all *policies webPod chooses to follow*, not capabilities the platform enforces. A user who sees a confirm dialog may reasonably conclude the assistant "had to ask". Is that an acceptable impression to leave? | **Yes, provided we never say it.** The dialog says `Clear Up Next?`, not `Allow the assistant to…`, and it appears identically for a human (§8.5). That makes it a statement about *the action*, which is true, rather than about *the agent's permissions*, which would be false. The one place we must be explicit is B04, whose copy states plainly: `18 controls are exposed to assistants. Any of them can be used while this page is open.` **If a reviewer can find any surface implying the assistant needed permission, that surface is a bug at merge-blocking severity.** |
| 8 | Should B04's `Expose tools to assistants: Off` be the default? | **No.** Defaulting to off makes webPod a normal music player with a dead settings row, and the product's second half never happens. Default on, make the switch easy to find, make Hold reachable from the top edge without entering a menu, and make the Engraving complete. **Discoverable withdrawal beats default prohibition** — and unlike a permission prompt, withdrawal actually works (§7.0). |

## 13. Build order

| Milestone | Contents | Exit criterion |
|---|---|---|
| **M0 — The instrument** | Pod body (both viewports), the `detent()` reducer with all four input paths, clicker + haptics, S03/S04/S08 with real MusicKit data, push/pop transitions | A human can navigate the whole menu tree one-handed with the screen off, by sound alone |
| **M1 — The music** | S13 + its four modes, S12, S17, S24, S05–S11, S18, offline + Service Worker. **Both colourways from the first screen — light and dark are built together, never sequentially** (§10.9). | It is a complete, shippable music player with no agent features at all (G8 proven), and every screen passes the §10.9 sign-off gate in both colourways |
| **M2 — The other face** | The flip, B01–B06, B08, B09, mini-transport docking, reduced-motion path | Settings is reachable in three ways and audio never stutters |
| **M3 — The second audience** | All 18 tools with correct `readOnlyHint` / `untrustedContentHint`, S25/D03, S26 confirmations (wired for **both** actors), the §8.2 agent flag, the two-orbit FX system, Show-Your-Work (§8.8), B04, B07 | An agent completes J3 unsupervised and a human audits it in under 30 seconds; the §8.3.7 #4 greyscale test passes on all eight priority screens in both colourways; **and an L0 audit finds no surface, string, animation or state in any agent flow implying the assistant asks, waits, requests, or is granted anything — and no agent action that clicks or vibrates** |
| **M4 — The delight** | S19 Cover Flow, S22 Brick, S21 Sleep Timer, S30 attract, the art bloom, share cards | Someone shows it to a friend without being asked to |

---

## 14. The provider abstraction

**Stack (fixed):** TanStack Start (+ Form, Virtual, Table) · Jotai, **`useState` banned** · Bun + Effect (server) · react-three-fiber (device body) · `html-in-canvas` under evaluation (panel) · shadcn/ui + Tailwind v4 (glass layer).
**Apple Music ships first. Spotify must be plannable without redesign.**

### 14.0 Confidence labelling

This document will be built from directly, so every capability row carries a confidence label. **An honest `UNVERIFIED` is worth more to an engineer than a confident guess.**

| Label | Meaning |
|---|---|
| **VERIFIED** | I am certain of the API's shape and availability. |
| **LIKELY** | High confidence from well-known platform behaviour, but confirm before relying on a detail. |
| **UNVERIFIED** | **Implementer must confirm against current docs before estimating.** Treat as a scheduling risk, not a fact. |

No local copies of the MusicKit or Spotify docs exist in `~/code/agentic-context`, so nothing here was checked against a primary source at authoring time. Every `UNVERIFIED` row is a real open question, not a hedge.

### 14.1 Where the layer lives

| Concern | Where | Why |
|---|---|---|
| `MusicProvider` implementation | **Client**, in the browser | Both SDKs are browser-side: MusicKit JS owns an HTML media element; Spotify's Web Playback SDK owns an EME-protected player. Neither can be driven from a server. |
| Token minting and refresh | **Server, Bun + Effect** | Apple's developer token is signed with a private key that must never reach the client. Spotify's PKCE code exchange and refresh should not expose the client secret. `TokenService` is an Effect service; the client calls it over HTTP. |
| State | **Jotai atoms + TanStack Query.** `useState` is banned, with no exception for "local" UI state — collapsed sections, drafts and transient toggles all become atoms. | §15 verifies it mechanically |
| Provider selection | A single `providerAtom`; every hook and every WebMCP registration derives from it | A provider switch is a re-registration event, not a page reload |

### 14.2 The interface

```ts
// ── Identity ───────────────────────────────────────────────────────────────
type ProviderId = "apple" | "spotify";
type LocalKey   = string;   // UUIDv7 minted by us. Our structures hold ONLY this.

interface TrackRef {
  key: LocalKey;            // ours, stable, never a provider id
  provider: ProviderId;
  catalogId: string;        // Apple catalog id | Spotify track id
  libraryId?: string;       // Apple ONLY: "i.xxxx" — a distinct id space from catalogId
  isrc?: string;            // the only cross-provider handle, and imperfect (§14.5)
  title: string;            // denormalised for display AND for re-resolution
  artistName: string;
  albumName?: string;
  durationMs: number;
  artwork?: Artwork;
  playable: boolean;        // storefront/market availability at time of resolution
}

interface Artwork {
  kind: "template" | "fixed";
  template?: string;                       // Apple: url with {w}/{h}
  sizes?: { url: string; w: number; h: number }[];  // Spotify: fixed array
}
// url(art, 1400) → Apple substitutes; Spotify returns the nearest >= requested,
// or the largest available, and reports what it actually gave you.
declare function artworkUrl(a: Artwork, px: number): { url: string; actualPx: number };

type Capability =
  | "auth" | "search" | "libraryRead" | "libraryAdd" | "libraryRemove"
  | "playlistCreate" | "playlistAddTracks" | "playlistRemoveTracks" | "playlistReorder"
  | "transport" | "seek" | "volume" | "queueRead" | "queueAppend" | "queueInsertNext"
  | "queueRemove" | "queueReorder" | "stations" | "stationSeedFromTrack"
  | "lyrics" | "lyricsSynced" | "ratingStars" | "ratingLoveDislike" | "saveToggle"
  | "progressTicks" | "artworkArbitrarySize";

// ── The interface ──────────────────────────────────────────────────────────
interface MusicProvider {
  readonly id: ProviderId;
  readonly displayName: string;

  /** THE contract. Every UI branch, and every WebMCP registration, reads this. */
  supports(c: Capability): boolean;
  /** Why a capability is missing — rendered verbatim in B04 and S27. */
  unsupportedReason(c: Capability): string | null;

  // Authorisation / session
  configure(): Promise<void>;
  authorize(): Promise<Session>;
  unauthorize(): Promise<void>;
  readonly session: Session | null;              // Jotai atom source
  onSessionChange(cb: (s: Session | null) => void): Unsubscribe;

  // Catalogue + library
  search(q: SearchQuery): Promise<SearchResults>;
  libraryList(kind: LibraryKind, page?: Cursor): Promise<Page<Entity>>;
  libraryAdd(ref: TrackRef | AlbumRef | PlaylistRef): Promise<void>;
  libraryRemove(ref: TrackRef | AlbumRef | PlaylistRef): Promise<void>;

  // Playlists
  playlistCreate(p: { name: string; description?: string; tracks?: TrackRef[] }): Promise<PlaylistRef>;
  playlistAddTracks(id: PlaylistRef, tracks: TrackRef[]): Promise<void>;
  playlistRemoveTracks(id: PlaylistRef, positions: number[]): Promise<void>;
  playlistReorder(id: PlaylistRef, from: number, to: number, count?: number): Promise<void>;

  // Transport
  play(target?: PlayTarget): Promise<void>;
  pause(): Promise<void>;
  skip(direction: "next" | "previous", count?: number): Promise<void>;
  seek(positionMs: number): Promise<void>;
  setVolume(level0to100: number): Promise<void>;
  readonly playback: PlaybackState;
  onPlaybackChange(cb: (s: PlaybackState) => void): Unsubscribe;
  /** Ticks ~4/s where the provider supplies them; otherwise our interpolator (§14.4). */
  onProgress(cb: (p: { positionMs: number; durationMs: number; interpolated: boolean }) => void): Unsubscribe;

  // Queue
  queueRead(): Promise<{ now: TrackRef | null; next: TrackRef[]; history: TrackRef[] }>;
  queueAppend(tracks: TrackRef[]): Promise<void>;
  queueInsertNext(tracks: TrackRef[]): Promise<void>;
  queueRemove(positions: number[]): Promise<void>;
  queueReorder(from: number, to: number): Promise<void>;

  // Discovery
  stationsList(): Promise<StationRef[]>;
  stationStart(seed: { type: "track" | "artist" | "genre" | "station"; ref: string }): Promise<StationRef>;

  // Song-level
  lyrics(ref: TrackRef): Promise<Lyrics>;               // { lines, synced: boolean }
  ratingSet(ref: TrackRef, r: { love?: "love" | "dislike" | "none" }): Promise<void>;
  saveToggle(ref: TrackRef, saved: boolean): Promise<void>;
}
```

**Stars are absent from this interface on purpose.** See §14.3 row 22.

### 14.3 Capability parity and fallback postures

**Postures:** **(a) emulate** in our layer · **(b) degrade** with a visible UI affordance · **(c) hide** the feature entirely for that provider · **(d) refuse** the provider for this feature and say so in the UI.

| # | Capability | Apple Music | Spotify | Conf. | Posture where they differ |
|---|---|---|---|---|---|
| 1 | Authorise / session | `MusicKit.configure()` + `authorize()`; developer token signed server-side | OAuth 2.0 PKCE; refresh token; server-side exchange | **VERIFIED** | — parity |
| 2 | **Paid tier required to play** | Apple Music subscription | **Spotify Premium** | **VERIFIED** | — parity in *requirement*, not in consequence; see row 3 |
| 3 | **Playback host** | MusicKit owns a media element in our page | **Web Playback SDK only** — an EME/Widevine player the SDK hosts and registers as a Spotify Connect device. We cannot supply our own audio element. | **VERIFIED** | **(b) degrade.** Transport still works through our wheel; what changes is that the device is a Connect target, so playback can be stolen by another Spotify client mid-session. S27 gains a Spotify-only state: `Playback moved to another device.` / `Play here`. Free-tier Spotify → **(d) refuse**: browse-only, with `Playback needs Spotify Premium.` on S13. |
| 4 | Catalogue search | `/v1/catalog/{sf}/search` | `GET /search` | **VERIFIED** | — parity |
| 5 | Library read | `/v1/me/library/*` | `/me/tracks`, `/me/albums`, `/me/playlists` | **VERIFIED** | — parity |
| 6 | Library **add** | `POST /v1/me/library?ids[songs]=` | `PUT /me/tracks` | **VERIFIED** | — parity |
| 7 | **Library remove** | **Not in the public API** | `DELETE /me/tracks` | **LIKELY** (Apple: not supported) | **(c) hide on Apple.** The row's action-sheet item does not exist on Apple; it does on Spotify. **Never render a disabled control** — an affordance that cannot work is worse than an absent one. |
| 8 | Playlist create | `POST /v1/me/library/playlists` | `POST /users/{id}/playlists` | **VERIFIED** | — parity |
| 9 | Playlist add tracks | `POST /v1/me/library/playlists/{id}/tracks` | `POST /playlists/{id}/tracks` | **VERIFIED** | — parity |
| 10 | **Playlist remove tracks** | **UNVERIFIED — implementer must confirm.** My understanding is the public API is append-only and cannot remove playlist tracks; Apple has been adding endpoints, so this must be checked first. | `DELETE /playlists/{id}/tracks` | **UNVERIFIED** / **VERIFIED** | **(c) hide on Apple** if unsupported. **This inverts the usual assumption and it directly breaks §7's `pod-edit-playlist`:** its `remove` and `reorder` fields would be unimplementable on the launch provider. **Confirm this before sprint planning — it is the single highest-risk row in this table.** |
| 11 | **Playlist reorder** | **UNVERIFIED**, same as row 10 | `PUT /playlists/{id}/tracks` (reorder or replace) | **UNVERIFIED** / **VERIFIED** | **(c) hide on Apple** if unsupported. Drag handles do not render; §8.5's staged diff shows `+` only. |
| 12 | Transport: play / pause / skip | MusicKit instance methods | `/me/player/*` + SDK methods | **VERIFIED** | — parity |
| 13 | Seek | `seekToTime(seconds)` | `PUT /me/player/seek` / SDK `seek()` | **VERIFIED** | — parity |
| 14 | Volume | `music.volume` 0–1 | SDK `setVolume()`; `/me/player/volume` | **VERIFIED** | — parity. Note both are *app* volume, not system volume. |
| 15 | Queue **read** | `music.queue.items` | `GET /me/player/queue` | **VERIFIED** / **LIKELY** | — parity |
| 16 | Queue **append** | `playLater()` | `POST /me/player/queue` (one URI per call) | **VERIFIED** | **(a) emulate** the batch on Spotify: N sequential calls, rate-limited, with the row-stagger animation paced to actual completion rather than run optimistically. |
| 17 | **Queue insert-next** | `playNext()` | **No API** | **VERIFIED** | **(b) degrade on Spotify.** `Play Next` becomes `Add to Queue` in the action sheet, with an 11px sublabel: `Spotify adds to the end of the queue.` The label changes; the button never lies. |
| 18 | **Queue remove / reorder** | **UNVERIFIED** — MusicKit JS v3 exposes a queue object; whether arbitrary splice/reorder is supported must be confirmed | **Not supported.** No remove, no reorder. | **UNVERIFIED** / **VERIFIED** | **(c) hide on Spotify.** S17's drag handles and swipe-to-remove do not render. **S17 is a priority-8 screen and on Spotify it degrades to a read-only Up Next with append.** Design it so the read-only variant is not a broken-looking version of the full one. `pod-queue-clear` and `pod-queue-reorder` are **not registered** on Spotify. |
| 19 | **Stations / radio** | `/v1/catalog/{sf}/stations`; `setQueue({station})` | **Public `/recommendations` and seeded-radio endpoints were withdrawn for new apps (Nov 2024).** | **LIKELY** / **LIKELY** | **(c) hide on Spotify.** S18 Radio is removed from the main menu entirely for that provider — not greyed. `pod-start-station` is **not registered**. S17's empty state loses `Start a station` and reads `Nothing up next.` only. |
| 20 | **Station seeded from a track** | **UNVERIFIED** — the in-app "start station from this song" behaviour may not have a public API equivalent | No | **UNVERIFIED** / **LIKELY** | **(c) hide** wherever unsupported. If Apple also lacks it, the action-sheet item `Start Station` disappears from both and S18 becomes curated stations only. |
| 21 | **Lyrics** | `/v1/catalog/{sf}/songs/{id}/lyrics` — **UNVERIFIED**: exists, but third-party display entitlement and time-sync availability must be confirmed | **No public API.** Spotify's lyrics are a licensed third-party integration, not exposed. | **UNVERIFIED** / **VERIFIED** | **(d) refuse on Spotify** — stated plainly, not hidden silently: S16 shows `Spotify doesn't offer lyrics to other apps.` and the NP center-cycle **drops from four stops to three**. `pod-get-lyrics` is **not registered**. On Apple, if only unsynced lyrics are available → **(b) degrade**: static text, no scroll-lock, and the `Following you` chip never appears. |
| 22 | **5-star ratings** | **Not in the API.** Apple exposes Love/Dislike only. Stars were an iTunes-local concept. | No ratings of any kind | **VERIFIED** | **(a) emulate, local-only, both providers.** Stars become a **device rating**: stored in IndexedDB, shown on S15, **never synced anywhere and influencing no recommendations.** §5.1 row 13 justified stars as the better rotary interaction and that still holds — but B06 About and S15's footer must say `Star ratings stay on this device.` **This is a correction to §7: `pod-rate-track`'s `stars` field is local; only `love` touches a provider.** |
| 23 | **Love / Dislike** | `PUT /v1/me/ratings/songs/{id}`, value `1` or `-1` | **No equivalent.** Save is not Love. | **VERIFIED** | **(c) hide on Spotify.** The heart control does not render. **Do not map Love→Save**: Love is a taste signal that shapes recommendations; Save is a library membership. Conflating them silently changes what a button means. |
| 24 | **Save / add-to-library** | `POST /v1/me/library` (add). Distinct from Love. | `PUT /me/tracks` (save). Spotify's "like" **is** save. | **VERIFIED** | **(b) degrade in labelling.** One control, two honest labels: `Add to Library` on Apple, `Save` on Spotify. Same verb slot, different word, because they are different models — and on Spotify it is the *only* affection signal, so it carries weight Apple's does not. |
| 25 | **Progress ticks** | `playbackTimeDidChange` fires on a timer | `player_state_changed` is **event-driven only** — no continuous tick | **VERIFIED** / **LIKELY** | **(a) emulate on Spotify.** An rAF interpolator advances position between events and hard-resyncs on every state change. `onProgress` reports `interpolated: true` so S14's scrubber can widen its hit tolerance. **The scrubber must never fight the interpolator:** during a human scrub, suspend interpolation and resync on release. |
| 26 | **Artwork sizing** | URL template with `{w}`/`{h}`; arbitrary sizes to ~3000px | **Fixed array of ~3 sizes** (typically 640 / 300 / 64) | **VERIFIED** / **LIKELY** | **(b) degrade on Spotify.** `artworkUrl()` returns `actualPx`. S13 requests 1400 and gets 640; the **off-raster bloom (§5.1 row 5) upscales a 640 source at 40px blur, which is visually fine because it is blurred** — but the S13 art region must clamp to `actualPx` and never upscale a sharp image. D01 desktop at 1.5× is the risk case; test it. |
| 27 | Shuffle / repeat | MusicKit modes | `PUT /me/player/shuffle`, `/repeat` | **VERIFIED** | — parity |
| 28 | Storefront / market | `storefrontId` | `market` / user country | **VERIFIED** | — parity; both affect availability, and both must set `TrackRef.playable` |
| 29 | ISRC | `attributes.isrc` on songs | `external_ids.isrc` | **VERIFIED** | — parity; the basis of §14.5 |
| 30 | Offline / downloads | **UNVERIFIED** — browser-side download-for-offline is very likely unavailable on both; §5.1 row 10 and every `DISCONNECTED` state assume a Service Worker cache of *shell, art and metadata*, not of audio | **UNVERIFIED** | **UNVERIFIED** | **Confirm early.** If neither provider permits offline audio in a browser, `Play downloads` in J6b and the `⤓` glyph must be cut, and `DISCONNECTED` becomes browse-cached-metadata-only. **This changes copy on five screens** — resolve before S13 and S17 are built. |

### 14.4 What the provider layer must never do

| Rule | Why |
|---|---|
| **Never invent parity.** No shim may make `supports()` return `true` for something the provider cannot do. | Emulation is only legitimate where the *result* is genuinely equivalent (batching appends, interpolating progress, local stars). It is illegitimate where the user's mental model would be wrong (mapping Love to Save). |
| **Never render a disabled control for an unsupported capability.** Hide it. | A greyed button says "this exists and you can't have it"; an absent one says "this product doesn't do that here". Only the second is true. |
| **A capability check is `supports()`, never a provider `if`.** No `if (provider.id === "spotify")` outside the two provider modules. | Otherwise the third provider costs a full audit instead of one file. |
| **Every unsupported capability surfaced to a human gets `unsupportedReason()` verbatim** in B04 and S27. | The user should never have to guess whether it is broken or absent. |

### 14.5 `TrackRef` — identity, and what survives a provider switch

**Provider IDs are not portable.** Apple catalog IDs are storefront-scoped and differ from Apple *library* IDs (`i.xxxx`), which are a separate id space again; Spotify uses its own IDs and URIs. Nothing in our layer may hold a provider ID as a primary key.

**The rule:** every internal structure — the queue, the Engraving (B07), undo tokens, drafts, staged diffs — holds a **`LocalKey` (UUIDv7) minted the first time we see a track**. `TrackRef` is the resolution record that key points at, and it carries denormalised `title` / `artistName` / `durationMs` **specifically so a track can be re-resolved later without a provider round-trip.**

**Cross-provider re-resolution ladder,** best effort, in order: `isrc` exact → `title` + `artistName` normalised (case, punctuation, feat./remaster suffixes stripped) + `durationMs` within ±2000ms → `title` + `artistName` only, **flagged low-confidence**. ISRC is the only real handle and it is imperfect: the same recording can carry different ISRCs across releases and remasters, and a match is a *recording* match, not a *master* match.

**What survives a provider switch — stated honestly:**

| Artefact | Survives? | What the UI does |
|---|---|---|
| **Device settings** (B02, B03) | **Yes, fully.** They are ours. | Nothing. |
| **Star ratings** | **Yes** — local-only by design (row 22), keyed by `LocalKey` with ISRC fallback | Re-attach on re-resolution; unmatched ratings persist, orphaned, and reappear if the track is ever seen again. |
| **Drafts** (`REVIEW_PENDING`) | **Best effort.** Re-resolved through the ladder. | Offer re-resolution on switch: `11 songs · 9 matched · 2 not found on Spotify.` Commit, edit, or discard. Unmatched rows render struck-through with `Not on Spotify`. |
| **Playlists** | **Not migrated.** They live in the provider's library. | webPod does not copy playlists between services. Say so once, plainly, in B05: `Playlists stay with the service that holds them.` |
| **The queue** | **No. The queue cannot survive, and we should not pretend it can.** It is provider-side state (a Spotify Connect queue; a MusicKit queue), it is being consumed in real time, and on Spotify it cannot even be reordered — so a partially-matched reconstruction would be neither the old queue nor a queue the user could repair. | **Migration UX:** on switch, the queue is **cleared**, and S17 shows a one-time card: `Your queue didn't come across.` / `14 songs were queued on Apple Music. 11 are on Spotify.` / `Rebuild queue` · `Start fresh`. `Rebuild queue` appends the 11 matches in order and reports the 3 misses by name in an expandable row. **The user chooses; we never silently rebuild a queue that is 78% of what it was.** |
| **The Engraving (B07)** and its **undo tokens** | **No, and this is not recoverable.** An undo token references a provider-side mutation — "remove these 6 tracks from playlist X" — that has no meaning against a different service. | **The log is archived, not deleted.** On switch, existing entries are stamped with the old provider's name, marked read-only, and their `⟲` affordances are removed. B07 shows a rule: `— switched to Spotify —`. Entries above it are history you can read and not undo. **Never leave a dead Undo control on a log entry**; a control that would fail is worse than none. |
| **Playback position in the current track** | **No.** | Playback stops on switch. The switch is behind the two-press irreversible confirm on B08 (§8.5), same as `Sign out`, because it drops a session. |

**The framing to hold on to: a provider switch is a new device, not a migration.** Everything that belongs to webPod (settings, stars, drafts) comes with you; everything that belongs to the service (library, playlists, queue, the mutation log) stays behind and is shown as history. Designing anything more ambitious would mean building a cross-service sync layer, which is a different product.

### 14.6 The 18 WebMCP tools under an unsupported capability

**Confirmed: the tool is simply not registered.** This is the honest use of the registration model and it follows directly from §7.0 — registration *is* availability, and not registering is the only absolute prohibition the platform offers.

| Rule | Detail |
|---|---|
| **Unsupported → unregistered** | `pod-get-lyrics`, `pod-start-station`, `pod-queue-clear` and `pod-queue-reorder` are not registered on Spotify. An agent **never sees a tool it cannot use**, so it never forms a plan around one, never calls it, and never has to interpret a refusal. |
| **Partially supported → the schema narrows** | Better than registering-and-refusing: `pod-edit-playlist` on Apple (if rows 10–11 confirm as unsupported) registers with **`remove` and `reorder` absent from its `inputSchema` entirely**, and a `description` that says it can only add. The agent cannot express an operation the provider cannot perform. |
| **Provider switch fires `toolchange`** | The roster is rebuilt from `supports()` on every provider change, exactly as it is on Hold and on auth loss (§7.3). |
| **`unsupportedReason()` never reaches the agent as a refusal** | It reaches the *human*, in B04's tools list, as `Lyrics — not available on Spotify`. The agent simply sees a shorter roster. |
| **Never register a tool that returns "unsupported"** | That is the anti-pattern this rule exists to prevent: it wastes a call, invites a retry, and teaches the agent that this page's tools are unreliable. |


---

## 15. Definition of Done and review posture

**Every criterion below is pass/fail.** If a reviewer has to exercise judgement to mark it, it is written wrong — rewrite it or delete it. Where a check can be mechanised, the command is given.

### 15.0 Universal gates — every screen, every system, no exceptions

| # | Gate | How it is checked |
|---|---|---|
| **U1** | **Both colourways, one sitting.** Reviewed in light and dark, at the same size, in the same session, in all seven §10 states. | Screenshot pair per state attached to the PR. A screen designed only in dark is **not designed** (§10.9). |
| **U2** | **Greyscale attribution test.** Force the stylesheet's hue channel to one value and desaturate. Actor identity still legible. | `filter: grayscale(1)` on the root; reviewer names who acted, from the screenshot, without seeing the code (§8.3.7 #4). |
| **U3** | **`prefers-reduced-motion: reduce`** — no translation, rotation or parallax; materiality retained; flip is a 120ms cross-dissolve with the `Back of device` chip; Show-Your-Work dwell extends to 1400ms. | DevTools emulation; recorded pass. |
| **U4** | **`prefers-reduced-transparency`** — every scrim solid at equivalent luminance; all `backdrop-filter` dropped. | DevTools emulation. |
| **U5** | **`prefers-contrast: more`** — FX render as 2px solid strokes with no glow; sigils at 1.4×; light ground → pure white, dark ground → pure black. | DevTools emulation. |
| **U6** | **44×44 minimum** on every interactive element. | Automated: axe/Playwright bounding-box assertion. Zero violations. |
| **U7** | **Contrast floors** — 4.5:1 body, 3:1 for 18px+, **in both colourways**. Chips and `☁︎` dim states included. | Automated contrast run over both themes. Zero violations. |
| **U8** | **L0 audit — no invented permission.** No surface, string, animation or state in any agent flow implies the agent asks, waits, requests, or is granted anything. | `grep -rniE '\b(allow|deny|denied|permit|permission|granted|authoris|authoriz|approve|approval|pending|blocked|ask(s|ed)? (for|to)|waiting for)\b' src/` — every hit manually cleared against §8.5's banned list, or the PR fails. |
| **U9** | **No `useState`.** | `grep -rn 'useState' src/ \| wc -l` must be **0**. No exceptions for "local" or "trivial" state. Jotai atoms only. |
| **U10** | **Panel is DOM, not canvas.** No `<canvas>` or WebGL renders any panel UI, text or control. r3f renders the *body* only. | `grep -rn 'canvas\|useFrame' src/panel/` must be 0. If `html-in-canvas` is adopted for the panel, U10 becomes a **blocking re-review** of U6, U7, U11 and U12 — rasterised text breaks screen readers, Dynamic Type and focus. |
| **U11** | **Dynamic Type to 200%** — no clipping, no truncation; ≥130% forces `airy` density and scales the raster 1.0→1.25 rather than clipping. | Manual at min and max. |
| **U12** | **Keyboard-complete.** Every state reachable and operable without touch or mouse; arrow keys are exactly one detent with **no acceleration**; `:focus-visible` never suppressed. | Manual keyboard-only traversal of the screen's full state set. |
| **U13** | **Announcements.** Detent settles debounced to one `aria-live="polite"` at 350ms; errors `assertive`; loading `aria-busy`. No live-region spam during fast scroll. | Screen-reader pass; count announcements during a 30-detent flick — must be 1. |
| **U14** | **Occlusion rule (§4.4b).** No informational feedback renders under the contact patch. Material state (depression, bevel, shadow) there is fine. | Reviewer performs each interaction **with their own thumb on a real phone** and confirms they can see the response. Not checkable on a desktop simulator. |
| **U15** | **No disabled controls for unsupported provider capabilities.** Absent, never greyed (§14.4). | `supports()` drives render, not `disabled`. |

### 15.1 Per-screen Definition of Done

#### S13 — Now Playing *(priority 1)*
1. All seven §10.1 states implemented, both colourways (U1).
2. Artwork bloom uses `screen` α0.35 in dark and **`multiply` α0.22 +12% saturation** in light; verified against a pale-art album and a dark-art album in both.
3. Art region **clamps to `actualPx`** from `artworkUrl()` and never upscales a sharp image; verified with a Spotify-shaped 640px source at desktop 1.5×.
4. Center cycles Volume → Scrub → Rate → Lyrics → Volume; **the cycle is three stops, not four, when `supports("lyrics")` is false**, and the mode chip sequence proves it.
5. Rotate default is **volume**, not scrub.
6. Success confirmation uses §8.3.6: object changes + **one 200ms actor pulse** (sky human / green agent) + in-raster footer row. **No green tick. No toast.**
7. Light-mode pulse is a darkening/saturation pulse, not a brightening one.
8. `LOSSLESS` / `SPATIAL` badges are passive and non-interactive.
9. Progress bar drives from `onProgress`; when `interpolated: true`, scrub hit tolerance widens and interpolation suspends during a human scrub, resyncing on release.
10. Universal gates U1–U15.

#### S03 — Main Menu *(priority 2)*
1. Menu rows render **on the first frame** — never blocked on a network call; only counts and the right pane shimmer.
2. Empty slices render **present and dimmed with a `0`**, never hidden; error renders `—`, never `0`.
3. Light mode adds the **1px `black / 10%` column rule** and the right pane's ground is 3% darker (§10.2).
4. **The Split Law holds:** no agent write ever touches the left column. Verified by driving `pod-navigate` while watching the left column.
5. `Radio` is **absent from the tree**, not greyed, when `supports("stations")` is false.
6. `Settings ⟳` row previews the flip (rotating ghost in the right pane) before it happens.
7. Menu at root produces the elastic bump + one clicker tick, never a no-op.
8. Universal gates.

#### D01 — Desktop Shell *(priority 3)*
1. Pod at 1.5× → screen exactly **480×360** (integer 320×240 × 1.5); no fractional-pixel text.
2. **Light-mode page ground is `oklch(0.94 0.004 90)`, not white**, with the pod's contact shadow and 1px body edge; the white pod holds its silhouette. **Validated on a real display in daylight, not a calibrated monitor** (§12 Q6).
3. Pod and sidecar fail **independently**; a sidecar error never disables the pod.
4. Sidecar auto-switches to D03 on the first tool call of a burst **once per session and never again**; verified by triggering four bursts.
5. Below 1180px → 64px rail; below 900px → full mobile layout. Both verified.
6. Everything in the sidecar is also reachable on the pod panel.
7. Universal gates.

#### B01 — Settings back plate *(priority 4)*
1. **Renders on the same frame the flip completes.** Zero loading state, ever. All settings local.
2. Back face is a **materially different surface** from the front: engraved/incised type on steel, no backlight glow. A reviewer shown the two faces side by side without labels identifies which is which. **If this fails, escalate — the flip is a gimmick and §6 needs re-scoping** (§12 Q1).
3. Back face is **mode-invariant**: identical in both colourways, only the reflected room changes (§10.4).
4. Incised type clears **4.5:1 against steel under the bright-room reflection** — the harder of the two cases.
5. Failed setting write springs the switch back with a 90ms recoil and an 11px etched note.
6. `Account & Apple Music` stays lit and navigable when signed out.
7. **No toast on the back face, ever** — the switch throw is the receipt.
8. Universal gates.

#### S25 — Agent Console *(priority 5)*
1. Renders **in-raster as a front-panel screen**, not a sheet (§8.7).
2. **Absent entirely** — no row in Extras, no `A` shortcut, no teaser — when `document.modelContext` is undefined (G10).
3. Stop button present in the header **from the first frame**, always, and calls `controller.abort()` on the in-flight tool (G4).
4. Light mode groups turns with a **1px left rule, not a background fill** (§10.5).
5. Tool chips show `readOnlyHint` / `untrustedContentHint` state and expand to raw JSON args.
6. **Every string in the transcript passes U8.** No `Understood — I left your queue alone.`-class copy.
7. Chips persist after the fact; a completed call is **never retro-labelled as refused** (§10.5).
8. Universal gates.

#### S08 — Album → Tracks *(priority 6)*
1. **8 skeleton rows at exactly 26px** so the list cannot reflow when data lands.
2. Staged diff: added rows green-tinted (8% dark / **12% multiply light**), removals struck **in ink, not crimson** (§10.6), moved rows with a ghost at the old index.
3. **Drag handles and swipe-to-remove do not render when `supports("playlistReorder")` / `("playlistRemoveTracks")` is false** — absent, not disabled (U15).
4. `Remove from Library` action-sheet item absent on Apple (§14.3 row 7).
5. Long-press opens the sheet **from the row** with the **halo fill ring** as its 600ms progress (§4.4b) — verified thumb-on-glass (U14).
6. Rendered through **TanStack Virtual** for lists over 100 rows; scroll holds 60fps on a mid-tier Android.
7. Universal gates.

#### S12 — Search *(priority 7)*
1. Field keeps focus and stays typeable throughout loading; 280ms debounce.
2. **M4 verified on this screen specifically**: light panel ground at chroma ≤ 0.010 / hue 105 against agent green at chroma 0.18 — the `:tool-form-active` field is unmistakable. **Sign off the light palette here before anywhere else** (§10.7).
3. Declarative attributes (`toolname`, `tooldescription`, `toolparamdescription`) present where supported **and the flow works identically with them absent** (G3). Verified by disabling them.
4. Agent-run search types into **the human's real field** at 24ms/char.
5. No-results always offers a **widened scope** before offering nothing.
6. Offline: `Apple Music` group header renders dimmed with `☁︎`, **never removed**.
7. Built with **TanStack Form**; zero `useState` (U9).
8. Universal gates.

#### S17 — Up Next *(priority 8)*
1. `Now` row renders first; light mode marks it with a **2px ink left bar + semibold**, not a fill (§10.8).
2. **The Spotify variant is a first-class design, not a broken-looking full one:** read-only queue with append, no drag handles, no swipe-remove, `Play Next` relabelled `Add to Queue` with the `Spotify adds to the end of the queue.` sublabel (§14.3 rows 17–18). Reviewed as its own screen, in both colourways.
3. Empty state names the default behaviour (`When this song ends, I'll keep going with a station.`) — **and drops the station sentence entirely when `supports("stations")` is false**.
4. Agent inserts expand from 0 height at 40ms stagger with a **3px solid green** left border in light mode (1px disappears).
5. `pod-queue-clear` receipt window is **12s**, matched to the collapse animation.
6. Provider-switch migration card implemented per §14.5: counts matched and unmatched, `Rebuild queue` / `Start fresh`, misses named. **Never silently rebuilds.**
7. Universal gates.

### 15.2 Per-system Definition of Done

#### The agent flag (§8.2)
1. Implemented as **exactly** the §8.2.1 snippet: set in `execute`, cleared on trusted `pointerdown`/`keydown`/`wheel`/`touchstart`. No timers, no thresholds, no debounce on the flag itself.
2. Transitions fire **only on change** — a burst of twelve calls produces one transition. Verified by instrumenting `onActorChange`.
3. `isTrusted` guard present, **and a comment at the call site stating it is not a security boundary** (§8.2.1).
4. **No code anywhere claims to detect agent presence.** `grep -rniE 'agentPresent|agentAttached|agentIdle|isAgentConnected'` returns 0.
5. Exactly **five states + one app mode** exist in the union type. No `CONFIRMING`, no `CO_PILOT`, no `AGENT_DENIED`.
6. L1 deferral: a call targeting a control under an active human gesture defers ≤2500ms then drops, logs `deferred, then dropped`, and shows the 4s footer row.

#### Ghost trail and halo (§8.3.2, §4.4b)
1. **Human FX never renders inside the wheel. Agent FX never renders outside it.** Automated: assert rendered FX bounds against `r=120` for both actors.
2. **Agent FX never renders inside `r = 76`.** Automated assertion — this is §8.3.2b #1 and it is a correctness rule.
3. The Center button has **exactly one press appearance**, produced only by human input. Verified by driving `pod-navigate {press:"center"}` and confirming a **ring flash, not a depression, and no halo**.
4. Halo bias peaks **180° opposite the live contact point**, recomputed per frame; uniform when there is no contact point.
5. **No handedness setting, no stored handedness.** `grep -rniE 'handed|leftHand|rightHand'` returns 0.
6. Halo is outside the wheel on **all four input paths**; only emphasis varies (§4.4b).
7. Device states (`HOLD_ENGAGED`, `DISCONNECTED`, `REVIEW_PENDING`) render **on the panel or the switch, never on the wheel**.
8. 400ms fade-out decay on the ghost trail; `data-actor-state` truthful on the same frame.

#### Expose flip (§6)
1. **R1 verified: audio does not stop, pause, duck or glitch during a flip.** Measured, not eyeballed.
2. **R2 verified:** the mini-transport docks at flip start and every control in it works mid-flip.
3. R3: `Menu` from a B-surface root restores the **exact** front screen and highlight index.
4. R5: every B-surface reachable without the flip (`,` lands on B01); every setting has a stable DOM id.
5. R6: **no automatic flip, ever** — no timeout, no flip-on-error. `grep` for flip calls in error handlers returns 0.
6. Interactive drag is reversible mid-gesture; release under 50% snaps back.
7. Agent flip: full 520ms duration, never faster; `surface` enum **omits `legal-reset`** so it cannot be requested.
8. Reduced-motion path is a 120ms cross-dissolve with the `Back of device` chip and a `Front` return control.

#### Haptics and sound (§4.9)
1. **`grep -rn 'navigator.vibrate' src/` returns 0** — all haptics go through `web-haptics`.
2. All seven triggers used per the §4.9.2 map; no trigger used outside its row.
3. **The silence rule is enforced at one call site**: the clicker and `haptic.trigger()` are both gated on `source !== "agent" && source !== "system"` **inside the `detent()` reducer**, not at call sites.
4. **Verified by hand:** drive a 14-detent `pod-navigate` on a real phone held in the palm. **Fourteen visible steps, zero clicks, zero vibrations.** This is a manual gate and cannot be waived.
5. `selection` suppressed above 12/sec; clicker hard-limited to 30/sec with ±2% pitch jitter.
6. `error` fires only for the failure of a human-initiated action — never for a system-caused skip.
7. Accelerometer chain implemented per §4.9.1 steps 1–10, including: **never requested on load**, asked at first wheel `pointerdown`, never re-asked after denial, and a **static 135° key light fallback that is not a flat surface**.
8. Flip haptics fire for **human-initiated flips only**.

#### Provider layer (§14)
1. `MusicProvider` implemented for Apple; the Spotify module exists as a **compiling stub whose `supports()` returns the §14.3 matrix**, so parity gaps are visible in CI from day one.
2. **`grep -rn 'provider.id ===' src/ --exclude-dir=providers` returns 0.** Capability checks are `supports()` everywhere else (§14.4).
3. Every `UNVERIFIED` row in §14.3 has a linked spike ticket **resolved before the dependent screen is estimated.** Rows 10, 11, 18, 20, 21, 30 are blocking.
4. `TrackRef` carries a `LocalKey`; **no internal structure holds a provider ID as a key.** Verified by type: queue, Engraving and undo tokens accept `LocalKey` only.
5. Provider switch: queue cleared with the §14.5 migration card; Engraving archived read-only with **`⟲` affordances removed**, never left dead.
6. `unsupportedReason()` surfaces verbatim in B04.
7. Stars are **local-only and labelled as such** on S15 and B06 (§14.3 row 22).
8. **Love is never mapped to Save** (§14.3 row 23).

#### WebMCP registration (§7)
1. One `AbortController` per tool, aborted on unmount; `toolchange` fires on every roster change.
2. `readOnlyHint` set on the six non-mutating tools; **`untrustedContentHint: true` on every tool returning catalogue text** (G7, G8).
3. **Unsupported capability → tool not registered** (§14.6). Verified by running against the Spotify stub and asserting the roster **omits** `pod-get-lyrics`, `pod-start-station`, `pod-queue-clear`, `pod-queue-reorder`.
4. **No registered tool ever returns "unsupported".** `grep -rniE 'not supported|unsupported' src/tools/` returns 0 in return paths.
5. Partial support narrows the **`inputSchema`** — the field is absent, not present-and-refused.
6. Hold engaged → all but two tools **unregistered**, and re-registered only by a human release.
7. **Every tool moves visible UI** (G1). Verified per tool by calling it with the panel visible and recording the change. **A tool with no recorded UI change fails.**
8. Show-Your-Work (§8.8): off-screen mutations navigate, act, receipt, dwell 900ms, return; human input during dwell cancels the return; consecutive same-surface mutations coalesce within 4s.

### 15.3 Reviewers must be strict

These are the failure modes most likely to slip through **on this project specifically**, because every one of them has already appeared in this document and had to be corrected. Reviewers should assume each is present until they have checked.

| # | Failure mode | Why it slips through | Reject on sight |
|---|---|---|---|
| 1 | **Fake permission language** | It reads as responsible. "Allow the assistant to…" sounds like good product hygiene, and three drafts of this spec shipped it. | Any agent-flow string containing the U8 banned words. Any dialog that appears for an agent action but not the identical human action. |
| 2 | **A pre-action prompt in any form** | It is the most natural way to make a destructive action feel safe, and it is unimplementable: the page learns of a call by being called (§8.5). | Any modal, sheet or card in an agent flow. There is no `CONFIRMING` state. |
| 3 | **Feedback drawn under the thumb** | On a desktop simulator it looks perfect. The defect only exists when a real hand is on real glass. | Any informational feedback at the contact point. **U14 must be checked on a phone, in hand — a desktop review cannot pass it.** |
| 4 | **Agent marks that look human** | Green near the wheel centre reads as a Center press, and Center is the commit affordance product-wide. | Agent FX inside `r=76`. Any agent-caused depression. Any halo produced by agent code. |
| 5 | **Agent haptics or clicker** | The natural instinct is "same event, different voice", which was v1–v3's rule. It costs the only attribution channel that works in a pocket. | Any vibration or click on a tool-driven action. |
| 6 | **`useState` creeping in** | Always for something "trivially local" — a collapsed section, a hover, a draft string. | `grep -rn 'useState' src/` returning anything above 0. No exceptions, no "just this one". |
| 7 | **Provider parity that does not exist** | A shim that makes Spotify *look* like it supports reordering is easier to write than a second design for S17, and it fails silently in production. | Any `supports()` returning `true` for a capability the provider lacks. Love mapped to Save. A greyed control where the capability is absent. |
| 8 | **Silently dropped states** | Loading, empty, error, offline and permission-denied get built; **offline and permission-denied get skipped** because they are hard to trigger locally. | Any of the seven §10 states missing. Reviewer must be able to *reach* each one — behind a devtools flag if necessary. |
| 9 | **Tools that run invisibly** | A tool that returns the right JSON looks finished. G1 requires it to *move the panel*. | Any tool whose PR has no recorded UI change. Any mutation that reports instead of performing in view. |
| 10 | **Rendering a fact the platform never supplies** | The worst class of bug on this project, and the prettiest. v2's agent-idle indicator was beautiful and rendered information the browser never gives a page. | Any indicator of agent presence, agent thinking, or agent intent. If you cannot name the API that supplies the fact, it is fabricated. |
| 11 | **Dark-mode-only design** | Dark is where the skeuomorphism is easy and where everything glows. Light inverts polarity, not hue. | A PR without both-colourway screenshots for every state (U1). |
| 12 | **Green used as success** | It is the universal convention and it is wrong here, because green is the agent. | Any green tick, any green success toast. The only legitimate green success is the S25 tool chip, where green means *the agent did it*. |
| 13 | **Device state drawn on the wheel** | The wheel is the most attractive surface to put an indicator on, and every device state was there before v5. | `HOLD_ENGAGED`, `DISCONNECTED` or `REVIEW_PENDING` rendering on the wheel or the Center button. |
| 14 | **An `UNVERIFIED` row treated as a fact** | §14.3's confidence labels are easy to skim past, and rows 10, 11, 18, 20, 21 and 30 each change a screen's design if they resolve the other way. | Any estimate or implementation depending on an unresolved `UNVERIFIED` row without a linked spike. |

**The posture:** on this project the plausible-looking answer has been wrong more often than the awkward one. Three drafts invented a permission model, one invented an agent-presence signal, one put the human's own feedback under their thumb, and one gave the agent a voice you could feel. Each was internally coherent and each was fiction. **Reviewers should treat "this looks right" as the beginning of the check, not the end of it** — and should ask, of any indicator, *which API supplies this fact?*

