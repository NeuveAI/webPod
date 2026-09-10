# Review: Deployment update notice

## Verdict: APPROVE

Final implementation, diary and evidence reviewed. The initial blocking identity mismatch is fixed. No unresolved blocking findings.

## Findings

- **Resolved Critical — client/server build identity differed** (`apps/web/vite.config.ts`). Module-level randomUUID was reevaluated across build environments. Fixed by a launcher-owned UUID inherited by the Vite child process. Root and Docker build paths both use this launcher; each invocation overwrites inherited identity, with no stale generated file. Independently confirmed second build identity `5d58a387-eb48-423b-bb8e-f205d0d4379c` in client/assets/index-DtIszThn.js and server/assets/router-BhZ1ZQD7.js. This differs from first corrected build `727329f9-8f67-4788-a6b5-a897d99f49e7`, whose parity and live endpoint were also independently verified.

## Independent checks

- Web TypeScript passed.
- Scoped eslint of build identity, update state/notice, root, version route, Start entry, Vite config and final build launcher passed. Web typecheck repeated after launcher fix passed.
- Existing welcome-entry, sticker-runtime and sticker-interaction-lifecycle suites: 41 passed, 0 failed, 278 assertions.
- Traced canonical Start endpoint, no-store response, HTML response revalidation, explicit location.replace retaining pathname/query/hash with one bounded version parameter, no local-storage mutation, query cancellation, visible-only scheduling, duplicate mount refcount and session dismissal set.
- Generated router type assertions are generator output, consistent with existing generated code; no new implementation type escape or useState.
- No static HTML exists in public or emitted client, so production dynamic HTML passes through the changed Start response wrapper.

## Browser, HTTP and evidence audit

Independently ran the final retained `evidence/update/browser-smoke.ts` successfully against the second production build on local port 4339. Assertions prove same version hidden, malformed/failed/offline checks quiet, foreground/online check, Later suppressing its version, different later version announcing, 44px controls, explicit Reload retaining route/query/hash/localStorage sentinel, one document navigation, visible 60s interval, hidden 120s quiet, maximum one request in flight and no subsequent poll after document cleanup. Browser errors were empty.

An earlier probe incorrectly counted both document navigation and TanStack's same-document URL normalization as reloads. Final probe counts actual document requests and records exactly one; two same-URL frame events are retained separately. This was an evidence defect, not an application double reload.

Independently verified `/api/version` is no-store and returns compiled identity; `/webpod` HTML has no-cache/max-age=0/must-revalidate plus CDN no-store. Production build log and differing-build evidence reviewed. Mobile screenshots and measured 390×844/320×568 notice bounds show readable compact content and visible 44px actions. The notice can overlap the lower shell/toolbar on a short phone, but Later remains reachable, no modal/focus capture is introduced, and active pointer capture/playback is not programmatically interrupted.

Scope, lifecycle, library contracts, static gates and evidence support approval. `git diff --check` passed. Existing mobile/haptics changes were reviewed separately; external `.gitignore` remains excluded. The launcher/package-script expansion was explicitly authorized and forms one coherent update-notice staging unit.

## Limits

Existing clients that predate this feature need an initial manual reload; they cannot receive a monitor they never loaded. Browser evidence uses intercepted deployment versions and a local production build, with real application notice/reload behavior. Production promotion and final remote cache/header checks belong to the supervisor. No new unit tests were added under the assigned scope.
