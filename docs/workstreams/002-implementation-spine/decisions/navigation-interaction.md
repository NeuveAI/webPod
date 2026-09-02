# Decisions: navigation and interaction

## N-1 — frame-owned restoration

Prior highlight and scroll position are restored exactly on pop. No replay or
recalculation occurs because both values stay on the preserved stack frame.

## N-2 — relationship data seam

The provider contract exposes entity types, library slices and search but not
browse relationships. Navigation consumes a `NavigationDataSource` containing
only provider-domain entities and LocalKey-based relationship methods. The
fixture adapter implements it synchronously; a real provider may populate the
same seam after its asynchronous fetches settle.

This is an integration gap, not invented provider parity. No capability is
claimed and no provider fact is synthesized.

## N-3 — composite keyboard exact-once

The composite capture bridge marks Center's keydown handled. The bare-panel
fallback observes that mark and does not publish a second selection. Outside a
composite it remains the keyboard activation path.

Canonical state source read: `/Users/vinicius/code/agentic-context/jotai/docs/core/store.mdx` (`createStore`, `get`, `set`, `sub`). The configured skill references under `/Users/vinicius/code/agent-context/` were absent, matching the environment defect already recorded in the tracker.

