# 003 — Dependency graph

```text
D0 cert/runtime fix ───────────────────────────────┐
                                                   ├─> D3 integration + owner validation
D1 playback/data truth + dwell preparation ───────┤
                                                   │
D2 Aqua/list presentation ─────────────────────────┘

D4 THREE.Clock cleanup ─┐
D5 static-gate repair ──┴─> closeout, after P0 capacity
```

D1 and D2 are intentionally parallel: D1 owns behavior/provider/panel orchestration; D2 owns shared list primitives and their CSS. Their dispatch packets prohibit crossing that boundary. D3 starts only after both independent reviews resolve all Critical and Major findings.
