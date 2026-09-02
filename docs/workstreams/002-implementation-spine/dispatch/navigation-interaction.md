# Dispatch: navigation and interaction

## Screen graph

`Music (S03)` routes by typed `NavigationRoute` descriptors:

- Cover Flow → albums (S19) → album tracks (S08) → Now Playing (S13)
- Playlists (S05) → playlist tracks (S08) → Now Playing
- Artists (S06) → artist albums (S07) → album tracks (S08) → Now Playing
- Albums → album tracks (S08) → Now Playing
- Songs (S09) → Now Playing
- Genres (S10) → Artists / Albums / Songs → the corresponding artist-album or track path
- Radio (S18), only when `supports('stations')` → Now Playing
- Search entry (S12) → grouped/provider search result track list (S12) → Now Playing

Every entity-bearing route stores a webPod `LocalKey`, never a provider id. The
stack stores each frame's highlight and `windowStart`, so Menu restores both by
construction.

## Action table

| Input | State transition |
|---|---|
| Wheel detent | Move highlight within the current frame; rejected boundary travel changes nothing and emits no wheel feedback |
| Center | Publish one external-store navigation intent; the panel data source resolves and pushes the typed destination |
| Menu tap | Pop exactly one frame; root produces the existing right bump |
| Menu hold ≥600 ms | Reset to the existing root frame and suppress the following tap |
| Previous / Next | Existing viewport paging semantics remain in state |
| Play/Pause | Existing provider-owned transport seam remains in composite |

## Invariants

- No component-local state; intents, stack and frames remain visible through the shared Jotai store.
- Capability checks decide row presence. Unsupported rows do not render disabled.
- Lists use the canonical panel viewport and reusable Aqua scroll indicator; at most eight rows render.
- Center selection is exact-once in both bare-panel and composite keyboard paths.
- Loading, empty, error, offline and signed-out/playback-permission postures remain renderable through typed panel states/status frames.
- No provider-name branch exists in navigation.

## Files and tests

- State contract/intent: `packages/state/src/contract.ts`, `store.ts`, `navigation-intent.test.ts`
- Route/data reducer: `packages/panel/src/navigation.ts`, `navigation.test.ts`
- Rendering/bridge: `packages/panel/src/Panel.tsx`, `panel.css`
- Long-Menu physical seam: `packages/composite/src/CompositeDevice.tsx` and integration test
- Browser evidence: `evidence/navigation-*.png`, `evidence/navigation-a11y.json`

## Open integration decision

`MusicProvider` has no relationship reads for album tracks, playlist tracks,
artist albums or genre facets. `NavigationDataSource` is therefore the narrow
typed input seam for provider-domain relationship results. The Apple lane must
populate it from real reads; changing route semantics or screen components is
not required.

