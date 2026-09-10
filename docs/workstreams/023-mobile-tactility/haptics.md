# Mobile haptics implementation diary

Status: implementation and automated checks ready for independent review; physical-phone feel unverified.

## Source and version

Read scope.md, global-patterns and modern-web-guidance skills and global coding instructions. The modern-web-guidance search for haptic vibration touch cleanup returned no applicable vibration guide. Canonical API source: `/Users/vinicius/code/.better-coding-agents/resources/web-haptics/packages/web-haptics/src/lib/web-haptics/index.ts`, types.ts, and package.json. Exact installed dependency `web-haptics@0.0.6` matches canonical source version. Inspected installed dist/index.d.ts and dist/index.mjs. Constructor only allocates fields, the native support probe guards navigator, and DOM creation occurs lazily on trigger. Safari fallback synchronously clicks a hidden native switch before its RAF sequence; debug=false avoids all library audio. `cancel()` stops native vibration and RAF; `destroy()` removes fallback DOM, so cleanup deliberately calls both.

Bun add initially failed on the existing zod ^4.6.1 release-age gate. A per-command `--minimum-release-age=0` succeeded. No repository/global policy changed. Lockfile diff: one workspace dependency line plus the exact web-haptics resolution and its separator (3 added lines); zero existing dependency changes. No new transitive installs.

## Decisions

Shared adapter exported by existing composite package, avoiding a new workspace. Instances allocate their WebHaptics engine only at first admitted tactile event; mount owns blur/visibility listeners and unmount cleanup. Unsupported browsers without navigator.vibrate or native input.switch support return before allocating fallback DOM or RAF. Rejections are swallowed because haptics cannot break a control. No useState, queued pulses, debug sound, or audio-setting changes.

Touch-only wheel detents consume the authoritative feedback atom once per store. Agent, mouse, keyboard, coast and rejected detents stay quiet. Center/cardinal switch contact pulses originate only in touch pointer handlers and respect Hold. Detents are 8ms/.45 intensity, contacts 24ms/.85. Common rate cap 45ms prevents bursts of semantic detents from queuing physical pulses; audio budgets are unchanged.

Sticker pointer ownership records touch provenance. An admitted pickup emits 18ms/.6, advancing peel crosses 12px steps with 10ms/.4 and a 70ms cap, first complete detachment emits 30ms/.8, and an admitted valid release emits 38ms/.7 at docking intent. This pulse indicates contact intent, not successful server persistence. Failed/missed drops do not emit a later success pulse. Rear selection and editor touch grips also emit pickup; editor release emits contact. Shared semantic animation/tool functions only cancel feedback, never trigger it, so WebMCP cannot create sticker haptics. Generation supersession, cancelled capture, reset, hidden page, blur and unmount stop ongoing feedback. These brief patterns require no app-owned timers.

Ownership coordination: framing engineer alone adds camera prop forwarding in CompositeDevice; haptics changes only controller input/lifetime sections of that file. Unrelated .gitignore edit preserved.

## Checks

- `bun run --cwd packages/composite typecheck`: pass.
- `bun run --cwd apps/web typecheck`: pass.
- Scoped eslint across interaction-haptics, CompositeDevice, composite index and sticker-haptics/interaction/collection/editor: pass.
- Existing CompositeDevice integration, interaction-audio, sticker interaction lifecycle, WebMCP, collections-model, grab, editor-model, editor-carry and return suites: 103 pass, 0 fail, 755 assertions. Output: evidence/haptics/tests.txt.
- `git diff --check`: pass.
- No unit tests added, per scope/global instruction.
- Chromium mobile browser smoke on the existing `/_spike/device?capture=&view=front&colourway=black` route, with deterministic provider fixture at 390×844: real touchscreen center/menu contact and CDP touch arc/cancel. A native-vibration spy observed button PWM `[17,3,3,1]`, lighter detent `[4,4]`, and cancellation `0`. Zero page errors. With navigator.vibrate absent (and no Safari switch support), identical touch actions produced zero haptic calls, zero hidden switches and zero page errors. Results and actual coordinates: evidence/haptics/browser-smoke.json; screenshots native-spy.png and unsupported.png. These are integration dispatch proofs, not real motor measurements. Reproducible probe: evidence/haptics/browser-smoke.ts, run with `WEBPOD_SMOKE_URL=http://127.0.0.1:4338 bun docs/workstreams/023-mobile-tactility/evidence/haptics/browser-smoke.ts` against an existing local dev server.
- Browser initially used networkidle, which timed out on live resources; corrected to DOMContentLoaded, T1 readiness and a scene settling interval. T1 alone precedes full input mesh readiness. The existing spike capture route intentionally preserves desktop-style framing and was chosen to isolate haptics; framing evidence uses production /webpod separately.

The short patterns produce one native switch click each on Safari’s fallback. Its tactile strength/duration is OS-controlled; the Android/native-vibration distinction cannot be promised on iPhone. Patterns were not artificially lengthened without physical evidence.

Sticker tactile call sites have static ownership review and existing lifecycle tests, but this probe does not exercise full sticker gestures in a real browser.

Physical output and relative strengths have not been felt on Android or iPhone. Browser automation can prove dispatch, rate bounds and graceful no-op, but cannot verify motor output or Safari tactile quality. Review/owner should validate clickwheel detents versus contact and sticker adhesion on an actual phone.
