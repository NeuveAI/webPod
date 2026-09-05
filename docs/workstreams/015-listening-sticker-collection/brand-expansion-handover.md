# Expansion handover — brand lane

Active document: `/Users/vinicius/code/webPod/docs/design/stickers.pen`.

Six additional packs, five original sticker designs each; 30 total. Every board is 1440×1200, explicit genre header, 3+2 layout and illustrative listening caption. Canonical material: ivory #F3EBD7, carbon #191A19, worn ink beneath flat satin. Proposed genres are browsing categories, not an exhaustive taxonomy. Latin pack is a rhythm-led exploration with salsa/clave references, not a claim that all Latin genres use clave.

## Palette and node inventory

### INDIE — SMALL HOURS

Board `vJnAY`; palette sage #779782 and coral #D97D6A. Source: `docs/design/images/playworn-indie-sheet.png`.

- PW-I01: **Demo Days** — node `hsray`. Revisit an early release.
- PW-I02: **Hidden Track** — node `hd5v6`. Explore a less-played song.
- PW-I03: **Room Tone** — node `FO5QQ`. Stay with a whole EP.
- PW-I04: **Paper Moon** — node `kbA9s`. An evening listening session.
- PW-I05: **Local Hero** — node `LFJ1e`. Discover an unfamiliar artist.

### JAZZ — BLUE ROOM

Board `N8nMt`; palette deep navy #203B5A and mustard #D4AD49. Source: `docs/design/images/playworn-jazz-sheet.png`.

- PW-J01: **Off Beat** — node `LvPvd`. Explore a new rhythm.
- PW-J02: **Blue Hour** — node `tqh80`. An evening album session.
- PW-J03: **Take Five** — node `DqVwa`. Return to a favourite recording.
- PW-J04: **Long Solo** — node `qULJk`. Stay for the long track.
- PW-J05: **Side Notes** — node `p3SwPc`. Explore an album deeper.

### CLASSICAL — LONG FORM

Board `Be3p1`; palette burgundy #71334A and pale blue #8AA7BD. Source: `docs/design/images/playworn-classical-sheet.png`.

- PW-H01: **First Movement** — node `S8fNE`. Begin an unfamiliar work.
- PW-H02: **Quiet Power** — node `jAgbt`. Listen to a quiet passage.
- PW-H03: **Encore** — node `t7Ouxm`. Return for another listen.
- PW-H04: **Counterpoint** — node `KP6pe`. Explore another interpretation.
- PW-H05: **Finale** — node `NnQMq`. Finish a complete work.

### COUNTRY — OPEN ROAD

Board `V90FNP`; palette denim blue #3E6481 and rusty orange #BE6845. Source: `docs/design/images/playworn-country-sheet.png`.

- PW-K01: **Six Strings** — node `HuaUI`. Find a story that stays.
- PW-K02: **Radio Miles** — node `fqttR`. Take a listening journey.
- PW-K03: **Steel Line** — node `VAk6q`. Explore a new instrumental voice.
- PW-K04: **Back Porch** — node `xk0lC`. Return to a familiar album.
- PW-K05: **Last Verse** — node `wrwlh`. Stay through the last song.

### REGGAE — VERSION SIDE

Board `q1EjJ`; palette deep teal #267A75 and ochre #D9AF4D. Source: `docs/design/images/playworn-reggae-sheet.png`.

- PW-G01: **Version** — node `MewjM`. Explore another version.
- PW-G02: **Echo Chamber** — node `z93rdJ`. Return to a favourite groove.
- PW-G03: **Low End** — node `jjLGf`. Explore a bass-led track.
- PW-G04: **One Drop** — node `PQ7iA`. Find a new rhythm.
- PW-G05: **Dub Plate** — node `I6gNK`. Dig into a deeper selection.

### LATIN — CLAVE CLUB

Board `fBfy3`; palette warm coral #E26B52 and turquoise #339B9A. Source: `docs/design/images/playworn-latin-sheet.png`.

- PW-L01: **Clave** — node `xSvga`. Discover a new rhythmic pattern.
- PW-L02: **Otra Vez** — node `p8kEg`. Play a favourite again.
- PW-L03: **Turn It** — node `ribrK`. Build a rhythm-led queue.
- PW-L04: **Night Ticket** — node `ImtHM`. An evening listening session.
- PW-L05: **Percussion** — node `bPJME`. Explore an unfamiliar ensemble.

## Representation and validation

Pencil SVG generation returned 29 empty targets and an isolated retry failed; app reported server unreachable. Built-in imagegen created one five-piece RGBA sheet per genre. Each of the 30 sticker frames holds a separately movable, aspect-preserving raster crop referencing its shared sheet. These are approval artwork, **not independently vector-editable or integration-ready assets**. Demo Days original generated SVG is retained disabled beneath matching raster. Seven small board-colour rectangular exclusion masks suppress neighbour slivers in country/reggae crops; these are approval-view masks and must not be exported as standalone transparent production assets. Final asset separation/alpha cleanup belongs after user approval.

Native screenshots and PNG exports again return blank backgrounds for new frames despite valid content; six PNG exports in evidence are diagnostics, not usable previews. Reliable complete preview: `/Users/vinicius/code/webPod/docs/design/playworn-brand-six.html`, exported beside source image files and inspected through Pencil browser. Query selector `[data-pencil-id="BOARD_ID"]` captures each board. Browser navigation is shared, coordinate with supervisor.

Independent review: indie, jazz, classical and Latin passed; country/reggae neighbour slivers identified and masked without changing artwork. All footer text moved to y1100; structural check reports no clipped text. Shared sheet rectangles intentionally exceed their cropped parents. Other board-level content stays within bounds. Final reviewer confirmation requested for corrected country/reggae previews.

## Grounding

- [Cooper Hewitt — Art of Noise](https://www.cooperhewitt.org/2025/09/10/art-of-noise-exhibition-tracing-history-of-music-and-design-to-open-at-cooper-hewitt/): historical sleeve design connects music to graphic identity; jazz and salsa are distinct references, not copied layouts.
- [Smithsonian — Salsa’s Roots](https://latino.si.edu/exhibitions/puro-ritmo/qr/salsas-roots-case): clave and Afro-Cuban roots inform two percussion motifs in this exploratory Latin pack.
- [V&A — Dennis Bovell and Mad Professor](https://www.vam.ac.uk/event/LqneOrDKE7/how-we-made-it-dennis-bovell-mad-professor-25-jun-2026): studio experimentation and sound-system performance inform VERSION SIDE.
- [London Museum — Dub in London](https://www.londonmuseum.org.uk/collections/london-stories/dub-london-shops-sound-systems-legends/): studio as instrument supports delay, speaker and version motifs.

## Prompt record

Built-in imagegen, six contact-sheet requests; no CLI/API key. Shared prompt: strict three-column/two-row five-piece sheet, sixth cell empty; separate clear silhouettes; original 90s/Y2K record-shop imagery; canonical ivory continuous die-cut edge and carbon keyline; sparse worn print, flat satin, no logos, caricatures or national symbols. Genre motifs and palettes are listed above. RGBA source outside pixels verified alpha=0. No app code or git operations.
