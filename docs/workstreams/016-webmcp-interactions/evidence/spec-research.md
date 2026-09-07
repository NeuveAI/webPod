# WebMCP source and verification packet

Research date: 2026-09-07. Research is read-only except this evidence file and the explicitly authorized Bun dependency installation in the external reference eval checkout. No credentials or other workstreams inspected.

## Canonical sources and revision agreement

- `/Users/vinicius/code/.better-coding-agents/resources/webmcp/index.bs`, local revision `7b3f50f31848b529e69bedbbdf8da0edccba055f` (2026-09-03).
- Official published draft: https://webmachinelearning.github.io/webmcp/ dated September 4, 2026; remote HEAD verified with `git ls-remote https://github.com/webmachinelearning/webmcp.git HEAD` as `50c4b7fd6c4402731271649bc544b662b061ed44`.
- `curl -fsSL https://raw.githubusercontent.com/webmachinelearning/webmcp/50c4b7fd6c4402731271649bc544b662b061ed44/index.bs | diff -u /Users/vinicius/code/.better-coding-agents/resources/webmcp/index.bs -` produced no differences. Local spec text exactly matches remote HEAD. Target this draft; do not substitute legacy API snippets.
- `/Users/vinicius/code/.better-coding-agents/resources/webmcp-tools`, revision `e747da2eb907e50a6814279a64607d02b961cd8d` (2026-09-04), supplies tooling and examples, not a competing normative API contract.

## API contract

Canonical section locations below refer to `webmcp/index.bs`.

- Lines 598–646: `document.modelContext`, not `navigator.modelContext`; Window-only secure-context API. `registerTool(tool, options)` returns `Promise<undefined>`. Await registration and handle rejection.
- Public cleanup uses the registration `AbortSignal`; there is no public `unregisterTool` in this revision. Registration options are `signal` and `exposedTo`.
- Lines 646–725: unique names, 1–128 ASCII alphanumeric/underscore/hyphen/dot characters; nonempty description; JSON-serializable input schema. Duplicate registration rejects. Browser checks active document, origin-keyed agent cluster and `tools` permissions policy.
- Lines 1060–1169: required `name`, `description`, `execute`; optional `title`, `inputSchema`, `annotations`. Callback shape is `execute(inputObject, {signal}): Promise<any>` in WebIDL. Application TypeScript should narrow unknown input and return explicit JSON-safe app results.
- Annotations are `readOnlyHint`, `untrustedContentHint`, `consequentialHint`, default false. Older MCP `destructiveHint`/`idempotentHint` are not this dictionary.
- Lines 466–540: platform JSON-serializes callback return values. Plain serializable object results are valid. Neither MCP `content`/`isError` envelopes nor `outputSchema` are required native registration fields.
- Execution cancellation reaches callback `options.signal`; app must cooperatively stop paced navigation and pending side effects. Caller cancellation rejects execution and ignores late settlement. Registration cleanup and invocation cancellation are distinct signals.
- Browser-side execution is `getTools()` followed by `executeTool(registeredTool, inputObject, {signal?})`; the resulting value is a JSON string.
- No `requestUserInteraction` exists in this draft. Tool callbacks do not become trusted human DOM events.
- Runtime argument validation remains the application's responsibility. Validate finite numbers, integral counts, enums, extra fields and ranges even when JSON Schema describes them.

## Type strategy and repo baseline

At research start `packages/tools/src/index.ts` was a placeholder; no WebMCP dependency or registration existed in app/package sources or `bun.lock`. Thus there was no installed protocol type authority in this repo.

The reference `webmcp-evals/package.json` declares `webmcp-types ^0.1.3`. Its installed definitions must be inspected before reuse; the draft WebIDL above has precedence if this external package differs. Prefer direct reuse of correct canonical package types. Otherwise use a minimal explicitly sourced boundary interface with unknown input, JSON-safe output and contract tests against the exact current API; do not silently adopt legacy navigator registration types or duplicate application state shapes. The installed-type comparison is recorded below once dependency installation completes.

Installed comparison completed: `webmcp-evals/node_modules/webmcp-types/index.d.ts`, version **0.1.3**, is not suitable as the complete current-draft type contract:

- `ToolExecuteCallback<T extends Record<string, unknown>>` only takes `input`, omitting execution `{signal}`. It allows synchronous returns via MaybePromise; current WebIDL converts callback results to promises, but our implementation should explicitly return promises.
- `ToolAnnotations` omits `consequentialHint`.
- `ModelContext` omits `executeTool` entirely.
- `RegisteredTool.inputSchema?: string` conflicts with the current draft's `object inputSchema`; `title` is mandatory in these types but optional in the draft dictionary.
- `ModelContextTool.execute: ToolExecuteCallback` refers to the generic without its required type argument, a declaration defect confirmed by TypeScript below.
- Correct overlapping pieces include document.modelContext feature optionality, Promise registration and registration signal/exposedTo. Reusing only those small structural subsets would still require replacing the central callback/tool definitions and global augmentation; therefore avoid adding this package solely for partial reuse.

**Selected type strategy:** a minimal app-owned boundary interface, directly sourced to the exact current `index.bs` dictionaries and methods, with unknown input narrowing and explicit JSON-safe results. Document the reference revision beside it and test registration shape, invocation signal and abort cleanup. Reuse canonical app state/input/orientation types for domain results. Do not claim webmcp-types 0.1.3 compatibility or augment its incompatible callback silently.

Declaration check command, run in the reference eval directory: `bunx --bun tsc --noEmit --skipLibCheck false --lib es2022,dom node_modules/webmcp-types/index.d.ts`. Exit 2: `node_modules/webmcp-types/index.d.ts(56,18): error TS2314: Generic type 'ToolExecuteCallback' requires 1 type argument(s).` This is an upstream declaration defect, not an application test failure.

## Evals and tests

Reference root: `/Users/vinicius/code/.better-coding-agents/resources/webmcp-tools/webmcp-evals` (package version `0.0.4`). Dependencies include `puppeteer-core ^25.4.0`. Initially no node_modules or built dist existed.

Useful paths beneath that directory:

- `src/evaluator/browser.ts`: native Puppeteer `page.webmcp.tools()` and `tool.execute(args)`, execution results and console-error capture.
- `src/evaluator/smokeEvaluator.ts`: deterministic calls and per-step timeout. See correction below: the smoke path discards expected result constraints.
- `src/types/evals.ts`: expectedCall arguments, result, optional calls, nested ordered/unordered sequences.
- `src/test/smokeEvaluator.test.ts`, `browserToolRegistry.test.ts`, `browserIntegration.test.ts`: reference runner tests.
- `src/evaluator/mappers.ts`: schema conversion; removes oneOf/anyOf for model compatibility.
- `examples/pizza-maker/evals.json`: authored suite example.

Use Bun directly in the reference eval directory (substitute the actual server URL and suite path):

```sh
bun install
bun src/bin/webmcp-evals.ts smoke -u http://localhost:3000 -e /absolute/path/webpod-evals.json --chrome-channel chrome-canary --timeout 30000 -v
```

Model-selection eval, only with a configured provider available:

```sh
bun src/bin/webmcp-evals.ts browser -u http://localhost:3000 -e /absolute/path/webpod-evals.json --backend vercel --model <configured-model> --chrome-channel chrome-canary
```

Do not run upstream build/test/run_smoke.sh/run_evals.sh wrappers: these invoke npm and violate repo law. Direct Bun source execution bypasses these wrappers. No credential-requiring model evaluation has been run by this research task.

Installed browser executables report Google Chrome Canary `155.0.8043.0` and Chrome stable `152.0.7977.76`. Runner uses `--enable-features=WebMCP`. This records availability, not yet a successful native tool execution.

Dependency setup evidence: `bun install` in the reference eval directory exited 0, installed 193 packages including `webmcp-types@0.1.3` and `puppeteer-core@25.4.0`, and created a Bun lockfile there by migrating the existing package lock. Bun blocked protobufjs@7.6.1's optional postinstall; it was not authorized or executed. `bun src/bin/webmcp-evals.ts smoke --help` exited 0, confirming source CLI execution works without build wrappers.

Smoke creates a fresh page per case, runs required calls in authored order and skips optional calls. **Correction after deeper implementation inspection:** `appendSmokeSteps` discards authored `expectedCall.result` and `runSmokeTest` only checks execution failure status. Therefore a bare CLI PASS does not verify expected result values. The new browser suite reuses exported `compileSmokeTests`/`runSmokeTest`, then explicitly asserts every authored result using upstream `matchesArgument`. A deliberately wrong position=999 expectation is the negative control. Include result expectations in fixtures and validate them separately; absence of an exception does not prove behavior. Smoke cannot establish SFX, pace, cancellation cleanup, loading-clock truthfulness, interaction parity or races alone: repository unit/integration/browser assertions must establish these.

Native browser observation: Canary `155.0.8043.0` registration accepts the current production tools, but its consumer inspection API still returns serialized string `inputSchema` values and `executeTool` requires serialized argument strings. Passing an object rejects with `UnknownError: Failed to parse input arguments`. The test-only consumer adapter handles that observed browser version; production registration remains the current draft contract. This older consumer transport must not be described as current-draft compliant. See native-evals.md for full evidence.

The runner's static schema file format includes `outputSchema`; that is its interchange format and not evidence of a native registration field. Browser execution understands optional MCP-style envelopes but does not require them.

Spec-linked Web Platform Tests: https://wpt.fyi/results/webmcp. These validate browser implementations rather than application semantics. `demos/shared/webmcp-polyfill.js` in webmcp-tools tracks the document API, but polyfill-only testing is insufficient native conformance evidence; this workstream deliberately uses feature detection instead of a fake native registry.
