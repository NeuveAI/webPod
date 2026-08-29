# W7 flagged-browser provenance

Runner: `bun run scripts/w7-browser-evidence.ts`.

The runner starts a fresh Vite server on 3017 and a fresh temporary Chrome
profile on CDP 9337, explicitly enabling `CanvasDrawElement`. It waits for the
real `/_probe/composite` route to resolve T1, focuses the application, performs
a real mouse arc over the canvas, and sends an Arrow key after release. It kills
both processes and removes the temporary profile in `finally`.

The before/after SHA-256 fingerprints are identical. They cover 151 runtime
files under `apps/web/src`, all packages, lock/package inputs, Vite config, and
the fingerprint implementation. The browser had `requestPaint`, produced no
page errors, restored application focus after the arc, and moved from menu row
7 to row 6 on the subsequent ArrowUp.

The runner itself is committed so the same reviewer can reproduce the result.

