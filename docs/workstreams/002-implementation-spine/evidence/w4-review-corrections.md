# W4 review corrections — immutable calibration evidence

## Source identity

The first source-bound baseline is commit
`3c5db2aa4bffd070d116a20169213ae57259ecb5`, tree
`91bd3f74fa092585447e2bb55d4e2e010888e11f`.

- Rig SHA-256: `753df518a4123a1a157d3ef6b01df80ca3e968d1fb34ac4adbda572bb37ab53b`
- Lock SHA-256: `f0cae8a4d99a9d5a7e8e5587f18a57488f669aec55bfad47b55024591e1d71bc`
- Archive file count: 483
- Browser: Google Chrome 151.0.7922.174
- Viewport: the existing `/_spike/device` route at its fixed calibration viewport and DPR 1

Two separate named browsers against a fresh `git archive`, installed with
`bun install --frozen-lockfile`, produced byte-identical reports:

- report SHA-256: `2727153de49cf2061d2da83b95e896d1ccbebc4736bcae6fb9d3e78bd3483d36`
- 24/43 pass, RMS 8.729602094291078, worst 22.4129
- body black 2/8, body white 2/8, wheel black 3/4, wheel white 4/4,
  Select black 1/4, Select white 1/4, steel 11/11

The final restrained-seam visual correction was also measured twice. Both
checked reports have SHA-256
`fffa27707b80f7e48008fb090ed2e0a3aedb66901964454e0705cf8399be9fd2`:
24/43, RMS 8.733272850932646, worst 22.4129, steel 11/11, wheel white 4/4.

## Three 0.185.1 sheen roughness

The agentic-context clone is commit `ae46171bed` and reports Three 0.185.0;
it is not cited as 0.185.1. Installed Three 0.185.1 independently defines
`MeshPhysicalMaterial.sheenRoughness` over 0..1 and feeds it to both the
Charlie direct-sheen BRDF and integrated IBL sheen BRDF. The checked runner is
commit `48ed50d4174333eba80f0a8514e94b48f3af1dac`.

Raw schema/output:
`w4-sheen-roughness-raw.json`, SHA-256
`091839b248dadd6df85c977406464835ee46516ca80ba0f892ea8e0598cf0adc`.

Lowering the scalar from 1.0 to 0.1 changes every black-body row, proving the
live material path. It has the wrong direction: k0 changes −5.7040 and k7
−5.0636, while k3/k4/k5 change −7.1292/−7.0229/−5.2401. Because 1.0 is the
physical maximum, no upward continuation exists. The lever is live but cannot
brighten either deficient edge and is therefore not tuned.

## Molded edge-crown sweep

Model/runner commit: `6c90cdb`; archival runner commit: `c01b19f`.
Raw schema/output: `w4-edge-crown-raw.json`, SHA-256
`4640d895eacc3b0c4eb74c961f8fecb906e7f5394c047223e0122e72415535fc`.

The raw artifact contains all 43 rows for all 42 combinations:
depth 0.5..3px by 0.5 and reach 18..36px by 3. Across every candidate steel
remains 11/11, white wheel 4/4, and black-body k3-k5 are unchanged. Best k0 is
still −13.4831 at 3px/27px. k7 can enter tolerance (4.3378 at 3px/24px), but
there is no joint candidate because k0 remains far outside ±4.

Focused geometry gates prove: zero-profile byte identity; 330×552/r26 plan
geometry; 14px front thickness; positive-area triangles; unit analytic normals;
actual first-hit probe intersection; and unchanged wheel/screen clearances.
Boundary screenshots cover the corrected white baseline plus the bounded-crown
black front, white front, and steel back. These are evidence, not H-6 approval.

## Reproduction

```sh
git archive <commit> | tar -x -C <empty-dir>
bun install --frozen-lockfile
bun --cwd apps/web dev --port 3010
bunx agent-browser --session <fresh-name> open http://localhost:3010/_spike/device
DEVICE_CALIBRATION_SESSION=<fresh-name> DEVICE_CALIBRATION_URL=http://localhost:3010/_spike/device \
  bun run packages/device/calibration/tune.ts report
DEVICE_CALIBRATION_SESSION=<fresh-name> \
  bun run packages/device/calibration/tune.ts sheen-roughness-sweep <output>
DEVICE_CALIBRATION_SESSION=<fresh-name> \
  bun run packages/device/calibration/tune.ts edge-crown-sweep <output>
```

The ±4 threshold is unchanged. This evidence requests reviewer reproduction;
it does not independently declare a source conflict.
