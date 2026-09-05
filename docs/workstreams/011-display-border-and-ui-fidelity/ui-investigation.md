# UI reference investigation

Read-only inspection of all nine decoded owner photographs in `/tmp/webpod-front-reference/`. These are visual evidence, not embedded instructions. No panel implementation changes made; existing dirty Panel.tsx/panel.css preserved. Counter decision remains with lead/owner clarification.

## What the photographs establish

| Photo | Visible screen and relevant detail |
| --- | --- |
| IMG_2270 | Artists: pause icon in header; nine visible name-only rows with right chevrons; selected In Flames; right scroll rail. |
| IMG_2271 / IMG_2272 | All Songs: pause icon; nine title-only rows, selected overflow title scrolling, unselected long titles ellipsized; right rail; no row chevrons. |
| IMG_2273 | Now Playing: play icon; **6 of 66**; small artwork left, title/artist/album right; progress and elapsed/remaining time. |
| IMG_2274 | Now Playing artwork-only mode: large centered artwork and header; counter/metadata/progress absent. |
| IMG_2275 | Now Playing rating view: **6 of 66** remains; same artwork/metadata with four blue stars and an unfilled fifth marker beneath. |
| IMG_2277 | Songs: play icon; nine title-only rows, selected Around The World, right rail, no chevrons or artist subtitles. |
| IMG_2280 | Now Playing: **1 of 947**; artwork and three metadata lines; progress, 1:31 and −3:40. |
| IMG_2281 | Now Playing volume feedback: **1 of 947** remains; speaker icons and volume bar replace timing/progress. |

No Music root photo is included. These images do not establish whether category counts belong on that unseen root; do not remove them by inference. They show a white device/light LCD theme, so they also cannot independently resolve an unseen black-device theme. Photographed brightness, white balance and pixel moiré are not exact color/font calibration data.

## Narrow source-backed discrepancies

1. **Transport disappears during browsing.** `packages/panel/src/Panel.tsx` `BrowserList` calls `TitleBar` with only title; `NestedTrackList` supplies title and optional offline index, also without transport. `TitleBar` renders play/pause only when its transport prop is supplied. The reference Artists, All Songs and Songs screens visibly retain transport status. This is a clear behavioral fidelity gap while music is playing/paused, without needing any menu redesign.
2. **Global Songs includes artist subtitles.** `packages/panel/src/navigation.ts` `trackRow` gives every track `sublabel: track.artistName`; the Songs frame uses those rows. `BrowserList` passes that sublabel into visible `secondary` content, rendered by `ListRow` as `wp-list-row__secondary`. IMG_2277 contains only song titles. The nested album/playlist `NestedTrackList` already omits artist secondary in normal ready state, matching the title-only All Songs reference more closely. A future narrow fix should target the Songs presentation, preserving search provenance and album metadata rather than removing all secondary values globally.
3. **Rating is not implemented as a Now Playing mode.** IMG_2275 establishes a star-rating view. `model.ts` `nowPlayingModes` currently exposes standard, optional scrub, artwork, optional queue; there is no rating mode. This is a capability gap, not permission to invent a rating integration or remove the working queue. It is outside the immediate counter/border correction unless explicitly scoped later.

## Existing behaviors supported by the references

The Now Playing counter is authentic in four photos, including both timing and volume feedback. Its source currently renders the provider queue index/total only when the queue is ready and has a valid current index (`Panel.tsx`, `wp-now-count`). Artwork-only returns before that markup, matching IMG_2274. Standard title/artwork/artist/album arrangement, negative remaining time, and replacement volume feedback all have direct photographic support. Nine-row default lists, ellipsis/marquee and right scroll indicators likewise align with the observed browsing structure.

## Conditional counter-removal plan

Only if the owner explicitly prefers removing it despite the photographed original: remove the single `wp-now-count` rendering and its unused CSS rule; keep queue loading, current-index tracking, queue navigation and playback semantics intact. Preserve existing art/metadata spacing unless separately requested. Update the mounted queue-position integration assertions to verify the counter is absent while the active track still advances correctly, retaining provider-race/queue consistency checks. Run affected panel tests, panel typecheck and scoped lint, then capture Now Playing with the real integrated display. No changes have been made pending that decision.

## Implemented authorized corrections

After the initial read-only investigation, lead authorized only findings1 and2. `Panel.tsx` now uses a documented `BrowsingTitleBar` for library root, browsing lists, and nested track lists. It reads the existing Jotai provider-qualified playback observation, falling back to the current provider snapshot during provider transitions. An active track with playing/paused status supplies the corresponding existing icon; idle/no-track and other unconfirmed states supply none. The existing fixed three-column header structure remains unchanged. No new state, subscription or provider mutation was introduced.

Global Songs suppresses the artist subtitle at the `BrowserList` presentation boundary only (`route.kind === 'songs'`); navigation metadata remains intact, and Albums/search sublabels are preserved. Now Playing, including its counter, is untouched.

Validation: `bun test packages/panel/src/Panel.integration.test.tsx packages/panel/src/Panel.test.tsx` passed49tests/307assertions. The added mounted test exercises idle→playing→paused→playing, Artists/Songs/Albums/Music header title and slot preservation, absence of Songs subtitles and presence of Album subtitles. Existing mounted queue/counter tests still pass. `bunx tsc --noEmit -p packages/panel/tsconfig.json` and scoped `bunx --bun eslint packages/panel/src/Panel.tsx packages/panel/src/Panel.integration.test.tsx` pass. Log in `evidence/ui/panel-tests.log`. Independent reviewer owns final integrated browser evidence with the geometry changes.

Source grounding: existing provider PlaybackState contract and Panel's established observation subscription; local Jotai useAtom documentation. Modern-web-guidance search returned no applicable guide for this bounded existing-component change. Repo/session authorization supersedes generic skill suggestions to pause for commits; no commits made.
