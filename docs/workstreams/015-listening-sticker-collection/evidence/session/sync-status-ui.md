# Sampled import status UI

`partial` now explains the intentional sample: “We synced a sample of your Apple Music library. Keep listening in webPod to earn more.” It does not claim a sync failure or offer an ineffective retry. `failed` retains the existing failed-sync message, reassurance that earned stickers are safe, and Retry sync action through the current collection command boundary. Complete, pending and absent status show no notice.

The notice was extracted inside `sticker-collection.tsx` into a small stateless presentation component. Existing Jotai inventory remains the sole status source. Its existing location, colors, spacing and button touch target remain unchanged; no layout, pack or motion redesign was introduced. A polite semantic status role now identifies the notice. Artwork failure retains its existing priority and retry.

Skills/references: Modern Web Guidance search executed before this UI task; its closest matches concerned form validation or unrelated reactive state, so no unrelated pattern was introduced. Read Interface Craft, Interface Design Guardrails with all four resources, Neuve Motion and Jotai State guidance. Grounded shared atom reading in local `resources/jotai/src/react/useAtomValue.ts` and existing deviceStore usage. Applied the craft principles of accurate expectations, concise language and removal of ineffective controls; preserved the existing storyboard, motion constants and reduced-motion paths.

Quality assessment for this bounded change: clarity 4/5 (sample vs failed explicit), honesty 5/5 (actual failures retain retry), cohesion 5/5 (same notice style and command boundary). No visual redesign claim or new screenshot baseline is needed for this copy/action distinction.

Verification: `bun test apps/web/src/sticker-import-status.test.tsx` passed **5 tests / 18 assertions**. Tests render the actual notice, assert sampled status has no failed copy or button, failed status has the safe inventory message and binds/invokes the current retry handler rather than an earlier callback, and complete/pending/absent status render nothing. App TypeScript and scoped ESLint passed. This focused test checks presentation and handler binding; it does not replace existing full pack browser gesture tests or backend retry tests.

Review correction: the neutral sample message also covers imports with zero eligible genres and no starter pack; the regression explicitly rejects a starter-pack promise.
