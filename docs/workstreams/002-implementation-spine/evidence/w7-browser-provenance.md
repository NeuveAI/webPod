# W7 flagged-browser provenance

Runner:

`W7_SOURCE_COMMIT=d66c66bfdc8d1e284739dc3ecf73ac80b537e4fa bun run scripts/w7-browser-evidence.ts`

The runner archives exact commit `d66c66bfdc8d1e284739dc3ecf73ac80b537e4fa`
(tree `7d93de5f0b960adf1ecd3bba72114444bac63ad3`) into a temporary immutable
snapshot. The archive contains only runtime package/app inputs and excludes
credentials, `.env*`, `.claude/`, `design.pen`, Git metadata, generated output,
dependencies, and docs. Dependencies are installed from the frozen lockfile.
Vite serves only that snapshot on strict dedicated port 3017 with reuse
forbidden; Chrome uses a fresh profile and CDP port 9337 with
`CanvasDrawElement` enabled.

The runner, snapshot health endpoint, and final direct fingerprint all report
exact digest `8dc78efc13ed68be287f46113dec3dcbf9dc3763c1d30a6c72e5ccb437b13884`
and exactly 151 files. The browser had `requestPaint`, produced no page errors,
restored application focus after the arc, and moved from menu row 7 to row 6 on
the subsequent ArrowUp.

Mutation command:

`W7_SOURCE_COMMIT=d66c66bfdc8d1e284739dc3ecf73ac80b537e4fa W7_PROVENANCE_PLANT=MIDRUN bun run scripts/w7-browser-evidence.ts`

The plant confirmed its write, then failed source identity: expected
`8dc78efc…/151`, received `bdd58ebb…/151`. The reviewer can reproduce both the
green proof and this red control from the named source.

The committed JSON is also parsed through `parseW7BrowserEvidence`. Deleting
`reviewedCommit` made the committed-artifact test fail with “W7 reviewedCommit
must be a lowercase 40-character Git object id”; deleting `reviewedTree` failed
independently with the corresponding reviewedTree error. Malformed and
well-formed-but-mismatched identities have separate deterministic gates.
