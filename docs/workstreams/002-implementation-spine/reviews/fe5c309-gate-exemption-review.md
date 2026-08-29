# Review: fe5c309 — canonical evidence-path naming exemption

## Verdict: REQUEST_CHANGES

### Correctness Check

- Source of truth: `AGENTS.md`; `scope.md`; `dispatch/W5-gates.md`; `review-system-prompt.md` (D-038, D-058, D-064); `strict-critique`; `global-patterns`.
- Correctness target: scripts may name a real bookkeeping artifact path, while comments, prose, product code, noncanonical paths, and malformed paths remain subject to naming hygiene.
- Dispatch scope: commit `fe5c309` only; `scripts/gate-core.ts` and `scripts/gates.test.ts` only.
- Dependency/HITL status: no library/runtime assumption was needed; TypeScript literal handling and gate behavior were tested through the real `runStaticGates` boundary. U14/U15 are unrelated manual gates and do not affect this verdict.
- Git history/staging: two-file commit, no trailers. Review left uncommitted because the verdict requests changes.

### Findings

- **[MAJOR] The purported canonical-path exemption accepts traversal and malformed artifact paths.** (`scripts/gate-core.ts:79`, `scripts/gate-core.ts:507`) — `[a-z0-9._/-]+` permits `..`, `.`, and repeated separators after the allowed artifact directory. In an immutable archive of `fe5c309`, each of these script literals made `NAMING` pass:
  - `../docs/workstreams/002-implementation-spine/evidence/../../../../packages/product/implementation-spine.ts`
  - `../docs/workstreams/002-implementation-spine/evidence//implementation-spine.json`
  - `../docs/workstreams/002-implementation-spine/evidence/./implementation-spine.json`

  The first resolves outside the bookkeeping tree and can hide the exact implementation-name leakage the gate owns; the latter two are not canonical paths. The committed test asserts one accepted example and one rejected comment (`scripts/gates.test.ts:103-124`) but never plants traversal or malformed segments, so all repository gates remain green for the wrong reason. Require a canonical, segment-aware predicate (and tests proving the edit landed) rather than a character-class approximation. A Critical or Major finding requires `REQUEST_CHANGES`.

### Verified controls

- Canonical paths passed with single quotes, double quotes, and no-substitution template literals.
- Comments, prose-wrapped paths, product-code paths, interpolated templates, and unsupported artifact directories failed.
- A malformed workstream slug (`002-`) and an empty artifact filename failed.

### Gates I ran myself

- Immutable `fe5c309` adversarial suite: **5 passed / 3 failed**; failures were traversal, doubled separator, and dot segment. Each plant asserted its exact source was written before invoking `runStaticGates` (D-064).
- `bun test scripts/gates.test.ts`: **50 passed / 0 failed**.
- `bunx tsc --noEmit -p scripts/tsconfig.json`: passed.
- `bun run lint`: passed.
- `bun run gates`: **16 automated passed / 0 failed; U14 and U15 manual**.
- `bun run build`: passed (client and SSR).

### D-038 questions

- The finding does not contradict the method used elsewhere: valid-path and rejection controls exercised the same public gate boundary as the failing plants.
- The reason supports the verdict directly: a path that resolves outside `docs/workstreams/**` is accepted as bookkeeping, violating the exemption's stated boundary; this is not merely an alternate route to the same conclusion.

### Neuve Dogfood Feedback

- Unavailable and intentionally not invoked: `AGENTS.md` states this repository has no Neuve shell or Kanban board.

---

# Re-review — 0bc1f02

## Verdict: REQUEST_CHANGES

The original Major is partly closed: all three exact bypass plants now fail, and the segment predicates reject the tested malformed initiative names, empty/malformed filenames, unsupported directories, and nested traversal variants. Valid top-level evidence, review, decision, and diary paths pass with single quotes, double quotes, and no-substitution template literals. Two blocking defects remain.

### Findings

- **[MAJOR] Interpolated template text is still invisible to the naming gate, so it bypasses the new canonical-path predicate entirely.** (`scripts/gate-core.ts:154-171`, `scripts/gate-core.ts:529-534`) — `authoredText()` records `StringLiteralLike` and JSX text but not `TemplateHead`, `TemplateMiddle`, or `TemplateTail`. This plant was asserted byte-for-byte before execution and made `NAMING` pass:

  ```ts
  const root = '..'
  export const p = `${root}/docs/workstreams/002-implementation-spine/evidence/../../packages/implementation-spine.ts`
  ```

  The forbidden text lives entirely in the template tail, so `isCanonicalBookkeepingPath()` never runs. This is a direct alternate-literal route around the guard, not a false positive or an unsupported syntax corner. Existing `scripts/browser-gate-mutations.ts` and `scripts/browser-gates.ts` use the same interpolated-path shape, proving the parser gap is reachable in normal repository code.

- **[MAJOR] The replacement rejects valid nested bookkeeping evidence that exists in this workstream.** (`scripts/gate-core.ts:86-104`) — the hard `segments.length !== 5` rule only permits a file immediately inside `evidence`, `reviews`, `decisions`, or `diary`. The valid control `../docs/workstreams/002-implementation-spine/evidence/w5b-browser/browser.json` fails `NAMING`, while `docs/workstreams/002-implementation-spine/evidence/w5b-browser/**` is an existing canonical evidence tree and the W5 dispatch excludes bookkeeping paths generally, not only one-level paths. This regression is currently masked because those production script paths are interpolated templates and therefore hit the first Major. Fixing template scanning without fixing canonical nested segments would make the repository's legitimate evidence writers fail.

### Adversarial matrix

- **Closed:** original traversal, doubled separator, and dot-segment bypasses.
- **Passed controls:** top-level `evidence`, `reviews`, `decisions`, and `diary`; single/double/no-substitution-template quoting; multi-dot canonical filename.
- **Rejected correctly:** comments, prose-wrapped paths, product-code paths, three nested attacks, six malformed initiative names, seven empty/malformed filename forms, four unsupported directories, and Unicode-escaped malformed traversal.
- **Still broken:** interpolated-template traversal passes; valid nested evidence fails.

### W7 provenance/schema regression check

- **Effective.** `scripts/w7-browser-evidence-schema.test.ts` reconstructed the committed source fingerprint from the reviewed commit/tree and independently rejected deleted or malformed commit/tree IDs, a different well-formed commit, a different well-formed tree, a wrong digest, and a wrong source-file count.
- `scripts/w7-browser-evidence-type.test.ts` still requires both identity fields.

### Gates I ran myself

- Immutable `0bc1f02` adversarial suite: **27 passed / 2 failed**; every plant asserted its exact source before invoking `runStaticGates` (D-064).
- Focused gate + W7 provenance/schema/type tests: **62 passed / 0 failed**.
- `bunx tsc --noEmit -p scripts/tsconfig.json`: passed.
- `bun run lint`: passed.
- `bun run gates`: **16 automated passed / 0 failed; U14 and U15 manual**; repository suite **928 passed / 0 failed**.
- `bun run build`: passed for client and SSR.

### D-038 questions

- The method is internally consistent: both failures were measured through the same public `runStaticGates` boundary as the passing controls, from an immutable archive of `0bc1f02`.
- The reasons support the conclusions directly: one authored syntax form is not visited at all, and one path already represented in the repository is rejected by the exact segment-count condition. The green repository gate is therefore explained by the interaction between the two defects, not evidence against either one.

---

# Final re-review — through 33484c6

## Verdict: REQUEST_CHANGES

The two round-two Majors are substantially corrected: ordinary interpolated templates are inspected, canonical nested evidence is accepted, every original bypass remains closed, and W7 provenance/schema enforcement remains intact. Two adversarial split-template forms still evade `NAMING`, so the gate is not yet approvable.

### Findings

- **[MAJOR] Unknown expressions can carry one half of forbidden authored vocabulary while the template reconstruction deletes that half.** (`scripts/gate-core.ts:201-210`, `scripts/gate-core.ts:245-269`, `scripts/gate-core.ts:280-284`) — an expression the evaluator cannot reduce becomes `TEMPLATE_EXPRESSION_MARKER`, and `contentFindings()` then removes every marker before matching. The expression's own string literals are scanned separately, but fragments are never recombined with the surrounding quasi. This asserted plant made `NAMING` pass:

  ```ts
  const flag = process.env['FLAG']
  export const name = `${flag ? 'implementation' : 'safe'}-spine`
  ```

  Neither the standalone literal `implementation` nor the standalone quasi `-spine` matches; together they author `implementation-spine`. This is the requested unknown-expression split and a direct bypass of the naming invariant.

- **[MAJOR] File-global name aggregation makes valid lexical shadowing disable constant reconstruction.** (`scripts/gate-core.ts:213-242`) — `staticStringBindings()` groups declarations only by identifier text across the entire source file and refuses every name with more than one initializer, without respecting lexical scope or which binding the template references. This asserted plant made `NAMING` pass:

  ```ts
  { const part = 'safe' }
  const part = 'implementation'
  export const name = `${part}-spine`
  ```

  The unrelated block-scoped declaration causes `part` to remain unresolved; the marker is removed, leaving only `-spine`. Ordinary shadowing therefore becomes a reliable way to bypass a guard that claims to reconstruct `const` expressions.

### Final adversarial matrix

- **Closed:** all three original bypasses; interpolated traversal; nested traversal; dot segments; repeated separators; evidence-to-review and evidence-to-package escapes.
- **Valid controls passed:** top-level evidence/review/decision/diary; `evidence/w5b-browser/**`; deeper canonical evidence; single quotes; double quotes; no-substitution templates; one unknown dynamic root; multi-dot filenames.
- **Rejected correctly:** sixteen malformed/escaping path forms, including malformed workstream names, unsupported directories, nested paths outside evidence, malformed subdirectory segments, empty filenames, malformed filenames, and workstream escapes.
- **Template splits rejected correctly:** literals, resolvable `const` concatenations, and unknown gaps splitting `implementation-spine`, `workstream`, and `002` across quasis.
- **Still broken:** conditional unknown expression carrying one fragment; shadowed `const` binding carrying one fragment.

### W7 provenance/schema regression check

- **Effective.** The focused suite reconstructed the committed source fingerprint from the reviewed Git commit/tree and rejected deleted or malformed identity fields, a different valid commit, a different valid tree, a wrong digest, and a wrong file count.
- The producer type test still requires both `reviewedCommit` and `reviewedTree`.

### Concurrent W4 distinction

- The verdict above is based only on immutable `33484c6` naming plants and W7 gate tests. It does **not** count concurrent W4 files or seam behavior against this lane.
- In this exact snapshot, `bun test packages/device` reproduced **86 passed / 0 failed**, so the previously reported concurrent W4 seam failure did not occur. If it recurs while W4 is being edited, it remains W4-owned and does not change either gate finding.

### Gates I ran myself

- Immutable `33484c6` adversarial naming suite: **30 passed / 2 failed**; every plant asserted its exact source before invoking `runStaticGates` (D-064).
- Focused gate + W7 provenance/schema/type tests: **63 passed / 0 failed**.
- `bunx tsc --noEmit -p scripts/tsconfig.json`: passed.
- `bun run lint`: passed.
- Current repository suite observed during `bun run gates`: **934 passed / 0 failed**; the command's aggregate tail was not used as approval evidence because the two immutable adversarial plants independently fail.
- `bun test packages/device`: **86 passed / 0 failed**.
- `bun run build`: passed for client and SSR.

### D-038 questions

- The method is internally consistent: passing and failing cases use the same `runStaticGates` boundary from an immutable commit archive, and each plant verifies its own write before measuring the gate.
- The reasons directly support `REQUEST_CHANGES`: both source programs author a forbidden complete term, and the gate passes only because its reconstruction discards information or conflates lexical bindings. Repository-green tests do not answer those two cases.

---

# Final gate re-review — through 9e3ce3f

## Verdict: REQUEST_CHANGES

The exact conditional-unknown and lexical-shadowing plants from the prior review now fail correctly, as do the added block, ordinary-function, loop, nested-template, and conditional-`const` variants. Canonical evidence paths remain green. Two unmodeled lexical binders still let the same forbidden split pass.

### Findings

- **[MAJOR] A concise arrow-function parameter is not treated as a lexical binding, so an outer `const` is resolved in its place.** (`scripts/gate-core.ts:208-215`, `scripts/gate-core.ts:242-246`, `scripts/gate-core.ts:256-263`) — `lexicalScope()` walks through a concise arrow function because it recognizes neither function-like nodes nor their expression bodies as scopes. The parameter guard only runs when the selected scope is a block whose parent is function-like. This asserted plant made `NAMING` pass:

  ```ts
  const part = 'safe'
  export const fn = (part: string) => `${part}-spine`
  ```

  The template's `part` resolves to the outer `safe`, producing `safe-spine`; at runtime it refers to the arrow parameter and can author `implementation-spine`. This is a nested-function scope bypass, not dynamic vocabulary that the source never exposed.

- **[MAJOR] A `catch` parameter is not treated as an opaque binding, so the resolver again falls through to an unrelated outer `const`.** (`scripts/gate-core.ts:208-215`, `scripts/gate-core.ts:223-253`) — the catch body is recognized as a block, but `directConstBinding()` only checks parameters when that block belongs to a function. It never checks `CatchClause.variableDeclaration`. This asserted plant made `NAMING` pass:

  ```ts
  const part = 'safe'
  try { throw 'implementation' } catch (part) { void `${part}-spine` }
  ```

  The runtime binding is the catch parameter, while static reconstruction incorrectly uses the outer `safe`. Ordinary lexical syntax therefore remains a deterministic bypass.

### Adversarial matrix

- **Closed:** the exact prior conditional-unknown and duplicate-name shadowing plants; nested blocks; block-bodied functions; `for…of`; ordinary `for`; `while`; nested templates; conditional `const`; unknown gaps; all original path and interpolated-traversal bypasses.
- **Path attacks closed:** traversal, dot/repeated separators, cross-category/workstream escapes, malformed workstream names, malformed nested segments/files, unsupported directories, and non-evidence nested bookkeeping paths.
- **Canonical controls stayed green:** evidence/review/decision/diary; `evidence/w5b-browser/**`; deeper nested evidence; single/double/no-substitution literals; unknown dynamic root; canonical paths held in a `const`; conditional alternatives between two canonical evidence paths.
- **Conservative safe controls stayed green:** ordinary conditional labels, nested safe shadowing, and an unrelated unknown interpolation.
- **Still broken:** concise arrow parameter; catch parameter.

### W7 provenance/schema regression check

- **Effective.** Focused tests reconstructed the committed source fingerprint and rejected missing/malformed commit and tree IDs, a different valid commit, a different valid tree, a wrong digest, and a wrong file count.
- The producer type continues to require both `reviewedCommit` and `reviewedTree`.

### Concurrent W4 distinction

- The immutable gate verdict above does not use W4 state. During this review, `bun test packages/device` reproduced W4 calibration archive failures while gate-focused tests remained green; a later aggregate run showed the same concurrent class as **932 passed / 1 failed / 1 error**.
- `bun run gates` therefore reported **15 automated passed / 1 failed**, with only `TESTS` red. `NAMING`, `TYPES`, `LINT`, W7 provenance/schema tests, and every other static gate passed. The W4 failure is explicitly outside this lane and neither causes nor excuses the two gate Majors.

### Gates I ran myself

- Immutable `9e3ce3f` adversarial suite: **44 passed / 2 failed**; every source plant was asserted before `runStaticGates` (D-064).
- Focused gate + W7 provenance/schema/type tests: **64 passed / 0 failed**.
- `bunx tsc --noEmit -p scripts/tsconfig.json`: passed.
- `bun run lint`: passed.
- `bun run build`: passed for client and SSR.
- `bun run gates`: naming/type/lint gates passed; aggregate tests failed only on concurrent W4 work as detailed above.

### D-038 questions

- Passing and failing cases use the same immutable `runStaticGates` boundary, with exact source verification before measurement. The concurrent W4 failure is separately attributed and is not evidence for either gate conclusion.
- The reasons directly support `REQUEST_CHANGES`: both runtime bindings are lexically closer than the outer `const`, yet the resolver selects the outer value. The resulting green gate is caused by incorrect scope resolution.

---

# Final gate re-review — through 2ef480c

## Verdict: APPROVE

No Critical, Major, or Minor findings remain in this lane. The cumulative fix preserves canonical bookkeeping references while rejecting every tested naming bypass across paths, templates, and lexical binding forms. W7 provenance/schema enforcement remains effective.

### Binding-form matrix

- **29/29 forbidden plants rejected** through the public `runStaticGates` boundary.
- Arrow and function parameters: concise bodies, block bodies, identifiers, object/array destructuring, defaults, and rest parameters.
- Catch bindings: identifiers and destructuring.
- Loops: `for`, `for…in`, `for…of`, and nested `while` blocks.
- Block bindings: `const`, `let`, and destructured `const`.
- Imports: default, named alias, namespace, and import-equals.
- Named scopes: function declaration/expression, class declaration/expression, method parameters, and constructor parameter properties.
- Lexical shadowing: nested blocks, functions, classes, loops, concise arrows, catch clauses, and outer-`const` collisions.
- Conditional interpolation: unknown conditional branches, conditional `const` values, nested templates, and unknown gaps splitting `implementation-spine`, `workstream`, and `002`.

### Path and conservative-control matrix

- **19/19 path attacks rejected:** original traversal, dot/repeated separators, nested traversal, category/workstream escapes, malformed workstream names, malformed nested segments/files, unsupported directories, and non-evidence nested bookkeeping.
- Interpolated traversal remains rejected.
- **11/11 canonical evidence controls passed:** evidence/review/decision/diary; `evidence/w5b-browser/**`; deeper nested evidence; single/double/no-substitution literals; unknown dynamic roots; a canonical path held in `const`; conditional canonical alternatives; canonical evidence paths rooted in arrow and catch parameters.
- **5/5 conservative safe controls passed:** ordinary conditional labels, safe lexical shadowing, unrelated unknown interpolation, safe arrow parameters, and safe catch parameters. The conservative unknown-expression handling did not create a false positive in the canonical or ordinary-safe matrix.

### W7 provenance/schema regression check

- **Effective.** The focused suite reconstructed the committed browser-source fingerprint from its reviewed commit/tree.
- Missing or malformed commit/tree IDs, a different valid commit, a different valid tree, a wrong digest, and a wrong file count were all rejected.
- The producer type still requires both `reviewedCommit` and `reviewedTree`.

### Gates I ran myself

- Immutable `2ef480c` adversarial suite: **65 passed / 0 failed**; every plant asserted its exact source before invoking `runStaticGates` (D-064).
- Focused gate + W7 provenance/schema/type tests: **65 passed / 0 failed**.
- `bunx tsc --noEmit -p scripts/tsconfig.json`: passed.
- `bun run lint`: passed.
- `bun run gates`: **16 automated passed / 0 failed; 939 repository tests passed; U14/U15 remain correctly manual**.
- `bun run build`: passed for client and SSR.

### D-038 questions

- The review method is internally consistent: forbidden, canonical, and safe controls all use the same immutable `runStaticGates` boundary and verify their source plants before measurement.
- The evidence now supports approval directly: every previously demonstrated bypass is red, legitimate canonical evidence remains green, conservative handling is bounded by safe controls, and independent W7 identity mutations remain red.
