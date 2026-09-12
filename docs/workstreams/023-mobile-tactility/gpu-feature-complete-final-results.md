# Final live acceptance

Production source 1b007f6, original user Chrome remote-debugging session and localhost:3000/webpod, iPhone phone viewport 440×956, CPU 6×. Actual devicePixelRatio measured 3; earlier handoff's DPR2 assumption was stale. The alternate-width acceptance keeps DPR3. Raw CDP only targets the original webPod tab. The user's original Performance recording remains stopped; no new trace was needed.

## Sticker gates passed

Evidence: [final artifacts](evidence/gpu-worker/feature-complete-final/).

- Explicit GL: actual saved PW-A01 width .7204816442896202, physical corner rotation 90→100.4074328147916° in grip presentation. Contour present, no artwork/capacity alerts, cancellation restores original contour and full placement exactly, held null and pending saves zero. This is the real formerly failing wide wrapped case.
- Default worker: same actual placement, admitted physical corner preview and cancellation, contour present and no alerts; exact placement retained, held null and pending zero.
- Both renderers: registered placed get/rotate/release produces visible, inert tool preview with contour; release preserves placement exactly, no pending save.
- Native collection: physical Soundcheck pickup from the opened liner displays a carried sticker while pack retracts. Touch cancellation alone leaves the floating draft; Escape cancels it through the existing interaction path. No saved placement added or changed. Immediate tool attempts did not admit a draft and are not counted as successful pickup. Settled physical pickup meets the finite fallback case.
- Collection tool guards are independent of renderer: active displayed collection, earned unplaced sticker, untucked pack and progress≥.99. Placed pickup tucks the pack and release does not untuck it; an owned/available catalogue record alone does not establish eligibility. Read-only independent inspection found no first-select requirement or native-specific grab branch.

## Input and media passed

Physical Select enters Songs (2726 items), MENU returns to Music (5 items), and selection/playback controls respond during the handling sequence. MusicKit state moves through loading 1, paused 3, playing 2 with playback time advancing to 2 seconds, then paused 3 at 3 seconds. This proves numeric state/time progression, not a claim of audible output. Original paused condition is restored. Physical clockwise/counterclockwise wheel arcs change selection; explicit registered navigation restores Music→Songs index3 after the bounded arc test.

## Resize and reduced motion passed

440→500→440 width at DPR3 preserves visible editor/contour on all three snapshots and effective worker, with no alerts. The earlier trial changed DPR as well and dismissed the editor; it is excluded from the same-DPR round-trip claim.

Reduced-motion emulation is confirmed true, physical Select/MENU plus back/front orientation complete, final held/animating flags false. Original no-emulation is restored and matchMedia is false. The earlier reduced-motion entry proof remains applicable: invisible GL preparation does not change authored entry behavior.

## Actual hide/resume finding

Real visible→hidden→visible events were recorded using one temporary about:blank tab in the same Chrome window, then that tab was closed. Full placement remained exact, pending saves zero and animation stopped, but isBeingHeld stayed true until the explicit cleanup touchCancel. This is a failed final gate on 1b007f6, not a pass. A focused visibility cancellation correction and independent review are in progress; the final current-source retest will be recorded below.

## Coverage qualification

Genuine GPU loss has not safely been induced in the shared Chrome session. Earlier controlled lifecycle and actual preparation-failure fallback evidence are separate and do not prove genuine GPU loss. No shared GPU crash or fake loss API is used. Targeted contour/panel CPU profiles and qualified long-task runs remain applicable to their unchanged paths; no universal GPU FPS or statistical speedup claim is made.

## Corrected final gate and closeout at d9434f5

The independently approved visibility correction passes the exact current-Chrome production retest: actual visible→hidden→visible events; isBeingHeld false **before** manual touchCancel; animation false, held sticker null, pending saves zero, exact saved placement. A fresh touch after return is admitted and moves yaw to22.68°, proving reentry, then cancels cleanly. Evidence webpod-hidden-fixed.json and webpod-hidden-reentry.json.

Clean production build passes on d9434f5's exact source (built immediately before committing the frozen, approved files). The earlier all14typechecks cover the unchanged source; final affected web typecheck, scoped lint and36tests/205assertions independently pass. Source and served production assets contain none of the temporary diagnostic marker strings. Existing GL/native quality/parity and bounded worker proofs remain unchanged.

Final production state: front, no held device/sticker or animation, no pending save/alert, exact original PW-A01, Music with Songs index3, playback stopped, default worker,440×956DPR3, reducedmotion false and no diagnostic globals. Temporary blank tab closed, bounded visibility observer/timer removed. Original Performance Record remains0 and CPU6× remains set. No profiler or trace started during this closeout.

Normal Vite devserver restored at the original origin and route returns200. After dependency optimization completed, registered final state matches the accepted state above: default worker, exact saved sticker, Music/Songs index3, stopped playback, no held/animation/pending/alerts,440×956DPR3 and reducedfalse. Evidence webpod-closeout-dev.json. Production validation server was stopped. PR6 remains unmerged and undeployed by this closeout.
