# Apple Music provisioning and authorization identity

## Owner-run transfer

Root AGENTS.md prohibits agents from reading/copying `cert/`. The owner runs:

```sh
bun --env-file=.env.local scripts/provision-apple-vercel.ts --upload
```

The script verifies the linked project ID matches `perf-lab/webpod`, validates
the local team/key identifiers and P-256 key, and pipes only the selected values
to `vercel env add` through stdin. Team ID, key ID and PEM use Sensitive variables
for Production and Preview. No secrets appear in command arguments or output.
Existing variables with these names are replaced. Re-running is safe after a
partial failure. The script does not upload files or deploy source.

The local key path may be relative to the repo; the cloud path is configured
under `/tmp`. The server materializes the secret in a uniquely named private
0700 subdirectory, writes a 0600 key file, updates its runtime key path, removes
the PEM environment variable, and deletes the directory during shutdown.
Signing remains in `packages/server-core`. Existing local file-based signing
is unchanged. No key enters Docker build inputs or browser bundles.

After the owner completes the transfer, redeploy and verify `/api/apple/developer-token`
returns 200, no-store/private, a short expiry and a verifiable ES256 token. Never
print or retain its token. Then test actual Apple authorization from the browser;
the user must make the Apple account/consent choices.

## Authorization identity

The official [MusicKit v3 SDK](https://js-cdn.music.apple.com/musickit/v3/musickit.js)
was inspected on 2026-09-09. Its `_thirdPartyInfo` uses `window.location.host`
for `thirdPartyName`, and selects an icon from `apple-music-app-icon` links
(preferring 120x120), then touch-icon links, then configured app icon.
The configured app name is already webPod, but does not replace that hostname.

The document now supplies a public HTTPS 120x120 PNG derived from our existing
favicon. Production uses webpod.vercel.app; localhost continues to identify
itself as localhost. Apple owns the consent layout and permission text. This
does not claim Apple endorsement or suppress the identity of the requesting site.
The popup's final icon rendering still needs a real authorization check.

The landing CTA says “Connect Apple Music” and explains that authorization is
handled by Apple. It distinguishes pre-authorization service unavailability
from an attempted connection or denied permission, rather than saying the user
failed sign-in immediately upon arrival. The Jotai store tracks the attempt.

## Validation

19 focused tests passed, including runtime key permissions/signature/cleanup,
safe invalid-input errors, existing token origin/expiry checks, a Node Web Crypto
compatibility test using the bundled runtime, and welcome action policy.
All 12 TypeScript projects and targeted lint passed. Production build passed.
Only generated test keys were used; the provisioning script was not executed
by the agent. No live credentials were inspected.

Production launcher integration tests additionally passed (3 tests, 135 assertions),
including synthetic secret provisioning through the actual built handler. Live
checks identified Vercel's HTTPS termination: Bun saw HTTP, rejecting an HTTPS
Origin and otherwise binding tokens to HTTP. The Vercel-only transport adapter
now restores HTTPS before passing requests to Start. The integration test checks
the HTTPS token claim and rejects an unrelated origin; typecheck and lint passed.

The public page and 120x120 PNG returned HTTP 200, and Chrome rendered the updated
Connect Apple Music action and explanatory copy. The live token endpoint reports
invalid_configuration until the owner transfers credentials and redeploys.

Final deployment: `dpl_GbyNnZXjGj6gs12j8vDoEnKv4NtA`, READY, Production,
aliased to https://webpod.vercel.app. Live verification: page HTTP 200 with
MusicKit icon metadata, matching HTTPS Origin reaches configuration validation
(503 pending credentials), unrelated Origin remains rejected with 403.
