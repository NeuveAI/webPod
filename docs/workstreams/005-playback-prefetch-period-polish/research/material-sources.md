# Material sources and extracted rules

## Primary visual evidence

The physical-device photographs are the geometry authority:

- `/Users/vinicius/code/tmp/ipod-reference/IMG_2270.HEIC` — Artists list: eight
  visible rows, compact single-line labels, chevrons, selected Aqua row, and a thin
  dedicated right rail.
- `IMG_2271.HEIC` — long song labels use inactive ellipsis.
- `IMG_2272.HEIC` — only the selected long row scrolls/marquees.
- `IMG_2273.HEIC` — Now Playing composition, artwork/metadata scale, progress/times,
  and bottom breathing room. Its visible queue count is overridden by D005-01.
- `IMG_2274.HEIC` — full-artwork center-button state.
- `IMG_2275.HEIC` — rating center-button state.
- `IMG_2277.HEIC` — Songs list density and scroll rail.

The owner-supplied current-state images are anti-references:

- `/Users/vinicius/.codex/attachments/3e7f6b8b-2f78-43a4-b786-d09f44b66938/image-1.png`
  shows the rejected count row and “Preparing playback” slab.
- `image-2.png` shows the desired eight-row list rhythm and thin rail.
- `image-3.png` shows period Aqua small determinate and diagonal-stripe indeterminate
  progress treatments.

## Apple primary sources

- [Apple iPod manuals index](https://support.apple.com/en-us/docs/ipod)
- [Apple iPod classic User Guide, 160 GB](https://cdsassets.apple.com/live/6GJYWVAV/user/ma1195_ipod_classic_160gb_user_guide.pdf)
- [Apple iPod classic User Guide, 120 GB](https://cdsassets.apple.com/live/6GJYWVAV/user/ma630_ipod_classic_120gb_en.pdf)

Extracted period behavior:

- Now Playing uses one persistent progress bar with elapsed and remaining time.
- Center cycles secondary playback views such as scrubber/artwork/rating rather
  than adding controls or help shelves to the standard screen.
- Center chooses the highlighted item; Menu goes back; Play/Pause owns transport.
- List destinations are signaled with chevrons and remain dense enough for eight
  visible rows.

## Supporting current Apple guidance

- [Progress indicators](https://developer.apple.com/design/human-interface-guidelines/progress-indicators):
  use indeterminate treatment only while duration is unknown, keep it visibly
  active, and switch to accurate determinate progress as soon as known.
- [Loading](https://developer.apple.com/design/human-interface-guidelines/loading):
  show the destination immediately and populate placeholders without blocking the
  whole screen.

Current HIG is supporting evidence only. Do not import Liquid Glass or modern iOS
styling into a 2005–2007 iPod surface.

## Browser implementation guidance applied

- Audio assets, if introduced, use correct `<link rel="preload" as="audio" type>`
  discovery without crowding render-critical bandwidth.
- Background prefetch uses low request priority; accepted input stays normal/high.
- Dynamic caches require explicit eviction.
- Async drill-down transitions to the destination shell immediately and respects
  reduced motion.
