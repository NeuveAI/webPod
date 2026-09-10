# Live failure investigation after user correction

The previous success declaration missed a real provider response and encoded the wrong root loading rule. Fifteen is initial render readiness, not a background population stop.

Connected the installed official chrome-devtools-mcp1.9.0 CLI through autoConnect to the user's existing remote Chrome. Used CUA for real keyboard navigation and DevTools network response/evaluation for diagnosis. Only response metadata was inspected; request/header output was suppressed and header redaction enabled. No credentials, signing files or auth changes were used.

Before fix: Root remains15+ for playlists/artists/albums/songs. Entering Artists separately drains to271. Keyboard-select AC/DC (index20) and enter: All then Couldn't load more albums, matching user screenshot.

DevTools request63: GET https://api.music.apple.com/v1/me/library/artists/r.hYxXFAA/albums?limit=15 returns200, data.length8, meta.total8, no next. Seven albums have artistName. The Back In Black library-album has name, genreNames:[], playParams with isLibrary:true/kind:album, trackCount:0, but no artistName, artwork or releaseDate. Whole-page mapping throws Error: Apple album is missing metadata, verified through the actual source method in the same page. This falsifies pagination/URL/limit theories: no continuation was involved.

Album order: POWER UP; Rock or Bust; Live At River Plate [Disc1]; Live At River Plate [Disc2]; Black Ice; Back In Black; Let There Be Rock; High Voltage. Provider title spacing preserved in fixture based on response.

Before screenshot: acdc-before.png.

Post-fix CUA/DevTools verification after reload:

- Without entering categories, root source first showed artists215/albums114/playlists112/songs115, then UI showed Artists271/Albums461/Playlists112/Songs515+. Screenshot root-continuous-progress.png records progressive counts.
- CUA selected AC/DC: all8albums display in original order including Back In Black. Screenshot acdc-after.png.
- Selecting All displays real songs. DevTools inspected currentScreenAtom: route artist-tracks, rows80, navigationLoading false, first Realize, last High Voltage. This is completed real provider data, not a fixture.
- Root source eventually reached playlists112/artists271/albums461/songs2726, all state complete, without visiting each category.
- A later cache-budget integration HMR occurred during multi-page artist checking. That check must be repeated from a fresh reload after final implementation freeze; the observations above preceded that integration.

Final frozen-code repeat:

- Reloaded after both owners confirmed no further production writes. Root again progressed without navigation (Artists271/Albums461/Playlists112/Songs615+ observed).
- Used real keyboard navigation to Various Artists. Its real relationship contains40albums, although root-normalized album grouping had suggested33. The artist frame settles with41rows (All+40), navigationLoading false, last album Cyberpunk2077:Radio,Vol.3(OriginalSoundtrack).
- DevTools captured200responses for the same artist albums endpoint at initial limit15, offset15/limit15 and offset30/limit15. This proves real continuation beyond the original small-artist spotcheck.
- Entered All through keyboard and real tracks rendered immediately. Final DevTools state: artist-tracks,155rows, navigationLoading false, first Catastrophist, last Dead Pilot. Screenshot multi-page-artist-all-after.png. Root library simultaneously reports all collections complete:112/271/461/2726.
- Lead final git diff --check and apps/web tsc pass after byte-budget integration.

Cache distinction: Current cache holds JavaScript metadata, not media bytes or disk storage. StorageManager.estimate reports origin storage rather than safe JS heap. A configurable64MiB estimated relationship-retention default is an engineering choice, not a universal browser standard;1GiB should not be preallocated as metadata RAM. Sources: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria and https://developer.chrome.com/docs/devtools/memory-problems .
