# Decision: one canonical panel list foundation

## Status

Accepted after owner visual rejection on 2026-09-03.

## Context

The first navigation implementation routed sibling collections through three
independent renderers: menu rows, generic browser rows and nested track rows.
Shared screen identifiers also caused the Albums collection to be mistaken for
an album-track screen. The result was visibly different padding, separators,
selection material and preview behavior across sibling screens.

## Decision

- Typed route identity, not `screenId`, selects collection versus nested-track presentation.
- Every collection uses exported `ListViewport` and `ListRow` primitives.
- `ListViewport` alone owns the 183 px available height, authoritative visible window, optional 168/104 split, overflow clipping and Aqua rail.
- `ListRow` alone owns row geometry, truncation, semantic current state and Aqua selection material.
- Preview is an optional slot beside the same viewport. Preview copy derives from the current frame row.
- Loading, empty and error content replace the viewport body without changing title or outer geometry.

## Rejected alternatives

- Per-screen CSS corrections: they preserve parallel markup and allow the same regression to recur.
- A wrapper around existing menu/browser/track rows: it creates nominal reuse without one geometry or material source.
- Dispatch by `screenId`: multiple typed routes legitimately share screen identifiers.
