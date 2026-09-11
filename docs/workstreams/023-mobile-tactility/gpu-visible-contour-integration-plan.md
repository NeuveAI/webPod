# Visible contour integration planning

Read-only C2 planning after A/B approval; C1 API pending lead lock. No source edits. Source e940 plus frozen A/B reviewed changes. Implements Phase C of gpu-visible-contour-dispatch.md only after explicit author/file ownership assignment.

## Confirmed capture seam and C1 interface

`createStickerProjection` (packages/device/src/sticker-projection.ts:24) already owns the current scene, camera, canvas, readScene and visibility. Its projectedPrint selector (:82) chooses actual carried/equipped committed Mesh by isStickerCarried, including collection tool previews without equipped inventory meshes. Capture there: update content/print/camera world transforms, update visibility, require ready; select preparedStickerContourDescriptor and getPreparedStickerContour from that exact geometry; capture9 live positions; read one fresh DOMRect; copy world/camera inverse/projection/content/camera tuples coherently. No dense contour calculation occurs during capture. Use actual geometry identity/revision, not requested draft identity.

No new visibility snapshot API is needed: createStickerVisibility already exposes ready, revision, snapshot(), getSnapshot and subscribe. snapshot is borrowed immutable packed storage and MUST NOT be transferred. C1 owns yielded private copy/reservation. Existing ready=false invalidation is a hard barrier even while previous resource remains leased.

Proposed C1 API from haptics/lead: createStickerContourQuery({onError?}) -> request(demand), clear(), subscribe, getSnapshot, dispose. Demand contains lineage, pose, visibilityRevision, projection, contentWorld, cameraWorld, collider:{snapshot,revision}, print:{identity,revision,descriptor,contour,quad}. Snapshot contains result (canonical stamped response or null), error and pending. The owner handles generation/resource IDs, private leases, bounded current/candidate/request/result credit and RAF publication. C2 must preserve echoed lineage/resource/pose in app snapshot, never flatten away admission metadata.

## Missing canonical pose authority

createStickerProjection currently receives no RenderPose reader. Native host has the exact admitted pose/binding.read; thread a readPose callback through device-render-host→native-sticker-controller→createStickerProjection. Merely using requested app orientation can stamp a geometry pose that was not adopted.

GL has no RenderPose binding: DeviceMotionBridge subscribes to readIntent and applies orientation directly to the model. DeviceMotionAuthority exports only readIntent/subscribeIntent/attach. Therefore GL cannot truthfully supply native motionEpoch/lastAcceptedCommand/sceneRevision from existing APIs. Lead must explicitly lock either an admitted GL snapshot stamp variant rooted in the existing actual pose/layout/resource notification authority, or a bounded canonical GL publication adapter. Do not fabricate an all-zero native stamp. This is the principal API decision before C2 writes.

## App demand/subscription and session

Current production-device-view.tsx:27–29 receives live projection handles and coalesces projectionVersion notifications before paint. sticker-editor.tsx:158–162 calls contour inside render useMemo; replace this with subscribed result plus demand in a committed effect or a small Jotai-backed bridge subscribed to canonical app state. Read active/shown state directly from deviceStore when submitting, so tool callbacks and DOM share authority. New result publication must not recursively trigger a fresh query for identical geometry/pose.

A small app contour bridge can be given the current StickerRearProjection by production-device-view and expose query result/demand atoms to sticker-editor. This avoids threading another prop through StickerCollection. Alternatively add explicit contourQuery to StickerRearProjection→commands→StickerCollection props→StickerEditor props; that approach requires sticker-collection.tsx in the manifest. Avoid smuggling subscription methods onto the existing contour function.

The editor has local lastPresentedAtom, activeEditorAtom, shownEditorAtom and presenceAtom. Submit while shown!=null and presence>0. Human state becoming null begins an inert fade, so keep that same presentation lineage during the positive exit. At fully hidden presence, hard-clear and stop demand. Tool editor is an independent derived state from tool property and placing/settling preview; do not treat human null as tool inactivity. clear/dispose must NOT be per-pose React effect cleanup: that cancels compatible active queries and starves completion.

Explicit session identity is missing. sticker-editor-model.ts's private session counter protects async write/reset only; selectStickerEditor does not increment it. New query-session token should advance on each actual select, including selecting the same sticker again, without changing existing write-session behavior. Tool identity should incorporate its real computation/gesture epoch and source role, retaining identity for compatible preview changes. External source replacement, source-role handoff, backend owner replacement and hidden document invalidate. Render must filter result lineage synchronously so a selection change cannot show old result for one commit before its effect clears it.

Current pointer begin already captures a fresh beginTransform plane and computes radius from its current projected pointer and state.draft; it does not use historical shape.center as mutation authority. Keep that path and pose/layout cancellation. Historical contour only locates rendered grips; human-dismissal and tool preview roots remain inert as today. Do not infer event authority from a published contour stamp.

## Owner lifetime and GL recreation trap

Native controller keeps one projection until controller disposal. GL StickerPackScene.tsx:124–130 currently recreates projection on orientation.visibleFace, packVisible, calculatedPresentation, rearCarry and sourcePlacementId in addition to scene/camera/canvas. If worker lifetime follows this unchanged effect it can retire repeatedly during flips. Stabilize physical projection ownership to scene/camera/canvas and use currentScene ref/demand barriers for changing pack/session/source; continue notifying actual pose changes separately. This requires StickerPackScene.tsx in C2 manifest and explicit runtime native/GL coverage.

Projection.dispose should cancel query owner and pending capture/visibility subscriptions alongside existing abort lifetime. Backend replacement must detach old result subscription before attaching replacement; old cleanup cannot null a newer handle. C1 generation guards prevent late worker publication. Window hide and layout change clear demand/results immediately; resume requests fresh coherent snapshot. Canvas rectangle must remain live under scroll/resize even with unchanged camera/geometry.

## Proposed manifest for lead lock

Required: packages/device/src/sticker-projection.ts and sticker-contract.ts; apps/web/src/production-device-view.tsx, sticker-editor.tsx; one app query bridge if selected; sticker-editor-model.ts for explicit selection session; packages/device/src/StickerPackScene.tsx for stable GL projection lifetime; packages/composite/src/device-render-host.ts and native-sticker-controller.ts for native admitted pose reader. GL pose adapter/contract changes remain unresolved and must be named before implementation. No sticker-visibility.ts change is currently necessary. C1 owns query owner/worker modules independently.

## C2 proof targets

Mounted human select→positivefade→hidden→same-ID reopen and tool carry preview; rapid compatible preview and independent hard source/session/layout/collider/backend barriers; subscribed exact final stationary result; no full contour call in React render; current plane input unaffected; owner unmount clears subscriptions and terminates/reserves correctly through C1. Preserve authored fading and existing error controls. Lead validates actual GL/native6× clean production after independent C2 review. Planning author may implement only after explicit reassignment; independent reviewer must then be another agent.
