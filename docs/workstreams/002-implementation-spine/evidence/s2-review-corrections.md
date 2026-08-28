# S2 strict-review corrections — credential-free verification

This artifact records the correction pass for the five Major and one Minor
findings in `reviews/s2-review.md`. No Apple credential was read or minted and no
network request was made.

## Boundary and request-budget proof

```text
$ bun run scripts/spikes/probe-apple.ts --request-plan
{
  "anonymousPreflight": 5,
  "credentialSanity": 1,
  "row20": 9,
  "row21": 4,
  "enumeration": 17,
  "total": 36
}

$ bun test scripts/spikes/probe-apple.test.ts
12 pass
0 fail
19 expect() calls
```

The tests pass the concrete `Request` through the same `sendReadOnly()` boundary
used by the live probe. POST, PUT, PATCH, DELETE, exact `/v1/me`, three
descendants, and an encoded `/v1/%6de` spelling all throw before the fake
transport is called. A catalog GET reaches the fake transport exactly once. The
request-budget test locks every phase and the 36-request total.

## Static checks

```text
$ bunx tsc --noEmit -p scripts/tsconfig.json
exit 0

$ bunx eslint scripts/spikes/probe-apple.ts \
    scripts/spikes/probe-apple.test.ts \
    scripts/spikes/mint-apple-dev-token.ts
exit 0
```

## Documentation corrections

- Historical tables are now labelled as redacted extractions, not a retained
  raw transcript.
- A fresh opted-in rerun can emit complete redacted response bodies.
- Header claims not captured by the instrument were withdrawn.
- Only mutable DER bytes are described as explicitly zeroed; immutable PEM and
  base64 strings are accurately described as garbage-collected.
- Row 21c separates verified relationship existence, likely timing semantics,
  and an unverified response format.
- The mixed `55b34dd` provenance is disclosed and an owner-only, recoverable
  history-split procedure is prepared without rewriting history.
