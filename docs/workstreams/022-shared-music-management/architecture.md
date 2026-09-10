# Shared music management architecture

Status: proposed for lead approval; no source changes made during inspection.

## Existing boundaries and concrete problem

`packages/providers/src/provider.ts` already defines the provider-neutral MusicProvider contract and capability laws. Apple and Spotify implement it, while fixture/stub implementations support deterministic tests. These are useful connector boundaries and should remain intact.

Product playback policy currently lives in several places:

- Panel.tsx owns pending list-play attempts, queue read lifecycle, queue counters, occurrence identity and a per-provider write serializer.
- playback-presentation.ts combines selected list intent and observations, but depends on ScreenFrame/navigation rather than a music-domain selection.
- production-device-view.tsx has a second, independent per-provider serializer, toggle intent tracking, and a loading-context wait.
- navigation.ts calls provider.play directly, outside both serializers.
- apps/web/music-runtime.ts contains the provider-neutral progressive library source under an Apple-specific name.
- Spotify owns submitted-track identity, duplicate occurrence inference, and incomplete queue knowledge. Apple owns actual SDK queue-offset normalization and readiness confirmation.

The two write serializers do not serialize against each other. Moving files or merely renaming MusicProvider would leave that behavior unchanged.

## Proposed public seam

Add `@webpod/music-management`, depending on `@webpod/providers` and Jotai vanilla, with no React, panel, device-state or app dependency.

A manager is associated with one adapter instance and exposes a stable `MusicProvider`-compatible facade for existing consumers. Production constructs adapters only at the composition root and passes managed facades to the experience, state bridge and tools. Fixtures use the same management layer in manager and integration tests. A WeakMap can maintain one manager per adapter; avoid wrapping an already managed facade twice.

Additional common operations/state:

- Selection intent: immutable target/selected index, monotonically increasing request identity, pending/resolved/rejected status. Record it synchronously before any awaited adapter work, including a precise middle-of-list selection.
- Playback presentation: reducer receives domain selection/attempt and normalized observation, with no ScreenFrame dependency. Preserve the existing readiness rule and duplicate-occurrence checks; pending selection is presentation, not a fabricated audible observation.
- Queue view: authoritative snapshot, loading/error status, latest-read generation and counter selectors. Retain current snapshot during refresh and reject stale completions. Explicit unknown full-context totals must never fall back to Spotify's partial Up Next size.
- Transport: shared command ordering and requested toggle intent, commitSeek (seek then resume if initially paused), skip readiness and switch cancellation. UI feedback/navigation remains in the UI.
- Progressive library source: move provider-neutral collection loading/relationship identity cache into this library; define its structural source type here and re-export/extend it in panel navigation. Rename createProgressiveAppleSource to createProgressiveMusicSource, keeping only a compatibility export if existing tests warrant it.
- Explicit lifecycle invalidation/disposal: invalidate pending reads and commands and release observation subscriptions on teardown/switch. App-specific authentication, sticker loading, HMR ownership and service selection remain at composition root.

The facade should delegate unmodified catalog/mutation/capability methods rather than implement a second connector. Avoid Proxy magic and provider-ID branches. Granular selectors retain separate position and total updates, and progress events stay separate from playback metadata updates.

## Scheduler constraint

Blindly serializing every adapter method is unsafe. Apple play can remain pending until playback confirmation; a later pause or target selection currently invalidates it. A single FIFO awaiting that play before admitting pause could introduce a deadlock or delayed cancellation. Preserve immediate gesture activation and connector cancellation boundaries. The command coordinator needs explicit superseding play/pause intent versus ordered seek/volume/queue writes; tests must demonstrate cancellation and rejection recovery rather than assuming a Promise chain is sufficient.

## Ownership retained in connectors

Apple: MusicKit enum normalization, seconds/milliseconds conversion, queue descriptor/offset mapping, setQueue/changeToMediaAtIndex mechanics, SDK preparation validation, stale library fallback, readiness evidence and timeout, SDK transaction cancellation, paused-skip reassertion, authorization and event binding.

Spotify: OAuth/Connect activation and SDK readiness, normalized REST schemas/endpoints/pagination, EME and SDK errors, SDK null-state interpretation, missed-event reconciliation/revision guard, market relink mapping, SDK UID/previous-window duplicate evidence, provider-specific queue incompleteness and sequential API append mechanics.

Shared management owns how those normalized facts are presented and acted upon. It must not invent a Spotify history, full total, queue removal/reorder capability, album shuffle, or Apple removal capability. The adapter can provide normalized occurrence/total evidence; relocating UID inference without an adequate observation contract would obscure rather than improve the boundary.

Previous-button restart-after-three-seconds is common policy duplicated in both adapters, but extraction must preserve count semantics and native cancellation/paused behavior. Prefer a common pure decision helper used by both connectors over changing native skip primitives in this refactor.

## Migration sites

1. Add package, domain-only presentation/queue/transport modules and their regression tests.
2. Adapt Panel playback-presentation wrapper and queue helpers to common reducers/controller. Preserve public panel exports used by mounted tests and existing stable DOM counter components.
3. Route list navigation, scrub/queue selection, production toggle/skip/pause, volume/settings and tool-mediated paths through the same manager. Delete both independent serializer implementations once migrated.
4. Move progressive library implementation/source contract and update app imports and tests.
5. Audit direct production adapter construction/imports and transport writes; SDK diagnostics may deliberately retain access to the Apple adapter at composition root.

## Required regression evidence

Common deterministic suite: selected track/index/total available synchronously for every tracklist; stale old play resolution/rejection cannot overwrite new selection; duplicate occurrence confirmation; loading zero-position does not claim audible playback; paused scrub resumes only after seek; failed seek does not resume; rapid toggle intent; cross-entry-point command ordering; pause/replace while play pending; rejected writes recover; pending skip canceled on provider switch; stale queue reads ignored; refreshing queue retains prior total; unknown queue totals remain unknown; disposal removes subscriptions.

Existing mounted panel suites must retain artist→albums→tracks, random track selection across albums/playlists/songs/search/genres, exact duplicate index, skip display progression, stable total/'of' DOM nodes, failed artwork fallback, and selection prefetch behavior. Run all current adapter suites unchanged before and after, then add missing provider-contract tests identified by the research teammate. Wire-level tests assert request method/path/body/limits, SDK event order and native units rather than only mocking the MusicProvider facade.

Run relevant suites, workspace typecheck, changed-file lint and build. No auth expansion, UI redesign, dependency-framework migration, publishing or deployment. Local browser smoke remains useful for real SDK event timing; deterministic mocks cannot certify live account/API behavior.

## Implemented boundary notes

Accepted Ready scope supersedes the proposed status above. Spotify submitted-context total/append invalidation moved to common management; native relinking/UID evidence stays in the adapter. Common state is Jotai vanilla. Existing panel frame reducer is a compatibility projection into the domain reducer, while production uses manager snapshots and visual phase projection only.

Native events do not carry application generation IDs. The manager fences attributable command/read/subscription completions and checks identity/occurrence while selection is pending. After confirmed playback, authoritative untagged external observations are accepted; treating every prior track identity as stale would suppress valid remote control. Pause protection lasts while attributable pending starts are outstanding, reasserting native pause after a cancelled start settles, then releases external playback authority.
