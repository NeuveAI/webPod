# Playback investigation and implementation

Read-only provider research established that artist All requires ordered album flattening for both providers. Sources and endpoint limits were delivered to lead before implementation.

After user steering added audible-playback/UI divergence, isolated ownership was assigned for manager.ts, manager.test.ts and playback-recovery.test.ts. Reproduced an Apple event-order failure without authentication, a browser, or playback mutation: a loading snapshot followed by a native playing snapshot and only playbackTimeDidChange leaves the shared manager loading. The provider snapshot was playing at 4000 ms; the manager snapshot was loading at 4000 ms with no intent.

Changed shared progress handling to reconcile a changed native transport snapshot even when no selection intent is pending. Existing selection identity/occurrence checks, pause admission, account epochs and disposal guards still apply. A last-native-transport comparison avoids per-tick transport events and queue reads while the clock alone advances.

Added direct Apple adapter and Spotify adapter/subscriber-gap regressions through the panel's managed presentation projection, plus shared tests for loading/playing/paused/error transitions, stale selection metadata, clock-only event budgets and retained callbacks after deactivation.

The reported screenshot's 0:00 specifically is not uniquely attributed to this reproduced path: the no-intent reproduction retains the advancing clock while stuck loading. Existing pending-intent tests exercise zero-clock presentation and stale identities. Retained HMR controller versus module-local manager ownership is a plausible additional risk; it was not changed without a bounded causal reproduction.

No commits, branch switches, credentials, encrypted design files, or live authenticated browser actions were used.

Reviewer then identified that navigation's full-load-before-play chain would lose Spotify's trusted gesture and allow stale delayed selection. Lead assigned manager-owned playProgressive in the same isolated files; navigation implementer wires it. The method synchronously calls play on the visible prefix and separately extends only the matching confirmed queue. It checks completion prefix identity, epoch/generation, and a queue mutation revision, and calls the provider once per suffix item so a superseding intent can stop the remaining append sequence. Tail errors leave the prefix audible. Tests cover sync invocation, position-zero staying pending until progress, newer play/pause/mutation/deactivation, stale prefix completion, load failure and supersession during one accepted append.

Independent reviewer caught foreground starvation in the first continuation implementation: one ordered command held the entire append loop. Fixed by admitting each append separately. A held-first-append regression proves foreground seek executes before the second append. This preserves existing command ordering while yielding between remote calls.
