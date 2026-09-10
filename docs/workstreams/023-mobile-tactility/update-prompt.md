# New-version prompt dispatch

Ready. Owner requests a new-version banner/CTA because the phone appears stuck on old code. Prior deployment was preview only, so production-versus-preview is a confirmed possible explanation and must be communicated. No service worker found. Continue on codex/mobile-tactility; preserve existing reviewed changes and external .gitignore edit.

## Correctness

Build identity is generated once per build, shared by emitted client and server, changes even with uncommitted code, and never exposes environment or credentials. A canonical TanStack Start GET route returns current identity with no-store. Page HTML must revalidate; hashed assets may remain cached. No parallel HTTP domain router.

App observes deployment identity using existing TanStack Query/core and Jotai patterns. Check on initial visible mount, return to foreground/online, and a modest visible-only interval (60 seconds). One active request at a time, timeout/abort, cleanup. Malformed/failed/offline checks remain quiet, no false banner. Compare to compiled client identity; same build never prompts. Keep dev quiet. No useState.

Accessible, compact banner: “A new version is ready” and “Reload” plus “Later”. Mobile safe-area aware, 44px controls, nonmodal/no focus steal, existing UI button or plain semantic styles if no suitable component. Reload is explicit, preserves path/query/hash, forces a fresh navigation via bounded version cache key, never clears storage, and does not auto-interrupt playback or a sticker gesture. Explain in small copy that reload pauses playback. Later dismisses this version for this page session; a different version can notify. No version hashes shown in product UI.

## Ownership and verification

Implementer owns new update modules, root shell wiring, vite build identity configuration, route plus generated route tree, and only necessary HTML header change in production server transport/Start entry. Ground library contracts in local resources and installed versions. Read global-patterns, Jotai/TanStack patterns, modern web guidance already searched by supervisor. No new unit tests per global instruction; use retained browser verification script on existing /webpod and existing tests. No new proof-only app routes apart from product version endpoint. No credentials, encrypted pen, auth/provider/storage mutation, unrelated refactors, commit or deployment.

Prove same-version hidden; different-version visible; Later hides without reappearing for same identity; later distinct identity can display; bad/offline quiet; foreground check; one reload preserves location and saved local data; no duplicate polls after cleanup. Mobile screenshot, production build endpoint/cache headers and compiled identity parity required. Artifact paths: update-diary.md, evidence/update/, update-review.md in this workstream. Record tuning assumptions and exact checks there. Typecheck web and lint changed files, production build, existing affected suites.

Independent reviewer audits identity stability, caching and reload semantics, lifecycle/query state, SSR, route behavior, UI collisions, and real version switch browser evidence; separate instance required. Definition of done is those gates pass and no unresolved blocking review finding. Real already-open old clients cannot receive a feature they never loaded; explicitly report bootstrap limitation. Publishing production is not part of this dispatch.

Build-parity verification found Vite/Start evaluates config separately per environment, so config-local UUID is invalid. Supervisor authorized necessary ownership expansion into `apps/web/scripts/build.ts` and app manifest build script: a single build launcher generates the identity and passes it through the child build environment. Validate two fresh builds differ, each client/server pair matches, and root/Docker builds still use canonical app build script. No persistent generated identity or unrelated manifest changes.

History intent: `Notify listeners when a new app version is available`, stage independently from mobile/haptics changes.

## Owner deployment clarification

Owner confirmed phone uses `webpod.vercel.app` and that “deploy” means production, not preview. Supervisor promoted the previously reviewed mobile/haptics source: production deployment `dpl_6SMLCcSaQ24f1QBeQVVHJuvVGZM5` is Ready, both production aliases assigned, `/webpod` and its mobile/haptics bundle return HTTP 200. This corrects the immediate old-version cause. After the banner passes independent review, supervisor will deploy it with `--prod`; implementer still does not deploy. Already-open clients need one initial reload to acquire the update monitor.

## Completed production rollout

Independent update review approved. `bunx --bun vercel deploy --prod --yes` completed as `dpl_dqnMEfDMQTLhUEo8YSeQePqx6kPF`, Ready and aliased to `https://webpod.vercel.app`. Live verification: `/api/version`, `/webpod`, and referenced client bundle HTTP 200; version endpoint no-store; HTML no-cache,max-age=0,must-revalidate; public build ID `530fe354-625e-4c47-bca0-b2b24afd24b8` matches emitted client; new-version notice copy present in served client. No commits created.
