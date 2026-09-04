# 003 — Review lanes

## D0 certificate/runtime portability

- Verify Node and Bun compatibility, relative-path normalization, no hardcoded shipped default, no client-reachable key access, and no credential logging.
- Re-run typecheck, lint, build, signer tests, client boundary scan, and a sanitized live endpoint status check.

## D1 playback/data truth

- Antagonistically test stale async events, repeated dwell, route changes, duplicates, current playback preservation, rejected/time-out playback, and artwork fallback.
- Reject any private MusicKit API, direct protected-media fetching, false buffer-depth claim, or error screen that erases selected metadata.

## D2 presentation

- Compare canonical-size captures against the workstream correctness contract in both colourways and relevant reduced-motion/contrast modes.
- Reject oversized text, more than one list geometry, persistent non-overflow rail, fixture art presented as live data, and inaccessible selected text.

## Severity gate

- Critical: credential exposure/client signing, private protected-media access, destructive queue mutation during active playback, or a regression that prevents navigation.
- Major: wrong song identity, failure erases metadata, dwell violates 700 ms/stale rules, default fixture data leaks into Apple UI, list density/overflow contract fails, or accessibility regression.
- Minor: bounded polish or evidence gaps that do not misrepresent state.
- Approval requires 0 Critical and 0 Major. Implementers remain available through re-review.
