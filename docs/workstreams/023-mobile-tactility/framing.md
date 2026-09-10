# Mobile framing and edge acquisition

Review-ready, 2026-09-10. Read full scope and global-patterns/global guidance before implementation. Modern Web Guidance CSS research was provided by lead. No Three/Fiber reference checkout was available under the required resources root; inspected installed Three 0.185.1 camera implementation, canonical camera-fit/envelope and R3F event code instead. No new unit tests or commits.

## Decisions and ownership

Opt-in `cameraMobileFraming` crosses ProductionDeviceView and CompositeDevice by forwarding only (coordinated with haptics engineer/lead). DeviceCanvas selects compact fit for <=520px width or <=960px width with <=520px canvas height; desktop remains 30°/48px and every capture route opts out. Explicit cameraDistance also bypasses compact fitting.

Use 8 CSS px padding, 4% total margin, and 12° field of view on phones. The existing 30° lens's perspective allowance limits width to approximately 82% even with small padding; the longer lens permits about 90% while retaining one immutable full yaw/pitch camera fit. No pose-following zoom. Camera diagnostics now refresh on viewport resize too.

The mobile stage reserves 8px/safe-area top and 60px + bottom safe area for a separate toolbar; toolbar buttons have 44px minimum height. Uses existing device-page style system, with no new components.

Touch hits widen from 18 model units to a projected 44 CSS pixel inward shell band, capped at one-quarter body width at severe foreshortening. Mouse/pen remain precise. First-visible-shell ownership remains mandatory; explicit front-glass and wheel exclusions prevent widened targets from taking their input even if a decorative mesh has no event handler. Sticker intersections retain precedence. Near-edge contacts outside the shell are intentionally not newly admitted: no invisible plane overlays the sticker/control ray pipeline. The effective band narrows near occupied controls and for a very small/edge-on device. This is a substantial acquisition increase on the exposed shell, rather than a claim every point on every edge has a 44px target.

## Browser evidence

Existing `/webpod` route, Chrome with CanvasDrawElement, existing deterministic Apple Music fixture (synthetic provider, no actual credentials). Reproduction: run web app dev server on 4338 and `bun docs/workstreams/023-mobile-tactility/evidence/framing/check.ts`. `baseline.ts` overrides only served device-page mobile opt-in/attribute in the browser response to reproduce the previous 30°/48px/full-stage layout; it does not rewrite working-tree files. Baseline is a camera/layout comparison, not a historical haptics implementation.

Final settled measurements (`measurements.json`, after two seconds for reveal):

| Viewport | Projected body | Width of viewport | Notes |
| --- | --- | --- | --- |
| 390x844 before | 263.18x440.55px | 67.5% | prior framing |
| 390x844 after | 349.47x584.99px | 89.6% | 32.8% larger width |
| 320x568 | 246.15x412.05px | 76.9% | height limits enlargement while retaining full yaw/pitch envelope + toolbar |
| 844x390 | 156.93x262.68px | 18.6% | short landscape; full upright body and toolbar remain visible |
| 1280x900 | 407.95x682.89px | 31.9% | desktop 48px fit retained |

At all four sizes a touch 35px inside the side shell admitted the grab. A 35px horizontal/10px vertical move produced yaw 14.7° and pitch 2.8°; touch cancellation released it. LCD/wheel/Select probes did not admit orientation and retained zero orientation. See JSON and portrait/landscape screenshots. A 45° yaw + 45° pitch screenshot remains fully visible at each size with identical camera distance before and after pose changes.

`sweep.ts`/`sweep.json` independently evaluate the fixed camera across yaw -180..177° and pitch -48..48° at 3° increments for all mobile canvas sizes. All projected corners remain within fitted NDC limits. Explicit modifier roll remains the existing separate mode outside the ordinary yaw/pitch envelope contract.

Checks: 71 existing tests pass (camera-fit, orientation-grab, orientation, device-preview-orientation; 378 assertions). Device and web typechecks pass. Scoped eslint of changed framing TS/TSX passes. `git diff --check` passes. No physical-phone touch-feel claim; emulated touch checks validate routing/capture, not subjective usability.

Initial browser attempt mistakenly used an unrelated already-running localhost:3000 site; corrected to dedicated webPod port 4338. No artifacts from that attempt retained. Early screenshots were replaced after waiting for reveal settlement; final files above are authoritative.
