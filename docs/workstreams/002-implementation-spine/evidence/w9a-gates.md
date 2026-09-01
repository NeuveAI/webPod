# W9a final gate evidence

Run from `/Users/vinicius/code/webPod` on September 1, 2026, after every
mutation plant had been reverted.

| Command | Result |
| --- | --- |
| `bun run typecheck` | exit 0; 11/11 TypeScript projects clean |
| `bun run lint` | exit 0 |
| `bun test` | exit 0; 1,072 pass, 0 fail, 66,254 expectations across 66 files |
| `bun run build` | exit 0; Vite client and SSR builds complete |
| `bun run gates` | exit 0; 16 automated pass, 0 automated fail; U14/U15 manual |
| scoped `git diff --check` | exit 0 on every W9a path |

The build reports the existing large-chunk warning for the 1.23 MB Three.js
client bundle; it is advisory and unchanged in kind. The repo-wide diff check
also sees two trailing spaces in the concurrently edited W8 evidence file
`evidence/volumetric-device-browser.txt`. That foreign file is not part of
W9a and was left untouched.

The focused physics and mounted-input tests cover:

- local deformation at 0°, 90°, 180° and 270°
- signed-angle seam continuity and travelling captured-ray contact
- Select travel greater than wheel travel
- position and analytic normal mutation, followed by byte-exact rest arrays
- rotated body-local surface normals
- zero idle frame requests and a bounded release under frozen timestamps
- mouse, touch, pen and semantic Enter
- release, cancel, lost capture, window blur, visibility loss and unmount
- fixed invisible hit planes and native selection prevention

See `w9a-mutations.md` for the five deliberately falsified mechanisms and
`w9a-browser.md` for the 16 key/fill/combined macro captures.
