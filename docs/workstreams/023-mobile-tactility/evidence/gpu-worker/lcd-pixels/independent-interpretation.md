# Independent before-glass pixel interpretation

Parsed the final matching-colorway records from `/tmp/webpod-lcd-pixels-native-black.txt`, `native-silver.txt`, `gl-black.txt`, and `gl-silver.txt` (each with the same path prefix). Silver logs also contain the earlier Black record; that cumulative record was excluded. Reversed the eight GL rows to match native top-left origin.

| Flat background | Native linear RGBA8 | GL linear RGBA8 |
|---|---|---|
| Black | 24, 33, 43, 255 | 24, 33, 43, 255 |
| Silver | 250, 250, 246, 255 | 250, 250, 246, 255 |

The background samples match exactly. This provides no evidence of a base-background transfer mismatch. However, every one of the 64 GL samples equals that background, while native samples contain distinct header, text/battery and highlight regions. Consequently the captures do not demonstrate equivalent spatial content or UV sampling in the GL diagnostic quad. Differences at those non-background locations cannot be interpreted as color-transfer differences, nor can these results alone isolate the visible gap exclusively to glass. The constant GL output requires explanation before claiming full pre-glass parity. No particular binding, content-readiness or filtering cause is established by this grid.

Native Silver's room-light toggle was not verified because of a browser timeout. The material colorway is known; room lighting does not affect this borrowed unlit LCD sample. The grid is bilinear point sampling, not area averaging, and neither its elapsed duration nor equality of the flat samples establishes performance or full visual parity. No additional browser actions, source edits or heavy checks were performed.
