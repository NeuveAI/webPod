# Temporary LCD sampler diagnostic-fit review

Disposition: APPROVE for the bounded temporary capture only. Independently inspected the final GL timer hardening and verified source SHA-256:

- screen-mesh.ts: `7825795301d6dd82f9ef639f85d84fae655edddd2c3984bb92baee17f45d8a1d`
- device-render-worker.ts: `4fc8f15d3f43d8dc9710d4639aace294640e38802370596d257f580cabc20b15`

Both paths borrow the actual installed LCD material without explicit mutation or disposal. Their canonical quads sample into explicit 8×8 linear RGBA unsigned-byte targets. Renderer state restores synchronously before asynchronous native readback. Native staging memory has owned destruction on completion, rejection, timeout and retirement. GL removes pending timers on material disposal and HMR, and checks detached mesh/canvas before allocation or renderer-state changes. Its synchronous read cannot be preempted; the elapsed deadline rejects a late result rather than guaranteeing a bounded driver stall.

Normalize GL bottom-left rows to native top-left before comparison. The native material's actual texture UV reflection remains part of its sampled pipeline; do not add a second texture flip. These are bilinear pixel-center samples, not averaged image regions. Use identical settled content and favor flat fields when localizing the pre-glass difference. Matching samples do not establish whole-image parity, PMREM equality or glass correctness; elapsed readback is not performance evidence.

No application edits, browser actions, build or additional heavy checks were performed by the reviewer. Restore both source files byte-exact after capture. Full native activation remains blocked by the independently observed visual gap until its cause and correction are verified.
