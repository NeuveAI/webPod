# W7 composite review mutation evidence

Every mutation was first confirmed in `git diff`, then run, then restored.

| Reviewer mutation | Gate | Red result |
|---|---|---|
| Replace mounted `arcStart`, `arcMove`, `arcEnd` forwards with no-ops | `bun test packages/composite/src/CompositeDevice.integration.test.tsx` | 0 pass / 1 fail; highlight expected `> 0`, received `0` |
| Replace elapsed frame seconds with `1 / 60` | targeted runtime elapsed-frame test | 0 pass / 1 fail; 15Hz and 240Hz reducer speeds both `1353.6` |
| Change `WHEEL_IDLE_MS` from 120 to 20 | targeted 120ms boundary test | 0 pass / 1 fail; expected `120`, received `20` |
| Remove application-focus restore on arc end | mounted integration test | 0 pass / 1 fail; active element was `BODY`, not the application |

The unmutated scoped suite is 41 passing after the elapsed-frame test was added.

