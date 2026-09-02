# Select press production evidence

This directory records the mounted correction for the iPod 5G center/Select
button. It does not claim owner visual acceptance.

## Immutable source and route

- implementation commit: `024c15137ccf7bb0587a7706629f555d02728dbe`
- tree: `228d352097efdf6b85c45d4493962490cd553caa`
- source fingerprint: `298b7aaf8a29006b2942f427a83c8f2561002e3b0e3ccec38aa7a8f3587ff294`
- source files: 200
- route: `/_spike/device`
- browser: installed Chrome with `CanvasDrawElement` enabled
- composite tier: T1
- proof path: ordinary production mouse move → down → hold → up → 96 ms
  demand-driven release; no query parameter, synthetic pose or proof API

`summary.json` records every full-frame and close-crop SHA-256. For both
colourways and both poses, each released image equals its rest image byte for
byte, while each held image differs.

## Capture matrix

Each row exists as a full 1280×960 route capture and a 220×220 Select close crop:

| finish | pose | states |
|---|---|---|
| black | front | rest, held, released |
| black | three-quarter | rest, held, released |
| white | front | rest, held, released |
| white | three-quarter | rest, held, released |

The front close crops show a restrained seam change. The three-quarter close
crops expose the negative device-local depth more clearly without changing the
button's base color, opacity, material, geometry or outline. These images are
evidence that the production path presents the authored transform; whether the
response is visually accepted belongs to the owner.

## Physical and runtime facts

- rest child-local transform: `(x, y, z) = (0, 0, 0)`
- held child-local transform: `(0, 0, -0.6407766990291263)` model units
- physical calibration: `-0.12 mm` device-local Z
- exact invariants: child-local X/Y, quaternion, scale, geometry positions,
  geometry normals, material identity and material serialization
- the parent rest frame remains declarative; the child has no JSX `position`
- the fixed floor is two annuli only, not a disk behind the button
- the click-wheel tilt, navigation, detents and SFX paths are unchanged

## Reference hierarchy

Owner-primary photographs are local 4032×3024 HEIC files supplied for this
workstream: `IMG_2239`, `2240`, `2242`–`2246`, `2248`, and `2249`. They establish
the white 5G's separate matte-plastic center, near-flush rest relationship,
uniform narrow seam, and absence of a metallic or decorative border. The
photographs do not expose a trustworthy pressed-travel dimension.
`owner-heic-sha256.txt` records their exact source identity without copying or
transcoding the owner files into the repository.

External corroboration:

- [iFixit 5G click-wheel-button replacement guide](https://www.ifixit.com/Guide/iPod%2B5th%2BGeneration%2B%28Video%29%2BClick%2BWheel%2BButton%2BReplacement/611)
- [iFixit black replacement part — plastic button only](https://www.ifixit.com/products/ipod-video-click-wheel-button-black)
- [Apple iPod manuals and downloads](https://support.apple.com/en-gb/docs/ipod)

iFixit establishes that the center is a separate removable plastic part and
that the electronics live below it. Apple documents behavior, not mechanical
travel. No reviewed source publishes 5G Select travel, so 0.12 mm is recorded
honestly as bounded visual calibration rather than an OEM dimension.

## Mutation evidence

See `mutation-plants.md`. Each plant first asserted that its edit landed, then
ran the focused gate, and was reverted with a path-local patch. No unrelated
worktree file was restored or staged.

## Gates from the immutable implementation commit

Because a parallel orientation lane advanced and dirtied the shared checkout,
the complete suite was rerun in a detached Git worktree at `024c151…` rather
than attributing mixed-tree results to Select:

- focused Select/physics/input: 27 pass, 0 fail, 987 assertions
- complete device package: 198 pass, 0 fail, 73,307 assertions
- typecheck: 11/11 projects clean
- lint: clean
- repository tests: 1,111 pass, 0 fail, 77,609 assertions
- `apps/web` production build: pass
- automated gates: 16 pass, 0 fail
- manual gates left outstanding by the repo runner: U14 thumb occlusion and
  U15 unsupported-control inspection

The ordinary-route Chrome evidence test independently passed against the same
commit, tree and fingerprint after the implementation commit was no longer
the shared checkout's `HEAD`.
