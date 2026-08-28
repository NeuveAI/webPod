# Dispatch packet — W5 · Correctness gate harness

**Status:** W5a `Ready on W0` · W5b `Blocked by W3` · **Lane:** L-A

The point of this slice: **strictness on this project must be mechanical, not cultural.** 001 §15 hands us gates that are already greppable — turning them into one command is the highest-leverage work in the workstream, because a gate that runs on every slice catches what a tired reviewer does not.

## W5a — `bun run gates` (static)

One script, `scripts/gates.sh`, exiting non-zero on any finding, with a per-check line of output naming the 001 gate id.

| Gate | Check | Source |
|---|---|---|
| **U8** | `grep -rniE '\b(allow\|deny\|denied\|permit\|permission\|granted\|authoris\|authoriz\|approve\|approval\|pending\|blocked\|ask(s\|ed)? (for\|to)\|waiting for)\b'` over source — every hit manually cleared or the check fails | §15.0 U8 |
| **U9** | `grep -rn 'useState'` must be **0**. No exception for "local" or "trivial". | §15.0 U9 |
| **U10** | `grep -rn 'canvas\|useFrame' packages/panel/` must be **0** | §15.0 U10 |
| agent-flag | `grep -rniE 'agentPresent\|agentAttached\|agentIdle\|isAgentConnected'` must be **0** | §15.2 |
| haptics | `grep -rn 'navigator.vibrate'` must be **0** (all haptics route through `web-haptics`) | §15.2 |
| halo | `grep -rniE 'handed\|leftHand\|rightHand'` must be **0** — there is no handedness setting and none is stored | §15.2 |
| provider | `grep -rn 'provider.id ===' --exclude-dir=providers` must be **0** | §15.2 |
| tools | `grep -rniE 'not supported\|unsupported'` in tool return paths must be **0** — an unsupported capability means the tool is **not registered**, never a tool that returns "unsupported" | §15.2 |
| flip | no flip call inside an error handler — **no automatic flip, ever** | §15.2 |
| trailers | no `Co-Authored-By`, `Claude-Session` or "Generated with" in any commit message on the branch | repo law, `AGENTS.md` |
| naming | workstream ids absent from implementation artifacts (bookkeeping paths under `docs/workstreams/` excluded) | `scope.md` |
| types | per-package `bunx tsc --noEmit -p <pkg>/tsconfig.json`, looped, never repo-wide | §15 |

**The acceptance test for this slice is not that the gates pass — it is that they FAIL correctly.** Plant one violation per gate, capture the red output to `evidence/w5a-planted-failures.txt`, then remove them. A gate that has never gone red is not a gate, and this is the first question your reviewer will ask.

## W5b — browser checks (needs W3's routes)

| Gate | Check |
|---|---|
| **U1** | Screenshot pair, light and dark, per state — automated capture, human comparison |
| **U2** | **Greyscale attribution:** `filter: grayscale(1)` on the root; actor identity must remain legible. In 002 there is no agent actor yet, so this establishes the harness and asserts the human channel survives desaturation. |
| **U3/U4/U5** | Emulated `prefers-reduced-motion`, `prefers-reduced-transparency`, `prefers-contrast: more` |
| **U6** | axe/Playwright bounding-box assertion, 44×44 minimum, **zero** violations |
| **U7** | Contrast 4.5:1 body / 3:1 at 18px+, **both colourways**, zero violations |
| **U11** | Dynamic Type to 200%: no clipping, no truncation |
| **U12** | Keyboard-complete traversal; arrow keys exactly one detent, no acceleration; `:focus-visible` never suppressed |
| **U13** | Exactly **1** `aria-live` announcement during a 30-detent flick |

Run everything in the **flag-off baseline browser profile** (`preview-validation.md`). A gate signed off in a Canary with `chrome://flags/#canvas-draw-element` enabled is signed off in a browser almost no user has.

**U14 and U15 are not automatable here.** U14 needs a phone in a hand (owner, H-5). U15 is structural and belongs to reviewer inspection. Say so in the harness output rather than silently omitting them — a gate list that quietly drops two entries is worse than one that prints "owner-only".

## Guardrails
Own `scripts/**` (handed over by W0) and `apps/web/tests/**`. Read everything. **Write no `src/`** — if a gate fails, you report it, you do not fix it.

## Artifacts
`diary/w5.md` · `decisions/w5.md` · `evidence/w5a-planted-failures.txt`, `evidence/w5b-*` · review `reviews/w5-review.md` (lane L-A)

## Commits
`chore: static correctness gates` → `test: browser gate harness`
