# Committed browser archive sticker inputs

2026-09-06. Review found a concrete integration regression: apps/web/vite.config.ts imports scripts/sticker-assets.ts, but the browser archive allowlist omitted both that script and assets/stickers/playworn. Working-tree copies happened to contain them; a clean reviewed-commit archive could not evaluate the asset-copy hook. Previous source fingerprints also omitted the runtime image pipeline and artwork bytes.

## Narrow fix

- Archive the sticker copy script and only assets/stickers/playworn when those paths exist in the reviewed Git tree. This folder contains the sole manifest and sixty immutable print PNGs; no historical design resources are added.
- Current fingerprint includes present sticker pipeline source, manifest and all sixty source PNG bytes. Generated public copies remain outputs and do not change provenance.
- Existing root/snapshot exclusions for cert, env files, docs and encrypted design remain unchanged. No credential contents were opened or copied.

## Tests

`bun test scripts/browser-source-fingerprint.test.ts`:5 passed,0 failed,37 assertions. The committed snapshot test now runs the actual archived sticker-assets.ts hook in a fresh Bun process, returns60, and verifies a generated public URL file against its source bytes. The hook itself verifies every manifest hash before copying. It also verifies generated output does not affect fingerprint and forbidden roots remain absent. Mutation checks independently change copy-script, manifest and PNG bytes, and each changes the current fingerprint. Existing source mutation and metadata identity checks remain.

`bunx --bun eslint scripts/browser-source-fingerprint.ts scripts/browser-source-fingerprint.test.ts`:pass. Test directories are unique mkdtemp paths, distinct from the shared Playwright served snapshot.

## Historical replay boundary

The8507a63 test asserts extraction tolerates a missing pre-sticker pipeline script; it does NOT assert a new fingerprint algorithm agrees with that historical commit's old Vite health helper. Historical browser replay must execute its matching archived Playwright config/helper. Lead explicitly kept mixed-version fingerprint redesign outside this correction. Current source, once committed, archives its matching expanded helper and runtime asset inputs together.

## Runner coordination correction

While reviewer regression was active, editing the live fingerprint helper changed a later Playwright worker's expected hash despite the immutable served snapshot. Reviewer halted and preserved that incomplete run rather than calling it a product failure. Source/helper/tests are now explicitly frozen before the fresh review/regression run; no further edits during browser execution. Only this evidence/diary text (excluded from source fingerprints) was written afterward. Independent source review is required before commit.

## Final independent disposition

Independent reviewer approved the narrow helper fix and completed all13 existing device browser regressions:13/13 passed in1.4minutes, served fingerprint b02745a4073b8135718bc3c3c2665482e90af1f69c81020ddcf5b23df6e757f0 (342files). Details and bounded provenance logs are in verification.md. Lead additionally reports the scripts TypeScript check passed; this is attributed lead verification, not a separate engineer run. No implementation source changed after freeze/review.
