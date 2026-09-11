# Independent route activation source review

Disposition: APPROVE for the single-line route preference only. `apps/web/src/device-page.tsx:323`, SHA-256 `b084488b6042270a753329ec76c01d4b7960e04dd0b5ca04990b10a484908bfa`, now passes `rendererBackend ?? 'worker'` to ProductionDeviceView. Undefined selects worker; explicit webgl and worker retain their values.

Canonical `routes/webpod.tsx:7–8` still accepts only the two supported query values. ProductionDeviceView forwards the value unchanged. Reusable CompositeDevice still defaults to webgl, and its existing per-owner Jotai failure state selects the complete DeviceCanvas fallback after WorkerDeviceCanvas failure; this patch changes neither renderer lifecycle nor persistent-state ownership.

Independently verified exact one-line diff/hash, web typecheck, scoped lint and diff whitespace check; all pass. No new tests, browser, build or application edits by reviewer. This is not evidence of successful no-query runtime activation: lead's clean build, supported-browser selection and final interaction/lifecycle smoke remain required. Induced-loss coverage and final human/process decision remain separately qualified.
