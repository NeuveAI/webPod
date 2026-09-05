# Visual evidence

`before-{black,white}-{front,oblique,side}.png`: initial worktree, existing production-surface isolation on /_spike/device. These show enclosure materials with the LCD content isolated out.

`after-{black,white}-{front,oblique,side}.png`: Classic materials and thin front profile on the same existing isolation mode. `white` is the persisted identifier for Silver.

`ui-{black,white}-{front,oblique,side}.png`: actual production UI with the existing deterministic Apple Music browser fixture. The capture changes Black to Silver during one live session; the LCD stays populated after the lifecycle fix. Fixture content is not a live library or playback claim.

Captured in installed Chrome with CanvasDrawElement at 1280×900, DPR 2. Run `CAPTURE_UI=1 CAPTURE_PREFIX=ui bun docs/workstreams/014-classic-consolidation/evidence/capture.ts` with the local app on port 3000. Omit CAPTURE_UI for material isolation. No proof-only product route was added.

Inspection: the metal front has broad highlights, restrained fine grain, and a matching Select finish. The black wheel is darker matte plastic, the silver variant has a light wheel and dark ink. The side band is thinner. No new screen wall or bezel is present; the original opening and cover remain intact. The polished steel back remains highly reflective.
