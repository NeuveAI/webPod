# GL mounted placement lifetime — independent read-only audit

No application changes, browser actions or new tests. This audit is separate from the author's actual broker ledger investigation and does not claim that equal array lengths establish equal damage inputs.

## Static placement coupled to unrelated gesture epochs

StickerSurface.tsx37 passes `scene.pack?.computationEpoch ?? 0` to usePreparedStickerSurface, and line44 passes the same epoch to its StickerPrint. EquippedSticker is keyed by stickerId and remains mounted even while carried; its print is hidden, preserving the source geometry/query owner. That retention is necessary and must not simply be removed to reduce the ledger.

For an unchanged saved placement, the global epoch can still change at landing start, peel start and cancel: sticker-interaction.ts107–108 increments for every animateStickerValue and line70 increments on cancellation. The actual drop sequence in sticker-collection.ts316–321 invokes landing, then peel, then cancellation. ProductionDeviceView184 copies this global epoch into pack, and substitutes pack:null when hidden.

usePreparedStickerSurface requests again when computationEpoch changes (sticker-prepared-surface.ts44). Its canonical surface key is the same serialized semantic input, so the geometry computation can be reused, but prepareSurface24–28 restores a new BufferGeometry wrapper and registers only the surface descriptor. usePreparedStickerDamage sees the new geometry/wearGeometry identity. preparePrint39 derives its damage key from that wrapper identity. The new surface has no earlier damage descriptor, so the recently added exact source-descriptor reuse cannot discover the prior print's field. The old PreparedPrint is intentionally retained until the replacement is complete, overlapping current and candidate damage/contour owners.

This is a concrete unnecessary request/identity path. Whether it is the sole cause of the captured rejection requires owner/key correlation; no measured byte attribution is invented here.

## Carry-to-equipped distinction

The captured full-grid fields42 and45 both have28227 normal scalars and18818 UV scalars (97×97 vertices); contour44 is complete and46 is rejected. That topology is used both by static equipped geometry and by the landed carry wear target. sticker-carry-preparation.ts72–76 creates the target with createStickerSurfaceGeometrySteps and chooses it for wear when landing>0. Therefore field sizes and sticker ID alone cannot establish which field belongs to which mounted owner, or whether their normals/UV bytes are equal. Surface40 refs3 is consistent with a surface plus old/new print source pins, but does not uniquely identify that scenario.

Even if the target wear inputs match, carried visible positions can differ from static rear positions. Sharing exact damage is potentially valid; sharing the contour by sticker ID or topology alone is not. Existing equalStickerDamageInputs is the appropriate exact consumed-input check. Preserve independent contours when their geometry differs.

## Smallest correction candidates for author/lead

First, limit static EquippedSticker invalidation to its semantic art/form/placement/texture/wear lifetime instead of unrelated pack gesture epochs. The narrow source boundary is StickerSurface.tsx's two EquippedSticker epoch arguments. Keep transient PeelingPrint/SheetPrint gesture cancellation semantics unchanged. If a dedicated revision is needed, derive it from the actual static input authority, not a new global cache. Recheck current/previous publication and placement edits rather than removing the existing retained current frame.

Second, if ledger correlation shows legitimate carry-target→equipped overlap remains the peak, pass existing exact prepared damage provenance through that actual ownership boundary and reuse only after the current exact-input comparator succeeds. This must not transfer or detach the main query arrays, prematurely release the carried visual, omit visible contours or increase the96MiB cap. That seam needs author-confirmed ownership before implementation.

The persistent hidden packet/prepared-sheet and warmup roots also retain intended program/artwork owners, but this audit proposes no broad teardown or duplicated budget fix. Prior canonical-source reuse and non-full-grid reservation corrections are already in place and are not re-proposed.

Cancellation refinement: replacing the Equipped epoch with constant0 alone is insufficient as a general correction. The existing surface runtime owner key omits placement, intentionally permitting compatible transient updates. A static saved-placement edit should retain semantic cancellation by including the exact placement in its owner key (a narrow additional sticker-prepared-surface.ts change, or an explicit semantic owner argument). This distinguishes actual art/form/placement replacement from unrelated packet animation. The author must preserve that boundary; the proposed caller-only edit is not approved blindly.
